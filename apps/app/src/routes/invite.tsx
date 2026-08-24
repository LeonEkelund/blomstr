import { Logo } from "@blomstr/ui"
import { useQueryClient } from "@tanstack/react-query"
import { Loader2 } from "lucide-react"
import { useEffect, useRef, useState } from "react"
import { Navigate, useNavigate, useParams } from "react-router-dom"
import { useAuth } from "@/components/auth-provider"
import { Button } from "@/components/ui/button"
import { supabase } from "@/lib/supabase"

/**
 * Redeeming an invite.
 *
 * The token survives the trip through sign-in, which is the usual bug in this
 * flow: it lives in the URL, and the sign-in page sends you back to where you
 * were headed.
 */
export function InvitePage() {
  const { token } = useParams()
  const { session, loading } = useAuth()
  const queryClient = useQueryClient()
  const navigate = useNavigate()

  const [error, setError] = useState<string | null>(null)
  // Redeeming twice would consume two uses of a multi-use invite.
  const attempted = useRef(false)

  useEffect(() => {
    if (loading || !session || !token || attempted.current) return
    attempted.current = true

    supabase
      .rpc("redeem_invite", { p_token: token })
      .then(async ({ error: rpcError }) => {
        if (rpcError) {
          setError(rpcError.message)
          return
        }
        // The workspace list is what decides whether onboarding shows.
        await queryClient.invalidateQueries({ queryKey: ["workspaces"] })
        navigate("/projects", { replace: true })
      })
  }, [loading, session, token, queryClient, navigate])

  if (loading) return null

  /*
    Sign in first, carrying where to come back to. Without `from`, the sign-in
    page would send them to the board — of a workspace they are not in yet.
  */
  if (!session) {
    return <Navigate to="/sign-in" replace state={{ from: `/invite/${token}` }} />
  }

  return (
    <main className="flex min-h-svh flex-col items-center justify-center px-6 py-12">
      <div className="flex w-full max-w-[22rem] flex-col items-center text-center">
        <Logo className="size-10" />

        {error ? (
          <>
            <h1 className="mt-4 text-xl font-semibold tracking-tight">
              This invite is not valid
            </h1>
            <p className="mt-1.5 text-sm text-balance text-muted-foreground">
              It may have expired, been revoked, or already been used. Ask whoever sent it
              for a new link.
            </p>
            <Button
              variant="outline"
              size="sm"
              className="mt-6"
              onClick={() => navigate("/", { replace: true })}
            >
              Continue
            </Button>
          </>
        ) : (
          <>
            <h1 className="mt-4 text-xl font-semibold tracking-tight">
              Joining the workspace
            </h1>
            <Loader2 className="mt-4 size-4 animate-spin text-muted-foreground" />
          </>
        )}
      </div>
    </main>
  )
}
