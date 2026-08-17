import type { ContentItem, Member, Stage } from "@blomstr/types"

/** Temporary fixtures so the board renders before Supabase exists. */

export const stages: Stage[] = [
  { id: "idea", name: "Idea", position: 0 },
  { id: "script", name: "Script", position: 1 },
  { id: "record", name: "Record", position: 2 },
  { id: "edit", name: "Editing", position: 3 },
  { id: "review", name: "Review", position: 4 },
  { id: "scheduled", name: "Scheduled", position: 5 },
]

export const members: Member[] = [
  { id: "u1", name: "Leon", role: "owner" },
  { id: "u2", name: "Max", role: "member" },
  { id: "u3", name: "Sarah", role: "member" },
  { id: "u4", name: "Jonas", role: "guest" },
]

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
    stageId: "edit",
    position: "a0",
    type: "youtube_video",
    platforms: ["youtube"],
    assigneeIds: ["u2"],
    dueAt: "2026-08-22T00:00:00Z",
  }),
  item({
    id: "c2",
    title: "Studio tour + gear breakdown",
    stageId: "script",
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
    stageId: "idea",
    position: "a0",
    platforms: ["youtube"],
  }),
  item({
    id: "c5",
    title: "Desk setup — 3 clips",
    stageId: "edit",
    position: "a1",
    type: "tiktok",
    platforms: ["tiktok", "instagram"],
    assigneeIds: ["u4"],
    dueAt: "2026-08-18T00:00:00Z",
  }),
  item({
    id: "c6",
    title: "Podcast ep. 14 — guest recording",
    stageId: "record",
    position: "a0",
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
    stageId: "scheduled",
    position: "a0",
    type: "reel",
    platforms: ["instagram"],
    assigneeIds: ["u3"],
    publishAt: "2026-08-21T15:00:00Z",
  }),
  item({
    id: "c9",
    title: "Q4 collab ideas",
    stageId: "idea",
    position: "a1",
    type: "youtube_video",
  }),
]
