# admin

Internal backoffice. Not built yet — Supabase Studio covers this until there
are real workspaces to support.

When it does get built: same stack as `apps/app` (Vite + React + Tailwind +
shadcn), but it must have its own authorization layer. It will run with
elevated access, and `service_role` bypasses every RLS policy.
