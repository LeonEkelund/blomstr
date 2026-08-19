import type { ContentItem, Member, Stage } from "@blomstr/types"

/** Temporary fixtures so the board renders before Supabase exists. */

/**
 * The default workflow. Deliberately medium-agnostic — "In progress" covers
 * writing, shooting, recording and editing alike, so a podcaster or
 * photographer isn't reading someone else's pipeline. Workspaces can add their
 * own stages on top of this.
 */
export const stages: Stage[] = [
  { id: "ideas", name: "Ideas", position: 0 },
  { id: "in_progress", name: "In progress", position: 1 },
  { id: "review", name: "Review", position: 2 },
  { id: "published", name: "Published", position: 3 },
]

export const members: Member[] = [
  { id: "u1", name: "Leon", role: "owner" },
  { id: "u2", name: "Max", role: "editor" },
  { id: "u3", name: "Sarah", role: "admin" },
  { id: "u4", name: "Jonas", role: "guest" },
]

/** Stands in for the signed-in user until auth exists. */
export const currentUser = {
  ...members[0],
  email: "leon@blomstr.app",
} as Member & { email: string }

function item(
  partial: Partial<ContentItem> &
    Pick<ContentItem, "id" | "title" | "stageId" | "position">,
): ContentItem {
  return {
    workspaceId: "w1",
    parentId: null,
    ancestorIds: [],
    type: "youtube_video",
    assigneeIds: [],
    approvalState: "draft",
    dueAt: null,
    publishAt: null,
    platforms: [],
    createdAt: "2026-08-01T09:00:00Z",
    ...partial,
  }
}

export const contentItems: ContentItem[] = [
  item({
    id: "c1",
    title: "I Tried AI for 30 Days",
    stageId: "in_progress",
    position: "a2",
    type: "youtube_video",
    platforms: ["youtube"],
    assigneeIds: ["u2"],
    dueAt: "2026-08-22T00:00:00Z",
  }),
  item({
    id: "c2",
    title: "Studio tour + gear breakdown",
    stageId: "in_progress",
    position: "a0",
    platforms: ["youtube"],
    assigneeIds: ["u1"],
    dueAt: "2026-08-25T00:00:00Z",
  }),
  item({
    id: "c3",
    title: "Nord VPN — sponsored integration",
    stageId: "review",
    position: "a0",
    type: "sponsored",
    platforms: ["youtube"],
    assigneeIds: ["u1", "u3"],
    approvalState: "in_review",
    dueAt: "2026-08-19T00:00:00Z",
  }),
  item({
    id: "c4",
    title: "Reacting to my old videos",
    stageId: "ideas",
    position: "a0",
    platforms: ["youtube"],
  }),
  item({
    id: "c5",
    title: "Desk setup — 3 clips",
    stageId: "in_progress",
    position: "a3",
    type: "tiktok",
    platforms: ["tiktok", "instagram"],
    assigneeIds: ["u4"],
    dueAt: "2026-08-18T00:00:00Z",
  }),
  item({
    id: "c6",
    title: "Podcast ep. 14 — guest recording",
    stageId: "in_progress",
    position: "a1",
    type: "podcast",
    assigneeIds: ["u1"],
    dueAt: "2026-08-20T00:00:00Z",
  }),
  item({
    id: "c7",
    title: "Thumbnail A/B — AI video",
    stageId: "review",
    position: "a1",
    type: "thumbnail",
    assigneeIds: ["u3"],
    approvalState: "changes_requested",
  }),
  item({
    id: "c8",
    title: "Back to school haul",
    stageId: "published",
    position: "a0",
    type: "reel",
    platforms: ["instagram"],
    assigneeIds: ["u3"],
    approvalState: "approved",
    // In the past, so the card reads as genuinely out rather than queued.
    publishAt: "2026-08-15T15:00:00Z",
  }),
  item({
    id: "c9",
    title: "Q4 collab ideas",
    stageId: "ideas",
    position: "a1",
    type: "youtube_video",
  }),
]
