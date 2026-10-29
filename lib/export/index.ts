import { z } from "zod"
import {
  bookmarkSchema,
  collectionSchema,
  type Bookmark,
  type Collection,
} from "@/lib/domain/bookmark"

export const EXPORT_VERSION = 1

export const exportFileSchema = z.object({
  app: z.literal("bookmark-ai"),
  version: z.literal(EXPORT_VERSION),
  exportedAt: z.iso.datetime(),
  collections: z.array(collectionSchema),
  bookmarks: z.array(bookmarkSchema),
})
export type ExportFile = z.infer<typeof exportFileSchema>

/** Explicit key order keeps diffs between two exports meaningful. */
const orderBookmark = (b: Bookmark): Bookmark => ({
  id: b.id,
  url: b.url,
  urlNormalized: b.urlNormalized,
  title: b.title,
  description: b.description,
  summary: b.summary,
  tags: b.tags,
  category: b.category,
  faviconUrl: b.faviconUrl,
  imageUrl: b.imageUrl,
  collectionId: b.collectionId,
  favourite: b.favourite,
  readAt: b.readAt,
  archivedAt: b.archivedAt,
  enrichment: b.enrichment,
  readingMinutes: b.readingMinutes,
  health: b.health,
  healthCheckedAt: b.healthCheckedAt,
  lastOpenedAt: b.lastOpenedAt,
  createdAt: b.createdAt,
  updatedAt: b.updatedAt,
})

const orderCollection = (c: Collection): Collection => ({
  id: c.id,
  name: c.name,
  position: c.position,
  createdAt: c.createdAt,
})

const byPosition = (a: Collection, b: Collection): number =>
  a.position - b.position || a.id.localeCompare(b.id)

export const toExportJson = (
  bookmarks: Bookmark[],
  collections: Collection[],
  now: Date = new Date(),
): string => {
  const file: ExportFile = {
    app: "bookmark-ai",
    version: EXPORT_VERSION,
    exportedAt: now.toISOString(),
    collections: [...collections].sort(byPosition).map(orderCollection),
    bookmarks: bookmarks.map(orderBookmark),
  }
  return JSON.stringify(file, null, 2)
}

const escapeHtml = (s: string): string =>
  s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")

const epochSeconds = (iso: string): number => Math.floor(Date.parse(iso) / 1000)

const indent = (depth: number): string => "    ".repeat(depth)

const anchorLine = (b: Bookmark, depth: number): string => {
  const attrs = [`HREF="${escapeHtml(b.url)}"`, `ADD_DATE="${epochSeconds(b.createdAt)}"`]
  if (b.tags.length > 0) attrs.push(`TAGS="${escapeHtml(b.tags.join(","))}"`)
  const title = b.title.trim() === "" ? b.url : b.title
  return `${indent(depth)}<DT><A ${attrs.join(" ")}>${escapeHtml(title)}</A>`
}

const folderLines = (c: Collection, items: Bookmark[], depth: number): string[] => [
  `${indent(depth)}<DT><H3 ADD_DATE="${epochSeconds(c.createdAt)}">${escapeHtml(c.name)}</H3>`,
  `${indent(depth)}<DL><p>`,
  ...items.map((b) => anchorLine(b, depth + 1)),
  `${indent(depth)}</DL><p>`,
]

export const toNetscapeHtml = (
  bookmarks: Bookmark[],
  collections: Collection[],
  now: Date = new Date(),
): string => {
  const known = new Set(collections.map((c) => c.id))
  // Bookmarks pointing at a collection we were not given fall back to top level
  // rather than silently vanishing from the export.
  const unsorted = bookmarks.filter((b) => b.collectionId === null || !known.has(b.collectionId))
  const grouped = [...collections]
    .sort(byPosition)
    .flatMap((c) => folderLines(c, bookmarks.filter((b) => b.collectionId === c.id), 1))

  const lines = [
    "<!DOCTYPE NETSCAPE-Bookmark-file-1>",
    `<!-- Exported from bookmark-ai on ${now.toISOString()} -->`,
    '<META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">',
    "<TITLE>Bookmarks</TITLE>",
    "<H1>Bookmarks</H1>",
    "<DL><p>",
    ...unsorted.map((b) => anchorLine(b, 1)),
    ...grouped,
    "</DL><p>",
  ]
  return `${lines.join("\n")}\n`
}

export const exportFilename = (kind: "json" | "html", now: Date = new Date()): string =>
  `bookmark-ai-${now.toISOString().slice(0, 10)}.${kind}`
