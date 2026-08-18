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
- [ ] 3. `02_workspaces` + `is_member`
- [ ] 4. `03_stages` + default seed
- [ ] 5. `04_content_graph` + ancestor trigger
- [ ] 6. `05_assets_versions` + status view
- [ ] 7. `06_comments`
- [ ] 8. `07_events`
- [ ] 9. `08_jobs`
- [ ] 10. `09_guest_grants` + `can_read_item`
- [ ] 11. `10_rls` — every table at once
- [ ] 12. `11_rpc` — approval, publish, invites
- [ ] 13. Seed a workspace and sign in
- [ ] 14. Generate types
- [ ] 15. Swap `ContentProvider` off fixtures
- [ ] 16. Delete `mock-data.ts`

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
cd C:\Users\Leon\Documents\blomstr
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

create type public.workspace_role as enum ('owner','member','guest');

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
  created_at  timestamptz not null default now()
);

create table public.workspace_members (
  workspace_id uuid not null references public.workspaces on delete cascade,
  user_id      uuid not null references auth.users on delete cascade,
  role         public.workspace_role not null default 'member',
  can_publish  boolean not null default false,
  created_at   timestamptz not null default now(),
  primary key (workspace_id, user_id)
);

-- "which workspaces am I in" is the hot path on every page load.
create index on public.workspace_members (user_id);

/*
  The foundation of every policy.

  security definer so it can read workspace_members without recursing into
  that table's own RLS policy. set search_path = '' plus fully-qualified names
  is mandatory — without it this is a privilege-escalation vector.

  (select auth.uid()) rather than auth.uid() so Postgres treats it as an
  InitPlan and evaluates it once per query instead of once per row.
*/
create or replace function public.is_member(ws uuid)
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
```

**Verify:**

```sql
select public.is_member(gen_random_uuid());   -- false, and no error
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
  yet a member of, so no RLS policy written in terms of is_member() can allow
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

  insert into public.workspace_members (workspace_id, user_id, role, can_publish)
  values (ws, uid, 'owner', true);

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
  created_at      timestamptz not null default now()
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
    public.is_member(item.workspace_id)
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
alter table public.stages                 enable row level security;
alter table public.content_items          enable row level security;
alter table public.content_item_assignees enable row level security;
alter table public.assets                 enable row level security;
alter table public.asset_versions         enable row level security;
alter table public.comments               enable row level security;
alter table public.events                 enable row level security;
alter table public.jobs                   enable row level security;
alter table public.guest_grants           enable row level security;

-- workspaces: no insert policy — creation goes through create_workspace().
create policy read_workspaces on public.workspaces
  for select using (public.is_member(id));
create policy update_workspaces on public.workspaces
  for update using (public.has_role(id, array['owner']::public.workspace_role[]));

-- membership: you can see your workspace's roster; only owners change it.
create policy read_members on public.workspace_members
  for select using (public.is_member(workspace_id));
create policy manage_members on public.workspace_members
  for all using (public.has_role(workspace_id, array['owner']::public.workspace_role[]));

create policy read_stages on public.stages
  for select using (public.is_member(workspace_id));
create policy write_stages on public.stages
  for all using (public.has_role(workspace_id, array['owner','member']::public.workspace_role[]));

-- content: guests read through the grant cascade, members write.
create policy read_items on public.content_items
  for select using (public.can_read_item(content_items));
create policy insert_items on public.content_items
  for insert with check (public.is_member(workspace_id));
create policy update_items on public.content_items
  for update using (public.is_member(workspace_id));
create policy delete_items on public.content_items
  for delete using (public.has_role(workspace_id, array['owner','member']::public.workspace_role[]));

create policy read_assignees on public.content_item_assignees
  for select using (exists (
    select 1 from public.content_items c
     where c.id = content_item_id and public.can_read_item(c)
  ));
create policy write_assignees on public.content_item_assignees
  for all using (exists (
    select 1 from public.content_items c
     where c.id = content_item_id and public.is_member(c.workspace_id)
  ));

create policy read_assets on public.assets
  for select using (exists (
    select 1 from public.content_items c
     where c.id = content_item_id and public.can_read_item(c)
  ));
create policy write_assets on public.assets
  for all using (public.is_member(workspace_id));

create policy read_versions on public.asset_versions
  for select using (exists (
    select 1 from public.assets a
      join public.content_items c on c.id = a.content_item_id
     where a.id = asset_id and public.can_read_item(c)
  ));
create policy insert_versions on public.asset_versions
  for insert with check (public.is_member(workspace_id));

/*
  Deliberately no update policy on asset_versions.

  approval_state is the one column a client must never set directly — it moves
  only through approve_version() / request_changes(), which check the state
  machine and emit an event in the same transaction.
*/

create policy read_comments on public.comments
  for select using (public.is_member(workspace_id));
create policy insert_comments on public.comments
  for insert with check (public.is_member(workspace_id) and author_id = (select auth.uid()));
create policy edit_own_comments on public.comments
  for update using (author_id = (select auth.uid()));
create policy delete_own_comments on public.comments
  for delete using (author_id = (select auth.uid()));

create policy read_events on public.events
  for select using (public.is_member(workspace_id));
-- No insert policy: events are written only by emit_event(), security definer.

create policy read_jobs on public.jobs
  for select using (public.has_role(workspace_id, array['owner']::public.workspace_role[]));
-- No write policy: jobs are enqueued by RPCs and processed by Edge Functions.

create policy read_grants on public.guest_grants
  for select using (public.is_member(workspace_id) or user_id = (select auth.uid()));
create policy manage_grants on public.guest_grants
  for all using (public.has_role(workspace_id, array['owner','member']::public.workspace_role[]));
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

## 12. RPCs

```powershell
pnpm dlx supabase migration new 11_rpc
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
  if not public.is_member(ws) then
    raise exception 'not a member of this workspace';
  end if;

  select coalesce(max(version_number), 0) + 1 into next_number
    from public.asset_versions where asset_id = p_asset_id;

  self_approved := public.has_role(ws, array['owner']::public.workspace_role[]);

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

  if not public.has_role(v.workspace_id, array['owner']::public.workspace_role[]) then
    raise exception 'only an owner can approve';
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
  if not public.has_role(v.workspace_id, array['owner']::public.workspace_role[]) then
    raise exception 'only an owner can request changes';
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
  if not exists (
    select 1 from public.workspace_members m
     where m.workspace_id = ws and m.user_id = (select auth.uid()) and m.can_publish
  ) then
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
  if not public.is_member(c.workspace_id) then
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

### 12b. Lock the columns the client must never write

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
  insert into public.workspace_members (workspace_id, user_id, role, can_publish)
  values (ws, uid, 'owner', true);

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
- [ ] `supabase db reset` applies all 11 migrations cleanly to an empty database
- [ ] The RLS coverage query returns `rls_on = true` and `policies > 0` for every table
- [ ] `can_read_item` passes all seven cases in the step 10 table
- [ ] `check_ancestor_integrity()` returns 0 rows after a re-parent
- [ ] Types regenerate into `packages/types/src/database.ts`
- [ ] The board reads real rows and **a drag survives a refresh**
- [ ] `mock-data.ts` is deleted

---

## Troubleshooting

**`supabase start` hangs or fails**
Docker isn't running. `docker ps` must succeed first.

**`infinite recursion detected in policy for relation "workspace_members"`**
A policy on that table is calling a function that reads it without
`security definer`. `is_member` must be `security definer` — that's what makes
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
