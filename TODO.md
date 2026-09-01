# Not built yet

What's stubbed, what's blocking it, and why it matters. Written down so the
placeholders don't quietly become permanent.

Ordered by value, not by effort.

---

## Since the last pass

The review loop is **built**. Migrations 11–16 added the approval RPCs, storage,
team invites, mindmaps and project activity. `emit_event` is called in 15
places, so `events` is populated and the activity rail is real. `/home` and
`/team` are real pages. Archived projects can be restored from `/workspace`.

Three of the six items that used to be here are done. What's left is below.

---

## 1. Repurposing — the other half of the thesis

The product line is *"one piece of content in, everything it becomes out, with
one approval pass."* The approval pass exists now. **Nothing creates the
"everything it becomes."**

`RepurposedTab` filters `parentId === project.id` and always finds nothing,
because there's no way to make a derivative. The "Create a clip" button is
`disabled`. `content_items.parent_id` and the trigger-maintained
`ancestor_ids` are built and unused.

### The shape was wrong, though

The first sketch was a `create_derivative_set` RPC that spawns eight empty clip
slots for the creator to fill in. That's admin the tool invented for itself —
in reality the clipper cuts what's good and delivers it.

So the feature is smaller: **a clip arriving should be able to say what it came
from.** A new project with a `parent_id`, created by whoever made the clip. No
batch RPC, no placeholder rows.

### What the parent link actually buys

| | Pays off |
|---|---|
| Guest access cascades to derivatives | Today — one grant instead of one per clip |
| Attribution: "this episode produced 8 clips, 340k views" | Once publishing + metrics exist |
| The tree — visible proof of what came from what | Once there are derivatives to show |

Only the first matters right now, which is why this is a small addition rather
than the big feature it looked like.

### Then the bulk review screen

Eight clips in a grid, approve or reject each in one pass. That's the
demo-able moment — and it's unbuildable until something creates eight clips.

---

## 2. Files — where the handoff actually happens

`FilesTab` is an empty state and Drive isn't connected, so the most common real
interaction in a creator team — *here's the footage / here's the delivery* —
happens entirely outside the product.

Storage exists (migration 13) for small assets. What's missing is Google Drive
for anything large.

**Long lead time:** Drive OAuth needs Google verification. Worth starting the
application before the code is ready.

**The trap, carried from the README:** Drive ACLs are not your ACLs. A guest
sees a file listed and gets "Request access" on click. Generate previews
server-side with the owner's token so viewing never depends on Drive sharing.

---

## 3. Mobile approvals

Review works, but only on a laptop. The creator is the bottleneck and isn't at
a desk — notification, swipe through what's waiting, approve, from a car.

Smaller than Files, and it multiplies work already shipped rather than opening
a new front. The board can stay desktop-only; approvals shouldn't be.

---

## 4. Board card menu

The project page has inline editing and archive. The board card doesn't — no
`⋯`, so renaming or archiving means opening the project first.

Reuses `updateItem` and `archiveItem`, so it's UI only.

**Gotcha:** the card has a full-size `<Link>` overlay. The `⋯` needs to sit
above it in z-order and `stopPropagation`, or clicking the menu navigates.

Scope: Rename, Archive. The board is for triage — full editing stays on the
project page.

---

## 5. Still placeholders

| Screen | Note |
|---|---|
| `/calendar` | The same items grouped by `publish_at` — cheap whenever wanted |
| `/settings` (Account) | Personal settings — workspace-level moved to `/workspace` |
| `/integrations` | Drive and social OAuth — see §2 |
| Overview tab | Events exist now, so this is buildable |
| Files tab | §2 |
| Repurposed tab | §1 |
| Publish tab | Needs the `jobs` queue wired to Edge Functions |

---

## Known risks carried forward

- **`ancestor_ids` drift is a permission leak**, not a data bug. Triggers
  maintain it; `check_ancestor_integrity()` should run in tests.
- **No RLS coverage test.** The query in supabase_guide.md §11 asserts every
  table has RLS on with at least one policy. Should be automated — it's the
  check that catches the table added at 1am.
- **`can_read_item` has no tests.** The one function where a bug is a data
  breach rather than a broken screen. Seven cases listed in the guide, §10.
- **No app-side test runner.** `rank.ts` is pure, breakable, and untested.
- **No error boundary.** A component that throws blanks the entire app rather
  than one panel — which is how a small bug in the notes editor once took down
  every screen.
- **Developing against the hosted database.** Docker isn't installed, so
  there's no local Postgres and no `db reset`. Every schema change is a forward
  migration against live data. Fine while you're the only user; install Docker
  before anyone else's data is in there.
- **Social API approval is the longest lead time** in the whole project.
  TikTok and Meta review takes weeks. Start those applications well before the
  publishing code is ready.
