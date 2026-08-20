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
