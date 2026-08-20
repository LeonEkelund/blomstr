create table public.jobs (
  id              uuid primary key default gen_random_uuid(),
  workspace_id    uuid not null references public.workspaces on delete cascade,
  kind            text not null,   -- 'publish' | 'drive_sync' | 'metrics'
  payload         jsonb not null default '{}',
  idempotency_key text not null unique,
  status          public.job_status not null default 'queued',
  attempts        int not null default 0,
  run_after       timestamptz not null default now(),
  leased_until    timestamptz,
  last_error      text,
  created_at      timestamptz not null default now()
);

create index on public.jobs (status, run_after);

/*
  Lease rather than a status flag: a worker that crashes mid-job leaves the row
  in 'leased' forever otherwise. skip locked lets several workers pull without
  fighting over the same row.
*/
create or replace function public.lease_jobs(kinds text[], lease_seconds int default 60, batch int default 10)
returns setof public.jobs
language sql
security definer
set search_path = ''
as $$
  update public.jobs j
     set status = 'leased',
         leased_until = now() + make_interval(secs => lease_seconds),
         attempts = j.attempts + 1
   where j.id in (
     select id from public.jobs
      where kind = any (kinds)
        and run_after <= now()
        and (status = 'queued' or (status = 'leased' and leased_until < now()))
      order by run_after
      limit batch
      for update skip locked
   )
  returning j.*;
$$;
