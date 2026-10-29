"use client"

import type { Bookmark, BookmarkPatch, Collection, NewBookmark } from "@/lib/domain/bookmark"
import type { Result } from "@/lib/domain/result"
import {
  clearAccountDataAction,
  createBookmarkAction,
  createCollectionAction,
  deleteBookmarkAction,
  deleteBookmarksAction,
  deleteCollectionAction,
  importBookmarksAction,
  listBookmarksAction,
  listCollectionsAction,
  renameCollectionAction,
  renameTagAction,
  updateBookmarkAction,
  updateBookmarksAction,
} from "@/lib/actions/bookmarks"
import type { BookmarkRepository } from "./types"

/**
 * Browser-side repository for signed-in users. Each call is a server action
 * backed by SupabaseRepository, so the dashboard code is identical in demo and
 * cloud mode; only the repository instance differs. The server component hands
 * over the first page load; every later read goes back to the server.
 */
export class RemoteRepository implements BookmarkRepository {
  private snapshot: { bookmarks: Bookmark[]; collections: Collection[] } | null

  constructor(initial: { bookmarks: Bookmark[]; collections: Collection[] }) {
    this.snapshot = initial
  }

  async listBookmarks(): Promise<Bookmark[]> {
    if (this.snapshot) return this.snapshot.bookmarks
    const r = await listBookmarksAction()
    return r.ok ? r.data : []
  }
  async getBookmark(id: string): Promise<Bookmark | null> {
    return (await this.listBookmarks()).find((b) => b.id === id) ?? null
  }
  updateBookmarks(ids: string[], patch: BookmarkPatch): Promise<Result<Bookmark[]>> {
    return updateBookmarksAction(ids, patch)
  }
  deleteBookmarks(ids: string[]): Promise<Result<{ deleted: number }>> {
    return deleteBookmarksAction(ids)
  }
  createBookmark(input: NewBookmark): Promise<Result<Bookmark>> {
    return createBookmarkAction(input)
  }
  updateBookmark(id: string, patch: BookmarkPatch): Promise<Result<Bookmark>> {
    return updateBookmarkAction(id, patch)
  }
  deleteBookmark(id: string): Promise<Result<void>> {
    return deleteBookmarkAction(id)
  }
  importBookmarks(inputs: NewBookmark[]): Promise<Result<{ created: Bookmark[]; skipped: number }>> {
    return importBookmarksAction(inputs)
  }
  async listCollections(): Promise<Collection[]> {
    if (this.snapshot) {
      const { collections } = this.snapshot
      this.snapshot = null // the initial load has been consumed; reads go live from here
      return collections
    }
    const r = await listCollectionsAction()
    return r.ok ? r.data : []
  }
  createCollection(name: string): Promise<Result<Collection>> {
    return createCollectionAction(name)
  }
  renameCollection(id: string, name: string): Promise<Result<Collection>> {
    return renameCollectionAction(id, name)
  }
  deleteCollection(id: string): Promise<Result<void>> {
    return deleteCollectionAction(id)
  }
  renameTag(from: string, to: string): Promise<Result<{ affected: number }>> {
    return renameTagAction(from, to)
  }
  clear(): Promise<Result<void>> {
    return clearAccountDataAction()
  }
}
