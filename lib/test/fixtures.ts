import type { Bookmark, Collection } from "@/lib/domain/bookmark"

let sequence = 0

/** Monotonic suffix so fixtures made in one test never collide on id/url. */
const next = (): number => {
  sequence += 1
  return sequence
}

export const makeBookmark = (overrides: Partial<Bookmark> = {}): Bookmark => {
  const n = next()
  const url = overrides.url ?? `https://example.com/page-${n}`
  const base: Bookmark = {
    id: `bm-${n}`,
    url,
    urlNormalized: url,
    title: `Example page ${n}`,
    description: null,
    summary: null,
    tags: [],
    category: null,
    faviconUrl: null,
    imageUrl: null,
    collectionId: null,
    favourite: false,
    readAt: null,
    archivedAt: null,
    enrichment: "done",
    readingMinutes: null,
    health: "unknown",
    healthCheckedAt: null,
    lastOpenedAt: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  }
  return { ...base, ...overrides }
}

export const makeCollection = (overrides: Partial<Collection> = {}): Collection => {
  const n = next()
  const base: Collection = {
    id: `col-${n}`,
    name: `Collection ${n}`,
    position: n,
    createdAt: "2026-01-01T00:00:00.000Z",
  }
  return { ...base, ...overrides }
}
