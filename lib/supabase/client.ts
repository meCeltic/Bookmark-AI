"use client"

import { createBrowserClient } from "@supabase/ssr"
import { supabaseEnv } from "./env"

let cached: ReturnType<typeof createBrowserClient> | null = null

export function createSupabaseBrowserClient() {
  const env = supabaseEnv()
  if (!env) return null
  cached ??= createBrowserClient(env.url, env.anonKey)
  return cached
}
