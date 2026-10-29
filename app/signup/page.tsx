import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { AuthForm } from "@/components/auth-form"
import { AuthLayout } from "@/components/auth-layout"
import { isCloudConfigured } from "@/lib/supabase/env"

export const metadata: Metadata = { title: "Create account" }

export default function SignupPage() {
  if (!isCloudConfigured()) redirect("/demo")
  return (
    <AuthLayout
      line="Start a drawer that follows you."
      card={{
        domain: "rauno.me",
        title: "Invisible Details of Interaction Design",
        summary: "Rauno Freiberg on the tiny timing, easing and hit-area decisions that make an interface feel considered.",
        tags: ["design", "interaction"],
      }}
    >
      <AuthForm mode="signup" />
    </AuthLayout>
  )
}
