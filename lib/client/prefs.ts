import type { SortOrder } from "@/lib/domain/bookmark"

export type Layout = "grid" | "list"

export interface Prefs {
  layout: Layout
  sort: SortOrder
  demoBannerDismissed: boolean
  /** Inbox: whether the already-read group is unfolded. */
  readOpen: boolean
}

const KEY = "bookmark-ai:prefs"
const DEFAULTS: Prefs = { layout: "list", sort: "newest", demoBannerDismissed: false, readOpen: false }

/** The UI offers Newest and Oldest only; older saved prefs fall back to Newest. */
function sanitize(p: Prefs): Prefs {
  return {
    layout: p.layout === "grid" ? "grid" : "list",
    sort: p.sort === "oldest" ? "oldest" : "newest",
    demoBannerDismissed: p.demoBannerDismissed === true,
    readOpen: p.readOpen === true,
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

/** One-time hints: a flag per name, remembered in this browser. */
export type Flag = "saved-once" | "done-hint" | "pane-keys"
const FLAG_KEY = (name: Flag) => `bookmark-ai:flag:${name}`

export function readFlag(name: Flag): boolean {
  if (typeof window === "undefined") return false
  try {
    return window.localStorage.getItem(FLAG_KEY(name)) === "1"
  } catch {
    return false
  }
}

export function writeFlag(name: Flag): void {
  try {
    window.localStorage.setItem(FLAG_KEY(name), "1")
  } catch {
    // Private mode: the hint may show again, which is harmless.
  }
  window.dispatchEvent(new CustomEvent("bookmark-ai:flag", { detail: name }))
}
