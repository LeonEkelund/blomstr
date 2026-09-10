/*
  Where the marketing site hands off to the product.

  The landing page and the app are separate deployments, and how they will
  share a domain is not settled yet. Every call to action routes through this
  one constant so that decision stays a one-line change: leave it relative if
  the two end up behind the same host, or make it absolute
  ("https://app.blomstr.app/sign-in") if they do not.
*/
export const SIGN_IN_URL = "/sign-in"

/** Section ids, kept in one place so nav links and scroll targets cannot drift. */
export const SECTIONS = {
  product: "product",
  workflow: "how-it-works",
  capabilities: "capabilities",
  collaboration: "collaboration",
} as const
