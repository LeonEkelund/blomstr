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
