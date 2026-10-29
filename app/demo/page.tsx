import type { Metadata } from "next"
import { DashboardApp } from "@/components/dashboard/app"
import { isCloudConfigured } from "@/lib/supabase/env"

export const metadata: Metadata = { title: "Demo", robots: { index: false } }

export default function DemoPage() {
  return <DashboardApp mode="demo" cloudAvailable={isCloudConfigured()} />
}
