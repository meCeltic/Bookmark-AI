import {
  bookmarkSchema,
  collectionSchema,
  type Bookmark,
  type BookmarkPatch,
  type Collection,
  type NewBookmark,
} from "@/lib/domain/bookmark"
import { fail, ok, type Result } from "@/lib/domain/result"
import { z } from "zod"
import type { BookmarkRepository } from "./types"
import { applyPatch, materialize, newId, nowIso, uniqueTags } from "./shared"

/**
 * localStorage-backed repository. Powers demo mode, so a visitor can use the whole
 * app without an account, and doubles as the reference implementation for the
 * repository contract tests.
 */

export interface KeyValueStore {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
}

const storedSchema = z.object({
  version: z.literal(1),
  bookmarks: z.array(bookmarkSchema),
  collections: z.array(collectionSchema),
})
type Stored = z.infer<typeof storedSchema>

const EMPTY: Stored = { version: 1, bookmarks: [], collections: [] }

export class LocalRepository implements BookmarkRepository {
  constructor(
    private readonly store: KeyValueStore,
    private readonly key = "bookmark-ai:demo",
  ) {}

  // ---- storage -------------------------------------------------------------

  private read(): Stored {
    const raw = this.store.getItem(this.key)
    if (!raw) return structuredClone(EMPTY)
    try {
      return storedSchema.parse(JSON.parse(raw))
    } catch {
      // Corrupt or outdated data: start clean rather than crash the dashboard.
      return structuredClone(EMPTY)
    }
  }

  private write(data: Stored): void {
    this.store.setItem(this.key, JSON.stringify(data))
  }

  private mutate<T>(fn: (data: Stored) => T): T {
    const data = this.read()
    const out = fn(data)
    this.write(data)
    return out
  }

  // ---- bookmarks -----------------------------------------------------------

  async listBookmarks(): Promise<Bookmark[]> {
    return this.read().bookmarks
  }

  async getBookmark(id: string): Promise<Bookmark | null> {
    return this.read().bookmarks.find((b) => b.id === id) ?? null
  }

  async createBookmark(input: NewBookmark): Promise<Result<Bookmark>> {
    return this.mutate((data) => {
      const bookmark = materialize(input)
      const existing = data.bookmarks.find((b) => b.urlNormalized === bookmark.urlNormalized)
      if (existing) {
        return fail<Bookmark>("DUPLICATE", "You already saved this page.", {
          existingId: existing.id,
          savedAt: existing.createdAt,
        })
      }
      data.bookmarks.unshift(bookmark)
      return ok(bookmark)
    })
  }

  async updateBookmark(id: string, patch: BookmarkPatch): Promise<Result<Bookmark>> {
    return this.mutate((data) => {
      const index = data.bookmarks.findIndex((b) => b.id === id)
      const current = data.bookmarks[index]
      if (!current) return fail<Bookmark>("NOT_FOUND", "That bookmark is gone.")
      const next = applyPatch(current, patch)
      data.bookmarks[index] = next
      return ok(next)
    })
  }

  async deleteBookmark(id: string): Promise<Result<void>> {
    return this.mutate((data) => {
      const before = data.bookmarks.length
      data.bookmarks = data.bookmarks.filter((b) => b.id !== id)
      return before === data.bookmarks.length
        ? fail<void>("NOT_FOUND", "That bookmark is gone.")
        : ok(undefined)
    })
  }

  async importBookmarks(inputs: NewBookmark[]): Promise<Result<{ created: Bookmark[]; skipped: number }>> {
    return this.mutate((data) => {
      const keys = new Set(data.bookmarks.map((b) => b.urlNormalized))
      const created: Bookmark[] = []
      let skipped = 0
      for (const input of inputs) {
        const bookmark = materialize(input)
        if (keys.has(bookmark.urlNormalized)) {
          skipped += 1
          continue
        }
        keys.add(bookmark.urlNormalized)
        created.push(bookmark)
      }
      data.bookmarks.unshift(...created)
      return ok({ created, skipped })
    })
  }

  // ---- collections ---------------------------------------------------------

  async listCollections(): Promise<Collection[]> {
    return [...this.read().collections].sort((a, b) => a.position - b.position)
  }

  async createCollection(name: string): Promise<Result<Collection>> {
    return this.mutate((data) => {
      const clean = name.trim()
      if (!clean) return fail<Collection>("VALIDATION", "Give the collection a name.")
      if (data.collections.some((c) => c.name.toLowerCase() === clean.toLowerCase())) {
        return fail<Collection>("DUPLICATE", `"${clean}" already exists.`)
      }
      const collection = collectionSchema.parse({
        id: newId(),
        name: clean,
        position: data.collections.length,
        createdAt: nowIso(),
      })
      data.collections.push(collection)
      return ok(collection)
    })
  }

  async renameCollection(id: string, name: string): Promise<Result<Collection>> {
    return this.mutate((data) => {
      const collection = data.collections.find((c) => c.id === id)
      if (!collection) return fail<Collection>("NOT_FOUND", "That collection is gone.")
      const clean = name.trim()
      if (!clean) return fail<Collection>("VALIDATION", "Give the collection a name.")
      collection.name = clean
      return ok(collection)
    })
  }

  async deleteCollection(id: string): Promise<Result<void>> {
    return this.mutate((data) => {
      if (!data.collections.some((c) => c.id === id)) {
        return fail<void>("NOT_FOUND", "That collection is gone.")
      }
      data.collections = data.collections.filter((c) => c.id !== id)
      for (const b of data.bookmarks) {
        if (b.collectionId === id) b.collectionId = null
      }
      return ok(undefined)
    })
  }

  // ---- tags ----------------------------------------------------------------

  async renameTag(from: string, to: string): Promise<Result<{ affected: number }>> {
    return this.mutate((data) => {
      const source = from.trim().toLowerCase()
      const target = to.trim().toLowerCase()
      let affected = 0
      for (const b of data.bookmarks) {
        if (!b.tags.includes(source)) continue
        const next = b.tags.map((t) => (t === source ? target : t)).filter(Boolean)
        b.tags = uniqueTags(next)
        b.updatedAt = nowIso()
        affected += 1
      }
      return ok({ affected })
    })
  }

  async clear(): Promise<Result<void>> {
    this.store.removeItem(this.key)
    return ok(undefined)
  }
}

/** In-memory store for tests and server-side rendering fallbacks. */
export class MemoryStore implements KeyValueStore {
  private map = new Map<string, string>()
  getItem(key: string) {
    return this.map.get(key) ?? null
  }
  setItem(key: string, value: string) {
    this.map.set(key, value)
  }
  removeItem(key: string) {
    this.map.delete(key)
  }
}
