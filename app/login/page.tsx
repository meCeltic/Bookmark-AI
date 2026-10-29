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
    <AuthLayout
      line="Your drawer is where you left it."
      card={{
        domain: "martinfowler.com",
        title: "CQRS",
        summary: "Martin Fowler's short, sceptical note on separating read and write models: when the split pays off, and why most systems should not start there.",
        tags: ["architecture", "patterns"],
      }}
    >
      <AuthForm mode="login" next={next} linkError={error === "link"} />
    </AuthLayout>
  )
}
