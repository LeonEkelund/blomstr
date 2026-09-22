/*
  Where the marketing site hands off to the product.

  The landing page and the app are separate deployments, so this is absolute,
  not relative. A relative "/sign-in" is silently broken here: the landing
  site's _redirects serves index.html for every unmatched path, so the CTA
  returned the marketing page to itself instead of 404ing, which is the worst
  of both — no error to notice, and no sign-in either.

  Set VITE_APP_URL on the landing deployment to the app's origin (a subdomain,
  e.g. https://app.blomstr.app). The fallback is the app's dev server, so
  `pnpm dev` in both apps hands off correctly with no env file.
*/
const APP_ORIGIN = import.meta.env.VITE_APP_URL ?? "http://localhost:5173"

export const SIGN_IN_URL = `${APP_ORIGIN.replace(/\/$/, "")}/sign-in`

/** Section ids, kept in one place so nav links and scroll targets cannot drift. */
export const SECTIONS = {
  product: "product",
  workflow: "how-it-works",
  capabilities: "capabilities",
  collaboration: "collaboration",
} as const
