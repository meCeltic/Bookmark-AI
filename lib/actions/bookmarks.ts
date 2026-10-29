"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import {
  bookmarkPatchSchema,
  newBookmarkSchema,
  tagSchema,
  type Bookmark,
  type BookmarkPatch,
  type Collection,
  type NewBookmark,
} from "@/lib/domain/bookmark"
import { fail, ok, type Result } from "@/lib/domain/result"
import { SupabaseRepository } from "@/lib/repo/supabase"
import { createSupabaseServerClient } from "@/lib/supabase/server"

/**
 * Server actions are thin: authenticate, validate, delegate to the repository,
 * revalidate. Every action returns a Result; nothing throws to the client.
 */

async function repoForCaller(): Promise<Result<SupabaseRepository>> {
  const supabase = await createSupabaseServerClient()
  if (!supabase) return fail("UNAUTHORIZED", "Cloud sync is not configured.")
  const { data, error } = await supabase.auth.getUser()
  if (error || !data.user) return fail("UNAUTHORIZED", "Sign in to continue.")
  return ok(new SupabaseRepository(supabase, data.user.id))
}

async function withRepo<T>(fn: (repo: SupabaseRepository) => Promise<Result<T>>): Promise<Result<T>> {
  const repo = await repoForCaller()
  if (!repo.ok) return repo
  try {
    const result = await fn(repo.data)
    if (result.ok) revalidatePath("/dashboard")
    return result
  } catch (error) {
    console.error("[action]", error)
    return fail("INTERNAL", "Something went wrong. Please try again.")
  }
}

const idSchema = z.string().uuid()

export async function createBookmarkAction(input: NewBookmark): Promise<Result<Bookmark>> {
  const parsed = newBookmarkSchema.safeParse(input)
  if (!parsed.success) return fail("VALIDATION", "That does not look like a web address.")
  return withRepo((repo) => repo.createBookmark(parsed.data))
}

export async function updateBookmarkAction(id: string, patch: BookmarkPatch): Promise<Result<Bookmark>> {
  const pid = idSchema.safeParse(id)
  const parsed = bookmarkPatchSchema.safeParse(patch)
  if (!pid.success || !parsed.success) return fail("VALIDATION", "Invalid change.")
  return withRepo((repo) => repo.updateBookmark(pid.data, parsed.data))
}

export async function deleteBookmarkAction(id: string): Promise<Result<void>> {
  const pid = idSchema.safeParse(id)
  if (!pid.success) return fail("VALIDATION", "Invalid id.")
  return withRepo((repo) => repo.deleteBookmark(pid.data))
}

export async function importBookmarksAction(
  inputs: NewBookmark[],
): Promise<Result<{ created: Bookmark[]; skipped: number }>> {
  const parsed = z.array(newBookmarkSchema).max(5000).safeParse(inputs)
  if (!parsed.success) return fail("VALIDATION", "The import file has invalid entries.")
  return withRepo((repo) => repo.importBookmarks(parsed.data))
}

export async function createCollectionAction(name: string): Promise<Result<Collection>> {
  return withRepo((repo) => repo.createCollection(String(name)))
}

export async function renameCollectionAction(id: string, name: string): Promise<Result<Collection>> {
  const pid = idSchema.safeParse(id)
  if (!pid.success) return fail("VALIDATION", "Invalid id.")
  return withRepo((repo) => repo.renameCollection(pid.data, String(name)))
}

export async function deleteCollectionAction(id: string): Promise<Result<void>> {
  const pid = idSchema.safeParse(id)
  if (!pid.success) return fail("VALIDATION", "Invalid id.")
  return withRepo((repo) => repo.deleteCollection(pid.data))
}

export async function renameTagAction(from: string, to: string): Promise<Result<{ affected: number }>> {
  const source = tagSchema.safeParse(from)
  const target = to.trim() === "" ? { success: true as const, data: "" } : tagSchema.safeParse(to)
  if (!source.success || !target.success) return fail("VALIDATION", "Tags are lowercase words, digits and - . + #")
  return withRepo((repo) => repo.renameTag(source.data, target.data))
}

export async function listBookmarksAction(): Promise<Result<Bookmark[]>> {
  const repo = await repoForCaller()
  if (!repo.ok) return repo
  try {
    return ok(await repo.data.listBookmarks())
  } catch {
    return fail("INTERNAL", "Could not load your bookmarks.")
  }
}

export async function listCollectionsAction(): Promise<Result<Collection[]>> {
  const repo = await repoForCaller()
  if (!repo.ok) return repo
  try {
    return ok(await repo.data.listCollections())
  } catch {
    return fail("INTERNAL", "Could not load your collections.")
  }
}

const idsSchema = z.array(idSchema).min(1).max(500)

export async function updateBookmarksAction(ids: string[], patch: BookmarkPatch): Promise<Result<Bookmark[]>> {
  const pids = idsSchema.safeParse(ids)
  const parsed = bookmarkPatchSchema.safeParse(patch)
  if (!pids.success || !parsed.success) return fail("VALIDATION", "Invalid change.")
  return withRepo((repo) => repo.updateBookmarks(pids.data, parsed.data))
}

export async function deleteBookmarksAction(ids: string[]): Promise<Result<{ deleted: number }>> {
  const pids = idsSchema.safeParse(ids)
  if (!pids.success) return fail("VALIDATION", "Invalid ids.")
  return withRepo((repo) => repo.deleteBookmarks(pids.data))
}

export async function clearAccountDataAction(): Promise<Result<void>> {
  return withRepo((repo) => repo.clear())
}
