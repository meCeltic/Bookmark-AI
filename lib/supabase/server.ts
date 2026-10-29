import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"
import { supabaseEnv } from "./env"

/** Request-scoped client for server components, actions and route handlers. */
export async function createSupabaseServerClient() {
  const env = supabaseEnv()
  if (!env) return null
  const cookieStore = await cookies()
  return createServerClient(env.url, env.anonKey, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (toSet) => {
        try {
          for (const { name, value, options } of toSet) cookieStore.set(name, value, options)
        } catch {
          // Server components cannot set cookies; proxy.ts refreshes the session instead.
        }
      },
    },
  })
}

export async function getSessionUser() {
  const supabase = await createSupabaseServerClient()
  if (!supabase) return null
  const { data, error } = await supabase.auth.getUser()
  if (error || !data.user) return null
  return data.user
}
