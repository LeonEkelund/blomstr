import type { ContentItem, Database, Member, Stage } from "@blomstr/types"

/**
 * The boundary between the database and the app.
 *
 * Postgres is snake_case, the components are camelCase. Mapping here rather
 * than renaming throughout means components never learn the schema, and a
 * column rename is a change in one file.
 */

type ContentItemRow = Database["public"]["Tables"]["content_items"]["Row"]
type StageRow = Database["public"]["Tables"]["stages"]["Row"]
type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"]
type MemberRow = Database["public"]["Tables"]["workspace_members"]["Row"]

export function toContentItem(
  row: ContentItemRow,
  assigneeIds: string[],
  /** Derived from the latest version — never a column on content_items. */
  approvalState: ContentItem["approvalState"] = "draft",
): ContentItem {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    parentId: row.parent_id,
    ancestorIds: row.ancestor_ids,
    type: row.type,
    title: row.title,
    stageId: row.stage_id,
    position: row.position,
    assigneeIds,
    approvalState,
    dueAt: row.due_at,
    publishAt: row.publish_at,
    platforms: row.platforms,
    sourceStartMs: row.source_start_ms ?? undefined,
    sourceEndMs: row.source_end_ms ?? undefined,
    createdAt: row.created_at,
  }
}

export function toStage(row: StageRow): Stage {
  return {
    id: row.id,
    name: row.name,
    accent: row.accent ?? undefined,
    position: row.position,
  }
}

export function toMember(member: MemberRow, profile: ProfileRow | undefined): Member {
  return {
    id: member.user_id,
    // Falls back to a stub rather than an empty card: a profile row is created
    // by trigger on signup, but a null display_name is possible.
    name: profile?.display_name ?? "Unknown",
    avatarUrl: profile?.avatar_url ?? undefined,
    role: member.role,
  }
}
