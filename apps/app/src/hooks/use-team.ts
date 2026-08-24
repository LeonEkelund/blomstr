import type { WorkspaceRole } from "@blomstr/types"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useWorkspace } from "@/hooks/use-workspace"
import { supabase } from "@/lib/supabase"

export interface Invite {
  id: string
  role: WorkspaceRole
  email: string | null
  contentItemId: string | null
  expiresAt: string
  usedCount: number
  maxUses: number
  revokedAt: string | null
  createdAt: string
}

/** Outstanding invites — not the tokens, which are never readable. */
export function useInvites() {
  const { workspace } = useWorkspace()

  const { data: invites = [], isPending } = useQuery({
    queryKey: ["invites", workspace?.id],
    enabled: Boolean(workspace),
    queryFn: async (): Promise<Invite[]> => {
      const { data, error } = await supabase
        .from("invites_listing")
        .select("*")
        .eq("workspace_id", workspace?.id ?? "")
        .order("created_at", { ascending: false })
      if (error) throw error

      return data.map((i) => ({
        id: i.id ?? "",
        role: i.role ?? "guest",
        email: i.email,
        contentItemId: i.content_item_id,
        expiresAt: i.expires_at ?? "",
        usedCount: i.used_count ?? 0,
        maxUses: i.max_uses ?? 1,
        revokedAt: i.revoked_at,
        createdAt: i.created_at ?? "",
      }))
    },
  })

  return { invites, loading: Boolean(workspace) && isPending }
}

export function useTeamActions() {
  const { workspace } = useWorkspace()
  const queryClient = useQueryClient()

  function refresh() {
    queryClient.invalidateQueries({ queryKey: ["members", workspace?.id] })
    queryClient.invalidateQueries({ queryKey: ["invites", workspace?.id] })
  }

  /*
    Returns the raw token, which exists only in this response — it is stored
    hashed. Whatever calls this has to show it to the user immediately, because
    there is no way to retrieve it afterwards.
  */
  const invite = useMutation({
    mutationFn: async ({ role, email }: { role: WorkspaceRole; email?: string }) => {
      const { data, error } = await supabase.rpc("create_invite", {
        p_workspace_id: workspace?.id,
        p_role: role,
        p_email: email?.trim() || undefined,
      })
      if (error) throw error
      return data as string
    },
    onSuccess: refresh,
  })

  const revoke = useMutation({
    mutationFn: async (inviteId: string) => {
      const { error } = await supabase.rpc("revoke_invite", { p_invite_id: inviteId })
      if (error) throw error
    },
    onSuccess: refresh,
  })

  const setRole = useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: WorkspaceRole }) => {
      const { error } = await supabase.rpc("set_member_role", {
        p_workspace_id: workspace?.id ?? "",
        p_user_id: userId,
        p_role: role,
      })
      if (error) throw error
    },
    onSuccess: refresh,
  })

  const remove = useMutation({
    mutationFn: async (userId: string) => {
      const { error } = await supabase.rpc("remove_member", {
        p_workspace_id: workspace?.id ?? "",
        p_user_id: userId,
      })
      if (error) throw error
    },
    onSuccess: refresh,
  })

  return { invite, revoke, setRole, remove }
}
