import type { Bookmark, BookmarkPatch, Collection, NewBookmark } from "@/lib/domain/bookmark"
import type { Result } from "@/lib/domain/result"

/**
 * The only surface the UI talks to for persistence.
 *
 * Three implementations share this contract and one test suite:
 *   LocalRepository    browser, localStorage, used by demo mode
 *   SupabaseRepository server, Postgres with row-level security
 *   RemoteRepository   browser, forwards to server actions that wrap SupabaseRepository
 */
export interface BookmarkRepository {
  listBookmarks(): Promise<Bookmark[]>
  getBookmark(id: string): Promise<Bookmark | null>
  /** Fails with DUPLICATE (detail.existingId) when the canonical URL is already saved. */
  createBookmark(input: NewBookmark): Promise<Result<Bookmark>>
  updateBookmark(id: string, patch: BookmarkPatch): Promise<Result<Bookmark>>
  deleteBookmark(id: string): Promise<Result<void>>
  /** Bulk create that skips duplicates instead of failing. */
  importBookmarks(inputs: NewBookmark[]): Promise<Result<{ created: Bookmark[]; skipped: number }>>

  listCollections(): Promise<Collection[]>
  createCollection(name: string): Promise<Result<Collection>>
  renameCollection(id: string, name: string): Promise<Result<Collection>>
  /** Bookmarks inside become unsorted; nothing is deleted but the folder. */
  deleteCollection(id: string): Promise<Result<void>>

  /** Rename or merge a tag across every bookmark. Empty `to` removes it. */
  renameTag(from: string, to: string): Promise<Result<{ affected: number }>>

  /** Wipe everything owned by this user. */
  clear(): Promise<Result<void>>
}

export type RepositoryMode = "demo" | "cloud"
