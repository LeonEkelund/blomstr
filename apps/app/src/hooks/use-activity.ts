import { useQuery } from "@tanstack/react-query"
import { supabase } from "@/lib/supabase"

interface EventPayload {
  version?: number
  from_stage_id?: string
  to_stage_id?: string
  fields?: string[]
}

export interface ProjectActivity {
  id: number
  actorId: string | null
  actorName: string
  verb: string
  payload: EventPayload
  versionNumber: number | null
  createdAt: string
}

function eventPayload(value: unknown): EventPayload {
  return value && typeof value === "object" ? (value as EventPayload) : {}
}

export function useProjectActivity(contentItemId: string) {
  const { data: activity = [], isPending } = useQuery({
    queryKey: ["activity", contentItemId],
    queryFn: async (): Promise<ProjectActivity[]> => {
      const { data: assets, error: assetError } = await supabase
        .from("assets")
        .select("id")
        .eq("content_item_id", contentItemId)
      if (assetError) throw assetError

      const { data: versions, error: versionError } = assets.length
        ? await supabase
            .from("asset_versions")
            .select("id, version_number")
            .in(
              "asset_id",
              assets.map((asset) => asset.id),
            )
        : { data: [], error: null }
      if (versionError) throw versionError

      const versionById = new Map(
        (versions ?? []).map((version) => [version.id, version.version_number]),
      )
      const subjectIds = [contentItemId, ...versionById.keys()]

      const { data: events, error: eventError } = await supabase
        .from("events")
        .select("id, actor_id, subject_id, verb, payload, created_at")
        .in("subject_id", subjectIds)
        .order("created_at", { ascending: false })
        .limit(30)
      if (eventError) throw eventError

      const actorIds = [
        ...new Set(events.map((event) => event.actor_id).filter(Boolean)),
      ] as string[]
      const { data: profiles, error: profileError } = actorIds.length
        ? await supabase.from("profiles").select("id, display_name").in("id", actorIds)
        : { data: [], error: null }
      if (profileError) throw profileError

      const nameById = new Map(
        (profiles ?? []).map((profile) => [
          profile.id,
          profile.display_name ?? "Unknown",
        ]),
      )

      const mapped = events.map((event) => ({
        id: event.id,
        actorId: event.actor_id,
        actorName: event.actor_id
          ? (nameById.get(event.actor_id) ?? "Unknown")
          : "System",
        verb: event.verb,
        payload: eventPayload(event.payload),
        versionNumber:
          versionById.get(event.subject_id) ??
          eventPayload(event.payload).version ??
          null,
        createdAt: event.created_at,
      }))

      // request_changes writes its required note as a comment in the same
      // transaction. The transition is the useful entry; showing both reads
      // as if the person performed two separate actions.
      return mapped.filter(
        (entry, index) =>
          !(
            entry.verb === "commented" &&
            mapped.some(
              (other, otherIndex) =>
                otherIndex !== index &&
                other.verb === "changes_requested" &&
                other.actorId === entry.actorId &&
                other.versionNumber === entry.versionNumber &&
                Math.abs(
                  new Date(other.createdAt).getTime() -
                    new Date(entry.createdAt).getTime(),
                ) < 2_000,
            )
          ),
      )
    },
  })

  return { activity, loading: isPending }
}
