/*
  Fill the project activity log for direct client writes.

  Review transitions already emit events from their RPCs. Ordinary project
  edits and comments are direct writes under RLS, so triggers are the only
  place that can record those changes atomically without trusting the client.
*/
create or replace function public.track_content_item_activity()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  changed text[] := array[]::text[];
begin
  if tg_op = 'INSERT' then
    perform public.emit_event(
      new.workspace_id, 'content_item', new.id, 'created', '{}'::jsonb
    );
    return new;
  end if;

  if old.archived_at is distinct from new.archived_at then
    perform public.emit_event(
      new.workspace_id,
      'content_item',
      new.id,
      case when new.archived_at is null then 'restored' else 'archived' end,
      '{}'::jsonb
    );
    return new;
  end if;

  if old.stage_id is distinct from new.stage_id then
    perform public.emit_event(
      new.workspace_id, 'content_item', new.id, 'moved',
      jsonb_build_object('from_stage_id', old.stage_id, 'to_stage_id', new.stage_id)
    );
    return new;
  end if;

  -- A rank-only update is a board reorder, not useful project history.
  if old.title is distinct from new.title then
    perform public.emit_event(
      new.workspace_id, 'content_item', new.id, 'renamed',
      jsonb_build_object('from', old.title, 'to', new.title)
    );
    return new;
  end if;

  if old.type is distinct from new.type then
    changed := array_append(changed, 'type');
  end if;
  if old.notes is distinct from new.notes then
    changed := array_append(changed, 'notes');
  end if;
  if old.due_at is distinct from new.due_at then
    changed := array_append(changed, 'due_date');
  end if;
  if old.publish_at is distinct from new.publish_at then
    changed := array_append(changed, 'publish_date');
  end if;
  if old.platforms is distinct from new.platforms then
    changed := array_append(changed, 'platforms');
  end if;

  if cardinality(changed) > 0 then
    perform public.emit_event(
      new.workspace_id, 'content_item', new.id, 'updated',
      jsonb_build_object('fields', to_jsonb(changed))
    );
  end if;

  return new;
end;
$$;

create trigger content_items_track_activity
after insert or update on public.content_items
for each row execute function public.track_content_item_activity();

create or replace function public.track_comment_activity()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  perform public.emit_event(
    new.workspace_id, new.subject_type, new.subject_id, 'commented', '{}'::jsonb
  );
  return new;
end;
$$;

create trigger comments_track_activity
after insert on public.comments
for each row execute function public.track_comment_activity();

/*
  Record the moment a canvas is started, but not every autosave after it. A
  drawing session may save dozens of times and those entries would bury the
  decisions the activity log is meant to surface.
*/
create or replace function public.track_mindmap_created()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  perform public.emit_event(
    new.workspace_id, 'content_item', new.content_item_id, 'mindmap_created',
    '{}'::jsonb
  );
  return new;
end;
$$;

create trigger mindmaps_track_created
after insert on public.mindmaps
for each row execute function public.track_mindmap_created();
