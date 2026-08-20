import { Logo } from "@blomstr/ui"
import { useQueryClient } from "@tanstack/react-query"
import { Loader2 } from "lucide-react"
import { type FormEvent, useState } from "react"
import { Navigate, useNavigate } from "react-router-dom"
import { useAuth } from "@/components/auth-provider"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useWorkspace } from "@/hooks/use-workspace"
import { supabase } from "@/lib/supabase"

/** "leon@blomstr.app" → "Leon's workspace", so Enter is a valid answer. */
function suggestName(email: string | undefined) {
  const local = email
    ?.split("@")[0]
    ?.replace(/[._-]+/g, " ")
    .trim()
  if (!local) return "My workspace"
  const name = local.charAt(0).toUpperCase() + local.slice(1)
  return `${name}'s workspace`
}

export function OnboardingPage() {
  const { user } = useAuth()
  const { workspace, loading } = useWorkspace()
  const queryClient = useQueryClient()
  const navigate = useNavigate()

  const [name, setName] = useState(() => suggestName(user?.email))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (loading) return null
  // Already has one — nothing to set up.
  if (workspace) return <Navigate to="/projects" replace />

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)
    setBusy(true)

    /*
      One RPC rather than three inserts: creating a workspace means inserting a
      row you are not yet a member of, which no RLS policy written in terms of
      membership can allow. create_workspace() is security definer and makes
      the workspace, the owner membership and the four stages atomically.
    */
    const { error: rpcError } = await supabase.rpc("create_workspace", {
      name: name.trim(),
    })

    if (rpcError) {
      setError(rpcError.message)
      setBusy(false)
      return
    }

    await queryClient.invalidateQueries({ queryKey: ["workspaces"] })
    navigate("/projects", { replace: true })
  }

  return (
    <main className="flex min-h-svh flex-col items-center justify-center px-6 py-12">
      <div className="w-full max-w-[22rem]">
        <div className="flex flex-col items-center text-center">
          <Logo className="size-10" />
          <h1 className="mt-4 text-xl font-semibold tracking-tight">
            Name your workspace
          </h1>
          <p className="mt-1.5 min-h-5 text-sm text-muted-foreground">
            You can change this later.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="mt-8 flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="workspace-name" className="text-sm font-medium">
              Workspace name
            </label>
            <Input
              id="workspace-name"
              required
              maxLength={60}
              className="h-10"
              value={name}
              onChange={(e) => setName(e.target.value)}
              // Sole field on a dedicated screen, and the suggestion is usually
              // right — focused and selected means Enter or one keystroke.
              autoFocus
              onFocus={(e) => e.target.select()}
            />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <Button
            type="submit"
            className="mt-1 h-10 w-full"
            disabled={busy || !name.trim()}
          >
            {busy && <Loader2 className="animate-spin" />}
            Create workspace
          </Button>
        </form>
      </div>
    </main>
  )
}
