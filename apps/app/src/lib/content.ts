import type { ContentItem, ContentType, Platform } from "@blomstr/types"

/** Display strings and formatters shared by the board and the project page. */

export const typeLabels: Record<ContentType, string> = {
  youtube_video: "YouTube",
  short: "Short",
  tiktok: "TikTok",
  reel: "Reel",
  instagram_post: "Instagram",
  podcast: "Podcast",
  livestream: "Live",
  newsletter: "Newsletter",
  thumbnail: "Thumbnail",
  sponsored: "Sponsored",
}

export const platformLabels: Record<Platform, string> = {
  youtube: "YouTube",
  tiktok: "TikTok",
  instagram: "Instagram",
  x: "X",
  linkedin: "LinkedIn",
}

/*
  Ordered for the picker rather than alphabetically: long-form first, then the
  short-form derived from it, then the rest. Typed as the label maps' keys, so
  adding an enum value fails the build here until it is listed.
*/
export const contentTypes = Object.keys(typeLabels) as ContentType[]
export const platforms = Object.keys(platformLabels) as Platform[]

export const approvalLabels: Record<ContentItem["approvalState"], string> = {
  draft: "Draft",
  in_review: "In review",
  changes_requested: "Changes requested",
  approved: "Approved",
}

export function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  })
}

export function formatLongDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  })
}

export function initials(name: string) {
  return name.slice(0, 2).toUpperCase()
}

/** A publish date in the past is a fact, not a plan. */
export function publishLabel(publishAt: string | null) {
  if (!publishAt) return ""
  return new Date(publishAt) <= new Date() ? "Published " : "Publishes "
}
