import type {
  Bookmark,
  LinkHealth,
  SortOrder,
  SystemView,
  ViewSelection,
} from "@/lib/domain/bookmark"
import { SYSTEM_VIEWS } from "@/lib/domain/bookmark"

export interface BookmarkFilter {
  view: ViewSelection
  tags: string[]
  health: LinkHealth | null
  sort: SortOrder
}

const isArchived = (b: Bookmark): boolean => b.archivedAt !== null

const matchesSystemView = (b: Bookmark, view: SystemView): boolean => {
  switch (view) {
    case "all":
      return !isArchived(b)
    case "favourites":
      return !isArchived(b) && b.favourite
    case "archive":
      return isArchived(b)
  }
}

export const matchesView = (b: Bookmark, view: ViewSelection): boolean =>
  view.kind === "view"
    ? matchesSystemView(b, view.view)
    : !isArchived(b) && b.collectionId === view.id

const hasAllTags = (b: Bookmark, tags: string[]): boolean =>
  tags.every((tag) => b.tags.includes(tag))

const hostnameOf = (url: string): string => {
  try {
    return new URL(url).hostname.replace(/^www\./, "").toLowerCase()
  } catch {
    return ""
  }
}

const compareTime = (a: string, b: string): number => Date.parse(a) - Date.parse(b)

/** Case-insensitive title order; bookmarks without a title sink to the bottom. */
const compareTitle = (a: Bookmark, b: Bookmark): number => {
  const ta = a.title.trim()
  const tb = b.title.trim()
  if (ta === "" && tb === "") return 0
  if (ta === "") return 1
  if (tb === "") return -1
  return ta.localeCompare(tb, undefined, { sensitivity: "base" })
}

const compareDomain = (a: Bookmark, b: Bookmark): number =>
  hostnameOf(a.url).localeCompare(hostnameOf(b.url)) || compareTitle(a, b)

/** Most recently opened first; never-opened bookmarks sink to the bottom. */
const compareOpened = (a: Bookmark, b: Bookmark): number => {
  if (a.lastOpenedAt === null && b.lastOpenedAt === null) return 0
  if (a.lastOpenedAt === null) return 1
  if (b.lastOpenedAt === null) return -1
  return compareTime(b.lastOpenedAt, a.lastOpenedAt)
}

const comparators: Record<SortOrder, (a: Bookmark, b: Bookmark) => number> = {
  newest: (a, b) => compareTime(b.createdAt, a.createdAt),
  oldest: (a, b) => compareTime(a.createdAt, b.createdAt),
  title: compareTitle,
  domain: compareDomain,
  opened: compareOpened,
}

export const sortBookmarks = (bookmarks: Bookmark[], sort: SortOrder): Bookmark[] =>
  [...bookmarks].sort(comparators[sort])

export const applyFilter = (bookmarks: Bookmark[], f: BookmarkFilter): Bookmark[] => {
  const kept = bookmarks.filter(
    (b) =>
      matchesView(b, f.view) &&
      hasAllTags(b, f.tags) &&
      (f.health === null || b.health === f.health),
  )
  return sortBookmarks(kept, f.sort)
}

export const tagCounts = (bookmarks: Bookmark[]): Array<{ tag: string; count: number }> => {
  const counts = new Map<string, number>()
  for (const b of bookmarks) {
    if (isArchived(b)) continue
    for (const tag of b.tags) counts.set(tag, (counts.get(tag) ?? 0) + 1)
  }
  return [...counts.entries()]
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag))
}

export const collectionCounts = (bookmarks: Bookmark[]): Map<string, number> => {
  const counts = new Map<string, number>()
  for (const b of bookmarks) {
    if (isArchived(b) || b.collectionId === null) continue
    counts.set(b.collectionId, (counts.get(b.collectionId) ?? 0) + 1)
  }
  return counts
}

export const isUnread = (b: Bookmark): boolean => !isArchived(b) && b.readAt === null

/** Per-view totals, plus `unread` (the Inbox badge) and `dead` (live links that failed a check). */
export const viewCounts = (bookmarks: Bookmark[]): Record<SystemView | "unread" | "dead", number> => {
  const counts = { all: 0, favourites: 0, archive: 0, unread: 0, dead: 0 }
  for (const b of bookmarks) {
    for (const view of SYSTEM_VIEWS) {
      if (matchesSystemView(b, view)) counts[view] += 1
    }
    if (isUnread(b)) counts.unread += 1
    if (!isArchived(b) && b.health === "dead") counts.dead += 1
  }
  return counts
}
