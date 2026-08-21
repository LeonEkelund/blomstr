import type { ContentItem, Stage } from "@blomstr/types"
import { useMemo } from "react"
import { useContent } from "@/hooks/use-content"
import { useStages } from "@/hooks/use-stages"

export interface BoardColumn {
  stage: Stage
  items: ContentItem[]
}

/** The board's view of the content store: stages, grouped and ordered. */
export function useBoard() {
  const { items, moveItem, loading: itemsLoading } = useContent()
  const { stages, loading: stagesLoading } = useStages()

  const columns = useMemo<BoardColumn[]>(() => {
    // Only top-level projects reach the board; derivatives live inside one.
    const projects = items.filter((i) => i.parentId === null)

    return [...stages]
      .sort((a, b) => a.position - b.position)
      .map((stage) => ({
        stage,
        items: projects
          .filter((i) => i.stageId === stage.id)
          .sort((a, b) => a.position.localeCompare(b.position)),
      }))
  }, [items, stages])

  const itemsById = useMemo(() => new Map(items.map((i) => [i.id, i])), [items])

  const projectCount = useMemo(
    () => items.reduce((n, i) => (i.parentId === null ? n + 1 : n), 0),
    [items],
  )

  return {
    columns,
    itemsById,
    moveItem,
    projectCount,
    loading: itemsLoading || stagesLoading,
  }
}
