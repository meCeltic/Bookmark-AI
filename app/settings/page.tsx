import type { Metadata } from "next"
import Link from "next/link"
import { redirect } from "next/navigation"
import { ArrowLeft } from "lucide-react"
import { SettingsPanel } from "@/components/settings"
import { Wordmark } from "@/components/wordmark"
import { createSupabaseServerClient } from "@/lib/supabase/server"

export const metadata: Metadata = { title: "Settings", robots: { index: false } }
export const dynamic = "force-dynamic"

export default async function SettingsPage() {
  const supabase = await createSupabaseServerClient()
  if (!supabase) redirect("/demo")
  const { data } = await supabase.auth.getUser()
  if (!data.user) redirect("/login?next=/settings")
  const { count } = await supabase.from("bookmarks").select("id", { count: "exact", head: true })

  return (
    <div className="mx-auto w-full max-w-[640px] px-4 pb-20 pt-5 sm:px-8">
      <header className="flex h-11 items-center justify-between gap-4">
        <Wordmark href="/dashboard" />
        <Link href="/dashboard" className="btn btn-ghost btn-sm -mr-2.5"><ArrowLeft size={14} /> Back to your pages</Link>
      </header>
      <h1 className="mt-12 text-[32px] leading-tight" style={{ fontWeight: 700, letterSpacing: "-0.02em" }}>Settings</h1>
      <div className="mt-10">
        <SettingsPanel email={data.user.email ?? ""} bookmarkCount={count ?? 0} />
      </div>
    </div>
  )
}
