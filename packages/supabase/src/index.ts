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

export type { SupabaseClient }
