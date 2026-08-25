/*
  One single-player Excalidraw scene per content item.

  Image bytes never live in scene JSON. `files` stores ids and private Storage
  paths, while objects remain under <workspace>/<content-item>/mindmap/.
*/
create table public.mindmaps (
  content_item_id uuid primary key references public.content_items on delete cascade,
  workspace_id    uuid not null references public.workspaces on delete cascade,
  scene           jsonb not null default '{"type":"excalidraw","version":1,"elements":[],"appState":{},"files":{}}',
  updated_by      uuid references auth.users default auth.uid(),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index on public.mindmaps (workspace_id);
alter table public.mindmaps enable row level security;

create policy read_mindmaps on public.mindmaps
  for select using (
    exists (
      select 1 from public.content_items c
       where c.id = mindmaps.content_item_id
         and c.workspace_id = mindmaps.workspace_id
         and public.can_read_item(c)
    )
  );

-- Guests may see a granted project's canvas, but only staff can change it.
create policy insert_mindmaps on public.mindmaps
  for insert with check (
    public.is_staff(workspace_id)
    and exists (
      select 1 from public.content_items c
       where c.id = content_item_id and c.workspace_id = workspace_id
    )
  );

create policy update_mindmaps on public.mindmaps
  for update using (public.is_staff(workspace_id))
  with check (
    public.is_staff(workspace_id)
    and exists (
      select 1 from public.content_items c
       where c.id = content_item_id and c.workspace_id = workspace_id
    )
  );

create policy delete_mindmaps on public.mindmaps
  for delete using (public.is_staff(workspace_id));

create or replace function public.touch_mindmap()
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

create trigger mindmaps_touch_updated_at
before update on public.mindmaps
for each row execute function public.touch_mindmap();
