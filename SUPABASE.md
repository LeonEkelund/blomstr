# Supabase — the plan

Everything needed to pick up the backend cold. Nothing here is built yet;
this is the map, the reasoning, and the order to do it in.

The load-bearing architecture decisions live in [README.md](README.md#architecture-decisions).
This file assumes them and says how to actually implement them.

> The SQL below is a **sketch**, not tested migrations. Types, constraints and
> policy details will move once you run it. The shapes and the reasoning are
> the part to trust.

---

## 1. How the pieces connect

```
apps/app
  lib/supabase.ts            reads VITE_ env vars, throws if missing
        │
        ▼
packages/supabase            createBrowserClient(url, anonKey)
        │                    anon key only — RLS is the security boundary
        ▼
   Supabase project
        │
        ├── Postgres          tables + RLS + RPC functions
        ├── Auth              users, sessions
        ├── Realtime          live board / comments later
        ├── Storage           small assets only (thumbnails, PDFs)
        └── Edge Functions    Drive sync, publishing, webhooks

supabase/                    migrations + Edge Functions, CLI-managed
        │
        ▼  supabase gen types typescript
packages/types/src/database.ts    generated — never hand-edited
packages/types/src/index.ts       hand-written app types that have no table
```

Two things to keep straight:

**`packages/types/src/index.ts` is hand-written today and will shrink.** Once
the schema exists, `ContentItem`, `Stage` and `Member` come from the generated
`database.ts`. What stays hand-written is only what has no table equivalent —
view models, discriminated unions the DB can't express, UI-only shapes.

**The anon key ships to the browser and that is fine.** It identifies the
project, not the user. RLS is what stops one workspace reading another's rows.
The `service_role` key bypasses RLS entirely and must never appear in
`apps/app` — it belongs only in Edge Functions and, eventually, `apps/admin`
behind its own authorization layer.

---

## 2. Setup, in order

```bash
pnpm dlx supabase init          # creates supabase/config.toml
pnpm dlx supabase start         # local Postgres in Docker
pnpm dlx supabase status        # prints local URL + anon key
```

Put the local URL and anon key in `apps/app/.env` (copy from `.env.example`).
`lib/supabase.ts` throws a clear error if either is missing, so you'll know.

Later, for the hosted project:

```bash
pnpm dlx supabase link --project-ref <ref>
pnpm dlx supabase db push       # apply local migrations to hosted
```

Work locally, push migrations. Never edit schema in the dashboard — the repo
stops being the source of truth the moment you do, and you can't review a
dashboard click in a PR.

---

## 3. The schema

### Enums

```sql
create type content_type as enum (
  'youtube_video','short','tiktok','reel','instagram_post',
  'podcast','livestream','newsletter','thumbnail','sponsored'
);
create type platform        as enum ('youtube','tiktok','instagram','x','linkedin');
create type approval_state  as enum ('draft','in_review','changes_requested','approved');
create type workspace_role  as enum ('owner','member','guest');
create type job_status      as enum ('queued','leased','done','failed','dead');
```

Enums are cheap to add values to (`alter type ... add value`) and impossible to
typo. `content_type` in particular is a row value, not a migration — adding
"carousel" later is one statement.

### Workspaces and membership

```sql
create table workspaces (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  created_at  timestamptz not null default now()
);

create table workspace_members (
  workspace_id uuid not null references workspaces on delete cascade,
  user_id      uuid not null references auth.users on delete cascade,
  role         workspace_role not null default 'member',
  created_at   timestamptz not null default now(),
  primary key (workspace_id, user_id)
);
```

Everything else hangs off `workspace_id`. Put it on **every** table even where
it's derivable — it makes RLS policies a single indexed comparison instead of a
join up the tree.

### Stages

```sql
create table stages (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces on delete cascade,
  name         text not null,
  position     int  not null,
  accent       text
);
```

Per-workspace, so the defaults (Ideas / In progress / Review / Published) are
seeded on workspace creation rather than hard-coded. `position` is an int here
because stages are reordered rarely and by one person; items need fractional
ranks, stages don't.

### Content items — the graph

```sql
create table content_items (
  id              uuid primary key default gen_random_uuid(),
  workspace_id    uuid not null references workspaces on delete cascade,
  parent_id       uuid references content_items on delete cascade,
  ancestor_ids    uuid[] not null default '{}',
  type            content_type not null,
  title           text not null,
  stage_id        uuid not null references stages,
  position        text not null,           -- fractional index, see lib/rank.ts
  due_at          timestamptz,
  publish_at      timestamptz,
  platforms       platform[] not null default '{}',
  source_start_ms int,                     -- clip range into the parent's master
  source_end_ms   int,
  created_by      uuid not null references auth.users,
  created_at      timestamptz not null default now()
);

create index on content_items (workspace_id, stage_id, position);
create index on content_items using gin (ancestor_ids);
```

One self-referencing table for projects *and* derivatives — the decision that
keeps review, publishing, permissions and attribution on one code path. The
board queries `where parent_id is null`.

`position` is the fractional index that `apps/app/src/lib/rank.ts` already
mints. **Two items in the same stage must never share one**, or a drop between
them has no gap to land in and `rankBetween` throws. Worth a partial unique
index:

```sql
create unique index on content_items (stage_id, position)
  where parent_id is null;
```

> ⚠️ `ancestor_ids` is denormalised **and** authorization depends on it. Drift
> is a permission leak, not a data bug. Maintain it in a trigger on insert and
> on `parent_id` change, allow re-parenting only through an RPC, and run a
> periodic consistency check.

**Assignees**: your current `ContentItem.assigneeIds` is an array. In Postgres
prefer a join table — it gives you FK integrity, and "what is assigned to me"
becomes an indexed lookup instead of an array scan.

```sql
create table content_item_assignees (
  content_item_id uuid not null references content_items on delete cascade,
  user_id         uuid not null references auth.users on delete cascade,
  primary key (content_item_id, user_id)
);
```

### Assets and versions

```sql
create table assets (
  id              uuid primary key default gen_random_uuid(),
  workspace_id    uuid not null references workspaces on delete cascade,
  content_item_id uuid not null references content_items on delete cascade,
  kind            text not null,        -- 'drive_file' | 'storage_object' | 'document'
  title           text not null,
  created_at      timestamptz not null default now()
);

create table asset_versions (
  id              uuid primary key default gen_random_uuid(),
  workspace_id    uuid not null references workspaces on delete cascade,
  asset_id        uuid not null references assets on delete cascade,
  version_number  int  not null,
  approval_state  approval_state not null default 'draft',
  drive_file_id   text,                 -- large files stay in Drive
  storage_path    text,                 -- small assets in Supabase Storage
  body            text,                 -- for kind = 'document' (the script)
  created_by      uuid not null references auth.users,
  created_at      timestamptz not null default now(),
  unique (asset_id, version_number)
);
```

**Approval lives here, never on `content_items`.** The project's status is
derived from its latest version — otherwise "approved" is a lie the moment V4
lands.

The **script is an asset** with `kind = 'document'`, so it gets versions and
comments like anything else that gets approved. Notes stay plain columns on the
project; nobody approves a note.

Derive the project's status with a view rather than a column:

```sql
create view content_item_status as
select ci.id,
       coalesce(latest.approval_state, 'draft') as approval_state
from content_items ci
left join lateral (
  select av.approval_state
  from asset_versions av
  join assets a on a.id = av.asset_id
  where a.content_item_id = ci.id
  order by av.created_at desc
  limit 1
) latest on true;
```

The board reads the view for its badge. The client can never write it.

### Comments — one polymorphic primitive

```sql
create table comments (
  id            uuid primary key default gen_random_uuid(),
  workspace_id  uuid not null references workspaces on delete cascade,
  subject_type  text not null,        -- 'content_item' | 'asset_version'
  subject_id    uuid not null,
  anchor        jsonb,                -- {t_ms} video | {x,y} image | null general
  body          text not null,
  author_id     uuid not null references auth.users,
  parent_id     uuid references comments on delete cascade,
  resolved_at   timestamptz,
  created_at    timestamptz not null default now()
);

create index on comments (subject_type, subject_id, created_at);
```

Timestamped video review and pins on a thumbnail are the same table with
different renderers. `anchor` being null is a general comment.

### Events — the spine

```sql
create table events (
  id           bigserial primary key,
  workspace_id uuid not null references workspaces on delete cascade,
  actor_id     uuid references auth.users,
  subject_type text not null,
  subject_id   uuid not null,
  verb         text not null,        -- 'created' | 'moved' | 'approved' | ...
  payload      jsonb not null default '{}',
  created_at   timestamptz not null default now()
);

create index on events (workspace_id, created_at desc);
create index on events (subject_type, subject_id, created_at desc);
```

The approval inbox, the project activity rail, notifications and the audit log
are all queries over this one table. Build it from the start — retrofitting
means backfilling history you no longer have.

**Keep state in tables. Do not event-source.** Events describe what happened;
they are not the source of truth for what *is*.

### Jobs — all external side effects

```sql
create table jobs (
  id              uuid primary key default gen_random_uuid(),
  workspace_id    uuid not null references workspaces on delete cascade,
  kind            text not null,           -- 'publish' | 'drive_sync' | 'metrics'
  payload         jsonb not null default '{}',
  idempotency_key text not null unique,
  status          job_status not null default 'queued',
  attempts        int not null default 0,
  run_after       timestamptz not null default now(),
  leased_until    timestamptz,
  last_error      text,
  created_at      timestamptz not null default now()
);
```

Publishing, Drive sync and metrics pulls never run inline in a request.
**Double-posting to a creator's real audience is unrecoverable**, so the unique
`idempotency_key` is a correctness requirement, not an optimisation.

### Guest grants

```sql
create table guest_grants (
  id              uuid primary key default gen_random_uuid(),
  workspace_id    uuid not null references workspaces on delete cascade,
  user_id         uuid not null references auth.users on delete cascade,
  content_item_id uuid not null references content_items on delete cascade,
  created_at      timestamptz not null default now(),
  unique (user_id, content_item_id)
);
```

Grant a freelancer one podcast episode and they see its clips too — resolved
through `ancestor_ids`, so it's one indexed lookup at any depth rather than
eight grants.

---

## 4. RLS

Every table gets RLS enabled and at least one policy. No exceptions.

The whole thing rests on two helpers:

```sql
create or replace function is_member(ws uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.workspace_members m
    where m.workspace_id = ws and m.user_id = auth.uid()
  );
$$;

create or replace function can_read_item(item content_items)
returns boolean language sql stable security definer set search_path = '' as $$
  select
    public.is_member(item.workspace_id)
    or exists (
      select 1 from public.guest_grants g
      where g.user_id = auth.uid()
        and (g.content_item_id = item.id
             or g.content_item_id = any (item.ancestor_ids))
    );
$$;
```

Then policies are one-liners:

```sql
alter table content_items enable row level security;

create policy read_items on content_items
  for select using (can_read_item(content_items));

create policy write_items on content_items
  for update using (is_member(workspace_id));
```

Two things that bite:

- **`security definer` needs `set search_path = ''`** and fully-qualified table
  names, or it's a privilege-escalation vector.
- **Write the permission function's tests before the policies.** It is the one
  piece where a bug is a data breach rather than a broken screen. This is step
  3 in the README's Next list for a reason.

---

## 5. What goes through RPC

> RLS can check *who you are*. It cannot cheaply express "only from
> `in_review`, only with approve rights, and emit an event atomically."

**Direct from the client** (reads, and writes with no invariant):

- board and project queries
- creating and editing comments
- notes, titles, dates
- **stage/position changes** — a plain update; the fractional rank is computed
  client-side by `lib/rank.ts`

**Through RPC / Edge Functions** (writes with invariants):

| Function | Why it can't be a direct write |
|---|---|
| `approve_version` | State machine + rights check + event, atomically |
| `request_changes` | Same |
| `create_version` | Assigns `version_number`, applies the self-authored rule |
| `publish` | Enqueues a job with an idempotency key; never posts inline |
| `invite_member`, `change_role` | Privilege escalation risk |
| `create_derivative_set` | Multi-row insert with `ancestor_ids` integrity |
| `reparent_item` | `ancestor_ids` drift is a permission leak |

**The client must never be able to set `approval_state` directly.** Revoke
column-level update on it and expose only the RPCs.

The self-authored rule belongs in `create_version`:

> If the author already holds approve rights, the version is created
> `approved`. A creator writing their own script does not approve their own
> work — it is approved by construction. Otherwise the approval inbox fills
> with people approving themselves and stops meaning anything.

---

## 6. Types

After **every** migration:

```bash
pnpm dlx supabase gen types typescript --local > packages/types/src/database.ts
```

Then narrow in `packages/types/src/index.ts`:

```ts
import type { Database } from "./database"

export type ContentItem = Database["public"]["Tables"]["content_items"]["Row"]
export type Stage       = Database["public"]["Tables"]["stages"]["Row"]
```

Note the shape shift: generated types are `snake_case` (`stage_id`,
`publish_at`) while the app currently uses `camelCase`. Either map at the query
boundary or rename in the components — decide once, early. Mapping at the
boundary is usually less churn and keeps components ignorant of the DB.

---

## 7. Migration order

Each step is one migration and should apply cleanly on an empty database.

1. `extensions_and_enums`
2. `workspaces_and_members` — plus `is_member`
3. `stages` — plus the default seed
4. `content_graph` — `content_items`, assignees, `ancestor_ids` trigger
5. `assets_and_versions` — plus the `content_item_status` view
6. `comments`
7. `events`
8. `jobs`
9. `guest_grants` — plus `can_read_item`
10. `rls_policies` — every table, all at once so nothing ships unguarded
11. `rpc_functions` — approval, publish, invites, derivatives

Steps 1–5 unblock the board and the project page. Steps 6–11 unblock review and
publishing.

---

## 8. Replacing the fixtures

What exists in the app today and what takes over:

| Now | Becomes |
|---|---|
| `lib/mock-data.ts` → `stages` | `stages` table, seeded per workspace |
| `lib/mock-data.ts` → `members` | `workspace_members` joined to `auth.users` |
| `lib/mock-data.ts` → `currentUser` | `supabase.auth.getUser()` |
| `lib/mock-data.ts` → `contentItems` | `content_items` table |
| `hooks/use-content.tsx` `useState` | `useQuery` + `useMutation` |
| `moveItem` / `setStage` callbacks | The optimistic update on the mutation |
| `ContentItem.approvalState` | `content_item_status` view |

`ContentProvider` was written so this swap is contained: the board and the
project page consume `useContent()` and don't know where the data comes from.
Replace the inside of that provider, delete `mock-data.ts`, and the components
stay as they are.

`QueryClientProvider` is already wired in `main.tsx` with a 30s `staleTime`.

---

## 9. Things that will bite

- **`ancestor_ids` drift is a permission leak.** Trigger-maintained, RPC-only
  re-parenting, periodic consistency check.
- **Duplicate `position` values break drops.** `rankBetween` throws when
  `before >= after`. Enforce with the partial unique index.
- **Drive ACLs are not your ACLs.** A guest can see a file listed and get
  "Request access" on click. Generate previews server-side with the owner's
  token so viewing never depends on Drive sharing settings.
- **`service_role` bypasses all RLS.** Edge Functions only. Never in
  `apps/app`. `apps/admin` needs its own authorization layer on top.
- **Publishing must be idempotent.** A retry that double-posts to a creator's
  audience cannot be undone.
- **`security definer` without `set search_path = ''`** is an escalation vector.
- **Realtime respects RLS** but every subscription is a connection. Subscribe
  per board, not per card.

---

## 10. Definition of done for the backend phase

- [ ] Local Supabase runs; `.env` set; app boots without the missing-env throw
- [ ] Migrations 1–11 apply cleanly to an empty database
- [ ] Every table has RLS on and at least one policy
- [ ] `can_read_item` has tests, including the guest-cascade case
- [ ] Types regenerate into `packages/types/src/database.ts`
- [ ] The board reads real rows and a drag persists across refresh
- [ ] `mock-data.ts` is deleted
