import { useQuery } from "@tanstack/react-query"
import { createContext, type ReactNode, useContext, useMemo, useState } from "react"
import { useAuth } from "@/components/auth-provider"
import { supabase } from "@/lib/supabase"

export interface Workspace {
  id: string
  name: string
}

/** Remembers which workspace you were last in, across sessions. */
const STORAGE_KEY = "blomstr-workspace"

interface WorkspaceContextValue {
  workspaces: Workspace[]
  workspace: Workspace | null
  setWorkspace: (id: string) => void
  loading: boolean
}

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null)

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const [selectedId, setSelectedId] = useState<string | null>(() => {
    try {
      return localStorage.getItem(STORAGE_KEY)
    } catch {
      return null
    }
  })

  /*
    Queried straight off `workspaces` rather than through workspace_members,
    because the read policy there is is_staff() — a guest cannot see their own
    membership row. The workspaces policy is in_workspace(), which covers
    guests too, so this is the one query that works for everyone.
  */
  const { data: workspaces = [], isPending } = useQuery({
    queryKey: ["workspaces", user?.id],
    enabled: Boolean(user),
    queryFn: async (): Promise<Workspace[]> => {
      const { data, error } = await supabase
        .from("workspaces")
        .select("id, name")
        .order("created_at")
      if (error) throw error
      return data
    },
  })

  const workspace = workspaces.find((w) => w.id === selectedId) ?? workspaces[0] ?? null

  const value = useMemo<WorkspaceContextValue>(
    () => ({
      workspaces,
      workspace,
      setWorkspace: (id: string) => {
        setSelectedId(id)
        try {
          localStorage.setItem(STORAGE_KEY, id)
        } catch {
          // Not persisting is survivable; the choice still holds this session.
        }
      },
      loading: Boolean(user) && isPending,
    }),
    [workspaces, workspace, user, isPending],
  )

  return <WorkspaceContext value={value}>{children}</WorkspaceContext>
}

export function useWorkspace() {
  const context = useContext(WorkspaceContext)
  if (!context) throw new Error("useWorkspace must be used within <WorkspaceProvider>")
  return context
}
