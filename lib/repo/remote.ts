"use client"

import type { Bookmark, BookmarkPatch, Collection, NewBookmark } from "@/lib/domain/bookmark"
import type { Result } from "@/lib/domain/result"
import {
  clearAccountDataAction,
  createBookmarkAction,
  createCollectionAction,
  deleteBookmarkAction,
  deleteCollectionAction,
  importBookmarksAction,
  renameCollectionAction,
  renameTagAction,
  updateBookmarkAction,
} from "@/lib/actions/bookmarks"
import type { BookmarkRepository } from "./types"

/**
 * Browser-side repository for signed-in users. Each call is a server action
 * backed by SupabaseRepository, so the dashboard code is identical in demo and
 * cloud mode; only the repository instance differs.
 */
export class RemoteRepository implements BookmarkRepository {
  constructor(
    private readonly initial: { bookmarks: Bookmark[]; collections: Collection[] },
  ) {}

  async listBookmarks(): Promise<Bookmark[]> {
    return this.initial.bookmarks
  }
  async getBookmark(id: string): Promise<Bookmark | null> {
    return this.initial.bookmarks.find((b) => b.id === id) ?? null
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
    return this.initial.collections
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
