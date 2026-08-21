/*
  A project captured in Ideas often has no form yet — "reacting to my old
  videos" might become a video, a Short, or both. Requiring a type at creation
  meant defaulting to one, and defaulting meant every new card claimed to be a
  YouTube video whether or not that was true.

  Untyped is now a real state. The type is set once it is actually known,
  which in practice is when the work starts.

  No sequence prefix on this filename: the numbered series in supabase_guide.md
  is a plan, and this is a correction to migration 04 rather than the next step
  in it. Timestamps order migrations, not the names.
*/
alter table public.content_items
  alter column type drop not null;
