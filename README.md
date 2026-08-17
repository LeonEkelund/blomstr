# blomstr

A workspace for creators and the people who make their content.

The team produces — editor, clipper, thumbnail designer — and the creator
approves it in one place, from raw footage through to published post.

**The product in one line:** one piece of content in, everything it becomes
out, with a single approval pass.

---

## Status

Early scaffold. The monorepo, the app shell and a static board exist. There is
no backend yet — no Supabase project, no schema, no auth. The board renders
from fixtures.

| Area | State |
|---|---|
| Monorepo, tooling, build | Done |
| App shell — sidebar, routing, layout | Done |
| Kanban board | Renders; drag-and-drop not wired |
| Supabase, schema, RLS | Not started |
| Auth, teams, permissions | Not started |
| Project workspace, review, publishing | Not started |
| `apps/landing`, `apps/admin` | Placeholder folders |

---

## Stack

| | |
|---|---|
| **Frontend** | React 19, TypeScript, Vite 8 |
| **Styling** | Tailwind 4, shadcn/ui (on Base UI), Geist |
| **Icons** | Lucide |
| **Data** | TanStack Query 5 |
| **Routing** | react-router 7 |
| **Drag & drop** | dnd-kit |
| **Backend** | Supabase — Postgres, Auth, Realtime, Edge Functions |
| **File storage** | Google Drive by reference; Supabase Storage for small assets |
| **Monorepo** | pnpm workspaces + Turborepo |

> **Note:** shadcn now builds on **Base UI**, not Radix. Some props differ from
> older shadcn docs — e.g. `TooltipProvider` takes `delay`, not `delayDuration`.

---

## Structure

```
apps/
  app/        the creator app — the only app currently built
  landing/    public marketing site (placeholder)
  admin/      internal backoffice (placeholder)

packages/
  config/     shared tsconfig base (strict)
  types/      shared domain types
  ui/         shared UI helpers; shared components once admin exists
  supabase/   Supabase client factory

supabase/     migrations + Edge Functions (not initialised yet)
```

### `apps/app`

```
src/
  App.tsx                    routes
  main.tsx                   QueryClient, TooltipProvider, Router
  components/layout/         app-layout, app-sidebar
  components/ui/             shadcn components
  routes/board.tsx           the Kanban
  routes/placeholder.tsx     stub for unbuilt pages
  lib/mock-data.ts           fixtures — delete once Supabase lands
  lib/supabase.ts            client; throws if env vars are missing
```

---

## Getting started

```bash
pnpm install
cp apps/app/.env.example apps/app/.env    # not needed until Supabase exists
pnpm --filter @blomstr/app dev            # http://localhost:5173
```

Other commands:

```bash
pnpm build          # build everything
pnpm typecheck      # typecheck everything
pnpm check          # Biome: format + lint, with autofix
pnpm run check:ci   # Biome in check-only mode (what CI runs)
```

Requires Node 20+ and pnpm 11+.

> Use `pnpm run <script>` for anything whose name might collide with a pnpm
> built-in — `pnpm ci` reinstalls `node_modules` instead of running the script.

### Tooling

- **Biome** handles formatting and linting. Install the VS Code extension and
  it formats on save; config is in `biome.json`.
- **CI** runs Biome, typecheck and build on every push and PR
  (`.github/workflows/ci.yml`).
- **`.gitattributes`** normalises line endings to LF so Windows and macOS
  machines don't produce whole-file diffs.

---

## Architecture decisions

These are the load-bearing ones. Everything else is refactorable; changing
these later is expensive.

### One table for the content graph

A top-level project and a derivative (clip, thumbnail, post) are the **same
shape** — derivatives just carry a `parentId`. One self-referencing
`content_items` table, not separate tables per content kind.

- The board queries `where parent_id is null`, so eight clips don't clog it
- The repurposing tree is a recursive CTE
- A new content type is a row value, not a migration

The moment clips get their own table, review, publishing, permissions and
attribution all need two code paths forever.

### Approval lives on the version, never the project

`asset_versions.approval_state`, with project status derived from it.
Otherwise "approved" becomes ambiguous the second someone uploads V4.

### One polymorphic comment primitive

`comments` carries `subject_type`, `subject_id` and an `anchor` jsonb —
`{t_ms}` for video, `{x,y}` for images, `null` for general. Timestamped video
review and pins on a thumbnail are the same table with different renderers.

### Guest grants cascade down the tree

A freelancer granted a podcast episode should see its clips without eight
grants. Resolved via an `ancestor_ids uuid[]` column (GIN indexed) so it's one
indexed lookup at any depth.

> ⚠️ `ancestor_ids` is denormalised **and** authorization depends on it. Drift
> is a permission leak, not a data bug. Maintain it in a trigger, allow
> re-parenting only through an RPC, and run a periodic consistency check.

### Reads direct, writes with invariants through RPC

- **Direct from the client:** boards, projects, comments, tasks, files, search
- **Through Postgres functions / Edge Functions:** approval transitions,
  publishing, invites, role changes, creating a derivative set

RLS can check *who you are*. It can't cheaply express "only from `in_review`,
only with approve rights, and emit an event atomically." That's an RPC. The
client must never be able to set `approval_state` directly.

### An event log is the spine

Every state change appends to one `events` table. The approval inbox, activity
feed, notifications and audit log are all queries over it. Build it from the
start — retrofitting means backfilling history you no longer have.

Keep state in tables. **Do not event-source.**

### All external side effects go through a job queue

Publishing, Drive sync, metrics pulls — never inline in a request. A `jobs`
table with idempotency keys, backoff, a lease/visibility timeout, and a
dead-letter state.

Double-posting to a creator's real audience is unrecoverable, so treat
idempotency as a correctness requirement.

### Large files stay in Google Drive

Postgres stores the Drive file/folder ID and metadata. Video never routes
through our infrastructure. Small assets — thumbnails, PDFs — go in Supabase
Storage.

> Drive ACLs are **not** our ACLs. A guest may see a file listed and get
> "Request access" on click. Generate previews server-side with the owner's
> token so viewing never depends on Drive sharing settings.

---

## Rules

- Every table has RLS enabled and at least one policy. No exceptions.
- Schema changes are migrations in the repo, never edits in the dashboard.
- Regenerate types after every migration:
  `supabase gen types typescript --local > packages/types/src/database.ts`
- The `service_role` key bypasses all RLS — it never touches a client bundle,
  and `apps/admin` needs its own authorization layer.
- Board ordering uses fractional indexing, so a reorder touches one row.

---

## Deliberately not building

| | Why |
|---|---|
| Video editor | CapCut and DaVinci are free |
| AI clipper | Opus Clip, Vizard — commoditised, racing to zero |
| Chat | Won't beat Discord; notify into it instead |
| CRM | The main object is a content project, not a lead |

Clip origin is a metadata field (`human \| ai \| imported`) — the pipeline
downstream is identical, so the human-clipper path ships first with no external
dependencies.

---

## Next

1. Wire dnd-kit into the board — drag between columns, optimistic updates
2. `supabase init`, then the content graph migration
3. Auth and workspace membership
4. The permission function, with tests
5. Project workspace page
