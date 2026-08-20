import { createClient, type SupabaseClient } from "@supabase/supabase-js"

/**
 * Browser client factory.
 *
 * Only ever pass the anon key here — it is safe to ship because every table
 * is guarded by RLS. The service-role key must never reach a client bundle.
 */
export function createBrowserClient(url: string, anonKey: string): SupabaseClient {
  return createClient(url, anonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  })
}

/*
  Re-exported so consuming apps don't each depend on @supabase/supabase-js
  directly — one place declares the version, and a mobile app later gets the
  same types without a second copy in its package.json.
*/
export type { Session, SupabaseClient, User } from "@supabase/supabase-js"
