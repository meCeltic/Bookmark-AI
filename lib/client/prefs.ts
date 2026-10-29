import type { SortOrder } from "@/lib/domain/bookmark"

export type Layout = "grid" | "list"

export interface Prefs {
  layout: Layout
  sort: SortOrder
  demoBannerDismissed: boolean
}

const KEY = "bookmark-ai:prefs"
const DEFAULTS: Prefs = { layout: "grid", sort: "newest", demoBannerDismissed: false }

export function readPrefs(): Prefs {
  if (typeof window === "undefined") return DEFAULTS
  try {
    const raw = window.localStorage.getItem(KEY)
    return raw ? { ...DEFAULTS, ...(JSON.parse(raw) as Partial<Prefs>) } : DEFAULTS
  } catch {
    return DEFAULTS
  }
}

export function writePrefs(patch: Partial<Prefs>): Prefs {
  const next = { ...readPrefs(), ...patch }
  try {
    window.localStorage.setItem(KEY, JSON.stringify(next))
  } catch {
    // Private mode or quota: preferences simply do not persist.
  }
  return next
}
