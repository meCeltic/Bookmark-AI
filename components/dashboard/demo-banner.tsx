"use client"

import Link from "next/link"
import { useState } from "react"
import { useMounted } from "@/lib/client/use-mounted"
import { X } from "lucide-react"
import { readPrefs, writePrefs } from "@/lib/client/prefs"
import { useDashboard } from "./provider"

/** One quiet line. On phones it collapses to "Demo · Sign up to sync". */
export function DemoBanner({ cloudAvailable }: { cloudAvailable: boolean }) {
  const api = useDashboard()
  const mounted = useMounted()
  const [dismissed, setDismissed] = useState(false)
  if (!mounted || dismissed || readPrefs().demoBannerDismissed) return null
  return (
    <div className="flex h-9 min-w-0 shrink-0 items-center gap-3 border-b border-line bg-surface-2 px-4 text-[13px] text-ink-2 sm:px-6">
      <span className="min-w-0 truncate">
        <span className="font-medium text-ink">Demo</span>
        <span className="hidden sm:inline">. Everything you do here stays in this browser.</span>
      </span>
      <button type="button" className="hidden shrink-0 underline-offset-2 hover:text-ink hover:underline sm:inline" onClick={() => api.resetDemo()}>Reset demo</button>
      {cloudAvailable ? (
        <Link href="/signup" className="shrink-0 font-medium text-action underline-offset-2 hover:underline">
          <span aria-hidden className="mr-1.5 text-ink-3 sm:hidden">·</span>
          Sign up to sync
        </Link>
      ) : null}
      <button type="button" className="btn btn-ghost btn-icon ml-auto h-6 w-6 shrink-0" aria-label="Dismiss" onClick={() => { writePrefs({ demoBannerDismissed: true }); setDismissed(true) }}><X size={13} /></button>
    </div>
  )
}
