import {
  adminClient,
  corsHeaders,
  json,
  requiredEnv,
  requireUser,
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
      return json({ error: "Only the workspace owner can choose Drive files" }, 403)
    }

    const { data: connection, error: connectionError } = await admin
      .from("drive_connections")
      .select("connected_by")
      .eq("workspace_id", workspaceId)
      .maybeSingle()
    if (connectionError) throw connectionError
    if (!connection) return json({ error: "Google Drive is not connected" }, 409)
    if (connection.connected_by !== user.id) {
      return json({ error: "Reconnect Drive with the current workspace owner" }, 409)
    }

    const { data: refreshToken, error: tokenError } = await admin.rpc(
      "get_drive_refresh_token",
      { p_workspace_id: workspaceId },
    )
    if (tokenError) throw tokenError
    if (!refreshToken) return json({ error: "Google Drive is not connected" }, 409)

    const response = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: requiredEnv("GOOGLE_DRIVE_CLIENT_ID"),
        client_secret: requiredEnv("GOOGLE_DRIVE_CLIENT_SECRET"),
        grant_type: "refresh_token",
        refresh_token: refreshToken as string,
      }),
    })
    const tokens = (await response.json()) as {
      access_token?: string
      expires_in?: number
      error_description?: string
    }
    if (!response.ok || !tokens.access_token) {
      throw new Error(tokens.error_description ?? "Could not refresh Drive access")
    }

    return json({
      accessToken: tokens.access_token,
      expiresIn: tokens.expires_in ?? 3600,
    })
  } catch (error) {
    return json(
      { error: error instanceof Error ? error.message : "Could not access Drive" },
      500,
    )
  }
})
