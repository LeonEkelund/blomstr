import type { Stage } from "@blomstr/types"
import { useQuery } from "@tanstack/react-query"
import { useWorkspace } from "@/hooks/use-workspace"
import { toStage } from "@/lib/mappers"
import { supabase } from "@/lib/supabase"

/**
 * The board's columns, per workspace.
 *
 * Seeded by `create_workspace()` at signup, so every workspace starts with
 * Ideas / In progress / Review / Published and can rename them later without
 * affecting anyone else.
 */
export function useStages() {
  const { workspace } = useWorkspace()

  const { data: stages = [], isPending } = useQuery({
    queryKey: ["stages", workspace?.id],
    enabled: Boolean(workspace),
    queryFn: async (): Promise<Stage[]> => {
      const { data, error } = await supabase
        .from("stages")
        .select("*")
        .eq("workspace_id", workspace?.id ?? "")
        .order("position")
      if (error) throw error
      return data.map(toStage)
    },
  })

  return { stages, loading: Boolean(workspace) && isPending }
}
