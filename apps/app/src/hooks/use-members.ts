import type { Member } from "@blomstr/types"
import { useQuery } from "@tanstack/react-query"
import { useAuth } from "@/components/auth-provider"
import { useWorkspace } from "@/hooks/use-workspace"
import { toMember } from "@/lib/mappers"
import { supabase } from "@/lib/supabase"

/**
 * Everyone in the current workspace, with their names.
 *
 * Two queries rather than one embedded select: `workspace_members.user_id` and
 * `profiles.id` both point at `auth.users`, but there is no foreign key
 * *between* them, so PostgREST cannot embed one in the other. Merged here
 * instead.
 */
/*
  Module-level so the fallback keeps one identity. `= []` inline would mint a
  new array every render, which quietly breaks memoisation in anything that
  takes members as a prop.
*/
const NO_MEMBERS: Member[] = []

export function useMembers() {
  const { workspace } = useWorkspace()

  const { data: members = NO_MEMBERS, isPending } = useQuery({
    queryKey: ["members", workspace?.id],
    enabled: Boolean(workspace),
    queryFn: async (): Promise<Member[]> => {
      const { data: rows, error } = await supabase
        .from("workspace_members")
        .select("*")
        .eq("workspace_id", workspace?.id ?? "")
      if (error) throw error

      const { data: profiles, error: profileError } = await supabase
        .from("profiles")
        .select("*")
        .in(
          "id",
          rows.map((r) => r.user_id),
        )
      if (profileError) throw profileError

      const byId = new Map(profiles.map((p) => [p.id, p]))
      return rows.map((row) => toMember(row, byId.get(row.user_id)))
    },
  })

  return { members, loading: Boolean(workspace) && isPending }
}

/** The signed-in user as a Member, for the sidebar's account row. */
export function useCurrentMember() {
  const { user } = useAuth()
  const { members } = useMembers()

  const member = members.find((m) => m.id === user?.id)

  return {
    member,
    email: user?.email ?? "",
    // Before the members query lands, the email is still something to show.
    name: member?.name ?? user?.email?.split("@")[0] ?? "",
  }
}
