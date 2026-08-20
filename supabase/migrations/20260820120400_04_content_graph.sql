create table public.content_items (
  id              uuid primary key default gen_random_uuid(),
  workspace_id    uuid not null references public.workspaces on delete cascade,
  parent_id       uuid references public.content_items on delete cascade,
  ancestor_ids    uuid[] not null default '{}',
  type            public.content_type not null,
  title           text not null,
  /*
    What the Notes tab writes to. Scratch — nobody approves a note, so it
    needs no versions and no review. The script is the opposite and lives in
    assets as kind = 'document'.

    Titles and descriptions per platform are packaging, not notes; those are
    on publish_targets.
  */
  notes           text,
  stage_id        uuid not null references public.stages,
  position        text not null,
  /*
    Soft delete. A hard delete cascades away every comment, version and event
    attached to the project, and creators will do it by accident.
  */
  archived_at     timestamptz,
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
