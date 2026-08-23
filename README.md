# blomstr

A workspace for creators and the people who make their content.

The team produces — editor, clipper, thumbnail designer — and the creator
approves it in one place, from raw footage through to published post.

**The product in one line:** one piece of content in, everything it becomes
out, with a single approval pass.

---

## Status

The board and the project page run on real data. You can sign in, create a
workspace, move cards between stages and have it survive a refresh, and edit a
project's fields and notes.

What does not exist yet is the review loop — nothing creates or approves a
version, so a project's status reads `Draft` and always will. See
[TODO.md](TODO.md) for what that blocks and why it's next.

| Area | State |
|---|---|
| Monorepo, tooling, build | Done |
| App shell — sidebar, routing, layout | Done |
| Theming — light / dark / system | Done |
| Auth — sign-in, session, onboarding | Done |
| Schema and RLS | Migrations 01–10 applied |
| Kanban board | Drag-and-drop, persisted |
| Project page — inline edit, archive, notes | Done |
| RPCs — approval, publishing, invites | **Not written** |
| Review, files, publish tabs | Empty states |
| Home, calendar, tasks, team | Placeholders |
| Mobile — board layout and touch drag | Not started |
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
| **Drag & drop** | Pragmatic drag-and-drop |
| **Editor** | Tiptap — notes only, code-split |
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
  main.tsx                   Theme, QueryClient, Tooltip, Router
  components/auth-provider   session, resolved once before any route renders
  components/theme-provider  light / dark / system, persisted
  components/notes-editor    Tiptap; lazy-loaded, markdown in / markdown out
  components/layout/         page-header, app-sidebar
  components/ui/             shadcn components
  hooks/use-content.tsx      the content store — queries and every mutation
  hooks/use-board.ts         the board's view of that store
  hooks/use-workspace.tsx    current workspace; everything is scoped by it
  hooks/use-members.ts       workspace roster joined to profiles
  routes/board.tsx           the Kanban
  routes/project/            layout, rail, tabs
  routes/sign-in.tsx         email/password, Google stubbed
  routes/onboarding.tsx      first workspace
  lib/mappers.ts             snake_case rows → camelCase app types
  lib/rank.ts                fractional indexing for board order
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

### Notes are markdown text; the script is a versioned asset

`content_items.notes` holds the brief, the hook, links — scratch the team
writes together. It is plain markdown in a `text` column, so it stays
greppable, diffable and reachable by Postgres full-text search, and it is
never versioned because nobody approves a note.

The script is the opposite and lives elsewhere: an asset with
`kind = 'document'`, so it gets versions, comments and approval like anything
else that leaves the team.

The distinction is who the writing is for. Notes are for the people making the
thing; the script is the thing.

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
  `lib/rank.ts` mints the keys; two items in a column must never share one, or
  a drop between them has no gap to land in.
- Default stages stay medium-agnostic — Ideas, In progress, Review, Published.
  A podcaster or photographer should not be reading a YouTube pipeline.
  Workflow is per-workspace, so these are a starting template, not a fixed set.

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

1. `supabase init`, then the content graph migration
2. Auth and workspace membership
3. The permission function, with tests
4. Project workspace page — `/projects/:id`

The board is a **view**, not a container: projects are created into a stage and
the board groups by `stage_id`, so there is no separate "add to board" step and
no project that exists off the board. Calendar is the same items grouped by
`publish_at`. Clicking a card opens `/projects/:id` as a real route — it has to
be linkable, since the whole point is sending it to whoever made the thing.

> `ContentItem.approvalState` sits on the app-level type but is **not** a
> column. It is read from the `content_item_status` view and merged in by
> `toContentItem`, so the board can render a badge without every consumer
> joining. The client can never write it.
>
> It reads `draft` for every project today, because nothing creates a version
> yet — see [TODO.md](TODO.md) §1.

### Decided, not yet built

The project workspace at `/projects/:id` is a shell — routing, header, rail and
empty states. Nothing on it writes. These decisions were made while designing
it and need to survive until the schema exists:

- **`approvalState` becomes derived.** Read from the latest version, never
  written by a client. The board keeps a cheap badge; the version keeps the
  truth.
- **Self-authored work skips review.** If the author already holds approve
  rights — a creator writing their own script — it is approved by construction.
  Otherwise the approval inbox fills with people approving themselves.
- **The script is an asset, not a field.** It gets approved, so it needs
  versions and comments like any other deliverable. Notes stay plain fields;
  nobody approves a note.
- **Derivatives get their own pages.** Same route, same shape, `parentId` set —
  a clipper's work has to be reviewable too.
- **Overview is always the landing tab.** A default that moves with the
  project's state cannot be learned. It carries status in a sentence, the next
  action, recent activity and counts that link out — not a statistics
  dashboard, and not a copy of the rail.
- **Mindmap is per-project**, Excalidraw (MIT), single-player first. Scene in
  `jsonb`, images to Storage rather than inlined as base64.

### Access

Four tiers. Two scopes — staff see the workspace, guests see only what they
were granted — and everything else is a consequence of the role.

| | Owner | Admin | Editor | Guest |
|---|:--:|:--:|:--:|:--:|
| See the whole workspace | ✅ | ✅ | ✅ | granted projects |
| Make and submit work | ✅ | ✅ | ✅ | ❌ |
| Comment | ✅ | ✅ | ✅ | ✅ on their projects |
| Approve, publish, invite guests | ✅ | ✅ | ❌ | ❌ |
| Add/remove people, change roles | ✅ | ❌ | ❌ | ❌ |

- **Editor covers editor, clipper and designer.** They make things and submit
  them; that is the only distinction worth a role.
- **Editors cannot approve their own work.** *"The team produces and the
  creator approves"* is the product — an editor with approve rights ends it.
  Note that granting approve also makes that person's own uploads skip review,
  via the self-authored rule.
- **Admin is the assistant.** Trusted with the audience and with sign-off,
  cannot widen the circle or promote themselves.
- **Capabilities derive from the role, never stored alongside it.** Two columns
  that must agree is a drift bug. Add a nullable override if a real case
  appears; not before.
- **Guests hold a `workspace_members` row**, so any check meaning "has a row
  here" hands a sponsor the whole account. `is_staff` is the boundary, and
  every write policy uses it.

Roles are the only editable thing. The Team page shows each person's
permissions read-only, derived from their tier, with the tier as a dropdown for
the owner.

### Getting in

- **Sign up → name the workspace → empty board.** `create_workspace` is
  `security definer` because you cannot insert a workspace you are not yet a
  member of.
- **Google OAuth first**, email/password as fallback. Every creator has a
  Google account and file storage is Drive — one identity rather than two.
  Signing in with Google does not itself grant Drive scopes; that consent comes
  later.
- **Signup is open.** Gating it protects nothing — costs are Postgres rows
  until people actually collaborate. Abuse concerns attach to *publishing*, so
  gate that instead.
- **A user with no workspace is a normal state, not an edge case.** A sponsor
  redeeming a guest link owns nothing and must never see "name your workspace".
  Guests will likely outnumber owners.
- **Invites are copy-links, not emails.** Email means SMTP, deliverability,
  templates and spam-folder support. Creators already live in Discord and
  WhatsApp. Add email when it earns its cost.
- **The role is baked into the invite**, never chosen on redemption —
  otherwise forwarding a link is privilege escalation.

### Money

**Guests are free and unlimited; staff are the meter.** A sponsor who comments
once cannot cost a seat, or creators stop inviting sponsors — and that is the
feature the product exists for. `seat_limit` counts owner + admin + editor.

The paywall lands when a creator adds their first editor, which is also when
they are already paying that editor and the coordination is worth money.
Storage is the wrong meter: files live in Drive by reference, so we do not
carry the cost.

> The principle is settled. The **number** — free tier at one seat — is a guess
> from comparable tools, not from this market. Change it freely; do not change
> the principle.
