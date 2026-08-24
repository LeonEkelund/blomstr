/*
  Fixes a cast in create_version.

  The state was chosen with `case when self_approved then 'approved' else
  'in_review' end`, which types as `text`. Postgres would normally coerce that
  into the approval_state enum on assignment, but these functions run with
  `set search_path = ''` — which is what stops them being a privilege
  escalation vector — and the implicit cast cannot resolve the type without a
  schema to look in. So it is spelled out.

  Replacing rather than editing migration 11: that one is already applied, and
  a migration that has run anywhere is frozen.
*/
create or replace function public.create_version(
  p_asset_id uuid,
  p_storage_path text default null,
  p_drive_file_id text default null,
  p_body text default null
)
returns public.asset_versions
language plpgsql
security definer
set search_path = ''
as $$
declare
  ws uuid;
  item uuid;
  next_number int;
  self_approved boolean;
  result public.asset_versions;
begin
  select a.workspace_id, a.content_item_id into ws, item
    from public.assets a where a.id = p_asset_id;

  if ws is null then
    raise exception 'asset % not found', p_asset_id;
  end if;
  if not public.is_staff(ws) then
    raise exception 'not a member of this workspace';
  end if;

  -- Version numbers are per asset and assigned here, never by the client.
  select coalesce(max(version_number), 0) + 1 into next_number
    from public.asset_versions where asset_id = p_asset_id;

  /*
    The self-authored rule: if whoever uploads it already holds approve rights,
    the version is approved on creation. A creator posting their own thumbnail
    is not waiting on themselves.
  */
  self_approved := public.can_approve(ws);

  insert into public.asset_versions
    (workspace_id, asset_id, version_number, approval_state,
     storage_path, drive_file_id, body)
  values
    (ws, p_asset_id, next_number,
     (case when self_approved then 'approved' else 'in_review' end)::public.approval_state,
     p_storage_path, p_drive_file_id, p_body)
  returning * into result;

  perform public.emit_event(
    ws, 'asset_version', result.id,
    case when self_approved then 'approved' else 'submitted_for_review' end,
    jsonb_build_object('content_item_id', item, 'version', next_number)
  );

  return result;
end;
$$;
