import { NextResponse } from "next/server"
import { createSupabaseServerClient } from "@/lib/supabase/server"

/** Finishes email confirmation and OAuth flows by exchanging the code for a session. */
export async function GET(request: Request) {
  const url = new URL(request.url)
  const code = url.searchParams.get("code")
  const nextPath = url.searchParams.get("next") ?? "/dashboard"
  const safeNext = nextPath.startsWith("/") && !nextPath.startsWith("//") ? nextPath : "/dashboard"

  if (code) {
    const supabase = await createSupabaseServerClient()
    if (supabase) {
      const { error } = await supabase.auth.exchangeCodeForSession(code)
      if (!error) return NextResponse.redirect(new URL(safeNext, url.origin))
    }
  }
  return NextResponse.redirect(new URL("/login?error=link", url.origin))
}
