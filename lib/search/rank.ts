import Fuse, { type FuseResult, type FuseResultMatch, type IFuseOptions } from "fuse.js"
import type { Bookmark } from "@/lib/domain/bookmark"

export interface SearchMatch {
  key: string
  indices: [number, number][]
}

export interface SearchHit {
  bookmark: Bookmark
  /** Relevance in [0, 1]; 1 is a perfect match. */
  score: number
  matches: SearchMatch[]
}

export interface SearchIndex {
  fuse: Fuse<Bookmark>
  bookmarks: Bookmark[]
}

const DEFAULT_LIMIT = 50

const FUSE_OPTIONS: IFuseOptions<Bookmark> = {
  keys: [
    { name: "title", weight: 0.45 },
    { name: "tags", weight: 0.25 },
    { name: "summary", weight: 0.15 },
    { name: "description", weight: 0.1 },
    { name: "url", weight: 0.05 },
  ],
  // Bitap counts a transposition as two edits, so "recat" vs "react" scores 0.4;
  // 0.35 would reject that everyday typo.
  threshold: 0.4,
  ignoreLocation: true,
  includeScore: true,
  includeMatches: true,
  minMatchCharLength: 2,
}

export const createSearchIndex = (bookmarks: Bookmark[]): SearchIndex => ({
  fuse: new Fuse(bookmarks, FUSE_OPTIONS),
  bookmarks,
})

const normalizeQuery = (query: string): string => query.trim().toLowerCase()

const toMatches = (matches: readonly FuseResultMatch[] | undefined): SearchMatch[] =>
  (matches ?? [])
    .filter((m): m is FuseResultMatch & { key: string } => typeof m.key === "string")
    .map((m) => ({ key: m.key, indices: m.indices.map(([s, e]) => [s, e] as [number, number]) }))

const toHit = (result: FuseResult<Bookmark>): SearchHit => ({
  bookmark: result.item,
  score: 1 - (result.score ?? 1),
  matches: toMatches(result.matches),
})

const exactTagHit = (bookmark: Bookmark, tag: string): SearchHit => ({
  bookmark,
  score: 1,
  matches: [{ key: "tags", indices: [[0, tag.length - 1]] }],
})

export const searchBookmarks = (
  index: SearchIndex,
  query: string,
  limit: number = DEFAULT_LIMIT,
): SearchHit[] => {
  const q = normalizeQuery(query)
  if (q === "") return []

  // A query that is exactly one of a bookmark's tags is an intent signal, not a
  // fuzzy hit, so those bookmarks are pinned to the top regardless of Fuse score.
  const exact = index.bookmarks.filter((b) => b.tags.includes(q)).map((b) => exactTagHit(b, q))
  const exactIds = new Set(exact.map((h) => h.bookmark.id))

  const fuzzy = index.fuse
    .search(q)
    .map(toHit)
    .filter((h) => !exactIds.has(h.bookmark.id))

  return [...exact, ...fuzzy].slice(0, limit)
}

/** Splits text into alternating plain/highlighted segments from inclusive index pairs. */
export const highlightRanges = (
  text: string,
  indices: [number, number][],
): Array<{ text: string; hit: boolean }> => {
  const ranges = [...indices]
    .map(([s, e]) => [Math.max(0, s), Math.min(text.length - 1, e)] as [number, number])
    .filter(([s, e]) => s <= e)
    .sort((a, b) => a[0] - b[0])

  const segments: Array<{ text: string; hit: boolean }> = []
  const push = (chunk: string, hit: boolean): void => {
    if (chunk === "") return
    const last = segments[segments.length - 1]
    if (last && last.hit === hit) last.text += chunk
    else segments.push({ text: chunk, hit })
  }

  let cursor = 0
  for (const [start, end] of ranges) {
    if (end < cursor) continue
    const from = Math.max(start, cursor)
    push(text.slice(cursor, from), false)
    push(text.slice(from, end + 1), true)
    cursor = end + 1
  }
  push(text.slice(cursor), false)
  return segments
}
