import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useAuth } from "@/components/auth-provider"
import { useWorkspace } from "@/hooks/use-workspace"
import { supabase } from "@/lib/supabase"

export type NotificationKind =
  | "assigned"
  | "submitted_for_review"
  | "approved"
  | "changes_requested"
  | "commented"

interface NotificationPayload {
  version?: number
  subject_type?: string
}

export interface AppNotification {
  id: number
  kind: NotificationKind
  actorName: string
  contentItemId: string
  contentItemTitle: string
  payload: NotificationPayload
  readAt: string | null
  createdAt: string
}

function payload(value: unknown): NotificationPayload {
  return value && typeof value === "object" ? (value as NotificationPayload) : {}
}

export function useNotifications() {
  const { user } = useAuth()
  const { workspace } = useWorkspace()
  const queryClient = useQueryClient()
  const queryKey = ["notifications", workspace?.id, user?.id]

  const {
    data: notifications = [],
    isPending,
    error,
  } = useQuery({
    queryKey,
    enabled: Boolean(workspace && user),
    refetchInterval: 30_000,
    queryFn: async (): Promise<AppNotification[]> => {
      const { data: rows, error: notificationError } = await supabase
        .from("notifications")
        .select("id, actor_id, content_item_id, kind, payload, read_at, created_at")
        .eq("workspace_id", workspace?.id ?? "")
        .eq("user_id", user?.id ?? "")
        .order("created_at", { ascending: false })
        .limit(30)
      if (notificationError) throw notificationError

      // Requesting changes also writes the required note as a comment in the
      // same transaction. Keep the decision and hide its duplicate comment.
      const visibleRows = rows.filter(
        (row) =>
          !(
            row.kind === "commented" &&
            rows.some(
              (other) =>
                other.kind === "changes_requested" &&
                other.actor_id === row.actor_id &&
                other.content_item_id === row.content_item_id &&
                Math.abs(
                  new Date(other.created_at).getTime() -
                    new Date(row.created_at).getTime(),
                ) < 5_000,
            )
          ),
      )

      const itemIds = [...new Set(visibleRows.map((row) => row.content_item_id))]
      const actorIds = [
        ...new Set(visibleRows.map((row) => row.actor_id).filter(Boolean)),
      ] as string[]
      const [{ data: items, error: itemError }, { data: profiles, error: profileError }] =
        await Promise.all([
          itemIds.length
            ? supabase.from("content_items").select("id, title").in("id", itemIds)
            : Promise.resolve({ data: [], error: null }),
          actorIds.length
            ? supabase.from("profiles").select("id, display_name").in("id", actorIds)
            : Promise.resolve({ data: [], error: null }),
        ])
      if (itemError) throw itemError
      if (profileError) throw profileError

      const titleById = new Map((items ?? []).map((item) => [item.id, item.title]))
      const nameById = new Map(
        (profiles ?? []).map((profile) => [
          profile.id,
          profile.display_name ?? "Someone",
        ]),
      )

      return visibleRows.map((row) => ({
        id: row.id,
        kind: row.kind as NotificationKind,
        actorName: row.actor_id ? (nameById.get(row.actor_id) ?? "Someone") : "Someone",
        contentItemId: row.content_item_id,
        contentItemTitle: titleById.get(row.content_item_id) ?? "Project",
        payload: payload(row.payload),
        readAt: row.read_at,
        createdAt: row.created_at,
      }))
    },
  })

  const markRead = useMutation({
    mutationFn: async (id: number) => {
      if (!user) throw new Error("not signed in")
      const { error: updateError } = await supabase
        .from("notifications")
        .update({ read_at: new Date().toISOString() })
        .eq("id", id)
        .eq("user_id", user.id)
      if (updateError) throw updateError
    },
    onMutate: (id) => {
      const previous = queryClient.getQueryData<AppNotification[]>(queryKey)
      queryClient.setQueryData<AppNotification[]>(queryKey, (current = []) =>
        current.map((notification) =>
          notification.id === id
            ? { ...notification, readAt: new Date().toISOString() }
            : notification,
        ),
      )
      return { previous }
    },
    onError: (_error, _id, context) => {
      if (context?.previous) queryClient.setQueryData(queryKey, context.previous)
    },
  })

  const markAllRead = useMutation({
    mutationFn: async () => {
      if (!user || !workspace) throw new Error("no workspace")
      const { error: updateError } = await supabase
        .from("notifications")
        .update({ read_at: new Date().toISOString() })
        .eq("workspace_id", workspace.id)
        .eq("user_id", user.id)
        .is("read_at", null)
      if (updateError) throw updateError
    },
    onMutate: () => {
      const previous = queryClient.getQueryData<AppNotification[]>(queryKey)
      queryClient.setQueryData<AppNotification[]>(queryKey, (current = []) =>
        current.map((notification) => ({
          ...notification,
          readAt: notification.readAt ?? new Date().toISOString(),
        })),
      )
      return { previous }
    },
    onError: (_error, _variables, context) => {
      if (context?.previous) queryClient.setQueryData(queryKey, context.previous)
    },
  })

  return {
    notifications,
    unreadCount: notifications.filter((notification) => !notification.readAt).length,
    loading: Boolean(workspace && user) && isPending,
    error,
    markRead,
    markAllRead,
  }
}
