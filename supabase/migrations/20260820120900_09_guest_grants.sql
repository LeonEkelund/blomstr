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
