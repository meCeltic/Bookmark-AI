import type { SupabaseClient } from "@supabase/supabase-js"
import {
  bookmarkSchema,
  collectionSchema,
  type Bookmark,
  type BookmarkPatch,
  type Collection,
  type NewBookmark,
} from "@/lib/domain/bookmark"
import { fail, ok, type Result } from "@/lib/domain/result"
import { logger } from "@/lib/log"
import type { BookmarkRepository } from "./types"
import { materialize, uniqueTags } from "./shared"

/**
 * Postgres implementation. Runs on the server with the caller's session, so
 * row-level security does the authorisation; this class never filters by user
 * itself except where the unique index needs the id on insert.
 */

type Row = Record<string, unknown>

/**
 * Explicit column lists: bookmarks skip the generated search vector, which only
 * Postgres needs. lib/repo/columns.test.ts checks both against the migration.
 */
export const BOOKMARK_COLUMNS =
  "id,user_id,collection_id,url,url_normalized,title,description,summary,tags,category,favicon_url,image_url,favourite,read_at,archived_at,enrichment,reading_minutes,health,health_checked_at,last_opened_at,created_at,updated_at"
export const COLLECTION_COLUMNS = "id,user_id,name,position,created_at"

const UNIQUE_VIOLATION = "23505"

/** Postgres wording and constraint names stay in the server log; the client gets one sentence. */
function failInternal<T>(error: { message: string; code?: string }): Result<T> {
  logger({ scope: "supabase" }).error("query failed", { code: error.code, detail: error.message })
  return fail("INTERNAL", "Something went wrong saving that. Please try again.")
}

/** Postgres hands back "+00:00" offsets; the app stores and compares "Z" strings. */
const iso = (value: unknown): string | null => (typeof value === "string" ? new Date(value).toISOString() : null)

export function rowToBookmark(row: Row): Bookmark {
  return bookmarkSchema.parse({
    id: row.id,
    url: row.url,
    urlNormalized: row.url_normalized,
    title: row.title ?? "",
    description: row.description ?? null,
    summary: row.summary ?? null,
    tags: row.tags ?? [],
    category: row.category ?? null,
    faviconUrl: row.favicon_url ?? null,
    imageUrl: row.image_url ?? null,
    collectionId: row.collection_id ?? null,
    favourite: row.favourite ?? false,
    readAt: iso(row.read_at),
    archivedAt: iso(row.archived_at),
    enrichment: row.enrichment ?? "pending",
    readingMinutes: row.reading_minutes ?? null,
    health: row.health ?? "unknown",
    healthCheckedAt: iso(row.health_checked_at),
    lastOpenedAt: iso(row.last_opened_at),
    createdAt: iso(row.created_at),
    updatedAt: iso(row.updated_at),
  })
}

function bookmarkToRow(b: Bookmark, userId: string): Row {
  return {
    id: b.id,
    user_id: userId,
    collection_id: b.collectionId,
    url: b.url,
    url_normalized: b.urlNormalized,
    title: b.title,
    description: b.description,
    summary: b.summary,
    tags: b.tags,
    category: b.category,
    favicon_url: b.faviconUrl,
    image_url: b.imageUrl,
    favourite: b.favourite,
    read_at: b.readAt,
    archived_at: b.archivedAt,
    enrichment: b.enrichment,
    reading_minutes: b.readingMinutes,
    health: b.health,
    health_checked_at: b.healthCheckedAt,
    last_opened_at: b.lastOpenedAt,
    created_at: b.createdAt,
  }
}

const PATCH_COLUMNS: Record<keyof BookmarkPatch, string> = {
  title: "title",
  description: "description",
  summary: "summary",
  tags: "tags",
  category: "category",
  faviconUrl: "favicon_url",
  imageUrl: "image_url",
  collectionId: "collection_id",
  favourite: "favourite",
  readAt: "read_at",
  archivedAt: "archived_at",
  enrichment: "enrichment",
  readingMinutes: "reading_minutes",
  health: "health",
  healthCheckedAt: "health_checked_at",
  lastOpenedAt: "last_opened_at",
}

function patchToRow(patch: BookmarkPatch): Row {
  const row: Row = {}
  for (const [key, column] of Object.entries(PATCH_COLUMNS) as [keyof BookmarkPatch, string][]) {
    if (key in patch) row[column] = key === "tags" ? uniqueTags(patch.tags ?? []) : patch[key]
  }
  return row
}

function rowToCollection(row: Row): Collection {
  return collectionSchema.parse({
    id: row.id,
    name: row.name,
    position: row.position ?? 0,
    createdAt: iso(row.created_at),
  })
}

export class SupabaseRepository implements BookmarkRepository {
  constructor(
    private readonly db: SupabaseClient,
    private readonly userId: string,
  ) {}

  async listBookmarks(): Promise<Bookmark[]> {
    const { data, error } = await this.db
      .from("bookmarks")
      .select(BOOKMARK_COLUMNS)
      .order("created_at", { ascending: false })
    if (error) throw new Error(error.message)
    return (data as Row[]).map(rowToBookmark)
  }

  async getBookmark(id: string): Promise<Bookmark | null> {
    const { data } = await this.db.from("bookmarks").select(BOOKMARK_COLUMNS).eq("id", id).maybeSingle()
    return data ? rowToBookmark(data as Row) : null
  }

  async createBookmark(input: NewBookmark): Promise<Result<Bookmark>> {
    const bookmark = materialize(input)
    const { data, error } = await this.db
      .from("bookmarks")
      .insert(bookmarkToRow(bookmark, this.userId))
      .select(BOOKMARK_COLUMNS)
      .single()
    if (error?.code === UNIQUE_VIOLATION) {
      const { data: existing } = await this.db
        .from("bookmarks")
        .select("id, created_at")
        .eq("url_normalized", bookmark.urlNormalized)
        .maybeSingle()
      return fail("DUPLICATE", "You already saved this page.", {
        existingId: existing?.id,
        savedAt: existing?.created_at,
      })
    }
    if (error) return failInternal(error)
    return ok(rowToBookmark(data as Row))
  }

  async updateBookmark(id: string, patch: BookmarkPatch): Promise<Result<Bookmark>> {
    const { data, error } = await this.db
      .from("bookmarks")
      .update(patchToRow(patch))
      .eq("id", id)
      .select(BOOKMARK_COLUMNS)
      .maybeSingle()
    if (error) return failInternal(error)
    if (!data) return fail("NOT_FOUND", "That bookmark is gone.")
    return ok(rowToBookmark(data as Row))
  }

  async deleteBookmark(id: string): Promise<Result<void>> {
    const { data, error } = await this.db.from("bookmarks").delete().eq("id", id).select("id")
    if (error) return failInternal(error)
    if (!data?.length) return fail("NOT_FOUND", "That bookmark is gone.")
    return ok(undefined)
  }

  async updateBookmarks(ids: string[], patch: BookmarkPatch): Promise<Result<Bookmark[]>> {
    if (!ids.length) return ok([])
    const { data, error } = await this.db.from("bookmarks").update(patchToRow(patch)).in("id", ids).select(BOOKMARK_COLUMNS)
    if (error) return failInternal(error)
    return ok((data as Row[]).map(rowToBookmark))
  }

  async deleteBookmarks(ids: string[]): Promise<Result<{ deleted: number }>> {
    if (!ids.length) return ok({ deleted: 0 })
    const { data, error } = await this.db.from("bookmarks").delete().in("id", ids).select("id")
    if (error) return failInternal(error)
    return ok({ deleted: data?.length ?? 0 })
  }

  async importBookmarks(inputs: NewBookmark[]): Promise<Result<{ created: Bookmark[]; skipped: number }>> {
    const batch = new Map<string, Bookmark>()
    for (const input of inputs) {
      const b = materialize(input)
      if (!batch.has(b.urlNormalized)) batch.set(b.urlNormalized, b)
    }
    const rows = [...batch.values()].map((b) => bookmarkToRow(b, this.userId))
    // ignoreDuplicates lets the unique index skip what is already saved, in one round trip.
    const { data, error } = await this.db
      .from("bookmarks")
      .upsert(rows, { onConflict: "user_id,url_normalized", ignoreDuplicates: true })
      .select(BOOKMARK_COLUMNS)
    if (error) return failInternal(error)
    const created = (data as Row[]).map(rowToBookmark)
    return ok({ created, skipped: inputs.length - created.length })
  }

  async listCollections(): Promise<Collection[]> {
    const { data, error } = await this.db.from("collections").select(COLLECTION_COLUMNS).order("position")
    if (error) throw new Error(error.message)
    return (data as Row[]).map(rowToCollection)
  }

  async createCollection(name: string): Promise<Result<Collection>> {
    const clean = name.trim()
    if (!clean) return fail("VALIDATION", "Give the collection a name.")
    const { data: last } = await this.db.from("collections").select("position").order("position", { ascending: false }).limit(1).maybeSingle()
    const { data, error } = await this.db
      .from("collections")
      .insert({ user_id: this.userId, name: clean, position: ((last as Row | null)?.position as number | undefined ?? -1) + 1 })
      .select(COLLECTION_COLUMNS)
      .single()
    if (error?.code === UNIQUE_VIOLATION) return fail("DUPLICATE", `"${clean}" already exists.`)
    if (error) return failInternal(error)
    return ok(rowToCollection(data as Row))
  }

  async renameCollection(id: string, name: string): Promise<Result<Collection>> {
    const clean = name.trim()
    if (!clean) return fail("VALIDATION", "Give the collection a name.")
    const { data, error } = await this.db
      .from("collections")
      .update({ name: clean })
      .eq("id", id)
      .select(COLLECTION_COLUMNS)
      .maybeSingle()
    if (error?.code === UNIQUE_VIOLATION) return fail("DUPLICATE", `"${clean}" already exists.`)
    if (error) return failInternal(error)
    if (!data) return fail("NOT_FOUND", "That collection is gone.")
    return ok(rowToCollection(data as Row))
  }

  async deleteCollection(id: string): Promise<Result<void>> {
    const { data, error } = await this.db.from("collections").delete().eq("id", id).select("id")
    if (error) return failInternal(error)
    if (!data?.length) return fail("NOT_FOUND", "That collection is gone.")
    return ok(undefined)
  }

  async renameTag(from: string, to: string): Promise<Result<{ affected: number }>> {
    const { data, error } = await this.db.rpc("rename_tag", {
      from_tag: from.trim().toLowerCase(),
      to_tag: to.trim().toLowerCase(),
    })
    if (error) return failInternal(error)
    return ok({ affected: Number(data ?? 0) })
  }

  /** Ranked full-text search in Postgres (tsvector + trigram), see migration 0001. */
  async search(query: string, limit = 50): Promise<Bookmark[]> {
    const { data, error } = await this.db.rpc("search_bookmarks", { q: query, max_rows: limit })
    if (error) throw new Error(error.message)
    return (data as Row[]).map(rowToBookmark)
  }

  async clear(): Promise<Result<void>> {
    const b = await this.db.from("bookmarks").delete().eq("user_id", this.userId)
    const c = await this.db.from("collections").delete().eq("user_id", this.userId)
    const error = b.error ?? c.error
    return error ? failInternal(error) : ok(undefined)
  }
}
