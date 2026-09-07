import type { Platform } from "@blomstr/types"
import { platformLabels } from "@/lib/content"

export interface ActivityDescriptionInput {
  verb: string
  payload: {
    to_stage_id?: string
    fields?: string[]
    platform?: Platform
  }
  versionNumber: number | null
}

const fieldLabels: Record<string, string> = {
  type: "type",
  notes: "notes",
  due_date: "due date",
  publish_date: "publish date",
  platforms: "platforms",
}

function joinFields(fields: string[]) {
  const labels = fields.map((field) => fieldLabels[field] ?? field.replaceAll("_", " "))
  if (labels.length < 2) return labels[0] ?? "project details"
  return `${labels.slice(0, -1).join(", ")} and ${labels.at(-1)}`
}

export function activityText(
  entry: ActivityDescriptionInput,
  stageNames: Map<string, string>,
) {
  const version = entry.versionNumber ? `V${entry.versionNumber}` : "a version"

  switch (entry.verb) {
    case "created":
      return "created this project"
    case "moved": {
      const destination = entry.payload.to_stage_id
        ? stageNames.get(entry.payload.to_stage_id)
        : undefined
      return destination ? `moved this project to ${destination}` : "moved this project"
    }
    case "renamed":
      return "renamed this project"
    case "updated":
      return `updated the ${joinFields(entry.payload.fields ?? [])}`
    case "archived":
      return "archived this project"
    case "restored":
      return "restored this project"
    case "submitted_for_review":
      return `submitted ${version} for review`
    case "approved":
      return `approved ${version}`
    case "changes_requested":
      return `requested changes on ${version}`
    case "commented":
      return entry.versionNumber ? `commented on ${version}` : "commented"
    case "mindmap_created":
      return "started the mindmap"
    case "invite_created":
      return "created a project invite"
    case "invite_redeemed":
      return "joined the workspace"
    case "role_changed":
      return "changed a team member's role"
    case "member_removed":
      return "removed a team member"
    case "assigned":
      return "assigned a teammate to this project"
    case "publish_target_updated":
      return entry.payload.platform
        ? `updated the ${platformLabels[entry.payload.platform]} publishing package`
        : "updated a publishing package"
    default:
      return entry.verb.replaceAll("_", " ")
  }
}
