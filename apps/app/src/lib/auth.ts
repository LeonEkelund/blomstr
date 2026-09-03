export const OAUTH_RETURN_TO_KEY = "blomstr-oauth-return-to"

/** OAuth return destinations must stay inside this app. */
export function safeInternalPath(value: unknown) {
  return typeof value === "string" && value.startsWith("/") && !value.startsWith("//")
    ? value
    : "/"
}
