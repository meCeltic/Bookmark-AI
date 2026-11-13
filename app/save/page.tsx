import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { getSessionUser } from "@/lib/supabase/server"
import { normalizeUrl } from "@/lib/url/normalize"

export const metadata: Metadata = { title: "Save", robots: { index: false } }
export const dynamic = "force-dynamic"

/** The search param the dashboard's omnibox reads to prefill Save mode (see topbar.tsx). */
const SAVE_PARAM = "save"

type Params = Record<string, string | string[] | undefined>

const first = (v: string | string[] | undefined): string => (Array.isArray(v) ? (v[0] ?? "") : (v ?? ""))

/** The link to save: ?url=, or the first http(s) link inside ?text= (share sheets put it there). */
function linkFrom(params: Params): string | null {
  const direct = first(params.url).trim()
  const fromText = /https?:\/\/\S+/i.exec(first(params.text))?.[0] ?? ""
  const raw = (direct || fromText).slice(0, 2048)
  return raw ? normalizeUrl(raw) : null
}

/**
 * Bookmarklet and share target: /save?url=… opens the drawer with the link
 * waiting in the omnibox. Signed in goes to /dashboard, anyone else to /demo.
 */
export default async function SavePage({ searchParams }: { searchParams: Promise<Params> }) {
  const link = linkFrom(await searchParams)
  const user = await getSessionUser()
  const target = user ? "/dashboard" : "/demo"
  redirect(link ? `${target}?${SAVE_PARAM}=${encodeURIComponent(link)}` : target)
}
