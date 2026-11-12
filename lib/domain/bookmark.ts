import { z } from "zod"

/**
 * Single source of truth for the shapes that cross boundaries:
 * server actions, the enrichment route, localStorage and the Supabase rows
 * all parse through these schemas before the UI sees them.
 */

export const ENRICHMENT_STATUSES = ["pending", "done", "fallback", "failed"] as const
export type EnrichmentStatus = (typeof ENRICHMENT_STATUSES)[number]

export const LINK_HEALTH = ["unknown", "ok", "redirected", "dead"] as const
export type LinkHealth = (typeof LINK_HEALTH)[number]

export const CATEGORIES = [
  "article",
  "documentation",
  "tool",
  "video",
  "repository",
  "paper",
  "product",
  "reference",
  "other",
] as const
export type Category = (typeof CATEGORIES)[number]

export const TAG_MAX = 8
export const TAG_LENGTH_MAX = 32

export const tagSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(1)
  .max(TAG_LENGTH_MAX)
  .regex(/^[a-z0-9][a-z0-9 .+#-]*$/, "tags are lowercase words, digits and - . + #")

export const bookmarkSchema = z.object({
  id: z.string().min(1),
  url: z.url(),
  urlNormalized: z.string().min(1),
  title: z.string().max(300),
  description: z.string().max(1000).nullable(),
  summary: z.string().max(600).nullable(),
  tags: z.array(tagSchema).max(TAG_MAX),
  category: z.enum(CATEGORIES).nullable(),
  faviconUrl: z.url().nullable(),
  imageUrl: z.url().nullable(),
  collectionId: z.string().nullable(),
  favourite: z.boolean(),
  readAt: z.iso.datetime({ offset: true }).nullable(),
  archivedAt: z.iso.datetime({ offset: true }).nullable(),
  enrichment: z.enum(ENRICHMENT_STATUSES),
  readingMinutes: z.number().int().min(0).max(600).nullable(),
  health: z.enum(LINK_HEALTH),
  healthCheckedAt: z.iso.datetime({ offset: true }).nullable(),
  lastOpenedAt: z.iso.datetime({ offset: true }).nullable(),
  createdAt: z.iso.datetime({ offset: true }),
  updatedAt: z.iso.datetime({ offset: true }),
})
export type Bookmark = z.infer<typeof bookmarkSchema>

/** What the UI needs to hand over to create a bookmark. Everything else is derived. */
export const newBookmarkSchema = z.object({
  url: z.url(),
  title: z.string().max(300).optional(),
  description: z.string().max(1000).nullable().optional(),
  summary: z.string().max(600).nullable().optional(),
  tags: z.array(tagSchema).max(TAG_MAX).optional(),
  category: z.enum(CATEGORIES).nullable().optional(),
  faviconUrl: z.url().nullable().optional(),
  imageUrl: z.url().nullable().optional(),
  collectionId: z.string().nullable().optional(),
  favourite: z.boolean().optional(),
  readAt: z.iso.datetime({ offset: true }).nullable().optional(),
  archivedAt: z.iso.datetime({ offset: true }).nullable().optional(),
  enrichment: z.enum(ENRICHMENT_STATUSES).optional(),
  readingMinutes: z.number().int().min(0).max(600).nullable().optional(),
  createdAt: z.iso.datetime({ offset: true }).optional(),
})
export type NewBookmark = z.infer<typeof newBookmarkSchema>

export const bookmarkPatchSchema = bookmarkSchema
  .omit({ id: true, url: true, urlNormalized: true, createdAt: true, updatedAt: true })
  .partial()
export type BookmarkPatch = z.infer<typeof bookmarkPatchSchema>

export const collectionSchema = z.object({
  id: z.string().min(1),
  name: z.string().trim().min(1).max(60),
  position: z.number().int(),
  createdAt: z.iso.datetime({ offset: true }),
})
export type Collection = z.infer<typeof collectionSchema>

/** Output of the enrichment pipeline (AI or metadata fallback). */
export const enrichmentSchema = z.object({
  title: z.string().max(300),
  description: z.string().max(1000).nullable(),
  summary: z.string().max(600).nullable(),
  tags: z.array(tagSchema).max(TAG_MAX),
  category: z.enum(CATEGORIES).nullable(),
  faviconUrl: z.url().nullable(),
  imageUrl: z.url().nullable(),
  readingMinutes: z.number().int().min(0).max(600).nullable(),
  source: z.enum(["ai", "metadata", "none"]),
})
export type Enrichment = z.infer<typeof enrichmentSchema>

export const SORT_ORDERS = ["newest", "oldest", "title", "domain", "opened"] as const
export type SortOrder = (typeof SORT_ORDERS)[number]

export const SYSTEM_VIEWS = ["all", "unsorted", "favourites", "reading", "archive"] as const
export type SystemView = (typeof SYSTEM_VIEWS)[number]

/** Where the dashboard is looking: a built-in view, or one collection. */
export type ViewSelection = { kind: "view"; view: SystemView } | { kind: "collection"; id: string }
