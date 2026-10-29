"use client"

import { Moon, Sun } from "lucide-react"
import { useTheme } from "next-themes"
import { useMounted } from "@/lib/client/use-mounted"

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
      onClick={() => setTheme(dark ? "light" : "dark")}
    >
      {dark ? <Sun size={16} /> : <Moon size={16} />}
    </button>
  )
}
