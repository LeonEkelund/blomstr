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
  /**
   * Same as `moveItem` but cache-only — no write.
   *
   * Used while dragging so the data keeps step with dnd-kit's preview. If they
   * diverge, releasing renders one frame of the old order before the reorder
   * applies, which reads as the card flickering back to where it came from.
   */
  previewMove: (id: string, stageId: string, index: number) => void
  /** Persist wherever `previewMove` left the card. Called once, on drop. */
  commitMove: (id: string) => void
  /** Send `id` to the end of `stageId` — what the header dropdown does. */
  setStage: (id: string, stageId: string) => void
  /** Append a new project to the bottom of `stageId`. */
  createItem: (stageId: string, title: string) => void
  /** Patch any directly-editable field. Every rail control calls this. */
  updateItem: (id: string, patch: ItemPatch) => void
  /** Replace the staff responsible for this deliverable. */
  setAssignees: (id: string, assigneeIds: string[]) => void
  /**
   * Soft delete — sets `archived_at` on the item and everything under it.
   *
   * Not a hard delete: `parent_id` cascades, so removing a podcast episode
   * would silently take its clips with it and there would be no way back.
   */
  archiveItem: (id: string) => void
}

/** The fields the project page can write directly, without an RPC. */
export interface ItemPatch {
  title?: string
  type?: ContentItem["type"]
  notes?: string
  dueAt?: string | null
  publishAt?: string | null
  platforms?: ContentItem["platforms"]
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
      /*
        Rolls back and resyncs on failure only.

        Deliberately no `onSettled` refetch. The optimistic value is exactly
        what was written, so confirming it changes nothing on screen — but the
        response replaces every item with a freshly built object, and that
        re-render arrived a beat after each drop as a visible flicker.
      */
      onError: (
        _error: unknown,
        _vars: TVars,
        context?: { previous?: ContentItem[] },
      ) => {
        if (context?.previous) queryClient.setQueryData(queryKey, context.previous)
        queryClient.invalidateQueries({ queryKey })
      },
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
    /*
      No optimistic update here, deliberately.

      `previewMove` has already patched the cache — that is what put the card
      in its new place. Doing it again in onMutate meant two state updates per
      drop: the second landing a microtask later, with fresh object identities,
      re-rendering just as the drag library released the card. That second
      render was the flicker, and it followed us across two drag libraries
      because it was never theirs.

      Snapshot synchronously so a failed write can still be rolled back.
    */
    onMutate: () => ({
      previous: queryClient.getQueryData<ContentItem[]>(queryKey),
    }),
    onError: (_error, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(queryKey, context.previous)
      queryClient.invalidateQueries({ queryKey })
    },
    onSuccess: (_data, vars) =>
      queryClient.invalidateQueries({ queryKey: ["activity", vars.id] }),
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
    /*
      Unlike a move, a create *does* need the refetch: the optimistic row
      carries a temporary id, and the real one only exists server-side. Without
      this the card would look right but not be clickable.
    */
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
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
          notes: "",
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

  const update = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: ItemPatch }) => {
      const { error } = await supabase
        .from("content_items")
        .update({
          ...(patch.title !== undefined && { title: patch.title }),
          ...(patch.type !== undefined && { type: patch.type }),
          ...(patch.notes !== undefined && { notes: patch.notes }),
          ...(patch.dueAt !== undefined && { due_at: patch.dueAt }),
          ...(patch.publishAt !== undefined && { publish_at: patch.publishAt }),
          ...(patch.platforms !== undefined && { platforms: patch.platforms }),
        })
        .eq("id", id)
      if (error) throw error
    },
    ...optimistic<{ id: string; patch: ItemPatch }>((current, vars) =>
      current.map((i) => (i.id === vars.id ? { ...i, ...vars.patch } : i)),
    ),
    onSuccess: (_data, vars) =>
      queryClient.invalidateQueries({ queryKey: ["activity", vars.id] }),
  })

  const setAssignees = useMutation({
    // Checkbox changes can happen faster than the network. Keep them ordered so
    // a quick add-then-remove cannot have the earlier insert land last.
    scope: { id: "content-assignees" },
    mutationFn: async ({
      id,
      previousIds,
      assigneeIds,
    }: {
      id: string
      previousIds: string[]
      assigneeIds: string[]
    }) => {
      const added = assigneeIds.filter((userId) => !previousIds.includes(userId))
      const removed = previousIds.filter((userId) => !assigneeIds.includes(userId))

      if (added.length > 0) {
        const { error } = await supabase
          .from("content_item_assignees")
          .insert(added.map((userId) => ({ content_item_id: id, user_id: userId })))
        if (error) throw error
      }

      if (removed.length > 0) {
        const { error } = await supabase
          .from("content_item_assignees")
          .delete()
          .eq("content_item_id", id)
          .in("user_id", removed)
        if (error) throw error
      }
    },
    ...optimistic<{ id: string; previousIds: string[]; assigneeIds: string[] }>(
      (current, vars) =>
        current.map((item) =>
          item.id === vars.id ? { ...item, assigneeIds: vars.assigneeIds } : item,
        ),
    ),
  })

  const archive = useMutation({
    mutationFn: async ({ id }: { id: string }) => {
      const archivedAt = new Date().toISOString()

      /*
        Archives the subtree in one statement. `ancestor_ids` contains every
        forebear, so `cs` matches the item's descendants at any depth — the
        same GIN index the guest-grant lookup uses.
      */
      const { error } = await supabase
        .from("content_items")
        .update({ archived_at: archivedAt })
        .or(`id.eq.${id},ancestor_ids.cs.{${id}}`)
      if (error) throw error
    },
    ...optimistic<{ id: string }>((current, vars) =>
      current.filter((i) => i.id !== vars.id && !i.ancestorIds.includes(vars.id)),
    ),
    onSuccess: (_data, vars) =>
      queryClient.invalidateQueries({ queryKey: ["activity", vars.id] }),
  })

  const value = useMemo<ContentContextValue>(() => {
    /** Where a card would land, or null if it is already sitting there. */
    function resolveMove(id: string, stageId: string, index: number) {
      const moving = items.find((i) => i.id === id)
      if (!moving) return null

      const { before, after } = rankForSlot(items, id, stageId, index)

      // Already in that gap — no rank to mint, and this runs on every
      // dragover tick.
      if (
        moving.stageId === stageId &&
        (before === null || moving.position > before) &&
        (after === null || moving.position < after)
      ) {
        return null
      }

      return { position: rankBetween(before, after) }
    }

    function previewMove(id: string, stageId: string, index: number) {
      const resolved = resolveMove(id, stageId, index)
      if (!resolved) return

      queryClient.setQueryData<ContentItem[]>(queryKey, (current = []) =>
        current.map((i) =>
          i.id === id ? { ...i, stageId, position: resolved.position } : i,
        ),
      )
    }

    /*
      Patch first, then write — one state update, never two.

      The mutation no longer patches the cache itself, so anything that moves a
      card has to preview it before committing. That is also the order the drag
      handler uses.
    */
    function moveItem(id: string, stageId: string, index: number) {
      const resolved = resolveMove(id, stageId, index)
      if (!resolved) return

      queryClient.setQueryData<ContentItem[]>(queryKey, (current = []) =>
        current.map((i) =>
          i.id === id ? { ...i, stageId, position: resolved.position } : i,
        ),
      )
      move.mutate({ id, stageId, position: resolved.position })
    }

    return {
      items,
      loading: Boolean(workspaceId) && isPending,
      moveItem,
      previewMove,
      /*
        Persists whatever the preview settled on, rather than recomputing —
        recomputing could pick a different rank and shift the card on release,
        which is the flicker this exists to avoid.
      */
      commitMove: (id: string) => {
        /*
          Read from the cache, not from `items`.

          `previewMove` is called immediately before this on drop, and `items`
          is the array from the last render — so the closure still holds the
          pre-move position and would persist the wrong one.
        */
        const moving = queryClient
          .getQueryData<ContentItem[]>(queryKey)
          ?.find((i) => i.id === id)
        if (!moving) return
        move.mutate({ id, stageId: moving.stageId, position: moving.position })
      },
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
      updateItem: (id, patch) => update.mutate({ id, patch }),
      setAssignees: (id, assigneeIds) => {
        const previousIds = items.find((item) => item.id === id)?.assigneeIds ?? []
        setAssignees.mutate({ id, previousIds, assigneeIds })
      },
      archiveItem: (id) => archive.mutate({ id }),
    }
    /*
      Depends on `move.mutate`, not `move`.

      useMutation returns a new result object on every render, so listing the
      mutation itself defeated this memo entirely: the context value got a new
      identity each render and every consumer — the board, every card, the
      project page — re-rendered with it. The `.mutate` functions are stable.
    */
  }, [
    items,
    isPending,
    workspaceId,
    move.mutate,
    create.mutate,
    update.mutate,
    setAssignees.mutate,
    archive.mutate,
    queryClient,
    queryKey,
  ])

  return <ContentContext value={value}>{children}</ContentContext>
}

export function useContent() {
  const context = useContext(ContentContext)
  if (!context) throw new Error("useContent must be used within <ContentProvider>")
  return context
}
