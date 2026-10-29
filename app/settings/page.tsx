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
    <div className="mx-auto max-w-[720px] px-5 py-6 sm:px-8">
      <header className="flex items-center justify-between">
        <Wordmark href="/dashboard" />
        <Link href="/dashboard" className="btn btn-ghost btn-sm"><ArrowLeft size={14} /> Back to the drawer</Link>
      </header>
      <h1 className="mt-10 font-display text-[30px] font-medium">Settings</h1>
      <div className="mt-8">
        <SettingsPanel email={data.user.email ?? ""} bookmarkCount={count ?? 0} />
      </div>
    </div>
  )
}
