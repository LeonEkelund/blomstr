/*
  One owner-managed Google Drive connection per workspace.

  Refresh tokens are encrypted by Supabase Vault. The public table keeps only
  the Vault row id and non-sensitive account metadata; browser roles cannot
  read the secret id or write connection rows directly.
*/
create extension if not exists supabase_vault with schema vault;

create table public.drive_connections (
  id                      uuid primary key default gen_random_uuid(),
  workspace_id            uuid not null unique references public.workspaces on delete cascade,
  connected_by            uuid not null references auth.users on delete cascade,
  google_email            text not null,
  refresh_token_secret_id uuid not null,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);

alter table public.drive_connections enable row level security;

create policy read_drive_connections on public.drive_connections
  for select using (public.is_staff(workspace_id));

revoke all on public.drive_connections from anon, authenticated;
grant select (id, workspace_id, connected_by, google_email, created_at, updated_at)
  on public.drive_connections to authenticated;
grant all on public.drive_connections to service_role;

/*
  Short-lived, single-use OAuth state. There is deliberately no client access;
  Edge Functions use the service role, which bypasses RLS.
*/
create table public.drive_oauth_states (
  state_hash   text primary key,
  workspace_id uuid not null references public.workspaces on delete cascade,
  user_id      uuid not null references auth.users on delete cascade,
  expires_at   timestamptz not null default (now() + interval '10 minutes'),
  created_at   timestamptz not null default now()
);

alter table public.drive_oauth_states enable row level security;

create policy no_client_drive_oauth_states on public.drive_oauth_states
  for all to authenticated using (false) with check (false);

revoke all on public.drive_oauth_states from anon, authenticated;
grant all on public.drive_oauth_states to service_role;

/*
  File references belong to assets, not versions. Linking raw footage should
  not move a project's derived approval state; a reviewed Drive delivery can
  still be snapshotted into asset_versions.drive_file_id later.
*/
alter table public.assets
  add column drive_file_id text,
  add column mime_type text,
  add column size_bytes bigint;

alter table public.assets
  add constraint drive_asset_has_file_id check (
    kind <> 'drive_file' or drive_file_id is not null
  ),
  add constraint drive_file_id_is_safe check (
    drive_file_id is null or drive_file_id ~ '^[A-Za-z0-9_-]+$'
  ),
  add constraint asset_size_is_positive check (
    size_bytes is null or size_bytes >= 0
  );

create unique index assets_one_drive_file_per_item
  on public.assets (content_item_id, drive_file_id)
  where drive_file_id is not null;

/* Called only by the OAuth callback Edge Function. */
create or replace function public.upsert_drive_connection_secret(
  p_workspace_id uuid,
  p_connected_by uuid,
  p_google_email text,
  p_refresh_token text
)
returns public.drive_connections
language plpgsql
security definer
set search_path = ''
as $$
declare
  existing public.drive_connections;
  secret_id uuid;
  result public.drive_connections;
begin
  if nullif(trim(p_refresh_token), '') is null then
    raise exception 'refresh token is required';
  end if;

  select * into existing
    from public.drive_connections
   where workspace_id = p_workspace_id
   for update;

  if existing.id is null then
    secret_id := vault.create_secret(
      p_refresh_token,
      'drive:' || p_workspace_id::text,
      'Google Drive refresh token for workspace ' || p_workspace_id::text
    );
  else
    secret_id := existing.refresh_token_secret_id;
    perform vault.update_secret(secret_id, p_refresh_token);
  end if;

  insert into public.drive_connections (
    workspace_id,
    connected_by,
    google_email,
    refresh_token_secret_id
  ) values (
    p_workspace_id,
    p_connected_by,
    trim(p_google_email),
    secret_id
  )
  on conflict (workspace_id) do update set
    connected_by = excluded.connected_by,
    google_email = excluded.google_email,
    updated_at = now()
  returning * into result;

  return result;
end;
$$;

revoke all on function public.upsert_drive_connection_secret(uuid, uuid, text, text)
  from public, anon, authenticated;
grant execute on function public.upsert_drive_connection_secret(uuid, uuid, text, text)
  to service_role;

/* Called only by trusted Edge Functions when refreshing an access token. */
create or replace function public.get_drive_refresh_token(p_workspace_id uuid)
returns text
language sql
security definer
set search_path = ''
as $$
  select secret.decrypted_secret
    from public.drive_connections connection
    join vault.decrypted_secrets secret
      on secret.id = connection.refresh_token_secret_id
   where connection.workspace_id = p_workspace_id;
$$;

revoke all on function public.get_drive_refresh_token(uuid)
  from public, anon, authenticated;
grant execute on function public.get_drive_refresh_token(uuid) to service_role;

/* Owner-facing disconnect that also removes the encrypted Vault entry. */
create or replace function public.disconnect_drive(p_workspace_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  secret_id uuid;
begin
  if not public.has_role(
    p_workspace_id,
    array['owner']::public.workspace_role[]
  ) then
    raise exception 'only the workspace owner can disconnect Drive';
  end if;

  delete from public.drive_connections
   where workspace_id = p_workspace_id
   returning refresh_token_secret_id into secret_id;

  if secret_id is not null then
    delete from vault.secrets where id = secret_id;
  end if;
end;
$$;

revoke all on function public.disconnect_drive(uuid) from public, anon;
grant execute on function public.disconnect_drive(uuid) to authenticated;

/*
  Atomic, validated insertion for files selected through Google Picker.
  Re-selecting the same file refreshes its metadata instead of duplicating it.
*/
create or replace function public.link_drive_file(
  p_content_item_id uuid,
  p_drive_file_id text,
  p_title text,
  p_mime_type text default null,
  p_size_bytes bigint default null
)
returns public.assets
language plpgsql
security definer
set search_path = ''
as $$
declare
  ws uuid;
  result public.assets;
begin
  select workspace_id into ws
    from public.content_items
   where id = p_content_item_id
     and archived_at is null;

  if ws is null then
    raise exception 'project not found';
  end if;
  if not public.is_staff(ws) then
    raise exception 'not a staff member of this workspace';
  end if;
  if nullif(trim(p_title), '') is null then
    raise exception 'file title is required';
  end if;
  if p_drive_file_id !~ '^[A-Za-z0-9_-]+$' then
    raise exception 'invalid Drive file id';
  end if;

  insert into public.assets (
    workspace_id,
    content_item_id,
    kind,
    title,
    drive_file_id,
    mime_type,
    size_bytes
  ) values (
    ws,
    p_content_item_id,
    'drive_file',
    trim(p_title),
    p_drive_file_id,
    nullif(trim(p_mime_type), ''),
    p_size_bytes
  )
  on conflict (content_item_id, drive_file_id)
    where drive_file_id is not null
  do update set
    title = excluded.title,
    mime_type = excluded.mime_type,
    size_bytes = excluded.size_bytes,
    updated_at = now()
  returning * into result;

  return result;
end;
$$;

revoke all on function public.link_drive_file(uuid, text, text, text, bigint)
  from public, anon;
grant execute on function public.link_drive_file(uuid, text, text, text, bigint)
  to authenticated;
