/*
  The review loop's write path.

  Reads stay direct from the client, but these three changes carry invariants
  RLS cannot express — "only from in_review", "only with approve rights", "and
  record it in the same transaction" — so they are functions, and the columns
  they own are revoked from clients below.

  Scoped to approval only. The invite and publishing RPCs drafted in
  supabase_guide.md §12 depend on tables that were cut from the schema (invites,
  publish_targets) and would fail here.
*/

/*
  Creates the next version of an asset.

  The self-authored rule: if whoever uploads it already holds approve rights,
  the version is approved on creation. A creator posting their own thumbnail is
  not waiting on themselves — it is approved by construction. Without this the
  approval queue fills with people approving their own work and stops meaning
  anything.
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

  self_approved := public.can_approve(ws);

  insert into public.asset_versions
    (workspace_id, asset_id, version_number, approval_state,
     storage_path, drive_file_id, body)
  values
    (ws, p_asset_id, next_number,
     case when self_approved then 'approved' else 'in_review' end,
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

create or replace function public.approve_version(
  p_version_id uuid,
  p_note text default null
)
returns public.asset_versions
language plpgsql
security definer
set search_path = ''
as $$
declare
  v public.asset_versions;
begin
  select * into v from public.asset_versions where id = p_version_id;
  if v.id is null then
    raise exception 'version % not found', p_version_id;
  end if;

  if not public.can_approve(v.workspace_id) then
    raise exception 'no approve permission';
  end if;

  /*
    The state machine. Approving something still in draft would skip review
    entirely, which hides work rather than signing it off — and approving twice
    should be an error, not a silent no-op.
  */
  if v.approval_state not in ('in_review', 'changes_requested') then
    raise exception 'cannot approve from state %', v.approval_state;
  end if;

  update public.asset_versions
     set approval_state = 'approved'
   where id = p_version_id
  returning * into v;

  perform public.emit_event(v.workspace_id, 'asset_version', v.id, 'approved',
                            jsonb_build_object('note', p_note));
  return v;
end;
$$;

/*
  Requesting changes always carries a note — a rejection without a reason just
  moves the conversation back to Discord, which is the thing this replaces. The
  note is written as a comment so it lands in the same thread as everything
  else said about this version.
*/
create or replace function public.request_changes(p_version_id uuid, p_note text)
returns public.asset_versions
language plpgsql
security definer
set search_path = ''
as $$
declare
  v public.asset_versions;
begin
  if p_note is null or length(trim(p_note)) = 0 then
    raise exception 'a note is required when requesting changes';
  end if;

  select * into v from public.asset_versions where id = p_version_id;
  if v.id is null then
    raise exception 'version % not found', p_version_id;
  end if;
  if not public.can_approve(v.workspace_id) then
    raise exception 'no approve permission';
  end if;
  if v.approval_state <> 'in_review' then
    raise exception 'cannot request changes from state %', v.approval_state;
  end if;

  update public.asset_versions
     set approval_state = 'changes_requested'
   where id = p_version_id
  returning * into v;

  insert into public.comments (workspace_id, subject_type, subject_id, body)
  values (v.workspace_id, 'asset_version', v.id, p_note);

  perform public.emit_event(v.workspace_id, 'asset_version', v.id, 'changes_requested',
                            jsonb_build_object('note', p_note));
  return v;
end;
$$;

/*
  Policies control which rows you may touch; these control which columns.

  asset_versions already has no update policy, so this is belt and braces — but
  approval_state is the one value in the schema that must only ever move
  through the functions above, and it is worth being unable to change by
  accident.

  parent_id and ancestor_ids on content_items are revoked for a different
  reason: ancestor_ids is what guest access resolves through, so a client
  editing either would be editing permissions.
*/
revoke update (approval_state) on public.asset_versions from authenticated;
revoke update (parent_id, ancestor_ids, workspace_id) on public.content_items from authenticated;
