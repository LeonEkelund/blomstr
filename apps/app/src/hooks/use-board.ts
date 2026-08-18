import type { ContentItem, Stage } from "@blomstr/types"
import { useCallback, useMemo, useState } from "react"
import { contentItems, stages } from "@/lib/mock-data"
import { rankBetween } from "@/lib/rank"

export interface BoardColumn {
  stage: Stage
  items: ContentItem[]
}

/**
 * The board's data and the single mutation it needs.
 *
 * Fixtures in local state for now. When Supabase exists this becomes a
 * `useQuery` plus a `useMutation` whose optimistic update is the same `move`
 * below — the components calling it do not change.
 */
export function useBoard() {
  const [items, setItems] = useState<ContentItem[]>(contentItems)

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
  }, [items])

  const itemsById = useMemo(() => new Map(items.map((i) => [i.id, i])), [items])

  /**
   * Put `id` into `stageId` at `index`, where `index` counts the column
   * *without* the moved card. Writes one new fractional rank.
   */
  const moveItem = useCallback((id: string, stageId: string, index: number) => {
    setItems((current) => {
      const moving = current.find((i) => i.id === id)
      if (!moving) return current

      const column = current
        .filter((i) => i.parentId === null && i.stageId === stageId && i.id !== id)
        .sort((a, b) => a.position.localeCompare(b.position))

      const at = Math.max(0, Math.min(index, column.length))
      const before = column[at - 1]?.position ?? null
      const after = column[at]?.position ?? null

      // Already sitting in that gap — no rank to mint, and re-rendering here
      // would churn on every dragover tick.
      if (
        moving.stageId === stageId &&
        (before === null || moving.position > before) &&
        (after === null || moving.position < after)
      ) {
        return current
      }

      const position = rankBetween(before, after)
      return current.map((i) => (i.id === id ? { ...i, stageId, position } : i))
    })
  }, [])

  const projectCount = useMemo(
    () => items.reduce((n, i) => (i.parentId === null ? n + 1 : n), 0),
    [items],
  )

  return { columns, itemsById, moveItem, projectCount }
}
