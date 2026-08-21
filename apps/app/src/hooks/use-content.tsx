import type { ContentItem } from "@blomstr/types"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { createContext, type ReactNode, useContext, useMemo } from "react"
import { useWorkspace } from "@/hooks/use-workspace"
import { toContentItem } from "@/lib/mappers"
import { rankBetween } from "@/lib/rank"
import { supabase } from "@/lib/supabase"

/**
 * The one store of content items.
 *
 * The board and the project page both write stage changes, so this is shared
 * rather than a hook each of them calls — otherwise moving a project from its
 * own page would not show up on the board behind it.
 *
 * Every mutation updates the cache before the round trip and rolls back on
 * failure. Dragging a card has to feel instant; waiting on a network hop to
 * redraw would make the board feel broken on a slow connection.
 */

interface ContentContextValue {
  items: ContentItem[]
  loading: boolean
  /** Place `id` in `stageId` at `index`, counted without the moved item. */
  moveItem: (id: string, stageId: string, index: number) => void
  /** Send `id` to the end of `stageId` — what the header dropdown does. */
  setStage: (id: string, stageId: string) => void
  /** Append a new project to the bottom of `stageId`. */
  createItem: (stageId: string, title: string) => void
}

const ContentContext = createContext<ContentContextValue | null>(null)

/** Computes the rank a card needs to land at `index` within `stageId`. */
function rankForSlot(
  items: ContentItem[],
  id: string | null,
  stageId: string,
  index: number,
) {
  const column = items
    .filter((i) => i.parentId === null && i.stageId === stageId && i.id !== id)
    .sort((a, b) => a.position.localeCompare(b.position))

  const at = Math.max(0, Math.min(index, column.length))
  return {
    before: column[at - 1]?.position ?? null,
    after: column[at]?.position ?? null,
  }
}

export function ContentProvider({ children }: { children: ReactNode }) {
  const { workspace } = useWorkspace()
  const queryClient = useQueryClient()
  const workspaceId = workspace?.id

  const queryKey = useMemo(() => ["content_items", workspaceId], [workspaceId])

  const { data: items = [], isPending } = useQuery({
    queryKey,
    enabled: Boolean(workspaceId),
    queryFn: async (): Promise<ContentItem[]> => {
      const { data, error } = await supabase
        .from("content_items")
        .select("*, content_item_assignees(user_id)")
        .eq("workspace_id", workspaceId ?? "")
        .is("archived_at", null)
        .order("position")
      if (error) throw error

      /*
        Approval is derived from the latest asset version, so it comes from the
        content_item_status view rather than a column. Fetched separately and
        merged: the view has no foreign key for PostgREST to embed through.
      */
      const { data: statuses, error: statusError } = await supabase
        .from("content_item_status")
        .select("id, approval_state")
        .eq("workspace_id", workspaceId ?? "")
      if (statusError) throw statusError

      const stateById = new Map(statuses.map((s) => [s.id, s.approval_state]))

      return data.map(({ content_item_assignees, ...row }) =>
        toContentItem(
          row,
          (content_item_assignees as { user_id: string }[]).map((a) => a.user_id),
          stateById.get(row.id) ?? "draft",
        ),
      )
    },
  })

  /** Shared optimistic wrapper: patch the cache, roll back if the write fails. */
  function optimistic<TVars>(
    apply: (current: ContentItem[], vars: TVars) => ContentItem[],
  ) {
    return {
      onMutate: async (vars: TVars) => {
        await queryClient.cancelQueries({ queryKey })
        const previous = queryClient.getQueryData<ContentItem[]>(queryKey)
        queryClient.setQueryData<ContentItem[]>(queryKey, (current = []) =>
          apply(current, vars),
        )
        return { previous }
      },
      onError: (
        _error: unknown,
        _vars: TVars,
        context?: { previous?: ContentItem[] },
      ) => {
        if (context?.previous) queryClient.setQueryData(queryKey, context.previous)
      },
      onSettled: () => queryClient.invalidateQueries({ queryKey }),
    }
  }

  const move = useMutation({
    mutationFn: async ({
      id,
      stageId,
      position,
    }: {
      id: string
      stageId: string
      position: string
    }) => {
      const { error } = await supabase
        .from("content_items")
        .update({ stage_id: stageId, position })
        .eq("id", id)
      if (error) throw error
    },
    ...optimistic<{ id: string; stageId: string; position: string }>((current, vars) =>
      current.map((i) =>
        i.id === vars.id ? { ...i, stageId: vars.stageId, position: vars.position } : i,
      ),
    ),
  })

  const create = useMutation({
    mutationFn: async ({
      stageId,
      title,
      position,
    }: {
      stageId: string
      title: string
      position: string
      tempId: string
    }) => {
      const { error } = await supabase.from("content_items").insert({
        workspace_id: workspaceId ?? "",
        stage_id: stageId,
        title,
        position,
        // Untyped until someone says otherwise — see ContentItem.type.
        type: null,
      })
      if (error) throw error
    },
    ...optimistic<{ stageId: string; title: string; position: string; tempId: string }>(
      (current, vars) => [
        ...current,
        {
          id: vars.tempId,
          workspaceId: workspaceId ?? "",
          parentId: null,
          ancestorIds: [],
          type: null,
          title: vars.title,
          stageId: vars.stageId,
          position: vars.position,
          assigneeIds: [],
          approvalState: "draft",
          dueAt: null,
          publishAt: null,
          platforms: [],
          createdAt: new Date().toISOString(),
        },
      ],
    ),
  })

  const value = useMemo<ContentContextValue>(() => {
    function moveItem(id: string, stageId: string, index: number) {
      const moving = items.find((i) => i.id === id)
      if (!moving) return

      const { before, after } = rankForSlot(items, id, stageId, index)

      // Already sitting in that gap — no rank to mint, and this fires on every
      // dragover tick.
      if (
        moving.stageId === stageId &&
        (before === null || moving.position > before) &&
        (after === null || moving.position < after)
      ) {
        return
      }

      move.mutate({ id, stageId, position: rankBetween(before, after) })
    }

    return {
      items,
      loading: Boolean(workspaceId) && isPending,
      moveItem,
      setStage: (id, stageId) => moveItem(id, stageId, Number.MAX_SAFE_INTEGER),
      createItem: (stageId, title) => {
        const { before } = rankForSlot(items, null, stageId, Number.MAX_SAFE_INTEGER)
        create.mutate({
          stageId,
          title: title.trim(),
          position: rankBetween(before, null),
          // Stands in until the insert returns and the query refetches.
          tempId: crypto.randomUUID(),
        })
      },
    }
  }, [items, isPending, workspaceId, move, create])

  return <ContentContext value={value}>{children}</ContentContext>
}

export function useContent() {
  const context = useContext(ContentContext)
  if (!context) throw new Error("useContent must be used within <ContentProvider>")
  return context
}
