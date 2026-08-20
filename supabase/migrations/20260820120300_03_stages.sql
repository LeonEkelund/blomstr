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
