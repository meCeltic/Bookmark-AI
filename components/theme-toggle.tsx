"use client"

import { Moon, Sun } from "lucide-react"
import { useTheme } from "next-themes"
import { useMounted } from "@/lib/client/use-mounted"
import { withTransition } from "@/lib/client/transition"

/** Switch theme inside a root View Transition, so the page crossfades for 200ms. */
export function switchTheme(setTheme: (theme: string) => void, next: "light" | "dark") {
  withTransition(() => {
    setTheme(next)
    // next-themes applies the class in an effect; set it here too so the new snapshot is right.
    document.documentElement.classList.toggle("dark", next === "dark")
    document.documentElement.classList.toggle("light", next === "light")
    document.documentElement.style.colorScheme = next
  })
}

export function ThemeToggle({ className = "" }: { className?: string }) {
  const { resolvedTheme, setTheme } = useTheme()
  const mounted = useMounted()
  const dark = mounted && resolvedTheme === "dark"
  return (
    <button
      type="button"
      className={`btn btn-ghost btn-icon ${className}`}
      aria-label={dark ? "Switch to light" : "Switch to dark"}
      title={dark ? "Light" : "Dark"}
      onClick={() => switchTheme(setTheme, dark ? "light" : "dark")}
    >
      {dark ? <Sun size={16} /> : <Moon size={16} />}
    </button>
  )
}
