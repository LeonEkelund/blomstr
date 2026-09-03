import { createClient, type User } from "npm:@supabase/supabase-js@2.58.0"

export const corsHeaders = {
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Origin": "*",
}

export function requiredEnv(name: string) {
  const value = Deno.env.get(name)
  if (!value) throw new Error(`Missing ${name}`)
  return value
}

export function adminClient() {
  return createClient(
    requiredEnv("SUPABASE_URL"),
    requiredEnv("SUPABASE_SERVICE_ROLE_KEY"),
    { auth: { persistSession: false, autoRefreshToken: false } },
  )
}

export async function requireUser(request: Request): Promise<User> {
  const authorization = request.headers.get("Authorization")
  if (!authorization) throw new Error("Not authenticated")

  const client = createClient(
    requiredEnv("SUPABASE_URL"),
    requiredEnv("SUPABASE_ANON_KEY"),
    {
      global: { headers: { Authorization: authorization } },
      auth: { persistSession: false, autoRefreshToken: false },
    },
  )
  const {
    data: { user },
    error,
  } = await client.auth.getUser()
  if (error || !user) throw new Error("Not authenticated")
  return user
}

export function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  })
}

export function randomToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(32))
  return btoa(String.fromCharCode(...bytes))
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replaceAll("=", "")
}

export async function sha256(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value))
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("")
}

export function driveCallbackUrl() {
  return `${requiredEnv("SUPABASE_URL")}/functions/v1/drive-auth-callback`
}

export function appUrl() {
  return requiredEnv("APP_URL").replace(/\/$/, "")
}

export function redirectToApp(result: "connected" | "error", message?: string) {
  const url = new URL(`${appUrl()}/integrations`)
  url.searchParams.set("drive", result)
  if (message) url.searchParams.set("message", message)
  return Response.redirect(url, 302)
}
