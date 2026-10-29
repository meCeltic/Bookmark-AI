import { describe, expect, it, beforeEach } from "vitest"
import { LocalRepository, MemoryStore } from "./local"
import type { BookmarkRepository } from "./types"

/**
 * Contract every repository implementation must satisfy. It runs against
 * LocalRepository here. SupabaseRepository shares the same row mapping and is
 * checked by hand against the migration (see docs/PLAN.md); it has no mocked
 * test because a fake PostgREST client would only test the fake.
 */
export function repositoryContract(name: string, make: () => BookmarkRepository) {
  describe(`${name} contract`, () => {
    let repo: BookmarkRepository
    beforeEach(async () => {
      repo = make()
      await repo.clear()
    })

    it("creates a bookmark with derived fields", async () => {
      const r = await repo.createBookmark({ url: "https://Example.com/Path/?utm_source=x" })
      expect(r.ok).toBe(true)
      if (!r.ok) return
      expect(r.data.title).toBe("example.com")
      expect(r.data.urlNormalized).toBe("https://example.com/Path")
      expect(r.data.enrichment).toBe("pending")
      expect(await repo.listBookmarks()).toHaveLength(1)
    })

    it("rejects a duplicate by canonical url and points at the original", async () => {
      const first = await repo.createBookmark({ url: "https://github.com/vercel/next.js" })
      const dup = await repo.createBookmark({ url: "http://www.github.com/vercel/next.js/?utm_medium=mail#readme" })
      expect(dup.ok).toBe(false)
      if (dup.ok || !first.ok) return
      expect(dup.error.code).toBe("DUPLICATE")
      expect(dup.error.detail?.existingId).toBe(first.data.id)
    })

    it("patches, dedupes tags and bumps updatedAt", async () => {
      const r = await repo.createBookmark({ url: "https://a.com", tags: ["react"] })
      if (!r.ok) throw new Error("create failed")
      const u = await repo.updateBookmark(r.data.id, { tags: ["React", "react", " hooks "], favourite: true })
      expect(u.ok).toBe(true)
      if (!u.ok) return
      expect(u.data.tags).toEqual(["react", "hooks"])
      expect(u.data.favourite).toBe(true)
      expect(u.data.updatedAt >= r.data.updatedAt).toBe(true)
    })

    it("deletes and reports NOT_FOUND afterwards", async () => {
      const r = await repo.createBookmark({ url: "https://a.com" })
      if (!r.ok) throw new Error("create failed")
      expect((await repo.deleteBookmark(r.data.id)).ok).toBe(true)
      const again = await repo.deleteBookmark(r.data.id)
      expect(again.ok).toBe(false)
      if (!again.ok) expect(again.error.code).toBe("NOT_FOUND")
    })

    it("imports in bulk, skipping duplicates inside the batch and in storage", async () => {
      await repo.createBookmark({ url: "https://a.com" })
      const r = await repo.importBookmarks([
        { url: "https://a.com/" },
        { url: "https://b.com", title: "B" },
        { url: "https://B.com" },
      ])
      expect(r.ok).toBe(true)
      if (!r.ok) return
      expect(r.data.created.map((b) => b.title)).toEqual(["B"])
      expect(r.data.skipped).toBe(2)
    })

    it("updates and deletes many in one call", async () => {
      const a = await repo.createBookmark({ url: "https://a.com" })
      const b = await repo.createBookmark({ url: "https://b.com" })
      await repo.createBookmark({ url: "https://c.com" })
      if (!a.ok || !b.ok) throw new Error("create failed")
      const u = await repo.updateBookmarks([a.data.id, b.data.id], { favourite: true })
      expect(u.ok && u.data.map((x) => x.favourite)).toEqual([true, true])
      const d = await repo.deleteBookmarks([a.data.id, b.data.id, "missing"])
      expect(d.ok && d.data.deleted).toBe(2)
      expect(await repo.listBookmarks()).toHaveLength(1)
    })

    it("manages collections and unsorts bookmarks when one is deleted", async () => {
      const c = await repo.createCollection("  Reading  ")
      expect(c.ok).toBe(true)
      if (!c.ok) return
      expect(c.data.name).toBe("Reading")
      const dup = await repo.createCollection("reading")
      expect(dup.ok).toBe(false)
      const b = await repo.createBookmark({ url: "https://a.com", collectionId: c.data.id })
      if (!b.ok) throw new Error("create failed")
      const renamed = await repo.renameCollection(c.data.id, "Later")
      expect(renamed.ok && renamed.data.name).toBe("Later")
      expect((await repo.deleteCollection(c.data.id)).ok).toBe(true)
      expect((await repo.getBookmark(b.data.id))?.collectionId).toBeNull()
      expect(await repo.listCollections()).toHaveLength(0)
    })

    it("renames and merges tags across bookmarks", async () => {
      await repo.createBookmark({ url: "https://a.com", tags: ["js", "web"] })
      await repo.createBookmark({ url: "https://b.com", tags: ["javascript"] })
      await repo.createBookmark({ url: "https://c.com", tags: ["css"] })
      const r = await repo.renameTag("js", "javascript")
      expect(r.ok && r.data.affected).toBe(1)
      const all = await repo.listBookmarks()
      expect(all.find((b) => b.url === "https://a.com")?.tags).toEqual(["javascript", "web"])
      const removed = await repo.renameTag("css", "")
      expect(removed.ok && removed.data.affected).toBe(1)
      expect(all.length).toBe(3)
    })
  })
}

repositoryContract("LocalRepository", () => new LocalRepository(new MemoryStore()))

describe("LocalRepository resilience", () => {
  it("starts clean when storage holds garbage", async () => {
    const store = new MemoryStore()
    store.setItem("bookmark-ai:demo", "{not json")
    const repo = new LocalRepository(store)
    expect(await repo.listBookmarks()).toEqual([])
  })
})
