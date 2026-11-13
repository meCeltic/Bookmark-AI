import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { AuthForm } from "@/components/auth-form"
import { AuthLayout } from "@/components/auth-layout"
import { isCloudConfigured } from "@/lib/supabase/env"

export const metadata: Metadata = { title: "Sign in" }

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  if (!isCloudConfigured()) redirect("/demo")
  const { next, error } = await searchParams
  return (
    <AuthLayout>
      <AuthForm mode="login" next={next} linkError={error === "link"} />
    </AuthLayout>
  )
}
