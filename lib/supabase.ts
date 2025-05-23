import { createClientComponentClient } from "@supabase/auth-helpers-nextjs"
import type { SupabaseClient } from "@supabase/supabase-js"

// Client singleton
let clientInstance: SupabaseClient | null = null

// Create a singleton client component client
export const createClient = () => {
  if (clientInstance) return clientInstance

  clientInstance = createClientComponentClient({
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL!,
    supabaseKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  })

  return clientInstance
}
