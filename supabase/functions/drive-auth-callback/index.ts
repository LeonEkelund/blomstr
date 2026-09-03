import {
  adminClient,
  driveCallbackUrl,
  redirectToApp,
  requiredEnv,
  sha256,
} from "../_shared/drive.ts"

Deno.serve(async (request) => {
  const callback = new URL(request.url)
  const code = callback.searchParams.get("code")
  const state = callback.searchParams.get("state")
  const providerError = callback.searchParams.get("error")

  if (!state) return redirectToApp("error", "Google did not return a valid request.")

  try {
    const admin = adminClient()
    const stateHash = await sha256(state)
    const { data: oauthState, error: stateError } = await admin
      .from("drive_oauth_states")
      .delete()
      .eq("state_hash", stateHash)
      .select("workspace_id, user_id, expires_at")
      .maybeSingle()
    if (stateError) throw stateError
    if (!oauthState || new Date(oauthState.expires_at) <= new Date()) {
      return redirectToApp("error", "The Drive connection request expired. Try again.")
    }
    if (providerError || !code) {
      return redirectToApp("error", "Google Drive access was not granted.")
    }

    const { data: membership, error: membershipError } = await admin
      .from("workspace_members")
      .select("role")
      .eq("workspace_id", oauthState.workspace_id)
      .eq("user_id", oauthState.user_id)
      .maybeSingle()
    if (membershipError) throw membershipError
    if (membership?.role !== "owner") {
      return redirectToApp("error", "Only the workspace owner can connect Drive.")
    }

    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: requiredEnv("GOOGLE_DRIVE_CLIENT_ID"),
        client_secret: requiredEnv("GOOGLE_DRIVE_CLIENT_SECRET"),
        code,
        grant_type: "authorization_code",
        redirect_uri: driveCallbackUrl(),
      }),
    })
    const tokens = (await tokenResponse.json()) as {
      access_token?: string
      refresh_token?: string
      error_description?: string
    }
    if (!tokenResponse.ok || !tokens.access_token || !tokens.refresh_token) {
      throw new Error(tokens.error_description ?? "Google did not return Drive tokens")
    }

    const profileResponse = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    })
    const profile = (await profileResponse.json()) as { email?: string }
    if (!profileResponse.ok || !profile.email) {
      throw new Error("Could not read the connected Google account")
    }

    const { error: saveError } = await admin.rpc("upsert_drive_connection_secret", {
      p_workspace_id: oauthState.workspace_id,
      p_connected_by: oauthState.user_id,
      p_google_email: profile.email,
      p_refresh_token: tokens.refresh_token,
    })
    if (saveError) throw saveError

    return redirectToApp("connected")
  } catch (error) {
    console.error("Drive OAuth callback failed", error)
    return redirectToApp("error", "Could not connect Google Drive. Please try again.")
  }
})
