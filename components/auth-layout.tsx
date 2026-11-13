import type { ReactNode } from "react"
import { Wordmark } from "@/components/wordmark"
import { ThemeToggle } from "@/components/theme-toggle"

/** Centred auth shell: wordmark on top, one narrow column, theme toggle in the corner. */
export function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="relative flex min-h-dvh flex-col items-center px-4 pb-16 pt-20 sm:pt-28">
      <ThemeToggle className="absolute right-3 top-3 sm:right-5 sm:top-5" />
      <div className="w-full max-w-[380px]">
        <Wordmark />
        <div className="mt-10">{children}</div>
      </div>
    </div>
  )
}
