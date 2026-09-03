import {
  adminClient,
  corsHeaders,
  driveCallbackUrl,
  json,
  randomToken,
  requiredEnv,
  requireUser,
  sha256,
} from "../_shared/drive.ts"

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }
  if (request.method !== "POST") return json({ error: "Method not allowed" }, 405)

  try {
    const user = await requireUser(request)
    const { workspaceId } = (await request.json()) as { workspaceId?: string }
    if (!workspaceId) return json({ error: "Workspace is required" }, 400)

    const admin = adminClient()
    const { data: membership, error: membershipError } = await admin
      .from("workspace_members")
      .select("role")
      .eq("workspace_id", workspaceId)
      .eq("user_id", user.id)
      .maybeSingle()
    if (membershipError) throw membershipError
    if (membership?.role !== "owner") {
      return json({ error: "Only the workspace owner can connect Drive" }, 403)
    }

    const state = randomToken()
    const stateHash = await sha256(state)
    await admin
      .from("drive_oauth_states")
      .delete()
      .lt("expires_at", new Date().toISOString())
    const { error: stateError } = await admin.from("drive_oauth_states").insert({
      state_hash: stateHash,
      workspace_id: workspaceId,
      user_id: user.id,
    })
    if (stateError) throw stateError

    const authorizationUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth")
    authorizationUrl.search = new URLSearchParams({
      access_type: "offline",
      client_id: requiredEnv("GOOGLE_DRIVE_CLIENT_ID"),
      include_granted_scopes: "true",
      prompt: "consent",
      redirect_uri: driveCallbackUrl(),
      response_type: "code",
      scope: ["openid", "email", "https://www.googleapis.com/auth/drive.file"].join(" "),
      state,
    }).toString()

    return json({ url: authorizationUrl.toString() })
  } catch (error) {
    return json(
      { error: error instanceof Error ? error.message : "Could not connect Drive" },
      500,
    )
  }
})
