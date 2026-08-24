/*
  Where small assets live.

  Thumbnails, stills and PDFs go here. Video does not — it stays in Google
  Drive by reference, so the bytes never route through this project and storage
  cost stays flat while a creator's footage grows.

  Storage has its own row-level security, on storage.objects. The table
  policies written in migration 10 do not apply to it, so access is defined
  again here — and deliberately in the same terms, so "who can see this" has
  one answer across the app rather than two that drift.
*/

insert into storage.buckets (id, name, public, file_size_limit)
values ('assets', 'assets', false, 26214400) -- 25MB
on conflict (id) do nothing;

/*
  Path convention: <workspace_id>/<content_item_id>/<filename>

  Both ids are in the path so a policy can resolve the project without a
  round trip — the first segment scopes writes to a workspace, the second
  decides who may read.
*/

/*
  Returns null instead of raising when a path segment is not a uuid.

  A policy that casts text to uuid will error on any object whose name does not
  follow the convention, and an error in a policy is a broken request rather
  than a denied one. Null simply matches nothing.
*/
create or replace function public.safe_uuid(value text)
returns uuid
language plpgsql
immutable
as $$
begin
  return value::uuid;
exception
  when others then
    return null;
end;
$$;

/*
  Read follows the project, not the workspace.

  A guest invited to one project can see its files and nothing else, which is
  the same rule content_items uses. The staff-only version would have let a
  sponsor see that a thumbnail exists while refusing to show it to them, which
  defeats the reason for inviting them.
*/
create policy "read assets for readable projects"
on storage.objects for select
using (
  bucket_id = 'assets'
  and exists (
    select 1 from public.content_items c
     where c.id = public.safe_uuid((storage.foldername(name))[2])
       and public.can_read_item(c)
  )
);

-- Writing is staff only: guests review work, they do not upload it.
create policy "write assets in own workspace"
on storage.objects for insert
with check (
  bucket_id = 'assets'
  and public.is_staff(public.safe_uuid((storage.foldername(name))[1]))
);

create policy "update assets in own workspace"
on storage.objects for update
using (
  bucket_id = 'assets'
  and public.is_staff(public.safe_uuid((storage.foldername(name))[1]))
);

create policy "delete assets in own workspace"
on storage.objects for delete
using (
  bucket_id = 'assets'
  and public.is_staff(public.safe_uuid((storage.foldername(name))[1]))
);
