-- Fixed lists of allowed values. Typos become impossible at the storage layer.
-- These mirror packages/types/src/index.ts — keep them in sync.

create type public.content_type as enum (
  'youtube_video','short','tiktok','reel','instagram_post',
  'podcast','livestream','newsletter','thumbnail','sponsored'
);

create type public.platform as enum (
  'youtube','tiktok','instagram','x','linkedin'
);

create type public.approval_state as enum (
  'draft','in_review','changes_requested','approved'
);

/*
  Four tiers, in descending order of trust.

    owner   the creator — everything, including people and billing
    admin   assistant or manager — approves and publishes, cannot grant access
    editor  editor, clipper, designer — makes the work, cannot approve it
    guest   sponsor or collaborator — one project, read and comment

  There is no separate clipper or designer role. They all make things and
  submit them for approval, which is the only distinction that matters.
*/
create type public.workspace_role as enum ('owner','admin','editor','guest');

create type public.job_status as enum ('queued','leased','done','failed','dead');
