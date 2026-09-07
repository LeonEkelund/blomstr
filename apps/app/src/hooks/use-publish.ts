import type { Platform } from "@blomstr/types"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useWorkspace } from "@/hooks/use-workspace"
import { supabase } from "@/lib/supabase"

export interface PublishTarget {
  id: string
  platform: Platform
  title: string
  caption: string
  tags: string[]
  updatedAt: string
}

export interface PublishTargetDraft {
  platform: Platform
  title: string
  caption: string
  tags: string[]
}

function cleanTags(tags: string[]) {
  return [
    ...new Set(tags.map((tag) => tag.trim().replace(/^#+/, "")).filter(Boolean)),
  ].slice(0, 30)
}

export function usePublishTargets(contentItemId: string) {
  const { workspace } = useWorkspace()
  const queryClient = useQueryClient()
  const queryKey = ["publish-targets", contentItemId]

  const { data: targets = [], isPending } = useQuery({
    queryKey,
    enabled: Boolean(workspace),
    queryFn: async (): Promise<PublishTarget[]> => {
      const { data, error } = await supabase
        .from("publish_targets")
        .select("id, platform, title, caption, tags, updated_at")
        .eq("content_item_id", contentItemId)
        .order("platform")
      if (error) throw error
      return data.map((target) => ({
        id: target.id,
        platform: target.platform,
        title: target.title,
        caption: target.caption,
        tags: target.tags,
        updatedAt: target.updated_at,
      }))
    },
  })

  const save = useMutation({
    // Keep rapid autosaves ordered so an older request cannot land last.
    scope: { id: `publish-target:${contentItemId}` },
    mutationFn: async (draft: PublishTargetDraft): Promise<PublishTarget> => {
      if (!workspace) throw new Error("no workspace")
      const { data, error } = await supabase
        .from("publish_targets")
        .upsert(
          {
            workspace_id: workspace.id,
            content_item_id: contentItemId,
            platform: draft.platform,
            title: draft.title.trim(),
            caption: draft.caption.trim(),
            tags: cleanTags(draft.tags),
          },
          { onConflict: "content_item_id,platform" },
        )
        .select("id, platform, title, caption, tags, updated_at")
        .single()
      if (error) throw error
      return {
        id: data.id,
        platform: data.platform,
        title: data.title,
        caption: data.caption,
        tags: data.tags,
        updatedAt: data.updated_at,
      }
    },
    onSuccess: (saved) => {
      queryClient.setQueryData<PublishTarget[]>(queryKey, (current = []) => [
        ...current.filter((target) => target.platform !== saved.platform),
        saved,
      ])
      queryClient.invalidateQueries({ queryKey: ["activity", contentItemId] })
    },
  })

  return { targets, loading: Boolean(workspace) && isPending, save }
}
