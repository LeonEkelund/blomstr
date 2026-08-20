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
