import type { ContentItem } from "@blomstr/types"
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react"
import { contentItems } from "@/lib/mock-data"
import { rankBetween } from "@/lib/rank"

/**
 * The one store of content items.
 *
 * The board and the project page both write stage changes, so this has to be
 * shared state rather than a hook each of them calls — otherwise moving a
 * project from its own page would not show up on the board behind it.
 *
 * Backed by fixtures in local state. When Supabase lands this becomes a
 * `useQuery` plus mutations whose optimistic updates are the callbacks below;
 * everything consuming it stays the same.
 */

interface ContentContextValue {
  items: ContentItem[]
  /** Place `id` in `stageId` at `index`, counted without the moved item. */
  moveItem: (id: string, stageId: string, index: number) => void
  /** Send `id` to the end of `stageId` — what the header dropdown does. */
  setStage: (id: string, stageId: string) => void
  /** Append a new project to the bottom of `stageId`. */
  createItem: (stageId: string, title: string) => void
}

const ContentContext = createContext<ContentContextValue | null>(null)

export function ContentProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ContentItem[]>(contentItems)

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

      // Already in that gap — no rank to mint, and re-rendering here would
      // churn on every dragover tick.
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

  const setStage = useCallback(
    (id: string, stageId: string) => moveItem(id, stageId, Number.MAX_SAFE_INTEGER),
    [moveItem],
  )

  const createItem = useCallback((stageId: string, title: string) => {
    setItems((current) => {
      const last = current
        .filter((i) => i.parentId === null && i.stageId === stageId)
        .sort((a, b) => a.position.localeCompare(b.position))
        .at(-1)

      return [
        ...current,
        {
          id: crypto.randomUUID(),
          workspaceId: "w1",
          parentId: null,
          ancestorIds: [],
          // Untyped until someone says otherwise — see ContentItem.type.
          type: null,
          title: title.trim(),
          stageId,
          position: rankBetween(last?.position ?? null, null),
          assigneeIds: [],
          approvalState: "draft",
          dueAt: null,
          publishAt: null,
          platforms: [],
          createdAt: new Date().toISOString(),
        },
      ]
    })
  }, [])

  const value = useMemo(
    () => ({ items, moveItem, setStage, createItem }),
    [items, moveItem, setStage, createItem],
  )

  return <ContentContext value={value}>{children}</ContentContext>
}

export function useContent() {
  const context = useContext(ContentContext)
  if (!context) throw new Error("useContent must be used within <ContentProvider>")
  return context
}
