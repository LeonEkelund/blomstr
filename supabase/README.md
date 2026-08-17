# supabase

Schema, migrations and Edge Functions live here, managed by the Supabase CLI.

Nothing set up yet. To start:

```bash
pnpm dlx supabase init
pnpm dlx supabase start          # local Postgres via Docker
pnpm dlx supabase migration new content_graph
```

Rules for this directory:

- Migrations are files in the repo. Never change schema in the dashboard.
- Every table gets RLS enabled and at least one policy, no exceptions.
- Regenerate types after any migration:
  `supabase gen types typescript --local > ../packages/types/src/database.ts`
