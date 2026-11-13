"use client"

import { useEffect, useState } from "react"

/**
 * Keep the last value mounted for `ms` after it goes away, so an exit
 * animation can play. `state` drives `data-state` ("open" | "closed").
 * Pass a value that is stable between renders (state, not a fresh array).
 */
export function usePresence<T>(value: T | null | undefined, ms = 140): { item: T | null; state: "open" | "closed" } {
  const [kept, setKept] = useState<T | null>(value ?? null)
  // Adjusted during render, not in an effect, so the open frame never shows a stale value.
  if (value != null && value !== kept) setKept(value)
  useEffect(() => {
    if (value != null) return
    const t = window.setTimeout(() => setKept(null), ms)
    return () => window.clearTimeout(t)
  }, [value, ms])
  return { item: value ?? kept, state: value != null ? "open" : "closed" }
}
