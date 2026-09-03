import { Logo } from "@blomstr/ui"
import { Loader2 } from "lucide-react"
import { type FormEvent, useState } from "react"
import { Navigate, useLocation } from "react-router-dom"
import { useAuth } from "@/components/auth-provider"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { OAUTH_RETURN_TO_KEY, safeInternalPath } from "@/lib/auth"
import { supabase } from "@/lib/supabase"

/** Google's mark. Lucide has no brand icons, and an approximation looks off. */
function GoogleIcon() {
  return (
    <svg viewBox="0 0 18 18" className="size-4" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62Z"
      />
      <path
        fill="#34A853"
        d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18Z"
      />
      <path
        fill="#FBBC05"
        d="M3.97 10.72a5.4 5.4 0 0 1 0-3.44V4.95H.96a9 9 0 0 0 0 8.1l3.01-2.33Z"
      />
      <path
        fill="#EA4335"
        d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.59C13.46.89 11.43 0 9 0A9 9 0 0 0 .96 4.95l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58Z"
      />
    </svg>
  )
}

type Mode = "signIn" | "signUp"

export function SignInPage() {
  const { session, loading } = useAuth()
  const location = useLocation()

  const [mode, setMode] = useState<Mode>("signIn")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  if (loading) return null
  if (session) {
    // Send them back where they were headed before the guard intercepted.
    const to = (location.state as { from?: string } | null)?.from ?? "/"
    return <Navigate to={to} replace />
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)
    setNotice(null)
    setBusy(true)

    const { data, error: authError } =
      mode === "signIn"
        ? await supabase.auth.signInWithPassword({ email, password })
        : await supabase.auth.signUp({ email, password })

    setBusy(false)

    if (authError) {
      setError(authError.message)
      return
    }

    /*
      Signing up returns no session when the project requires email
      confirmation, which is the default. Without this the form would just sit
      there looking broken.
    */
    if (mode === "signUp" && !data.session) {
      setNotice("Check your email to confirm your account.")
    }
  }

  async function handleGoogle() {
    setError(null)
    setBusy(true)

    // The router state does not survive leaving the site for Google's consent
    // screen. Keep the intended in-app destination for the callback instead.
    try {
      const from = (location.state as { from?: string } | null)?.from
      sessionStorage.setItem(OAUTH_RETURN_TO_KEY, safeInternalPath(from))
    } catch {
      // Storage can be unavailable in private browsing; landing on Home is fine.
    }

    const { error: authError } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    })
    if (authError) {
      setError(authError.message)
      setBusy(false)
    }
    // On success the browser navigates away, so there is nothing to reset.
  }

  return (
    <main className="flex min-h-svh flex-col items-center justify-center px-6 py-12">
      <div className="w-full max-w-[22rem]">
        {/*
          No subtitle when signing in: someone returning already knows what
          this is, and the pitch belongs on the landing page. Signing up keeps
          one line, because a first-time visitor does want to know what it
          costs before handing over an email.
        */}
        <div className="flex flex-col items-center text-center">
          <Logo className="size-10" />
          <h1 className="mt-4 text-xl font-semibold tracking-tight">
            {mode === "signIn" ? "Welcome back" : "Create your account"}
          </h1>
          {/*
            One line in both modes so the header is the same height either way
            — otherwise toggling shifts the whole form, since the page is
            vertically centred.
          */}
          <p className="mt-1.5 min-h-5 text-sm text-muted-foreground">
            {mode === "signIn"
              ? "Sign in to continue to blomstr."
              : "Free to start. Invite your team later."}
          </p>
        </div>

        <Button
          variant="outline"
          className="mt-8 h-10 w-full gap-2.5"
          onClick={handleGoogle}
          disabled={busy}
        >
          <GoogleIcon />
          Continue with Google
        </Button>

        <div className="my-6 flex items-center gap-3">
          <span className="h-px flex-1 bg-border" />
          <span className="text-xs text-muted-foreground">or</span>
          <span className="h-px flex-1 bg-border" />
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="email" className="text-sm font-medium">
              Email
            </label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              required
              className="h-10"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="password" className="text-sm font-medium">
              Password
            </label>
            <Input
              id="password"
              type="password"
              autoComplete={mode === "signIn" ? "current-password" : "new-password"}
              required
              minLength={8}
              className="h-10"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}
          {notice && <p className="text-sm text-muted-foreground">{notice}</p>}

          <Button type="submit" className="mt-1 h-10 w-full" disabled={busy}>
            {busy && <Loader2 className="animate-spin" />}
            {mode === "signIn" ? "Sign in" : "Create account"}
          </Button>
        </form>

        <p className="mt-6 text-center text-sm text-muted-foreground">
          {mode === "signIn" ? "New to blomstr?" : "Already have an account?"}{" "}
          <button
            type="button"
            className="font-medium text-foreground underline-offset-4 hover:underline"
            onClick={() => {
              setMode(mode === "signIn" ? "signUp" : "signIn")
              setError(null)
              setNotice(null)
            }}
          >
            {mode === "signIn" ? "Create an account" : "Sign in"}
          </button>
        </p>
      </div>
    </main>
  )
}
