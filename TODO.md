# Not built yet

What's stubbed, what's blocking it, and why it matters. Written down so the
placeholders don't quietly become permanent.

Ordered by value, not by effort.

---

## 1. The review loop — the biggest gap

**Status is stuck on `Draft` and can never change.**

`content_items` has no `approval_state` column. The rail reads the
`content_item_status` view, which derives it from the newest `asset_version`:

```sql
coalesce(latest.approval_state, 'draft')
```

No versions exist, so it falls through to `draft` forever. It's wired
correctly end to end — there is just nothing on the other end yet.

The same gap disables the two header buttons in `project-layout.tsx`
(**Approve**, **Request changes**) and leaves `ReviewTab` an empty state.

### What's missing

| Piece | State |
|---|---|
| `assets`, `asset_versions` tables | ✅ exist (migration 05) |
| `comments` table | ✅ exists (migration 06) |
| `events` table | ✅ exists (migration 07) |
| `create_version`, `approve_version`, `request_changes` RPCs | ❌ **never written** |
| Column revokes on `approval_state` | ❌ never written |
| Storage bucket for uploads | ❌ none configured |
| Review tab UI | ❌ empty state |

The RPC SQL is already drafted in [supabase_guide.md](supabase_guide.md) §12 —
mostly paste and fix.

### Order

1. `11_rpc` migration — the three functions plus the column revokes
2. A storage bucket for small assets, with workspace-scoped policies
3. Review tab: upload → V1 → comment → Approve / Request changes
4. Wire up the two disabled header buttons

### Start with images, not video

Thumbnails and stills go straight to Supabase Storage — no Drive OAuth, no
proxy previews, no `service_role`. And thumbnail approval is genuinely
high-frequency for a creator, so it exercises the whole loop properly. Video
through Drive is a much bigger lift and can wait until the loop works.

### Why it's first

Everything shipped so far — board, stages, drag-and-drop — is Trello. The
review loop is the part no other tool does for a creator team, and it is the
one that turns approval from a Discord thread into a product.

---

## 2. Home — the approval inbox

`/home` is a `PlaceholderPage`. It should be *what needs you right now*: a
single queue fed by the `events` table.

**Blocked on §1** — nothing emits events until approvals exist, so building it
now means building it against an empty table and then again later.

This is the thing that makes the app a daily habit rather than somewhere you
occasionally visit. Second priority precisely because it depends on the first.

---

## 3. Board card menu

The project page now has inline editing and archive. The board card doesn't —
no `⋯`, so renaming or archiving means opening the project first.

Reuses `updateItem` and `archiveItem` from `use-content.tsx`, so it's UI only.

**One gotcha:** the card has a full-size `<Link>` overlay for navigation. The
`⋯` button needs to sit above it in z-order and `stopPropagation`, or clicking
the menu navigates to the project instead.

Scope: Rename, Archive. Board is for triage — full editing stays on the
project page.

---

## 4. Assignees

The rail shows assignees read-only. Making them editable needs a mutation
against `content_item_assignees` (a join table, not a column), so it's a
different shape from the other rail fields — hence not done alongside them.

Policies already exist. `useMembers()` already lists the workspace roster.

---

## 5. Unarchive

`archiveItem` sets `archived_at`, and every query filters `archived_at is
null`. There is currently **no way to see or restore an archived project** —
it's recoverable in principle, unreachable in practice.

Needs: an archived view (Settings, or a board filter) with a restore action.
Small, but right now "archive" is functionally delete from the user's side.

---

## 6. Still placeholders

Each is a `PlaceholderPage` or an `EmptyState`:

| Screen | Note |
|---|---|
| `/calendar` | Publish dates and deadlines across the workspace |
| `/tasks` | Needs a tasks table — no schema yet |
| `/team` | Roster exists via `useMembers`; invites need `invite_member` RPC |
| `/settings` | Workspace name, stage editing, theme |
| `/integrations` | Drive and social OAuth — the long-lead-time work |
| Overview tab | Wants the event log (§1) to have anything to summarise |
| Notes tab | Plain text on the project; no schema yet |
| Files tab | Drive integration |
| Mindmap tab | Canvas — React Flow, much later |
| Publish tab | Needs the `jobs` queue wired to Edge Functions |

---

## Known risks carried forward

- **`ancestor_ids` drift is a permission leak**, not a data bug. Triggers
  maintain it; `check_ancestor_integrity()` should run in tests.
- **No RLS coverage test.** The query in supabase_guide.md §11 asserts every
  table has RLS on with at least one policy. It should be automated — it's the
  check that catches the table added at 1am.
- **`can_read_item` has no tests.** It's the one function where a bug is a data
  breach rather than a broken screen. Seven cases listed in the guide, §10.
- **No app-side test runner.** `rank.ts` is pure, breakable, and untested.
- **Developing against the hosted database.** Docker isn't installed, so
  there's no local Postgres and no `db reset`. Every schema change is a forward
  migration against live data. Fine while you're the only user; install Docker
  before anyone else's data is in there.
- **Social API approval is the longest lead time** in the whole project.
  TikTok and Meta review takes weeks. Worth starting those applications well
  before the publishing code is ready.
