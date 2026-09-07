/*
  Notifications are personal pointers to high-signal events, not another copy
  of the workspace activity feed. Events remain the audit log; this table adds
  recipients and read state.
*/
create table public.notifications (
  id              bigint generated always as identity primary key,
  workspace_id    uuid not null references public.workspaces on delete cascade,
  user_id         uuid not null references auth.users on delete cascade,
  actor_id        uuid references auth.users on delete set null,
  content_item_id uuid not null references public.content_items on delete cascade,
  event_id        bigint not null references public.events on delete cascade,
  kind            text not null,
  payload         jsonb not null default '{}',
  read_at         timestamptz,
  created_at      timestamptz not null default now(),
  unique (event_id, user_id),
  constraint notification_kind_check check (
    kind in ('assigned', 'submitted_for_review', 'approved',
             'changes_requested', 'commented')
  )
);

create index notifications_inbox_idx
  on public.notifications (user_id, workspace_id, created_at desc);

alter table public.notifications enable row level security;

create policy read_own_notifications on public.notifications
  for select using (user_id = (select auth.uid()));

create policy update_own_notifications on public.notifications
  for update using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

revoke update on public.notifications from authenticated;
grant update (read_at) on public.notifications to authenticated;

/*
  Turn only actionable events into inbox entries:
  - a new assignee is told about the project;
  - owners/admins are told when work needs review;
  - the person who made a version receives its decision;
  - people attached to a project receive new discussion.
*/
create or replace function public.deliver_event_notifications()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_item_id uuid;
  version_creator uuid;
  version_number integer;
  recipient uuid;
  notification_payload jsonb;
begin
  if new.subject_type = 'content_item' then
    v_item_id := new.subject_id;
  elsif new.subject_type = 'asset_version' then
    select a.content_item_id, av.created_by, av.version_number
      into v_item_id, version_creator, version_number
      from public.asset_versions av
      join public.assets a on a.id = av.asset_id
     where av.id = new.subject_id;
  elsif new.payload ? 'content_item_id' then
    v_item_id := (new.payload ->> 'content_item_id')::uuid;
  end if;

  if v_item_id is null then
    return new;
  end if;

  notification_payload := new.payload ||
    jsonb_build_object('subject_type', new.subject_type) ||
    case when version_number is null then '{}'::jsonb
         else jsonb_build_object('version', version_number)
    end;

  if new.verb = 'assigned' then
    recipient := nullif(new.payload ->> 'user_id', '')::uuid;
    if recipient is not null and recipient is distinct from new.actor_id then
      insert into public.notifications
        (workspace_id, user_id, actor_id, content_item_id, event_id, kind, payload)
      values
        (new.workspace_id, recipient, new.actor_id, v_item_id, new.id,
         'assigned', notification_payload)
      on conflict (event_id, user_id) do nothing;
    end if;

  elsif new.verb = 'submitted_for_review' then
    insert into public.notifications
      (workspace_id, user_id, actor_id, content_item_id, event_id, kind, payload)
    select new.workspace_id, member.user_id, new.actor_id, v_item_id, new.id,
           'submitted_for_review', notification_payload
      from public.workspace_members member
     where member.workspace_id = new.workspace_id
       and member.role in ('owner', 'admin')
       and member.user_id is distinct from new.actor_id
    on conflict (event_id, user_id) do nothing;

  elsif new.verb in ('approved', 'changes_requested') then
    if version_creator is not null and version_creator is distinct from new.actor_id then
      insert into public.notifications
        (workspace_id, user_id, actor_id, content_item_id, event_id, kind, payload)
      values
        (new.workspace_id, version_creator, new.actor_id, v_item_id, new.id,
         new.verb, notification_payload)
      on conflict (event_id, user_id) do nothing;
    end if;

  elsif new.verb = 'commented' then
    insert into public.notifications
      (workspace_id, user_id, actor_id, content_item_id, event_id, kind, payload)
    select new.workspace_id, people.user_id, new.actor_id, v_item_id, new.id,
           'commented', notification_payload
      from (
        select item.created_by as user_id
          from public.content_items item where item.id = v_item_id
        union
        select assignment.user_id
          from public.content_item_assignees assignment
         where assignment.content_item_id = v_item_id
        union
        select member.user_id
          from public.workspace_members member
         where member.workspace_id = new.workspace_id
           and member.role in ('owner', 'admin')
        union
        select grant_row.user_id
          from public.guest_grants grant_row
          join public.content_items item on item.id = v_item_id
         where grant_row.content_item_id = item.id
            or grant_row.content_item_id = any(item.ancestor_ids)
        union
        select version_creator where version_creator is not null
      ) people
     where people.user_id is distinct from new.actor_id
    on conflict (event_id, user_id) do nothing;
  end if;

  return new;
end;
$$;

create trigger events_deliver_notifications
after insert on public.events
for each row execute function public.deliver_event_notifications();

/* Assignment was not previously an event, so make it atomic like comments. */
create or replace function public.track_assignment_activity()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  ws uuid;
begin
  select item.workspace_id into ws
    from public.content_items item where item.id = new.content_item_id;

  perform public.emit_event(
    ws,
    'content_item',
    new.content_item_id,
    'assigned',
    jsonb_build_object('user_id', new.user_id)
  );
  return new;
end;
$$;

create trigger content_item_assignees_track_assignment
after insert on public.content_item_assignees
for each row execute function public.track_assignment_activity();
