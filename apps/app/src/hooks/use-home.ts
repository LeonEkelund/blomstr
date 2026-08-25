import { useQuery } from "@tanstack/react-query"
import { useWorkspace } from "@/hooks/use-workspace"
import { supabase } from "@/lib/supabase"

interface HomePayload {
  content_item_id?: string
  version?: number
  from_stage_id?: string
  to_stage_id?: string
  fields?: string[]
}

export interface HomeVersion {
  id: string
  contentItemId: string
  number: number
  state: "draft" | "in_review" | "changes_requested" | "approved"
  createdBy: string
  createdAt: string
}

export interface HomeActivity {
  id: number
  actorId: string | null
  actorName: string
  contentItemId: string | null
  contentItemTitle: string | null
  verb: string
  payload: HomePayload
  versionNumber: number | null
  createdAt: string
}

function payload(value: unknown): HomePayload {
  return value && typeof value === "object" ? (value as HomePayload) : {}
}

export function useHomeFeed() {
  const { workspace } = useWorkspace()

  const { data, isPending, error } = useQuery({
    queryKey: ["home-feed", workspace?.id],
    enabled: Boolean(workspace),
    queryFn: async (): Promise<{
      versions: HomeVersion[]
      activity: HomeActivity[]
    }> => {
      const workspaceId = workspace?.id ?? ""
      const { data: assets, error: assetError } = await supabase
        .from("assets")
        .select("id, content_item_id")
        .eq("workspace_id", workspaceId)
      if (assetError) throw assetError

      const itemByAsset = new Map(
        assets.map((asset) => [asset.id, asset.content_item_id]),
      )
      const { data: versionRows, error: versionError } = assets.length
        ? await supabase
            .from("asset_versions")
            .select(
              "id, asset_id, version_number, approval_state, created_by, created_at",
            )
            .in(
              "asset_id",
              assets.map((asset) => asset.id),
            )
            .order("created_at", { ascending: false })
        : { data: [], error: null }
      if (versionError) throw versionError

      // Only the newest version of each asset determines what needs attention.
      const latestByAsset = new Map<string, (typeof versionRows)[number]>()
      for (const version of versionRows ?? []) {
        if (!latestByAsset.has(version.asset_id)) {
          latestByAsset.set(version.asset_id, version)
        }
      }

      const versions = [...latestByAsset.values()].flatMap<HomeVersion>((version) => {
        const contentItemId = itemByAsset.get(version.asset_id)
        return contentItemId
          ? [
              {
                id: version.id,
                contentItemId,
                number: version.version_number,
                state: version.approval_state,
                createdBy: version.created_by,
                createdAt: version.created_at,
              },
            ]
          : []
      })

      const { data: eventRows, error: eventError } = await supabase
        .from("events")
        .select("id, actor_id, subject_id, verb, payload, created_at")
        .eq("workspace_id", workspaceId)
        .order("created_at", { ascending: false })
        .limit(20)
      if (eventError) throw eventError

      const versionById = new Map(versions.map((version) => [version.id, version]))
      // Older versions can still be event subjects even though they are not in
      // the attention queue, so retain their project and version mappings.
      for (const version of versionRows ?? []) {
        const contentItemId = itemByAsset.get(version.asset_id)
        if (!contentItemId) continue
        versionById.set(version.id, {
          id: version.id,
          contentItemId,
          number: version.version_number,
          state: version.approval_state,
          createdBy: version.created_by,
          createdAt: version.created_at,
        })
      }

      const actorIds = [
        ...new Set(
          [
            ...versions.map((version) => version.createdBy),
            ...eventRows.map((event) => event.actor_id),
          ].filter(Boolean),
        ),
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

      const { data: contentRows, error: contentError } = await supabase
        .from("content_items")
        .select("id, title")
        .eq("workspace_id", workspaceId)
        .is("archived_at", null)
      if (contentError) throw contentError
      const titleById = new Map(contentRows.map((item) => [item.id, item.title]))

      const activity = eventRows.map<HomeActivity>((event) => {
        const eventPayload = payload(event.payload)
        const version = versionById.get(event.subject_id)
        const directItemId = titleById.has(event.subject_id) ? event.subject_id : null
        const contentItemId =
          directItemId ?? version?.contentItemId ?? eventPayload.content_item_id ?? null

        return {
          id: event.id,
          actorId: event.actor_id,
          actorName: event.actor_id
            ? (nameById.get(event.actor_id) ?? "Unknown")
            : "System",
          contentItemId,
          contentItemTitle: contentItemId ? (titleById.get(contentItemId) ?? null) : null,
          verb: event.verb,
          payload: eventPayload,
          versionNumber: version?.number ?? eventPayload.version ?? null,
          createdAt: event.created_at,
        }
      })

      return { versions, activity }
    },
  })

  return {
    versions: data?.versions ?? [],
    activity: data?.activity ?? [],
    loading: Boolean(workspace) && isPending,
    error,
  }
}
