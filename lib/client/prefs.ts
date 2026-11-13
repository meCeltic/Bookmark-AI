import type { SortOrder } from "@/lib/domain/bookmark"

export type Layout = "grid" | "list"

export interface Prefs {
  layout: Layout
  sort: SortOrder
  demoBannerDismissed: boolean
}

const KEY = "bookmark-ai:prefs"
const DEFAULTS: Prefs = { layout: "list", sort: "newest", demoBannerDismissed: false }

/** The UI offers Newest and Oldest only; older saved prefs fall back to Newest. */
function sanitize(p: Prefs): Prefs {
  return {
    layout: p.layout === "grid" ? "grid" : "list",
    sort: p.sort === "oldest" ? "oldest" : "newest",
    demoBannerDismissed: p.demoBannerDismissed === true,
  }
}

export function readPrefs(): Prefs {
  if (typeof window === "undefined") return DEFAULTS
  try {
    const raw = window.localStorage.getItem(KEY)
    return raw ? sanitize({ ...DEFAULTS, ...(JSON.parse(raw) as Partial<Prefs>) }) : DEFAULTS
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
