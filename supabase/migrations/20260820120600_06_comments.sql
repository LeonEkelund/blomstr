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
