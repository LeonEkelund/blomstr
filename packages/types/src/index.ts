/**
 * Shared domain types.
 *
 * These are hand-written for now. Once the schema exists they should be
 * derived from `supabase gen types typescript`, with this file keeping only
 * the app-level types that have no direct table equivalent.
 */

export type ContentType =
  | "youtube_video"
  | "short"
  | "tiktok"
  | "reel"
  | "instagram_post"
  | "podcast"
  | "livestream"
  | "newsletter"
  | "thumbnail"
  | "sponsored"

export type Platform = "youtube" | "tiktok" | "instagram" | "x" | "linkedin"

export type ApprovalState = "draft" | "in_review" | "changes_requested" | "approved"

/**
 * Descending trust. `owner` is the creator; `admin` is an assistant who can
 * approve and publish but not change the team; `editor` covers editor, clipper
 * and designer — they make the work and submit it, they don't sign it off;
 * `guest` sees only the projects they were granted.
 */
export type WorkspaceRole = "owner" | "admin" | "editor" | "guest"

export interface Member {
  id: string
  name: string
  avatarUrl?: string
  role: WorkspaceRole
}

/** A column on the board. Workflow is per-workspace and customizable. */
export interface Stage {
  id: string
  name: string
  /** Tailwind-friendly accent token, e.g. "amber" | "violet". */
  accent?: string
  position: number
}

/**
 * The core object. A top-level project and a derivative (clip, thumbnail,
 * post) are the same shape — derivatives just carry a parentId.
 */
export interface ContentItem {
  id: string
  workspaceId: string
  /** null = top-level project; the board shows only these. */
  parentId: string | null
  /** Every ancestor, nearest last. Used for guest access resolution. */
  ancestorIds: string[]
  /**
   * Null until it is known. An idea often has no form yet, and defaulting to
   * one means the card claims something nobody said.
   */
  type: ContentType | null
  title: string
  stageId: string
  /** Fractional index — string-ordered, so reorders touch one row. */
  position: string
  assigneeIds: string[]
  approvalState: ApprovalState
  dueAt: string | null
  publishAt: string | null
  platforms: Platform[]
  /** Optional range into the parent's master asset, for clips. */
  sourceStartMs?: number
  sourceEndMs?: number
  createdAt: string
}
