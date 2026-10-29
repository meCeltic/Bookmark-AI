import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { DashboardApp } from "@/components/dashboard/app"
import { SupabaseRepository } from "@/lib/repo/supabase"
import { createSupabaseServerClient } from "@/lib/supabase/server"

export const metadata: Metadata = { title: "Your drawer", robots: { index: false } }
export const dynamic = "force-dynamic"

export default async function DashboardPage() {
  const supabase = await createSupabaseServerClient()
  if (!supabase) redirect("/demo")
  const { data } = await supabase.auth.getUser()
  if (!data.user) redirect("/login?next=/dashboard")

  const repo = new SupabaseRepository(supabase, data.user.id)
  const [bookmarks, collections] = await Promise.all([repo.listBookmarks(), repo.listCollections()])

  return <DashboardApp mode="cloud" user={{ email: data.user.email ?? "you" }} initial={{ bookmarks, collections }} />
}
