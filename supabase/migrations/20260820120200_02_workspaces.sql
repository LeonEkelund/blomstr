create table public.workspaces (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  /*
    Billing plumbing, in early and unenforced beyond the seat check in
    create_invite. Adding it now means switching billing on is "add Stripe",
    not "rewrite the invite path".

    seat_limit counts STAFF only — owner, admin, editor. Guests are always
    free and always unlimited. See "Seats" in Decisions taken; that split is
    structural and expensive to reverse.
  */
  plan        text not null default 'free',
  seat_limit  int  not null default 1,
  created_at  timestamptz not null default now()
);

create table public.workspace_members (
  workspace_id uuid not null references public.workspaces on delete cascade,
  user_id      uuid not null references auth.users on delete cascade,
  role         public.workspace_role not null default 'editor',
  created_at   timestamptz not null default now(),
  primary key (workspace_id, user_id)
);

/*
  Capabilities are derived from the role, not stored alongside it. Two columns
  that must agree is a drift bug waiting to happen, and with admin defined as
  "approves and publishes" a flag buys nothing.

  If one specific editor ever needs publish rights, add a nullable override
  column then — null meaning "use the role default". Not before.
*/

-- "which workspaces am I in" is the hot path on every page load.
create index on public.workspace_members (user_id);

/*
  auth.users is not readable from the client, so without this table the board
  cannot render a name or an avatar. Mirrored on signup by the trigger below.
*/
create table public.profiles (
  id           uuid primary key references auth.users on delete cascade,
  display_name text,
  avatar_url   text,
  created_at   timestamptz not null default now()
);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    new.raw_user_meta_data->>'avatar_url'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

/*
  The foundation of every policy.

  security definer so it can read workspace_members without recursing into
  that table's own RLS policy. set search_path = '' plus fully-qualified names
  is mandatory — without it this is a privilege-escalation vector.

  (select auth.uid()) rather than auth.uid() so Postgres treats it as an
  InitPlan and evaluates it once per query instead of once per row.

  ⚠️ is_staff, NOT "is in this workspace". Redeeming an invite gives a guest a
  workspace_members row, so a naive "has a row here" check would hand a sponsor
  the run of the whole workspace — every comment on every project. Guests are
  in the workspace; they are not staff. Every write policy checks this one.
*/
create or replace function public.is_staff(ws uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.workspace_members m
    where m.workspace_id = ws
      and m.user_id = (select auth.uid())
      and m.role in ('owner','admin','editor')
  );
$$;

/*
  Attached to the workspace at all, guests included. Only for things a guest
  legitimately needs — the workspace's own name, so their one project has a
  heading. Never for writes.
*/
create or replace function public.in_workspace(ws uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.workspace_members m
    where m.workspace_id = ws
      and m.user_id = (select auth.uid())
  );
$$;

create or replace function public.has_role(ws uuid, roles public.workspace_role[])
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.workspace_members m
    where m.workspace_id = ws
      and m.user_id = (select auth.uid())
      and m.role = any (roles)
  );
$$;

/*
  Editors make the work; they do not sign it off. The product's whole premise
  is "the team produces and the creator approves" — an editor who could approve
  their own upload would collapse that.
*/
create or replace function public.can_approve(ws uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.has_role(ws, array['owner','admin']::public.workspace_role[]);
$$;

-- Posting to a real audience is irreversible. Same trust line as approval.
create or replace function public.can_publish(ws uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.has_role(ws, array['owner','admin']::public.workspace_role[]);
$$;

/*
  Changing who is on the team, and what they may do, is owner-only. This is the
  line between owner and admin: an admin is trusted with the audience and with
  editorial sign-off, but cannot widen the circle or promote themselves.
*/
create or replace function public.can_manage_people(ws uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.has_role(ws, array['owner']::public.workspace_role[]);
$$;

/*
  Inviting a guest to a single project is narrower than changing the team, so
  admins can do it — a manager sending a sponsor a review link shouldn't need
  the creator. Editors cannot: handing out access is not part of making things.
*/
create or replace function public.can_invite_guests(ws uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.has_role(ws, array['owner','admin']::public.workspace_role[]);
$$;
