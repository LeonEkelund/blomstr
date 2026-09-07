/*
  Packaging is per platform, while schedule and approval stay on the project.
  These rows are preparation only: publishing to an external audience remains
  a separate, idempotent job once a social connection exists.
*/
create table public.publish_targets (
  id              uuid primary key default gen_random_uuid(),
  workspace_id    uuid not null references public.workspaces on delete cascade,
  content_item_id uuid not null references public.content_items on delete cascade,
  platform        public.platform not null,
  title           text not null default '',
  caption         text not null default '',
  tags            text[] not null default '{}',
  updated_by      uuid references auth.users default auth.uid(),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (content_item_id, platform),
  constraint publish_target_title_length check (char_length(title) <= 300),
  constraint publish_target_caption_length check (char_length(caption) <= 5000),
  constraint publish_target_tag_count check (cardinality(tags) <= 30)
);

create index publish_targets_workspace_idx
  on public.publish_targets (workspace_id);

alter table public.publish_targets enable row level security;

create policy read_publish_targets on public.publish_targets
  for select using (
    exists (
      select 1 from public.content_items item
       where item.id = publish_targets.content_item_id
         and item.workspace_id = publish_targets.workspace_id
         and public.can_read_item(item)
    )
  );

/* Editors prepare packages; the irreversible publish action stays admin+. */
create policy insert_publish_targets on public.publish_targets
  for insert with check (
    public.is_staff(workspace_id)
    and exists (
      select 1 from public.content_items item
       where item.id = content_item_id
         and item.workspace_id = workspace_id
    )
  );

create policy update_publish_targets on public.publish_targets
  for update using (public.is_staff(workspace_id))
  with check (
    public.is_staff(workspace_id)
    and exists (
      select 1 from public.content_items item
       where item.id = content_item_id
         and item.workspace_id = workspace_id
    )
  );

create policy delete_publish_targets on public.publish_targets
  for delete using (public.is_staff(workspace_id));

create or replace function public.touch_publish_target()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at := now();
  new.updated_by := auth.uid();
  return new;
end;
$$;

create trigger publish_targets_touch_updated_at
before update on public.publish_targets
for each row execute function public.touch_publish_target();

/* One deliberate save is one useful activity entry, regardless of fields. */
create or replace function public.track_publish_target_activity()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if tg_op = 'INSERT'
     or old.title is distinct from new.title
     or old.caption is distinct from new.caption
     or old.tags is distinct from new.tags then
    perform public.emit_event(
      new.workspace_id,
      'content_item',
      new.content_item_id,
      'publish_target_updated',
      jsonb_build_object('platform', new.platform)
    );
  end if;
  return new;
end;
$$;

create trigger publish_targets_track_activity
after insert or update on public.publish_targets
for each row execute function public.track_publish_target_activity();
