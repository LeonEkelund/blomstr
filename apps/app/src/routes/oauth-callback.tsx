import { Logo } from "@blomstr/ui"
import { Loader2 } from "lucide-react"
import { useEffect } from "react"
import { Link, useLocation, useNavigate } from "react-router-dom"
import { useAuth } from "@/components/auth-provider"
import { Button } from "@/components/ui/button"
import { OAUTH_RETURN_TO_KEY, safeInternalPath } from "@/lib/auth"

function oauthError(search: string, hash: string) {
  const query = new URLSearchParams(search)
  const fragment = new URLSearchParams(hash.startsWith("#") ? hash.slice(1) : hash)
  return (
    query.get("error_description") ??
    fragment.get("error_description") ??
    query.get("error") ??
    fragment.get("error")
  )
}

export function OAuthCallbackPage() {
  const { session, loading } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const error = oauthError(location.search, location.hash)

  useEffect(() => {
    if (!session) return

    let destination = "/"
    try {
      destination = safeInternalPath(sessionStorage.getItem(OAUTH_RETURN_TO_KEY))
      sessionStorage.removeItem(OAUTH_RETURN_TO_KEY)
    } catch {
      // Home remains the safe fallback when storage is unavailable.
    }
    navigate(destination, { replace: true })
  }, [session, navigate])

  useEffect(() => {
    if (!error && (loading || session)) return
    try {
      sessionStorage.removeItem(OAUTH_RETURN_TO_KEY)
    } catch {
      // Nothing sensitive is stored; an uncleared destination is harmless.
    }
  }, [error, loading, session])

  if (error || (!loading && !session)) {
    return (
      <main className="flex min-h-svh flex-col items-center justify-center px-6 py-12 text-center">
        <Logo className="size-10" />
        <h1 className="mt-4 text-xl font-semibold tracking-tight">
          Couldn’t sign you in
        </h1>
        <p className="mt-2 max-w-sm text-sm text-muted-foreground">
          {error ?? "Google did not return a valid session. Please try again."}
        </p>
        <Button className="mt-6" render={<Link to="/sign-in" />}>
          Back to sign in
        </Button>
      </main>
    )
  }

  return (
    <main className="flex min-h-svh flex-col items-center justify-center gap-3 px-6 py-12">
      <Loader2 className="size-5 animate-spin text-muted-foreground" />
      <p className="text-sm text-muted-foreground">Finishing sign in…</p>
    </main>
  )
}
