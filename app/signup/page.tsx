import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { AuthForm } from "@/components/auth-form"
import { AuthLayout } from "@/components/auth-layout"
import { isCloudConfigured } from "@/lib/supabase/env"

export const metadata: Metadata = { title: "Create account" }

export default function SignupPage() {
  if (!isCloudConfigured()) redirect("/demo")
  return (
    <AuthLayout>
      <AuthForm mode="signup" />
    </AuthLayout>
  )
}
