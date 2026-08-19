# Supabase — the runbook

Step-by-step execution. [SUPABASE.md](SUPABASE.md) is the *plan* and the
reasoning; this file is the *how*, in order, with the exact commands and SQL.

Work through it top to bottom. Every step has a verification — don't move on
until it passes, because a broken migration is far cheaper to find at step 4
than at step 11.

> The SQL here is written to apply cleanly on an empty database but has **not
> been executed** — there's no Docker on this machine to run it against. Expect
> to fix a type or a constraint. The shapes, the order and the reasoning are the
> parts to trust.

---

## Progress checklist

- [ ] 0. Docker Desktop installed and running
- [ ] 1. `supabase init` + `supabase start`, `.env` filled in
- [ ] 2. `01_enums`
- [ ] 3. `02_workspaces` + `profiles` + `is_staff`
- [ ] 4. `03_stages` + default seed
- [ ] 5. `04_content_graph` + ancestor trigger
- [ ] 6. `05_assets_versions` + status view
- [ ] 7. `06_comments`
- [ ] 8. `07_events`
- [ ] 9. `08_jobs`
- [ ] 10. `09_guest_grants` + `can_read_item`
- [ ] 11. `10_rls` — every table at once
- [ ] 12. `11_publish_targets`
- [ ] 13. `12_invites` — guest links
- [ ] 14. `13_rpc` — approval, publish, invites
- [ ] 15. `14_storage` — buckets and their policies
- [ ] 16. `15_realtime` — publication config
- [ ] 17. `16_scheduling` — pg_cron and the job runner
- [ ] 18. Tests — pgTAP, `can_read_item` first
- [ ] 19. Seed a workspace and sign in
- [ ] 20. Generate types
- [ ] 21. Swap `ContentProvider` off fixtures
- [ ] 22. Delete `mock-data.ts`

---

## Decisions taken

Questions the schema couldn't answer on its own. Each is settled below so the
migrations have something concrete to implement. All are reversible — the
reasoning is here so a future you can disagree on purpose rather than by
accident.

### Roles

Four tiers. Two scopes — staff see the workspace, guests see only what they
were granted — and the rest is capability.

| | Owner | Admin | Editor | Guest |
|---|:--:|:--:|:--:|:--:|
| See the whole workspace | ✅ | ✅ | ✅ | granted projects only |
| Create / edit / move projects | ✅ | ✅ | ✅ | ❌ |
| Upload versions, submit for review | ✅ | ✅ | ✅ | ❌ |
| Comment | ✅ | ✅ | ✅ | ✅ on their projects |
| **Approve / request changes** | ✅ | ✅ | ❌ | ❌ |
| **Publish to the real audience** | ✅ | ✅ | ❌ | ❌ |
| Invite a guest to a project | ✅ | ✅ | ❌ | ❌ |
| Edit the workflow (stages) | ✅ | ✅ | ❌ | ❌ |
| Delete projects | ✅ | ✅ | ❌ | ❌ |
| **Add/remove people, change roles** | ✅ | ❌ | ❌ | ❌ |
| Billing, delete workspace | ✅ | ❌ | ❌ | ❌ |

**Editor covers editor, clipper and thumbnail designer.** They all make things
and submit them; that is the only distinction that matters, and splitting them
would multiply policies for no gain.

**Editors cannot approve their own work.** The product's premise is *"the team
produces and the creator approves"*. An editor with approve rights collapses
it.

**Admin is the assistant or manager.** Trusted with the audience and with
editorial sign-off; cannot widen the circle or promote themselves. That last
line is what separates admin from owner.

**Capabilities are derived from the role, not stored.** Two columns that must
agree is a drift bug waiting to happen. If one specific editor ever needs
publish rights, add a nullable override then — `null` meaning "use the role
default". Not before.

> **Owner is per-workspace.** A *platform* admin — you, looking across every
> customer — is a different thing entirely: that is `apps/admin` with
> `service_role`, outside RLS. Never let one word cover both, or somebody will
> eventually grant the wrong one.

### Seats

**Guests are free and unlimited. Staff are the meter.** A sponsor who redeems a
link, comments once and never returns must not consume a paid seat — otherwise
creators learn to avoid inviting sponsors, and that is the feature the product
is built around. `workspaces.seat_limit` counts owner + admin + editor only,
and `create_invite` enforces it including outstanding invites.

`is_staff` already draws exactly this line, which is convenient but not an
accident: it is the same question as "does this person cost anything".

> The **principle** — guests free, staff metered — is settled and expensive to
> reverse. The **number** (`seat_limit` defaults to 1) is an assumption drawn
> from comparable tools, not from this market. Change it freely.

Roles are the only editable thing; capabilities are read-only consequences of
them. Changing a tier goes through `set_member_role`, which refuses to remove
the last owner and clears grants on demotion to guest.

**A thumbnail is both, and the distinction is work vs file.** Making a
thumbnail is a job someone does and someone approves, so it is a derivative
`content_item` with `parent_id` set to the video. The image itself is an
`asset` of that item, with versions. The Publish tab then points at the
approved asset. This keeps the existing fixture — *"Thumbnail A/B — AI video"* —
valid, and it means the designer's work is tracked and reviewable like anyone
else's.

**A user belongs to many workspaces.** `workspace_members` is already
many-to-many; an editor working for three creators is three memberships. The
app resolves a current workspace and persists the choice. No schema change —
just don't build anything that assumes one.

**Staff and guest are the only two scopes — and `is_staff` is what enforces
it.** Redeeming an invite gives a guest a `workspace_members` row, so any check
shaped like *"does this person have a row in this workspace"* would hand a
sponsor the run of the account: every comment, every project, write access to
all of it. Guests are **in** the workspace; they are not **staff**.

Every write policy checks `is_staff`. Guest-visible reads are scoped to the
subject via `can_read_item` / `can_read_subject`, never to the workspace.
`in_workspace` exists for exactly one thing — reading the workspace's name, so
a guest's single project has a heading.

A freelancer accumulating many grants is fine: it's an indexed array lookup,
not a join per grant. If they're around permanently, make them an editor.

**The script autosaves to a draft, and versions are deliberate.** Autosave
writes `assets.draft_body`; "send for review" snapshots that into a new
`asset_versions` row. A version per keystroke would make the review thread
meaningless, and `asset_versions` has no update policy by design.

**A clipper's work lives in *My Tasks*, not on the board.** The board is
`parent_id is null`, so a clip — which always has a parent — never appears on
it. That means the person whose whole job is clips currently has nowhere to
work. No schema change is needed: `content_item_assignees` already answers
"what is assigned to me" with an indexed lookup, across every depth of the
tree. But the `/tasks` route is still a placeholder, and it has to exist before
anyone but the creator can use the product.

```sql
-- What My Tasks queries.
select c.*
  from public.content_items c
  join public.content_item_assignees a on a.content_item_id = c.id
 where a.user_id = (select auth.uid())
 order by c.due_at nulls last;
```

---

## 0. Prerequisites

**Docker Desktop is required and is not installed.** `supabase start` runs
Postgres, Auth, Storage and Studio as local containers.

1. Install Docker Desktop for Windows
2. Launch it and wait for the whale icon to settle
3. Verify:

```powershell
docker --version
docker ps
```

Both must succeed. `docker ps` failing with "cannot connect to the Docker
daemon" means Docker is installed but not running.

The Supabase CLI itself needs no install — `pnpm dlx supabase` fetches it.
Confirm:

```powershell
pnpm dlx supabase --version    # 2.114.0 at time of writing
```

---

## 1. Initialise and start

From the repo root:

```powershell
cd C:\Users\leonh\blomstr
pnpm dlx supabase init
```

This creates `supabase/config.toml`. It will ask about generating VS Code
settings and Deno config — say no to both for now.

```powershell
pnpm dlx supabase start
```

First run pulls several GB of images. When it finishes it prints a block like:

```
API URL:     http://127.0.0.1:54321
DB URL:      postgresql://postgres:postgres@127.0.0.1:54322/postgres
Studio URL:  http://127.0.0.1:54323
anon key:    eyJhbGciOi...
service_role key: eyJhbGciOi...
```

Copy the API URL and **anon** key into `apps/app/.env`:

```powershell
Copy-Item apps\app\.env.example apps\app\.env
```

```env
VITE_SUPABASE_URL=http://127.0.0.1:54321
VITE_SUPABASE_ANON_KEY=eyJhbGciOi...
```

Never put the `service_role` key here. It bypasses every RLS policy you're
about to write.

**Verify:**

```powershell
pnpm dlx supabase status
```

Studio should load at http://127.0.0.1:54323.

> If you lose the keys later, `supabase status` reprints them.

---

## How to run each migration

Every step below follows the same shape:

```powershell
pnpm dlx supabase migration new <name>
```

That creates `supabase/migrations/<timestamp>_<name>.sql`. Paste the SQL into
it, then:

```powershell
pnpm dlx supabase db reset
```

`db reset` drops the local database and replays **every** migration from
scratch. Use it constantly — it's the only way to know your migrations apply
cleanly in order, which is what will happen on the hosted project.

To run a verification query:

```powershell
pnpm dlx supabase db execute --local "select 1;"
```

Or paste it into Studio's SQL editor, which is easier to read.

---

## 2. Enums

```powershell
pnpm dlx supabase migration new 01_enums
```

```sql
create type public.content_type as enum (
  'youtube_video','short','tiktok','reel','instagram_post',
  'podcast','livestream','newsletter','thumbnail','sponsored'
);

create type public.platform as enum (
  'youtube','tiktok','instagram','x','linkedin'
);

create type public.approval_state as enum (
  'draft','in_review','changes_requested','approved'
);

/*
  Four tiers, in descending order of trust. See "Roles" in Decisions taken for
  the full matrix.

    owner   the creator — everything, including people and billing
    admin   assistant or manager — approves and publishes, cannot grant access
    editor  editor, clipper, designer — makes the work, cannot approve it
    guest   sponsor or collaborator — one project, read and comment

  There is no separate clipper or designer role. They all make things and
  submit them for approval, which is the only distinction that matters.
*/
create type public.workspace_role as enum ('owner','admin','editor','guest');

create type public.job_status as enum ('queued','leased','done','failed','dead');
```

These mirror `packages/types/src/index.ts` exactly. Keep them in sync — adding
a content type later is `alter type public.content_type add value 'carousel';`,
one statement, no table rewrite.

**Verify:**

```sql
select typname from pg_type where typname = 'content_type';
```

---

## 3. Workspaces and membership

```powershell
pnpm dlx supabase migration new 02_workspaces
```

```sql
create table public.workspaces (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  /*
    Billing plumbing, in early and unenforced beyond the seat check in
    create_invite. Adding it now means switching billing on is "add Stripe",
    not "rewrite the invite path".

    seat_limit counts STAFF only — owner, admin, editor. Guests are always
    free and always unlimited. See "Seats" in Decisions taken; that split is
    structural and expensive to reverse.
  */
  plan        text not null default 'free',
  seat_limit  int  not null default 1,
  created_at  timestamptz not null default now()
);

create table public.workspace_members (
  workspace_id uuid not null references public.workspaces on delete cascade,
  user_id      uuid not null references auth.users on delete cascade,
  role         public.workspace_role not null default 'editor',
  created_at   timestamptz not null default now(),
  primary key (workspace_id, user_id)
);

/*
  Capabilities are derived from the role, not stored alongside it. Two columns
  that must agree is a drift bug waiting to happen, and with admin defined as
  "approves and publishes" a flag buys nothing.

  If one specific editor ever needs publish rights, add a nullable override
  column then — null meaning "use the role default". Not before.
*/

-- "which workspaces am I in" is the hot path on every page load.
create index on public.workspace_members (user_id);

/*
  auth.users is not readable from the client, so without this table the board
  cannot render a name or an avatar. Mirrored on signup by the trigger below.
*/
create table public.profiles (
  id           uuid primary key references auth.users on delete cascade,
  display_name text,
  avatar_url   text,
  created_at   timestamptz not null default now()
);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    new.raw_user_meta_data->>'avatar_url'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

/*
  The foundation of every policy.

  security definer so it can read workspace_members without recursing into
  that table's own RLS policy. set search_path = '' plus fully-qualified names
  is mandatory — without it this is a privilege-escalation vector.

  (select auth.uid()) rather than auth.uid() so Postgres treats it as an
  InitPlan and evaluates it once per query instead of once per row.

  ⚠️ is_staff, NOT "is in this workspace". Redeeming an invite gives a guest a
  workspace_members row, so a naive "has a row here" check would hand a sponsor
  the run of the whole workspace — every comment on every project. Guests are
  in the workspace; they are not staff. Every write policy checks this one.
*/
create or replace function public.is_staff(ws uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.workspace_members m
    where m.workspace_id = ws
      and m.user_id = (select auth.uid())
      and m.role in ('owner','admin','editor')
  );
$$;

/*
  Attached to the workspace at all, guests included. Only for things a guest
  legitimately needs — the workspace's own name, so their one project has a
  heading. Never for writes.
*/
create or replace function public.in_workspace(ws uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.workspace_members m
    where m.workspace_id = ws
      and m.user_id = (select auth.uid())
  );
$$;

create or replace function public.has_role(ws uuid, roles public.workspace_role[])
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.workspace_members m
    where m.workspace_id = ws
      and m.user_id = (select auth.uid())
      and m.role = any (roles)
  );
$$;

/*
  Editors make the work; they do not sign it off. The product's whole premise
  is "the team produces and the creator approves" — an editor who could approve
  their own upload would collapse that.
*/
create or replace function public.can_approve(ws uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.has_role(ws, array['owner','admin']::public.workspace_role[]);
$$;

-- Posting to a real audience is irreversible. Same trust line as approval.
create or replace function public.can_publish(ws uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.has_role(ws, array['owner','admin']::public.workspace_role[]);
$$;

/*
  Changing who is on the team, and what they may do, is owner-only. This is the
  line between owner and admin: an admin is trusted with the audience and with
  editorial sign-off, but cannot widen the circle or promote themselves.
*/
create or replace function public.can_manage_people(ws uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.has_role(ws, array['owner']::public.workspace_role[]);
$$;

/*
  Inviting a guest to a single project is narrower than changing the team, so
  admins can do it — a manager sending a sponsor a review link shouldn't need
  the creator. Editors cannot: handing out access is not part of making things.
*/
create or replace function public.can_invite_guests(ws uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.has_role(ws, array['owner','admin']::public.workspace_role[]);
$$;
```

**Verify:**

```sql
select public.is_staff(gen_random_uuid());   -- false, and no error
```

---

## 4. Stages

```powershell
pnpm dlx supabase migration new 03_stages
```

```sql
create table public.stages (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces on delete cascade,
  name         text not null,
  position     int  not null,
  accent       text,
  created_at   timestamptz not null default now()
);

create index on public.stages (workspace_id, position);

/*
  Seeded per workspace rather than hard-coded, so a workspace can rename and
  reorder its own pipeline later.

  These four match apps/app/src/lib/mock-data.ts. Deliberately medium-agnostic:
  "In progress" covers writing, shooting, recording and editing alike, so a
  podcaster isn't reading a YouTuber's pipeline.
*/
create or replace function public.seed_default_stages(ws uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.stages (workspace_id, name, position) values
    (ws, 'Ideas',       0),
    (ws, 'In progress', 1),
    (ws, 'Review',      2),
    (ws, 'Published',   3);
$$;

/*
  Bootstrap problem: creating a workspace requires inserting a row you are not
  yet a member of, so no RLS policy written in terms of is_staff() can allow
  it. This function is the only way in — it creates the workspace, makes the
  caller its owner, and seeds the stages, atomically.
*/
create or replace function public.create_workspace(name text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  ws uuid;
  uid uuid := (select auth.uid());
begin
  if uid is null then
    raise exception 'not authenticated';
  end if;

  insert into public.workspaces (name) values (name) returning id into ws;

  insert into public.workspace_members (workspace_id, user_id, role)
  values (ws, uid, 'owner');

  perform public.seed_default_stages(ws);

  return ws;
end;
$$;
```

**Verify** — after you have a user (step 13):

```sql
select public.create_workspace('Test');
select name, position from public.stages order by position;
```

---

## 5. The content graph

```powershell
pnpm dlx supabase migration new 04_content_graph
```

```sql
create table public.content_items (
  id              uuid primary key default gen_random_uuid(),
  workspace_id    uuid not null references public.workspaces on delete cascade,
  parent_id       uuid references public.content_items on delete cascade,
  ancestor_ids    uuid[] not null default '{}',
  type            public.content_type not null,
  title           text not null,
  stage_id        uuid not null references public.stages,
  position        text not null,
  due_at          timestamptz,
  publish_at      timestamptz,
  platforms       public.platform[] not null default '{}',
  source_start_ms int,
  source_end_ms   int,
  created_by      uuid not null references auth.users default auth.uid(),
  created_at      timestamptz not null default now()
);

-- The board's query: one workspace, grouped by stage, ordered by rank.
create index on public.content_items (workspace_id, stage_id, position);
-- Guest grant resolution walks this.
create index on public.content_items using gin (ancestor_ids);
create index on public.content_items (parent_id);

/*
  Two items in the same column must never share a rank. rankBetween() in
  apps/app/src/lib/rank.ts throws when before >= after, so a duplicate makes
  the gap between them undroppable.
*/
create unique index content_items_board_rank
  on public.content_items (stage_id, position)
  where parent_id is null;

/*
  ancestor_ids is denormalised AND authorization depends on it (see
  can_read_item in step 10). Drift is a permission leak, not a data bug — so
  it is never written by the client, only by these triggers.
*/
create or replace function public.set_ancestor_ids()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  parent_chain uuid[];
begin
  if new.parent_id is null then
    new.ancestor_ids := '{}';
  else
    select c.ancestor_ids || c.id
      into parent_chain
      from public.content_items c
     where c.id = new.parent_id;

    if parent_chain is null then
      raise exception 'parent % does not exist', new.parent_id;
    end if;

    if new.id = any (parent_chain) then
      raise exception 'cycle: % cannot be its own ancestor', new.id;
    end if;

    new.ancestor_ids := parent_chain;
  end if;

  return new;
end;
$$;

create trigger content_items_set_ancestors
before insert or update of parent_id on public.content_items
for each row execute function public.set_ancestor_ids();

/*
  Re-parenting a node invalidates every descendant's chain, so rebuild the
  subtree. Without this, a moved node's children keep pointing at the old
  ancestors and a guest keeps access they should have lost.
*/
create or replace function public.cascade_ancestor_ids()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  with recursive subtree as (
    select c.id, new.ancestor_ids || new.id as chain
      from public.content_items c
     where c.parent_id = new.id
    union all
    select c.id, s.chain || c.parent_id
      from public.content_items c
      join subtree s on c.parent_id = s.id
  )
  update public.content_items c
     set ancestor_ids = s.chain
    from subtree s
   where c.id = s.id;

  return null;
end;
$$;

create trigger content_items_cascade_ancestors
after update of parent_id on public.content_items
for each row
when (old.parent_id is distinct from new.parent_id)
execute function public.cascade_ancestor_ids();

/*
  Run this periodically (and in tests). A non-empty result is a security bug.
*/
create or replace function public.check_ancestor_integrity()
returns table (id uuid, stored uuid[], expected uuid[])
language sql
stable
security definer
set search_path = ''
as $$
  with recursive tree as (
    select c.id, c.parent_id, '{}'::uuid[] as chain
      from public.content_items c
     where c.parent_id is null
    union all
    select c.id, c.parent_id, t.chain || c.parent_id
      from public.content_items c
      join tree t on c.parent_id = t.id
  )
  select c.id, c.ancestor_ids, t.chain
    from public.content_items c
    join tree t on t.id = c.id
   where c.ancestor_ids is distinct from t.chain;
$$;

-- Assignees as a join table, not an array: FK integrity, and "assigned to me"
-- becomes an indexed lookup rather than an array scan across the workspace.
create table public.content_item_assignees (
  content_item_id uuid not null references public.content_items on delete cascade,
  user_id         uuid not null references auth.users on delete cascade,
  primary key (content_item_id, user_id)
);

create index on public.content_item_assignees (user_id);
```

**Verify:**

```sql
-- after seeding, re-parent something and confirm the chain rebuilds
select * from public.check_ancestor_integrity();   -- 0 rows
```

---

## 6. Assets and versions

```powershell
pnpm dlx supabase migration new 05_assets_versions
```

```sql
create table public.assets (
  id              uuid primary key default gen_random_uuid(),
  workspace_id    uuid not null references public.workspaces on delete cascade,
  content_item_id uuid not null references public.content_items on delete cascade,
  kind            text not null check (kind in ('drive_file','storage_object','document')),
  title           text not null,
  /*
    Autosave target for kind = 'document' (the script). Typing writes here;
    "send for review" snapshots it into a new asset_versions row. A version per
    keystroke would make the review thread meaningless, and asset_versions has
    no update policy by design.
  */
  draft_body      text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index on public.assets (content_item_id);

create table public.asset_versions (
  id             uuid primary key default gen_random_uuid(),
  workspace_id   uuid not null references public.workspaces on delete cascade,
  asset_id       uuid not null references public.assets on delete cascade,
  version_number int not null,
  approval_state public.approval_state not null default 'draft',
  drive_file_id  text,     -- large files stay in Drive
  storage_path   text,     -- small assets in Supabase Storage
  body           text,     -- kind = 'document' (the script)
  created_by     uuid not null references auth.users default auth.uid(),
  created_at     timestamptz not null default now(),
  unique (asset_id, version_number)
);

create index on public.asset_versions (asset_id, created_at desc);

/*
  Approval lives on the version, never on content_items — otherwise "approved"
  becomes a lie the moment V4 lands. The board reads this view for its badge
  and the client can never write it.
*/
create or replace view public.content_item_status as
select ci.id,
       ci.workspace_id,
       coalesce(latest.approval_state, 'draft')::public.approval_state as approval_state,
       latest.id as latest_version_id
  from public.content_items ci
  left join lateral (
    select av.id, av.approval_state
      from public.asset_versions av
      join public.assets a on a.id = av.asset_id
     where a.content_item_id = ci.id
     order by av.created_at desc
     limit 1
  ) latest on true;

-- Views run as the caller under invoker security, so the underlying
-- content_items policy still applies. Make that explicit.
alter view public.content_item_status set (security_invoker = true);
```

**Verify:**

```sql
select * from public.content_item_status limit 1;   -- 'draft' with no versions
```

---

## 7. Comments

```powershell
pnpm dlx supabase migration new 06_comments
```

```sql
create table public.comments (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces on delete cascade,
  subject_type text not null check (subject_type in ('content_item','asset_version')),
  subject_id   uuid not null,
  anchor       jsonb,   -- {t_ms} video | {x,y} image | null general
  body         text not null check (length(trim(body)) > 0),
  author_id    uuid not null references auth.users default auth.uid(),
  parent_id    uuid references public.comments on delete cascade,
  resolved_at  timestamptz,
  created_at   timestamptz not null default now()
);

create index on public.comments (subject_type, subject_id, created_at);
create index on public.comments (workspace_id, created_at desc);
```

One table for timestamped video review, pins on a thumbnail, and general
project chatter. `anchor` null means a general comment. Building the video
player later needs no schema change.

---

## 8. Events — the spine

```powershell
pnpm dlx supabase migration new 07_events
```

```sql
create table public.events (
  id           bigserial primary key,
  workspace_id uuid not null references public.workspaces on delete cascade,
  actor_id     uuid references auth.users,
  subject_type text not null,
  subject_id   uuid not null,
  verb         text not null,   -- 'created' | 'moved' | 'approved' | 'published'
  payload      jsonb not null default '{}',
  created_at   timestamptz not null default now()
);

create index on public.events (workspace_id, created_at desc);
create index on public.events (subject_type, subject_id, created_at desc);

-- Called from RPCs, inside the same transaction as the change itself.
create or replace function public.emit_event(
  ws uuid, subject_type text, subject_id uuid, verb text, payload jsonb default '{}'
)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.events (workspace_id, actor_id, subject_type, subject_id, verb, payload)
  values (ws, (select auth.uid()), subject_type, subject_id, verb, payload);
$$;
```

The approval inbox, the project activity rail, notifications and the audit log
are all queries over this one table. It goes in now because retrofitting means
backfilling history you no longer have.

**Keep state in tables. Do not event-source.** Events describe what happened;
they are not the truth about what *is*.

---

## 9. Jobs

```powershell
pnpm dlx supabase migration new 08_jobs
```

```sql
create table public.jobs (
  id              uuid primary key default gen_random_uuid(),
  workspace_id    uuid not null references public.workspaces on delete cascade,
  kind            text not null,   -- 'publish' | 'drive_sync' | 'metrics'
  payload         jsonb not null default '{}',
  idempotency_key text not null unique,
  status          public.job_status not null default 'queued',
  attempts        int not null default 0,
  run_after       timestamptz not null default now(),
  leased_until    timestamptz,
  last_error      text,
  created_at      timestamptz not null default now()
);

create index on public.jobs (status, run_after);

/*
  Lease rather than a status flag: a worker that crashes mid-job leaves the row
  in 'leased' forever otherwise. skip locked lets several workers pull without
  fighting over the same row.
*/
create or replace function public.lease_jobs(kinds text[], lease_seconds int default 60, batch int default 10)
returns setof public.jobs
language sql
security definer
set search_path = ''
as $$
  update public.jobs j
     set status = 'leased',
         leased_until = now() + make_interval(secs => lease_seconds),
         attempts = j.attempts + 1
   where j.id in (
     select id from public.jobs
      where kind = any (kinds)
        and run_after <= now()
        and (status = 'queued' or (status = 'leased' and leased_until < now()))
      order by run_after
      limit batch
      for update skip locked
   )
  returning j.*;
$$;
```

**Double-posting to a creator's real audience is unrecoverable.** The unique
`idempotency_key` is a correctness requirement, not an optimisation.

---

## 10. Guest grants and the read rule

```powershell
pnpm dlx supabase migration new 09_guest_grants
```

```sql
create table public.guest_grants (
  id              uuid primary key default gen_random_uuid(),
  workspace_id    uuid not null references public.workspaces on delete cascade,
  user_id         uuid not null references auth.users on delete cascade,
  content_item_id uuid not null references public.content_items on delete cascade,
  created_at      timestamptz not null default now(),
  unique (user_id, content_item_id)
);

create index on public.guest_grants (user_id);

/*
  Grant a freelancer one podcast episode and they see its clips too, because
  the clip's ancestor_ids contains the episode. One indexed lookup at any
  depth, instead of one grant per derivative.
*/
create or replace function public.can_read_item(item public.content_items)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    public.is_staff(item.workspace_id)
    or exists (
      select 1
        from public.guest_grants g
       where g.user_id = (select auth.uid())
         and (g.content_item_id = item.id
              or g.content_item_id = any (item.ancestor_ids))
    );
$$;
```

**Write the tests for this before the policies in step 11.** It's the one place
where a bug is a data breach rather than a broken screen. Minimum cases:

| Case | Expected |
|---|---|
| member, own workspace | true |
| member, other workspace | false |
| guest, granted item | true |
| guest, child of granted item | true |
| guest, grandchild of granted item | true |
| guest, sibling of granted item | false |
| anonymous | false |

---

## 11. RLS — all tables at once

```powershell
pnpm dlx supabase migration new 10_rls
```

Doing every table in one migration is deliberate: a table that ships with RLS
off is readable by anyone with the anon key.

```sql
alter table public.workspaces             enable row level security;
alter table public.workspace_members      enable row level security;
alter table public.profiles               enable row level security;
alter table public.stages                 enable row level security;
alter table public.content_items          enable row level security;
alter table public.content_item_assignees enable row level security;
alter table public.assets                 enable row level security;
alter table public.asset_versions         enable row level security;
alter table public.comments               enable row level security;
alter table public.events                 enable row level security;
alter table public.jobs                   enable row level security;
alter table public.guest_grants           enable row level security;

/*
  Every write below checks is_staff, never in_workspace. A guest holds a
  workspace_members row, so "has a row here" would let a sponsor edit the whole
  workspace. in_workspace appears exactly once — on reading the workspace name.
*/

-- workspaces: no insert policy — creation goes through create_workspace().
-- Guests need the name so their one project has a heading, nothing more.
create policy read_workspaces on public.workspaces
  for select using (public.in_workspace(id));
create policy update_workspaces on public.workspaces
  for update using (public.has_role(id, array['owner']::public.workspace_role[]));

-- Staff see the roster; only the owner changes it. Guests see nobody —
-- a sponsor has no business enumerating your team.
create policy read_members on public.workspace_members
  for select using (public.is_staff(workspace_id));
create policy manage_members on public.workspace_members
  for all using (public.can_manage_people(workspace_id));

/*
  You can see the profile of anyone you share a workspace with — that is what
  puts a name on a card. Not "any authenticated user", which would turn the
  table into a directory of every account on the platform.
*/
create policy read_profiles on public.profiles
  for select using (
    id = (select auth.uid())
    or exists (
      select 1
        from public.workspace_members mine
        join public.workspace_members theirs
          on theirs.workspace_id = mine.workspace_id
       where mine.user_id = (select auth.uid())
         and theirs.user_id = profiles.id
    )
  );

create policy update_own_profile on public.profiles
  for update using (id = (select auth.uid()));

-- Guests need stage names to read a status; changing the workflow is admin+.
create policy read_stages on public.stages
  for select using (public.in_workspace(workspace_id));
create policy write_stages on public.stages
  for all using (public.has_role(workspace_id, array['owner','admin']::public.workspace_role[]));

-- content: guests read through the grant cascade, staff write.
create policy read_items on public.content_items
  for select using (public.can_read_item(content_items));
create policy insert_items on public.content_items
  for insert with check (public.is_staff(workspace_id));
create policy update_items on public.content_items
  for update using (public.is_staff(workspace_id));
create policy delete_items on public.content_items
  for delete using (public.has_role(workspace_id, array['owner','admin']::public.workspace_role[]));

create policy read_assignees on public.content_item_assignees
  for select using (exists (
    select 1 from public.content_items c
     where c.id = content_item_id and public.can_read_item(c)
  ));
create policy write_assignees on public.content_item_assignees
  for all using (exists (
    select 1 from public.content_items c
     where c.id = content_item_id and public.is_staff(c.workspace_id)
  ));

create policy read_assets on public.assets
  for select using (exists (
    select 1 from public.content_items c
     where c.id = content_item_id and public.can_read_item(c)
  ));
create policy write_assets on public.assets
  for all using (public.is_staff(workspace_id));

create policy read_versions on public.asset_versions
  for select using (exists (
    select 1 from public.assets a
      join public.content_items c on c.id = a.content_item_id
     where a.id = asset_id and public.can_read_item(c)
  ));
create policy insert_versions on public.asset_versions
  for insert with check (public.is_staff(workspace_id));

/*
  Deliberately no update policy on asset_versions.

  approval_state is the one column a client must never set directly — it moves
  only through approve_version() / request_changes(), which check the state
  machine and emit an event in the same transaction.
*/

/*
  Scoped by subject, not by workspace.

  A workspace-wide check here was the bug: a sponsor invited to one video would
  have read every comment in the account, including notes on projects they were
  never shown. The comment is visible if — and only if — the thing it hangs off
  is visible.

  Guests can still write. A sponsor reviewing their own integration is the
  entire reason to invite one.
*/
create or replace function public.can_read_subject(p_type text, p_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select case p_type
    when 'content_item' then exists (
      select 1 from public.content_items c
       where c.id = p_id and public.can_read_item(c)
    )
    when 'asset_version' then exists (
      select 1
        from public.asset_versions av
        join public.assets a        on a.id = av.asset_id
        join public.content_items c on c.id = a.content_item_id
       where av.id = p_id and public.can_read_item(c)
    )
    else false
  end;
$$;

create policy read_comments on public.comments
  for select using (public.can_read_subject(subject_type, subject_id));
create policy insert_comments on public.comments
  for insert with check (
    public.can_read_subject(subject_type, subject_id)
    and author_id = (select auth.uid())
  );
create policy edit_own_comments on public.comments
  for update using (author_id = (select auth.uid()));
create policy delete_own_comments on public.comments
  for delete using (author_id = (select auth.uid()));

create policy read_events on public.events
  for select using (public.is_staff(workspace_id));
-- No insert policy: events are written only by emit_event(), security definer.

create policy read_jobs on public.jobs
  for select using (public.has_role(workspace_id, array['owner']::public.workspace_role[]));
-- No write policy: jobs are enqueued by RPCs and processed by Edge Functions.

create policy read_grants on public.guest_grants
  for select using (public.is_staff(workspace_id) or user_id = (select auth.uid()));
create policy manage_grants on public.guest_grants
  for all using (public.has_role(workspace_id, array['owner','admin']::public.workspace_role[]));
```

**Verify — every table is covered:**

```sql
select c.relname,
       c.relrowsecurity as rls_on,
       count(p.polname) as policies
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  left join pg_policy p on p.polrelid = c.oid
 where n.nspname = 'public' and c.relkind = 'r'
 group by 1, 2
 order by 1;
```

Every row must show `rls_on = true` and `policies > 0`. Add this as a test —
it's the check that catches the table you add at 1am six months from now.

---

## 11b. Publish targets

```powershell
pnpm dlx supabase migration new 11_publish_targets
```

`content_items.publish_at` and `platforms[]` cannot express "YouTube on
Thursday with this title, TikTok on Friday with that one." Packaging is
per-platform, so it needs its own row per platform.

> Everything from here on is created **after** the blanket RLS migration, so
> each new table enables RLS and declares its policies inline. A table that
> ships without them is readable by anyone holding the anon key.

```sql
create table public.publish_targets (
  id                uuid primary key default gen_random_uuid(),
  workspace_id      uuid not null references public.workspaces on delete cascade,
  content_item_id   uuid not null references public.content_items on delete cascade,
  platform          public.platform not null,
  title             text,
  description       text,
  tags              text[] not null default '{}',
  -- The approved thumbnail, chosen from this item's assets.
  thumbnail_asset_id uuid references public.assets on delete set null,
  scheduled_at      timestamptz,
  status            text not null default 'draft'
                    check (status in ('draft','queued','publishing','published','failed')),
  external_id       text,          -- the platform's id once it exists
  external_url      text,
  last_error        text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (content_item_id, platform)
);

create index on public.publish_targets (workspace_id, scheduled_at)
  where status in ('draft','queued');

alter table public.publish_targets enable row level security;

create policy read_targets on public.publish_targets
  for select using (exists (
    select 1 from public.content_items c
     where c.id = content_item_id and public.can_read_item(c)
  ));

create policy write_targets on public.publish_targets
  for all using (public.is_staff(workspace_id));

-- status and external_* are moved by the publish worker, never by a client.
revoke update (status, external_id, external_url, last_error)
  on public.publish_targets from authenticated;
```

---

## 11c. Invites — guest links

```powershell
pnpm dlx supabase migration new 12_invites
```

`guest_grants` assumes the person already has an account. This is how someone
who doesn't gets one.

```sql
create table public.invites (
  id              uuid primary key default gen_random_uuid(),
  workspace_id    uuid not null references public.workspaces on delete cascade,
  -- null = the whole workspace; set = this project and everything under it
  content_item_id uuid references public.content_items on delete cascade,
  role            public.workspace_role not null default 'guest',
  /*
    The raw token appears once, in the URL you send. Only its hash is stored,
    so a leaked database dump does not hand over live access links.
  */
  token_hash      text not null unique,
  email           text,          -- optional: only this address may redeem
  expires_at      timestamptz not null default now() + interval '14 days',
  max_uses        int not null default 1,
  used_count      int not null default 0,
  revoked_at      timestamptz,
  created_by      uuid not null references auth.users default auth.uid(),
  created_at      timestamptz not null default now()
);

create index on public.invites (workspace_id, created_at desc);

alter table public.invites enable row level security;

/*
  Deliberately no select policy for the token itself — nobody reads invites
  directly. Members list them through a view that omits token_hash; redemption
  happens through redeem_invite(), which is security definer because the person
  redeeming is not yet a member of anything.
*/
create policy manage_invites on public.invites
  for all using (public.can_invite_guests(workspace_id));

create view public.invites_listing
with (security_invoker = true) as
select id, workspace_id, content_item_id, role, email,
       expires_at, max_uses, used_count, revoked_at, created_by, created_at
  from public.invites;
```

Needs `pgcrypto` for the hashing, which Supabase enables by default; add it to
`01_enums` if `digest()` is missing:

```sql
create extension if not exists pgcrypto with schema extensions;
```

---

## 12. RPCs

```powershell
pnpm dlx supabase migration new 13_rpc
```

```sql
/*
  Assigns the version number and applies the self-authored rule.

  If the author already holds approve rights, the version is created approved.
  A creator writing their own script does not approve their own work — it is
  approved by construction. Otherwise the approval inbox fills with people
  approving themselves and stops meaning anything.
*/
create or replace function public.create_version(
  p_asset_id uuid,
  p_drive_file_id text default null,
  p_storage_path text default null,
  p_body text default null
)
returns public.asset_versions
language plpgsql
security definer
set search_path = ''
as $$
declare
  ws uuid;
  item uuid;
  next_number int;
  self_approved boolean;
  result public.asset_versions;
begin
  select a.workspace_id, a.content_item_id into ws, item
    from public.assets a where a.id = p_asset_id;

  if ws is null then
    raise exception 'asset % not found', p_asset_id;
  end if;
  if not public.is_staff(ws) then
    raise exception 'not a member of this workspace';
  end if;

  select coalesce(max(version_number), 0) + 1 into next_number
    from public.asset_versions where asset_id = p_asset_id;

  /*
    The self-authored rule: if the author already holds approve rights, the
    version is approved on creation. A creator writing their own script does
    not approve their own work — it is approved by construction. Otherwise the
    approval inbox fills with people approving themselves and stops meaning
    anything.
  */
  self_approved := public.can_approve(ws);

  insert into public.asset_versions
    (workspace_id, asset_id, version_number, approval_state,
     drive_file_id, storage_path, body)
  values
    (ws, p_asset_id, next_number,
     case when self_approved then 'approved' else 'in_review' end,
     p_drive_file_id, p_storage_path, p_body)
  returning * into result;

  perform public.emit_event(
    ws, 'asset_version', result.id,
    case when self_approved then 'approved' else 'submitted_for_review' end,
    jsonb_build_object('content_item_id', item, 'version', next_number)
  );

  return result;
end;
$$;

create or replace function public.approve_version(p_version_id uuid, p_note text default null)
returns public.asset_versions
language plpgsql
security definer
set search_path = ''
as $$
declare
  v public.asset_versions;
begin
  select * into v from public.asset_versions where id = p_version_id;
  if v.id is null then
    raise exception 'version % not found', p_version_id;
  end if;

  if not public.can_approve(v.workspace_id) then
    raise exception 'no approve permission';
  end if;

  -- The state machine: approving a draft skips review, which hides work.
  if v.approval_state not in ('in_review','changes_requested') then
    raise exception 'cannot approve from state %', v.approval_state;
  end if;

  update public.asset_versions
     set approval_state = 'approved'
   where id = p_version_id
  returning * into v;

  perform public.emit_event(v.workspace_id, 'asset_version', v.id, 'approved',
                            jsonb_build_object('note', p_note));
  return v;
end;
$$;

create or replace function public.request_changes(p_version_id uuid, p_note text)
returns public.asset_versions
language plpgsql
security definer
set search_path = ''
as $$
declare
  v public.asset_versions;
begin
  select * into v from public.asset_versions where id = p_version_id;
  if v.id is null then
    raise exception 'version % not found', p_version_id;
  end if;
  if not public.can_approve(v.workspace_id) then
    raise exception 'no approve permission';
  end if;
  if v.approval_state <> 'in_review' then
    raise exception 'cannot request changes from state %', v.approval_state;
  end if;

  update public.asset_versions
     set approval_state = 'changes_requested'
   where id = p_version_id
  returning * into v;

  insert into public.comments (workspace_id, subject_type, subject_id, body)
  values (v.workspace_id, 'asset_version', v.id, p_note);

  perform public.emit_event(v.workspace_id, 'asset_version', v.id, 'changes_requested',
                            jsonb_build_object('note', p_note));
  return v;
end;
$$;

/*
  Never posts inline. Enqueues a job with an idempotency key so a retry after a
  network failure cannot double-post to a real audience.
*/
create or replace function public.enqueue_publish(p_content_item_id uuid, p_platform public.platform)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  ws uuid;
  job_id uuid;
begin
  select workspace_id into ws from public.content_items where id = p_content_item_id;
  if ws is null then
    raise exception 'content item % not found', p_content_item_id;
  end if;
  if not public.can_publish(ws) then
    raise exception 'no publish permission';
  end if;

  insert into public.jobs (workspace_id, kind, payload, idempotency_key)
  values (ws, 'publish',
          jsonb_build_object('content_item_id', p_content_item_id, 'platform', p_platform),
          format('publish:%s:%s', p_content_item_id, p_platform))
  on conflict (idempotency_key) do nothing
  returning id into job_id;

  if job_id is not null then
    perform public.emit_event(ws, 'content_item', p_content_item_id, 'publish_queued',
                              jsonb_build_object('platform', p_platform));
  end if;

  return job_id;
end;
$$;

/*
  ancestor_ids drift is a permission leak, so re-parenting is RPC-only.
  Revoke direct column update in step 12b below.
*/
create or replace function public.reparent_item(p_item_id uuid, p_parent_id uuid)
returns public.content_items
language plpgsql
security definer
set search_path = ''
as $$
declare
  c public.content_items;
begin
  select * into c from public.content_items where id = p_item_id;
  if c.id is null then
    raise exception 'item % not found', p_item_id;
  end if;
  if not public.is_staff(c.workspace_id) then
    raise exception 'not a member of this workspace';
  end if;

  update public.content_items set parent_id = p_parent_id
   where id = p_item_id returning * into c;

  perform public.emit_event(c.workspace_id, 'content_item', c.id, 'reparented',
                            jsonb_build_object('parent_id', p_parent_id));
  return c;
end;
$$;
```

### 12b. Invite links

```sql
/*
  Returns the raw token exactly once. It is never stored — only its hash is —
  so if the caller loses it, the invite has to be revoked and reissued. That is
  the correct trade: a table full of live access links is a breach waiting for
  a backup to leak.
*/
/*
  Two shapes, distinguished by p_content_item_id:

    null → a staff invite. Workspace-wide, role admin or editor, owner only,
           and it consumes a seat.
    set  → a guest invite. That project and everything under it, owner or
           admin, and it is always free.

  The role is baked into the invite rather than chosen on redemption —
  otherwise forwarding the link would be privilege escalation.
*/
create or replace function public.create_invite(
  p_workspace_id uuid default null,
  p_content_item_id uuid default null,
  p_email text default null,
  p_role public.workspace_role default 'guest',
  p_expires_in interval default interval '14 days',
  p_max_uses int default 1
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  ws uuid;
  raw_token text;
  staff_count int;
  limit_seats int;
begin
  if p_content_item_id is null then
    -- Staff invite.
    ws := p_workspace_id;
    if ws is null then
      raise exception 'pass either a workspace or a content item';
    end if;
    if p_role not in ('admin','editor') then
      raise exception 'a workspace invite must be admin or editor';
    end if;
    if not public.can_manage_people(ws) then
      raise exception 'only the owner can add staff';
    end if;

    /*
      Seats are counted in staff, never guests. A sponsor who comments once and
      never returns must not consume one, or creators learn to avoid inviting
      sponsors — and that is the feature the product is built around.

      Outstanding staff invites count too, otherwise you can oversubscribe by
      sending several at once.
    */
    select count(*) into staff_count
      from public.workspace_members m
     where m.workspace_id = ws and m.role in ('owner','admin','editor');

    select count(*) + staff_count into staff_count
      from public.invites i
     where i.workspace_id = ws
       and i.content_item_id is null
       and i.revoked_at is null
       and i.expires_at > now()
       and i.used_count < i.max_uses;

    select w.seat_limit into limit_seats
      from public.workspaces w where w.id = ws;

    if staff_count >= limit_seats then
      raise exception 'seat limit reached (% of %)', staff_count, limit_seats;
    end if;
  else
    -- Guest invite.
    select c.workspace_id into ws
      from public.content_items c where c.id = p_content_item_id;
    if ws is null then
      raise exception 'content item % not found', p_content_item_id;
    end if;
    if p_role <> 'guest' then
      raise exception 'a project invite must be a guest invite';
    end if;
    if not public.can_invite_guests(ws) then
      raise exception 'no permission to invite';
    end if;
  end if;

  raw_token := encode(extensions.gen_random_bytes(32), 'hex');

  insert into public.invites
    (workspace_id, content_item_id, role, token_hash, email, expires_at, max_uses)
  values
    (ws, p_content_item_id, p_role,
     encode(extensions.digest(raw_token, 'sha256'), 'hex'),
     p_email, now() + p_expires_in, p_max_uses);

  perform public.emit_event(
    ws,
    case when p_content_item_id is null then 'workspace' else 'content_item' end,
    coalesce(p_content_item_id, ws),
    'invite_created',
    jsonb_build_object('role', p_role, 'email', p_email)
  );

  return raw_token;
end;
$$;

/*
  The one function a non-member may call. security definer because the caller
  is, by definition, not yet a member of anything — no RLS policy written in
  terms of is_staff() could let them read the invites table.
*/
create or replace function public.redeem_invite(p_token text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  inv public.invites;
  uid uuid := (select auth.uid());
  user_email text;
begin
  if uid is null then
    raise exception 'sign in before redeeming an invite';
  end if;

  select * into inv from public.invites
   where token_hash = encode(extensions.digest(p_token, 'sha256'), 'hex');

  -- One message for every failure: a distinct "expired" vs "not found" tells
  -- someone guessing tokens that they guessed a real one.
  if inv.id is null
     or inv.revoked_at is not null
     or inv.expires_at < now()
     or inv.used_count >= inv.max_uses then
    raise exception 'this invite is not valid';
  end if;

  if inv.email is not null then
    select email into user_email from auth.users where id = uid;
    if lower(user_email) is distinct from lower(inv.email) then
      raise exception 'this invite is not valid';
    end if;
  end if;

  insert into public.workspace_members (workspace_id, user_id, role)
  values (inv.workspace_id, uid, inv.role)
  on conflict (workspace_id, user_id) do nothing;

  if inv.content_item_id is not null then
    insert into public.guest_grants (workspace_id, user_id, content_item_id)
    values (inv.workspace_id, uid, inv.content_item_id)
    on conflict (user_id, content_item_id) do nothing;
  end if;

  update public.invites set used_count = used_count + 1 where id = inv.id;

  perform public.emit_event(inv.workspace_id, 'content_item', inv.content_item_id,
                            'invite_redeemed', jsonb_build_object('user_id', uid));

  return inv.workspace_id;
end;
$$;

/*
  Changing someone's tier. RPC rather than a plain update because the
  last-owner check and the grant cleanup are invariants RLS cannot express, and
  the audit event has to land in the same transaction.
*/
create or replace function public.set_member_role(
  p_workspace_id uuid,
  p_user_id uuid,
  p_role public.workspace_role
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  old_role public.workspace_role;
begin
  if not public.can_manage_people(p_workspace_id) then
    raise exception 'only the owner can change roles';
  end if;

  select role into old_role
    from public.workspace_members
   where workspace_id = p_workspace_id and user_id = p_user_id;

  if old_role is null then
    raise exception 'not a member of this workspace';
  end if;

  -- Never leave a workspace ownerless: nobody could administer it again and
  -- the only repair is a service_role session.
  if old_role = 'owner' and p_role <> 'owner' then
    if (select count(*) from public.workspace_members
         where workspace_id = p_workspace_id and role = 'owner') <= 1 then
      raise exception 'cannot remove the last owner';
    end if;
  end if;

  update public.workspace_members
     set role = p_role
   where workspace_id = p_workspace_id and user_id = p_user_id;

  /*
    Demotion to guest strips workspace-wide access, and staff hold no grants —
    so the person would otherwise land on an empty app. Grants must be
    re-issued deliberately rather than inherited from a role they no longer
    hold.
  */
  if p_role = 'guest' and old_role <> 'guest' then
    delete from public.guest_grants
     where workspace_id = p_workspace_id and user_id = p_user_id;
  end if;

  perform public.emit_event(
    p_workspace_id, 'workspace_member', p_user_id, 'role_changed',
    jsonb_build_object('from', old_role, 'to', p_role)
  );
end;
$$;

-- Same last-owner guard: a direct delete would let an owner remove themselves.
create or replace function public.remove_member(p_workspace_id uuid, p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  old_role public.workspace_role;
begin
  if not public.can_manage_people(p_workspace_id) then
    raise exception 'only the owner can remove people';
  end if;

  select role into old_role
    from public.workspace_members
   where workspace_id = p_workspace_id and user_id = p_user_id;

  if old_role is null then
    return;
  end if;

  if old_role = 'owner'
     and (select count(*) from public.workspace_members
           where workspace_id = p_workspace_id and role = 'owner') <= 1 then
    raise exception 'cannot remove the last owner';
  end if;

  delete from public.workspace_members
   where workspace_id = p_workspace_id and user_id = p_user_id;
  delete from public.guest_grants
   where workspace_id = p_workspace_id and user_id = p_user_id;

  perform public.emit_event(
    p_workspace_id, 'workspace_member', p_user_id, 'member_removed',
    jsonb_build_object('role', old_role)
  );
end;
$$;

create or replace function public.revoke_invite(p_invite_id uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.invites set revoked_at = now()
   where id = p_invite_id and public.can_invite_guests(workspace_id);
$$;
```

The app side is a `/invite/:token` route: if there's no session, sign in or up
first, then call `redeem_invite`, then land on the project. Because the grant
cascades through `ancestor_ids`, granting the project also grants its clips.

> **An invite link still requires an account.** A *public* review link — send a
> sponsor a URL, they watch and comment with no signup — is a different
> mechanism, because RLS has no user to check. That needs an Edge Function
> validating a signed token and reading with `service_role`. Creators ask for
> this constantly; don't assume this table covers it.

### 12c. Lock the columns the client must never write

```sql
revoke update (approval_state) on public.asset_versions from authenticated;
revoke update (parent_id, ancestor_ids, workspace_id) on public.content_items from authenticated;
```

Policies control *rows*; these grants control *columns*. Without them a member
could `update content_items set parent_id = ...` directly and bypass the
integrity that `reparent_item` enforces.

**Note what is deliberately NOT an RPC:** stage and position changes. Dragging
a card is a plain update — the fractional rank is computed client-side by
`lib/rank.ts` and there's no invariant beyond "you're a member", which the
policy already covers. Making it an RPC would add a round trip to the most
frequent action in the app.

---

## 12d. Storage buckets

```powershell
pnpm dlx supabase migration new 14_storage
```

`asset_versions.storage_path` has been referenced since step 6 but no bucket
exists. Storage has its **own** RLS, on `storage.objects` — your table policies
do not apply to it.

```sql
insert into storage.buckets (id, name, public)
values ('assets', 'assets', false)
on conflict (id) do nothing;

/*
  Path convention: <workspace_id>/<content_item_id>/<filename>. The workspace
  id being the first segment is what makes the policy a cheap prefix check
  rather than a join.
*/
create policy "read own workspace assets"
on storage.objects for select
using (
  bucket_id = 'assets'
  and public.is_staff(((storage.foldername(name))[1])::uuid)
);

create policy "write own workspace assets"
on storage.objects for insert
with check (
  bucket_id = 'assets'
  and public.is_staff(((storage.foldername(name))[1])::uuid)
);

create policy "delete own workspace assets"
on storage.objects for delete
using (
  bucket_id = 'assets'
  and public.is_staff(((storage.foldername(name))[1])::uuid)
);
```

The bucket is private, so the client fetches through signed URLs
(`createSignedUrl`), not public links. Large video never comes here — it stays
in Drive by reference. This is thumbnails, PDFs and small attachments.

> Guests are deliberately excluded: this policy checks `is_staff`, so a guest
> with a grant can read the *rows* but not the *files*. If guests need to see
> thumbnails, widen it to walk `guest_grants` — but do that on purpose.

---

## 12e. Realtime

```powershell
pnpm dlx supabase migration new 15_realtime
```

```sql
alter publication supabase_realtime add table public.content_items;
alter publication supabase_realtime add table public.comments;
alter publication supabase_realtime add table public.asset_versions;
```

Realtime respects RLS, so subscribers only receive rows they could have read.
Two rules:

- **Subscribe per board, not per card.** Every subscription is a connection.
- **Don't add `events` to the publication.** It is append-only and high volume;
  the activity feed can poll or refetch on window focus.

---

## 12f. Scheduling and the job runner

```powershell
pnpm dlx supabase migration new 16_scheduling
```

`lease_jobs` exists but nothing calls it, and nothing notices that a
`scheduled_at` has arrived. Both need a scheduler.

```sql
create extension if not exists pg_cron with schema extensions;

-- Anything due in the last minute gets enqueued exactly once; the unique
-- idempotency_key in the jobs table is what makes "exactly once" true.
create or replace function public.enqueue_due_publishes()
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  queued int := 0;
begin
  insert into public.jobs (workspace_id, kind, payload, idempotency_key)
  select t.workspace_id, 'publish',
         jsonb_build_object('publish_target_id', t.id),
         format('publish_target:%s', t.id)
    from public.publish_targets t
   where t.status = 'draft'
     and t.scheduled_at is not null
     and t.scheduled_at <= now()
  on conflict (idempotency_key) do nothing;

  get diagnostics queued = row_count;

  update public.publish_targets
     set status = 'queued'
   where status = 'draft' and scheduled_at <= now();

  return queued;
end;
$$;

select cron.schedule('enqueue-due-publishes', '* * * * *',
                     $$select public.enqueue_due_publishes()$$);
```

The worker that *drains* the queue is an Edge Function calling `lease_jobs`,
also on a cron. It runs with `service_role` — it has to, since it acts on
behalf of nobody — which is exactly why it lives server-side and never in
`apps/app`.

**Timezones.** `scheduled_at` is `timestamptz`, so it stores an absolute
moment. But a creator thinks "Thursday at 9am *my time*", and that is a
different absolute moment depending on where they are and whether DST has
shifted. Store the workspace's IANA timezone and resolve in the UI:

```sql
alter table public.workspaces add column timezone text not null default 'UTC';
```

---

## 12g. Tests

The guide has said "write tests for `can_read_item`" since step 10 without
saying how. pgTAP ships with Supabase:

```powershell
pnpm dlx supabase test new permissions
```

`supabase/tests/permissions.test.sql`:

```sql
begin;
select plan(4);

-- Impersonate a user the way PostgREST does, so RLS actually applies.
set local role authenticated;
set local request.jwt.claims = '{"sub":"<member-uuid>","role":"authenticated"}';

select ok(public.is_staff('<workspace-uuid>'), 'editor is staff in own workspace');
select ok(not public.is_staff('<other-workspace-uuid>'), 'editor blocked from other workspace');

set local request.jwt.claims = '{"sub":"<guest-uuid>","role":"authenticated"}';

select ok(
  (select public.can_read_item(c) from public.content_items c where c.id = '<granted-item>'),
  'guest reads the granted item'
);
select ok(
  (select public.can_read_item(c) from public.content_items c where c.id = '<child-of-granted>'),
  'guest reads a child through the ancestor cascade'
);

/*
  Guest isolation. A guest holds a workspace_members row, so these are the
  cases that catch the whole class of "guest is treated as staff" bugs. Each
  one was a real hole before is_staff existed.
*/
select ok(not public.is_staff('<workspace-uuid>'), 'guest is not staff');

select is_empty(
  $$select 1 from public.comments
     where subject_id = '<ungranted-item>'$$,
  'guest cannot read comments on a project they were not granted'
);

select is_empty(
  $$select 1 from public.content_items where id = '<ungranted-item>'$$,
  'guest cannot read an ungranted project'
);

select is_empty(
  $$select 1 from public.workspace_members$$,
  'guest cannot enumerate the team'
);

select throws_ok(
  $$update public.content_items set title = 'hijacked'
     where id = '<ungranted-item>'$$,
  null,
  'guest cannot write to an ungranted project'
);

-- Editors make things but do not sign them off.
set local request.jwt.claims = '{"sub":"<editor-uuid>","role":"authenticated"}';
select ok(public.is_staff('<workspace-uuid>'), 'editor is staff');
select ok(not public.can_approve('<workspace-uuid>'), 'editor cannot approve');
select ok(not public.can_publish('<workspace-uuid>'), 'editor cannot publish');
select ok(not public.can_invite_guests('<workspace-uuid>'), 'editor cannot invite');

-- Admins approve and publish but cannot change the team.
set local request.jwt.claims = '{"sub":"<admin-uuid>","role":"authenticated"}';
select ok(public.can_approve('<workspace-uuid>'), 'admin approves');
select ok(public.can_publish('<workspace-uuid>'), 'admin publishes');
select ok(not public.can_manage_people('<workspace-uuid>'), 'admin cannot change roles');

select * from finish();
rollback;
```

Update `plan(4)` to match the number of assertions — pgTAP fails the run if the
count is wrong, which is the point.

```powershell
pnpm dlx supabase test db
```

Cover all seven cases from the step 10 table, plus the RLS coverage query from
step 11 as its own test. That second one is what catches the table you add at
1am six months from now.

---

## 12h. `updated_at`

None of the tables track modification time, which you will want the first time
you debug a sync bug or sort by "recently touched".

```sql
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- Repeat for each table that has the column.
alter table public.content_items add column updated_at timestamptz not null default now();
create trigger touch_content_items before update on public.content_items
for each row execute function public.touch_updated_at();
```

---

## 13. Seed and sign in

Create a user through the app rather than by hand, so the auth rows are
consistent. Add a throwaway sign-in to `apps/app`:

```tsx
// apps/app/src/routes/dev-auth.tsx — delete once real auth exists
import { useState } from "react"
import { supabase } from "@/lib/supabase"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

export function DevAuthPage() {
  const [email, setEmail] = useState("leon@blomstr.app")
  const [password, setPassword] = useState("password123")
  const [message, setMessage] = useState("")

  async function run(mode: "signUp" | "signInWithPassword") {
    const { error } = await supabase.auth[mode]({ email, password })
    setMessage(error ? error.message : `${mode} ok`)
  }

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3">
      <Input value={email} onChange={(e) => setEmail(e.target.value)} className="w-72" />
      <Input
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        className="w-72"
      />
      <div className="flex gap-2">
        <Button onClick={() => run("signUp")}>Sign up</Button>
        <Button variant="outline" onClick={() => run("signInWithPassword")}>
          Sign in
        </Button>
      </div>
      <p className="text-sm text-muted-foreground">{message}</p>
    </div>
  )
}
```

Route it at `/dev-auth`, sign up once, then seed. Local Supabase does not
require email confirmation by default.

Then in Studio's SQL editor, **as that user** — or simply run the insert with
the user's id looked up by email:

```sql
-- supabase/seed.sql  (runs automatically on `supabase db reset`)
do $$
declare
  uid uuid;
  ws  uuid;
  s_ideas uuid; s_progress uuid; s_review uuid; s_published uuid;
begin
  select id into uid from auth.users where email = 'leon@blomstr.app';
  if uid is null then
    raise notice 'no user yet — sign up at /dev-auth, then run db reset again';
    return;
  end if;

  insert into public.workspaces (name) values ('Leon') returning id into ws;
  insert into public.workspace_members (workspace_id, user_id, role)
  values (ws, uid, 'owner');

  insert into public.stages (workspace_id, name, position) values
    (ws,'Ideas',0),(ws,'In progress',1),(ws,'Review',2),(ws,'Published',3);

  select id into s_ideas     from public.stages where workspace_id = ws and position = 0;
  select id into s_progress  from public.stages where workspace_id = ws and position = 1;
  select id into s_review    from public.stages where workspace_id = ws and position = 2;
  select id into s_published from public.stages where workspace_id = ws and position = 3;

  insert into public.content_items
    (workspace_id, type, title, stage_id, position, platforms, due_at, publish_at, created_by)
  values
    (ws,'youtube_video','I Tried AI for 30 Days',       s_progress, 'a2', '{youtube}',           '2026-08-22', null, uid),
    (ws,'youtube_video','Studio tour + gear breakdown', s_progress, 'a0', '{youtube}',           '2026-08-25', null, uid),
    (ws,'podcast',      'Podcast ep. 14 — guest recording', s_progress,'a1','{}',                '2026-08-20', null, uid),
    (ws,'tiktok',       'Desk setup — 3 clips',         s_progress, 'a3', '{tiktok,instagram}',  '2026-08-18', null, uid),
    (ws,'sponsored',    'Nord VPN — sponsored integration', s_review,'a0','{youtube}',           '2026-08-19', null, uid),
    (ws,'thumbnail',    'Thumbnail A/B — AI video',     s_review,   'a1', '{}',                  null,         null, uid),
    (ws,'youtube_video','Reacting to my old videos',    s_ideas,    'a0', '{youtube}',           null,         null, uid),
    (ws,'youtube_video','Q4 collab ideas',              s_ideas,    'a1', '{}',                  null,         null, uid),
    (ws,'reel',         'Back to school haul',          s_published,'a0', '{instagram}',         null, '2026-08-15T15:00:00Z', uid);
end $$;
```

```powershell
pnpm dlx supabase db reset      # replays migrations + seed
```

---

## 14. Generate types

After **every** migration, without exception:

```powershell
pnpm dlx supabase gen types typescript --local > packages/types/src/database.ts
```

Add it as a script so nobody forgets:

```json
// package.json (root)
"db:types": "supabase gen types typescript --local > packages/types/src/database.ts",
"db:reset": "supabase db reset && pnpm db:types"
```

### The camelCase decision — make it now

Generated types are `snake_case` (`stage_id`, `publish_at`); the app is
`camelCase` (`stageId`, `publishAt`). Decide once, before any component reads
real data.

**Map at the query boundary.** Less churn than renaming across every component,
and it keeps the UI ignorant of the schema.

```ts
// apps/app/src/lib/mappers.ts
import type { ContentItem } from "@blomstr/types"
import type { Database } from "@blomstr/types/database"

type Row = Database["public"]["Tables"]["content_items"]["Row"]

export function toContentItem(row: Row, assigneeIds: string[] = []): ContentItem {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    parentId: row.parent_id,
    ancestorIds: row.ancestor_ids,
    type: row.type,
    title: row.title,
    stageId: row.stage_id,
    position: row.position,
    assigneeIds,
    approvalState: "draft",   // comes from content_item_status, joined separately
    dueAt: row.due_at,
    publishAt: row.publish_at,
    platforms: row.platforms,
    sourceStartMs: row.source_start_ms ?? undefined,
    sourceEndMs: row.source_end_ms ?? undefined,
    createdAt: row.created_at,
  }
}
```

`packages/types/src/index.ts` keeps only what has no table equivalent — view
models and UI-only shapes. Everything with a table comes from `database.ts`.

---

## 15. Swap the provider

`ContentProvider` was written for this: the board and the project page call
`useContent()` and don't know where the data comes from. Replace the inside,
leave every consumer alone.

```tsx
// apps/app/src/hooks/use-content.tsx — the shape of the replacement
const { data: items = [] } = useQuery({
  queryKey: ["content_items", workspaceId],
  queryFn: async () => {
    const { data, error } = await supabase
      .from("content_items")
      .select("*, content_item_assignees(user_id)")
      .eq("workspace_id", workspaceId)
      .order("position")
    if (error) throw error
    return data.map((row) =>
      toContentItem(row, row.content_item_assignees.map((a) => a.user_id)),
    )
  },
})

const move = useMutation({
  mutationFn: async ({ id, stageId, position }) => {
    const { error } = await supabase
      .from("content_items")
      .update({ stage_id: stageId, position })
      .eq("id", id)
    if (error) throw error
  },
  // The current moveItem() body becomes this — the board already feels
  // instant, and this keeps it that way while the round trip happens.
  onMutate: async (next) => {
    await queryClient.cancelQueries({ queryKey: ["content_items", workspaceId] })
    const previous = queryClient.getQueryData(["content_items", workspaceId])
    queryClient.setQueryData(["content_items", workspaceId], (old) =>
      old.map((i) => (i.id === next.id ? { ...i, ...next } : i)),
    )
    return { previous }
  },
  onError: (_e, _v, ctx) =>
    queryClient.setQueryData(["content_items", workspaceId], ctx.previous),
  onSettled: () =>
    queryClient.invalidateQueries({ queryKey: ["content_items", workspaceId] }),
})
```

`moveItem` keeps computing the rank with `rankBetween` exactly as it does now —
that logic doesn't change, it just gets persisted afterwards.

**Order of work in the app:**

1. Auth session in a provider; redirect to `/dev-auth` when there's no session
2. Resolve the current `workspaceId` from `workspace_members`
3. Swap `ContentProvider` internals to the query above
4. Read `approvalState` from `content_item_status` instead of the column
5. Replace `members` with `workspace_members` joined to profiles
6. Replace `currentUser` with `supabase.auth.getUser()`
7. Delete `mock-data.ts`

Do them in that order. Each one leaves the app working.

---

## 16. Done when

- [ ] `supabase start` runs; `.env` set; the app boots without the missing-env throw
- [ ] `supabase db reset` applies all 16 migrations cleanly to an empty database
- [ ] The RLS coverage query returns `rls_on = true` and `policies > 0` for every table
- [ ] `can_read_item` passes all seven cases in the step 10 table, under pgTAP
- [ ] `check_ancestor_integrity()` returns 0 rows after a re-parent
- [ ] A signup creates a `profiles` row automatically
- [ ] `create_invite` → `redeem_invite` gives a fresh account access to one
      project and its children, and nothing else
- [ ] A revoked or expired invite fails with the same message as a bogus one
- [ ] Types regenerate into `packages/types/src/database.ts`
- [ ] The board reads real rows and **a drag survives a refresh**
- [ ] `mock-data.ts` is deleted

---

## Troubleshooting

**`supabase start` hangs or fails**
Docker isn't running. `docker ps` must succeed first.

**`infinite recursion detected in policy for relation "workspace_members"`**
A policy on that table is calling a function that reads it without
`security definer`. `is_staff` must be `security definer` — that's what makes
it bypass the policy it's being used inside.

**`permission denied for schema public` inside a function**
Missing `set search_path = ''` combined with unqualified table names. Every
`security definer` function needs both the setting *and* `public.` prefixes.

**`new row violates row-level security policy`**
An insert policy is missing, or uses `using` where it needs `with check`.
`using` filters what you can see; `with check` validates what you write.

**The board is empty but rows exist in Studio**
Studio queries as `service_role` and ignores RLS. The app queries as the signed-in
user. You're either not authenticated or not a member of that workspace.

**`rankBetween: "a0" must sort before "a0"`**
Duplicate `position` in one stage. The partial unique index from step 5 should
prevent it; if it fires, something wrote a rank without going through
`rankBetween`.

**Types are stale after a migration**
You forgot `db:types`. Use `pnpm db:reset`, which chains both.
