/** Supabase is optional: without it the app runs in demo mode only. */
export function supabaseEnv(): { url: string; anonKey: string } | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  return url && anonKey ? { url, anonKey } : null
}

export const isCloudConfigured = () => supabaseEnv() !== null
