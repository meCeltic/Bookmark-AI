import {
  bookmarkSchema,
  type Bookmark,
  type BookmarkPatch,
  type NewBookmark,
} from "@/lib/domain/bookmark"
import { canonicalKey } from "@/lib/url/normalize"

export const nowIso = () => new Date().toISOString()

export const newId = (): string =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`

/** Turn a NewBookmark into a full, validated Bookmark. Shared by every repository. */
export function materialize(input: NewBookmark, id = newId()): Bookmark {
  const created = input.createdAt ?? nowIso()
  return bookmarkSchema.parse({
    id,
    url: input.url,
    urlNormalized: canonicalKey(input.url),
    title: input.title?.trim() || hostnameOf(input.url),
    description: input.description ?? null,
    summary: input.summary ?? null,
    tags: uniqueTags(input.tags ?? []),
    category: input.category ?? null,
    faviconUrl: input.faviconUrl ?? null,
    imageUrl: input.imageUrl ?? null,
    collectionId: input.collectionId ?? null,
    favourite: input.favourite ?? false,
    readAt: input.readAt ?? null,
    archivedAt: input.archivedAt ?? null,
    enrichment: input.enrichment ?? "pending",
    readingMinutes: input.readingMinutes ?? null,
    health: "unknown",
    healthCheckedAt: null,
    lastOpenedAt: null,
    createdAt: created,
    updatedAt: created,
  })
}

export function applyPatch(bookmark: Bookmark, patch: BookmarkPatch): Bookmark {
  const next = { ...bookmark, ...patch, updatedAt: nowIso() }
  if (patch.tags) next.tags = uniqueTags(patch.tags)
  return bookmarkSchema.parse(next)
}

export function uniqueTags(tags: string[]): string[] {
  const seen = new Set<string>()
  for (const raw of tags) {
    const tag = raw.trim().toLowerCase()
    if (tag) seen.add(tag)
  }
  return [...seen]
}

function hostnameOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "")
  } catch {
    return url
  }
}
