/*
  Team management: invites, and changing or removing people.

  Every function here carries an invariant RLS cannot express — a seat count, a
  last-owner check, a token that must be verified before the caller is a member
  of anything — so they are functions, and the tables they own are not writable
  directly.
*/

create extension if not exists pgcrypto with schema extensions;

/*
  Seats are counted in staff, never guests.

  Defaulting to one made sense as billing plumbing, but it also means the first
  editor you invite is refused — the owner already occupies the only seat.
  Until billing exists there is nothing to enforce, so this is a workable
  number rather than a real limit.
*/
alter table public.workspaces alter column seat_limit set default 5;
update public.workspaces set seat_limit = 5 where seat_limit = 1;

create table public.invites (
  id              uuid primary key default gen_random_uuid(),
  workspace_id    uuid not null references public.workspaces on delete cascade,
  -- null = the whole workspace (staff); set = this project and its children
  content_item_id uuid references public.content_items on delete cascade,
  role            public.workspace_role not null default 'guest',
  /*
    Only the hash is stored. The raw token is returned once, when the invite is
    created, and never again — so a leaked database dump is not a pile of live
    access links. Losing the link means reissuing it.
  */
  token_hash      text not null unique,
  email           text,
  expires_at      timestamptz not null default now() + interval '14 days',
  max_uses        int not null default 1,
  used_count      int not null default 0,
  revoked_at      timestamptz,
  created_by      uuid not null references auth.users default auth.uid(),
  created_at      timestamptz not null default now()
);

create index on public.invites (workspace_id, created_at desc);

alter table public.invites enable row level security;

/*
  No select policy: nobody reads this table directly, because reading it would
  mean reading token hashes. The listing view below omits them, and redemption
  goes through a function.
*/
create policy manage_invites on public.invites
  for all using (public.can_invite_guests(workspace_id));

create view public.invites_listing
with (security_invoker = true) as
select id, workspace_id, content_item_id, role, email,
       expires_at, max_uses, used_count, revoked_at, created_by, created_at
  from public.invites;

/*
  Returns the raw token exactly once.

  Two shapes: a workspace invite for staff, which the owner alone may issue and
  which consumes a seat, and a project invite for a guest, which an admin may
  also issue and which is always free.

  The role is fixed at creation rather than chosen on redemption — otherwise
  forwarding a link would be a way to pick your own permissions.
*/
create or replace function public.create_invite(
  p_workspace_id uuid default null,
  p_content_item_id uuid default null,
  p_role public.workspace_role default 'guest',
  p_email text default null,
  p_expires_in interval default interval '14 days',
  p_max_uses int default 1
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  ws uuid;
  raw_token text;
  staff_count int;
  outstanding int;
  limit_seats int;
begin
  if p_content_item_id is null then
    ws := p_workspace_id;
    if ws is null then
      raise exception 'pass either a workspace or a content item';
    end if;
    if p_role not in ('admin'::public.workspace_role, 'editor'::public.workspace_role) then
      raise exception 'a workspace invite must be admin or editor';
    end if;
    if not public.can_manage_people(ws) then
      raise exception 'only the owner can add staff';
    end if;

    -- Outstanding invites count too, or several sent at once oversubscribe.
    select count(*) into staff_count
      from public.workspace_members m
     where m.workspace_id = ws
       and m.role in ('owner'::public.workspace_role,
                      'admin'::public.workspace_role,
                      'editor'::public.workspace_role);

    select count(*) into outstanding
      from public.invites i
     where i.workspace_id = ws
       and i.content_item_id is null
       and i.revoked_at is null
       and i.expires_at > now()
       and i.used_count < i.max_uses;

    select w.seat_limit into limit_seats
      from public.workspaces w where w.id = ws;

    if staff_count + outstanding >= limit_seats then
      raise exception 'seat limit reached (% of %)', staff_count + outstanding, limit_seats;
    end if;
  else
    select c.workspace_id into ws
      from public.content_items c where c.id = p_content_item_id;
    if ws is null then
      raise exception 'content item % not found', p_content_item_id;
    end if;
    if p_role <> 'guest'::public.workspace_role then
      raise exception 'a project invite must be a guest invite';
    end if;
    if not public.can_invite_guests(ws) then
      raise exception 'no permission to invite';
    end if;
  end if;

  raw_token := encode(extensions.gen_random_bytes(32), 'hex');

  insert into public.invites
    (workspace_id, content_item_id, role, token_hash, email, expires_at, max_uses)
  values
    (ws, p_content_item_id, p_role,
     encode(extensions.digest(raw_token, 'sha256'), 'hex'),
     p_email, now() + p_expires_in, p_max_uses);

  perform public.emit_event(
    ws,
    case when p_content_item_id is null then 'workspace' else 'content_item' end,
    coalesce(p_content_item_id, ws),
    'invite_created',
    jsonb_build_object('role', p_role, 'email', p_email)
  );

  return raw_token;
end;
$$;

/*
  The one function a non-member may call.

  security definer because the caller is, by definition, not yet a member of
  anything — no policy written in terms of membership could let them read the
  invite they are trying to redeem.
*/
create or replace function public.redeem_invite(p_token text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  inv public.invites;
  uid uuid := (select auth.uid());
  user_email text;
begin
  if uid is null then
    raise exception 'sign in before redeeming an invite';
  end if;

  select * into inv from public.invites
   where token_hash = encode(extensions.digest(p_token, 'sha256'), 'hex');

  /*
    One message for every failure. Distinguishing "expired" from "not found"
    tells someone guessing tokens that they guessed a real one.
  */
  if inv.id is null
     or inv.revoked_at is not null
     or inv.expires_at < now()
     or inv.used_count >= inv.max_uses then
    raise exception 'this invite is not valid';
  end if;

  if inv.email is not null then
    select email into user_email from auth.users where id = uid;
    if lower(user_email) is distinct from lower(inv.email) then
      raise exception 'this invite is not valid';
    end if;
  end if;

  insert into public.workspace_members (workspace_id, user_id, role)
  values (inv.workspace_id, uid, inv.role)
  on conflict (workspace_id, user_id) do nothing;

  if inv.content_item_id is not null then
    insert into public.guest_grants (workspace_id, user_id, content_item_id)
    values (inv.workspace_id, uid, inv.content_item_id)
    on conflict (user_id, content_item_id) do nothing;
  end if;

  update public.invites set used_count = used_count + 1 where id = inv.id;

  perform public.emit_event(inv.workspace_id, 'workspace_member', uid,
                            'invite_redeemed',
                            jsonb_build_object('role', inv.role));

  return inv.workspace_id;
end;
$$;

create or replace function public.revoke_invite(p_invite_id uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.invites set revoked_at = now()
   where id = p_invite_id and public.can_invite_guests(workspace_id);
$$;

/*
  Changing someone's tier.

  A function rather than an update because of the last-owner check and the
  grant cleanup, and because the audit event has to land in the same
  transaction as the change.
*/
create or replace function public.set_member_role(
  p_workspace_id uuid,
  p_user_id uuid,
  p_role public.workspace_role
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  old_role public.workspace_role;
begin
  if not public.can_manage_people(p_workspace_id) then
    raise exception 'only the owner can change roles';
  end if;

  select role into old_role
    from public.workspace_members
   where workspace_id = p_workspace_id and user_id = p_user_id;

  if old_role is null then
    raise exception 'not a member of this workspace';
  end if;

  /*
    Never leave a workspace without an owner. Nobody could administer it again
    and the only repair would be a service_role session.
  */
  if old_role = 'owner'::public.workspace_role
     and p_role <> 'owner'::public.workspace_role then
    if (select count(*) from public.workspace_members
         where workspace_id = p_workspace_id
           and role = 'owner'::public.workspace_role) <= 1 then
      raise exception 'cannot remove the last owner';
    end if;
  end if;

  update public.workspace_members
     set role = p_role
   where workspace_id = p_workspace_id and user_id = p_user_id;

  /*
    Staff hold no grants, so someone demoted to guest would otherwise land on
    an empty app. Access has to be re-issued deliberately rather than inherited
    from a role they no longer hold.
  */
  if p_role = 'guest'::public.workspace_role
     and old_role <> 'guest'::public.workspace_role then
    delete from public.guest_grants
     where workspace_id = p_workspace_id and user_id = p_user_id;
  end if;

  perform public.emit_event(
    p_workspace_id, 'workspace_member', p_user_id, 'role_changed',
    jsonb_build_object('from', old_role, 'to', p_role)
  );
end;
$$;

-- Same last-owner guard: a direct delete would let an owner remove themselves.
create or replace function public.remove_member(p_workspace_id uuid, p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  old_role public.workspace_role;
begin
  if not public.can_manage_people(p_workspace_id) then
    raise exception 'only the owner can remove people';
  end if;

  select role into old_role
    from public.workspace_members
   where workspace_id = p_workspace_id and user_id = p_user_id;

  if old_role is null then
    return;
  end if;

  if old_role = 'owner'::public.workspace_role
     and (select count(*) from public.workspace_members
           where workspace_id = p_workspace_id
             and role = 'owner'::public.workspace_role) <= 1 then
    raise exception 'cannot remove the last owner';
  end if;

  delete from public.workspace_members
   where workspace_id = p_workspace_id and user_id = p_user_id;
  delete from public.guest_grants
   where workspace_id = p_workspace_id and user_id = p_user_id;

  perform public.emit_event(
    p_workspace_id, 'workspace_member', p_user_id, 'member_removed',
    jsonb_build_object('role', old_role)
  );
end;
$$;
