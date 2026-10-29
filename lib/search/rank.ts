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

type Field = "title" | "tags" | "summary" | "description" | "url"

interface Entry {
  bookmark: Bookmark
  /** Lower-cased field text, for substring matching. */
  text: Record<Field, string>
  /** Distinct words from title and tags, for typo matching. */
  words: string[]
}

export interface SearchIndex {
  entries: Entry[]
}

const DEFAULT_LIMIT = 50

/**
 * Ranking, in order:
 *   1. the query is exactly one of the card's tags (an intent signal)
 *   2. every query word appears as a substring of some field, ranked by field
 *   3. a single-word query is within one or two typos of a title or tag word
 *
 * Typos use optimal string alignment distance (Levenshtein plus adjacent
 * transposition) on words rather than whole fields, so "recat" finds "react"
 * without lighting up every summary that happens to contain r, e, c, a, t.
 */
const FIELD_WEIGHT: Array<[Field, number]> = [
  ["title", 1],
  ["tags", 0.9],
  ["summary", 0.6],
  ["description", 0.5],
  ["url", 0.4],
]

const wordsOf = (text: string): string[] =>
  text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length >= 3)

export const createSearchIndex = (bookmarks: Bookmark[]): SearchIndex => ({
  entries: bookmarks.map((bookmark) => ({
    bookmark,
    text: {
      title: bookmark.title.toLowerCase(),
      tags: bookmark.tags.join(" ").toLowerCase(),
      summary: (bookmark.summary ?? "").toLowerCase(),
      description: (bookmark.description ?? "").toLowerCase(),
      url: bookmark.url.toLowerCase(),
    },
    words: [...new Set([...wordsOf(bookmark.title), ...bookmark.tags.flatMap(wordsOf)])],
  })),
})

const normalizeQuery = (query: string): string => query.trim().toLowerCase()

/** Every query word must appear in some field; the score follows the best field hit. */
function substringHit(entry: Entry, words: string[]): SearchHit | null {
  let best = 0
  const matches: SearchMatch[] = []
  for (const word of words) {
    let found = false
    for (const [field, weight] of FIELD_WEIGHT) {
      const at = entry.text[field].indexOf(word)
      if (at === -1) continue
      found = true
      best = Math.max(best, weight * (at === 0 ? 1 : 0.9))
      matches.push({ key: field, indices: [[at, at + word.length - 1]] })
      break
    }
    if (!found) return null
  }
  return { bookmark: entry.bookmark, score: 0.35 + 0.65 * best, matches }
}

/** Optimal string alignment distance, capped: returns max + 1 as soon as it is exceeded. */
export function editDistance(a: string, b: string, max: number): number {
  if (Math.abs(a.length - b.length) > max) return max + 1
  const rows: number[][] = Array.from({ length: a.length + 1 }, (_, i) =>
    Array.from({ length: b.length + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)),
  )
  for (let i = 1; i <= a.length; i++) {
    let rowMin = Infinity
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      let value = Math.min(rows[i - 1]![j]! + 1, rows[i]![j - 1]! + 1, rows[i - 1]![j - 1]! + cost)
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        value = Math.min(value, rows[i - 2]![j - 2]! + 1)
      }
      rows[i]![j] = value
      rowMin = Math.min(rowMin, value)
    }
    if (rowMin > max) return max + 1
  }
  return rows[a.length]![b.length]!
}

const typoBudget = (word: string): number => (word.length >= 8 ? 2 : word.length >= 4 ? 1 : 0)

function fuzzyHit(entry: Entry, word: string): SearchHit | null {
  const budget = typoBudget(word)
  if (budget === 0) return null
  let bestDistance = budget + 1
  let bestWord = ""
  for (const candidate of entry.words) {
    const d = editDistance(word, candidate, budget)
    if (d < bestDistance) {
      bestDistance = d
      bestWord = candidate
    }
  }
  if (bestDistance > budget) return null
  const field: Field = entry.bookmark.tags.includes(bestWord) ? "tags" : "title"
  const at = entry.text[field].indexOf(bestWord)
  return {
    bookmark: entry.bookmark,
    score: 0.3 * (1 - bestDistance / (budget + 1)),
    matches: at >= 0 ? [{ key: field, indices: [[at, at + bestWord.length - 1]] }] : [],
  }
}

export const searchBookmarks = (index: SearchIndex, query: string, limit: number = DEFAULT_LIMIT): SearchHit[] => {
  const q = normalizeQuery(query)
  if (q === "") return []
  const words = q.split(/\s+/).filter(Boolean)

  const exact: SearchHit[] = []
  const plain: SearchHit[] = []
  const seen = new Set<string>()

  for (const entry of index.entries) {
    if (entry.bookmark.tags.includes(q)) {
      exact.push({ bookmark: entry.bookmark, score: 1, matches: [{ key: "tags", indices: [[0, q.length - 1]] }] })
      seen.add(entry.bookmark.id)
      continue
    }
    const hit = substringHit(entry, words)
    if (hit) {
      plain.push(hit)
      seen.add(entry.bookmark.id)
    }
  }
  plain.sort((a, b) => b.score - a.score)

  const fuzzy: SearchHit[] = []
  if (words.length === 1) {
    for (const entry of index.entries) {
      if (seen.has(entry.bookmark.id)) continue
      const hit = fuzzyHit(entry, words[0]!)
      if (hit) fuzzy.push(hit)
    }
    fuzzy.sort((a, b) => b.score - a.score)
  }

  return [...exact, ...plain, ...fuzzy].slice(0, limit)
}

/** Splits text into alternating plain/highlighted segments from inclusive index pairs. */
export const highlightRanges = (text: string, indices: [number, number][]): Array<{ text: string; hit: boolean }> => {
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
