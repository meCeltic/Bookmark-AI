"use client"

import Link from "next/link"
import { useState } from "react"
import { useMounted } from "@/lib/client/use-mounted"
import { X } from "lucide-react"
import { readPrefs, writePrefs } from "@/lib/client/prefs"
import { useDashboard } from "./provider"

export function DemoBanner({ cloudAvailable }: { cloudAvailable: boolean }) {
  const api = useDashboard()
  const mounted = useMounted()
  const [dismissed, setDismissed] = useState(false)
  if (!mounted || dismissed || readPrefs().demoBannerDismissed) return null
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-border bg-surface-2 px-4 py-2 text-[13px] sm:px-5">
      <span><strong className="font-semibold">Demo mode.</strong> Everything you do here stays in this browser.</span>
      <button type="button" className="underline underline-offset-2 hover:text-accent" onClick={() => api.resetDemo()}>Reset demo</button>
      {cloudAvailable ? <Link href="/signup" className="underline underline-offset-2 hover:text-accent">Create a free account to sync</Link> : null}
      <button type="button" className="btn btn-ghost btn-icon ml-auto h-6 w-6" aria-label="Dismiss" onClick={() => { writePrefs({ demoBannerDismissed: true }); setDismissed(true) }}><X size={13} /></button>
    </div>
  )
}
