import { createServerClient } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"
import { supabaseEnv } from "@/lib/supabase/env"

const PROTECTED = ["/dashboard", "/settings"]
const AUTH_PAGES = ["/login", "/signup"]

/**
 * Refreshes the Supabase session cookie on every matched request and gates the
 * account-only pages. Demo mode (/demo) is public and never touches Supabase.
 */
export async function proxy(request: NextRequest) {
  const env = supabaseEnv()
  const { pathname } = request.nextUrl
  const wantsProtected = PROTECTED.some((p) => pathname.startsWith(p))

  if (!env) {
    // No Supabase configured: the whole app is demo mode.
    return wantsProtected ? NextResponse.redirect(new URL("/demo", request.url)) : NextResponse.next()
  }

  let response = NextResponse.next({ request })
  const supabase = createServerClient(env.url, env.anonKey, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (toSet) => {
        for (const { name, value } of toSet) request.cookies.set(name, value)
        response = NextResponse.next({ request })
        for (const { name, value, options } of toSet) response.cookies.set(name, value, options)
      },
    },
  })

  const {
    data: { user },
  } = await supabase.auth.getUser()

  // A redirect must carry any refreshed session cookies, or the next request
  // presents an already-used refresh token.
  const redirectWithCookies = (to: URL) => {
    const redirect = NextResponse.redirect(to)
    for (const cookie of response.cookies.getAll()) redirect.cookies.set(cookie)
    return redirect
  }

  if (!user && wantsProtected) {
    const login = new URL("/login", request.url)
    login.searchParams.set("next", pathname)
    return redirectWithCookies(login)
  }
  if (user && AUTH_PAGES.includes(pathname)) {
    return redirectWithCookies(new URL("/dashboard", request.url))
  }
  return response
}

export const config = {
  matcher: ["/dashboard/:path*", "/settings/:path*", "/login", "/signup", "/auth/:path*"],
}
