"use server"

import { redirect } from "next/navigation"
import { z } from "zod"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import { safeNextPath } from "@/lib/url/safe-path"

const credentials = z.object({
  email: z.string().trim().email(),
  password: z.string().min(8, "Use at least 8 characters."),
  next: z.string().max(500).optional(),
})

export interface AuthState {
  error?: string
  notice?: string
}

function siteUrl() {
  return process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"
}

export async function signInAction(_prev: AuthState, form: FormData): Promise<AuthState> {
  const parsed = credentials.safeParse(Object.fromEntries(form))
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check your details." }
  const supabase = await createSupabaseServerClient()
  if (!supabase) return { error: "Sign-in is not configured on this deployment. Use the demo." }
  const { error } = await supabase.auth.signInWithPassword({ email: parsed.data.email, password: parsed.data.password })
  if (error) {
    return { error: /fetch|network|ENOTFOUND|ECONNREFUSED/i.test(error.message) ? "Could not reach the sign-in service. Try the demo meanwhile." : "Email or password did not match." }
  }
  redirect(safeNextPath(parsed.data.next))
}

export async function signUpAction(_prev: AuthState, form: FormData): Promise<AuthState> {
  const parsed = credentials.safeParse(Object.fromEntries(form))
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check your details." }
  const supabase = await createSupabaseServerClient()
  if (!supabase) return { error: "Accounts are not configured on this deployment. Use the demo." }
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: { emailRedirectTo: `${siteUrl()}/auth/callback?next=/dashboard` },
  })
  // One generic message: the specific Supabase text would reveal whether the address is registered.
  if (error) return { error: "Could not create the account with those details." }
  if (data.session) redirect("/dashboard")
  return { notice: "Check your inbox. The link in the email finishes creating the account." }
}

export async function signOutAction() {
  const supabase = await createSupabaseServerClient()
  await supabase?.auth.signOut()
  redirect("/")
}
