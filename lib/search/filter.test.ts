import { describe, expect, it } from "vitest"
import type { Bookmark, SortOrder, ViewSelection } from "@/lib/domain/bookmark"
import { makeBookmark } from "@/lib/test/fixtures"
import { applyFilter, collectionCounts, tagCounts, viewCounts, type BookmarkFilter } from "./filter"

const view = (v: ViewSelection["kind"] extends "view" ? never : never) => v
void view

const filterFor = (selection: ViewSelection, extra: Partial<BookmarkFilter> = {}): BookmarkFilter => ({
  view: selection,
  tags: [],
  health: null,
  sort: "newest",
  ...extra,
})

const ids = (list: Bookmark[]): string[] => list.map((b) => b.id)

const plain = makeBookmark({ id: "plain" })
const fav = makeBookmark({ id: "fav", favourite: true })
const read = makeBookmark({ id: "read", readAt: "2026-01-05T00:00:00.000Z" })
const inCol = makeBookmark({ id: "inCol", collectionId: "c1" })
const archived = makeBookmark({ id: "archived", favourite: true, archivedAt: "2026-01-06T00:00:00.000Z" })
const archivedInCol = makeBookmark({ id: "archivedInCol", collectionId: "c1", archivedAt: "2026-01-06T00:00:00.000Z" })
const all = [plain, fav, read, inCol, archived, archivedInCol]

describe("applyFilter views", () => {
  it("all = everything not archived", () => {
    expect(ids(applyFilter(all, filterFor({ kind: "view", view: "all" }))).sort()).toEqual(
      ["fav", "inCol", "plain", "read"],
    )
  })
  it("favourites = favourite and not archived", () => {
    expect(ids(applyFilter(all, filterFor({ kind: "view", view: "favourites" })))).toEqual(["fav"])
  })
  it("archive = archived only", () => {
    expect(ids(applyFilter(all, filterFor({ kind: "view", view: "archive" }))).sort()).toEqual(
      ["archived", "archivedInCol"],
    )
  })
  it("collection = that collection, not archived", () => {
    expect(ids(applyFilter(all, filterFor({ kind: "collection", id: "c1" })))).toEqual(["inCol"])
    expect(applyFilter(all, filterFor({ kind: "collection", id: "nope" }))).toEqual([])
  })
})

describe("applyFilter tags and health", () => {
  const a = makeBookmark({ id: "a", tags: ["react", "hooks"], health: "ok" })
  const b = makeBookmark({ id: "b", tags: ["react"], health: "dead" })
  const c = makeBookmark({ id: "c", tags: ["vue", "hooks"], health: "ok" })
  const list = [a, b, c]
  const allView: ViewSelection = { kind: "view", view: "all" }

  it("requires every selected tag", () => {
    expect(ids(applyFilter(list, filterFor(allView, { tags: ["react"] }))).sort()).toEqual(["a", "b"])
    expect(ids(applyFilter(list, filterFor(allView, { tags: ["react", "hooks"] })))).toEqual(["a"])
    expect(applyFilter(list, filterFor(allView, { tags: ["react", "vue"] }))).toEqual([])
  })

  it("filters by health when set", () => {
    expect(ids(applyFilter(list, filterFor(allView, { health: "dead" })))).toEqual(["b"])
    expect(applyFilter(list, filterFor(allView, { health: null }))).toHaveLength(3)
  })

  it("does not mutate its input", () => {
    const input = [c, a, b]
    applyFilter(input, filterFor(allView, { sort: "title" }))
    expect(ids(input)).toEqual(["c", "a", "b"])
  })
})

describe("applyFilter sort orders", () => {
  const allView: ViewSelection = { kind: "view", view: "all" }
  const sorted = (list: Bookmark[], sort: SortOrder) => ids(applyFilter(list, filterFor(allView, { sort })))

  it("newest and oldest by createdAt", () => {
    const old = makeBookmark({ id: "old", createdAt: "2025-01-01T00:00:00.000Z" })
    const mid = makeBookmark({ id: "mid", createdAt: "2025-06-01T00:00:00.000Z" })
    const recent = makeBookmark({ id: "recent", createdAt: "2026-01-01T00:00:00.000Z" })
    expect(sorted([mid, old, recent], "newest")).toEqual(["recent", "mid", "old"])
    expect(sorted([mid, old, recent], "oldest")).toEqual(["old", "mid", "recent"])
  })

  it("title is case-insensitive with untitled last", () => {
    const list = [
      makeBookmark({ id: "untitled", title: "  " }),
      makeBookmark({ id: "zed", title: "zed" }),
      makeBookmark({ id: "Alpha", title: "Alpha" }),
      makeBookmark({ id: "beta", title: "beta" }),
    ]
    expect(sorted(list, "title")).toEqual(["Alpha", "beta", "zed", "untitled"])
  })

  it("domain groups by hostname without www, then title", () => {
    const list = [
      makeBookmark({ id: "z-b", url: "https://www.zeta.com/1", title: "B" }),
      makeBookmark({ id: "a", url: "https://alpha.org/x", title: "X" }),
      makeBookmark({ id: "z-a", url: "https://zeta.com/2", title: "a" }),
    ]
    expect(sorted(list, "domain")).toEqual(["a", "z-a", "z-b"])
  })

  it("opened is most recent first with never-opened last", () => {
    const list = [
      makeBookmark({ id: "never" }),
      makeBookmark({ id: "early", lastOpenedAt: "2026-01-01T00:00:00.000Z" }),
      makeBookmark({ id: "late", lastOpenedAt: "2026-03-01T00:00:00.000Z" }),
      makeBookmark({ id: "never2" }),
    ]
    expect(sorted(list, "opened")).toEqual(["late", "early", "never", "never2"])
  })

  it("is stable for ties", () => {
    const list = ["x", "y", "z"].map((id) => makeBookmark({ id, title: "same", createdAt: "2026-01-01T00:00:00.000Z" }))
    expect(sorted(list, "title")).toEqual(["x", "y", "z"])
    expect(sorted(list, "newest")).toEqual(["x", "y", "z"])
  })
})

describe("counts", () => {
  const list = [
    makeBookmark({ tags: ["react", "hooks"], collectionId: "c1" }),
    makeBookmark({ tags: ["react"], collectionId: "c1", favourite: true }),
    makeBookmark({ tags: ["a11y"], collectionId: "c2", readAt: "2026-01-01T00:00:00.000Z" }),
    makeBookmark({ tags: ["react", "zzz"], collectionId: "c1", archivedAt: "2026-01-01T00:00:00.000Z" }),
  ]

  it("tagCounts sorts by count desc then name and ignores archived", () => {
    expect(tagCounts(list)).toEqual([
      { tag: "react", count: 2 },
      { tag: "a11y", count: 1 },
      { tag: "hooks", count: 1 },
    ])
  })

  it("collectionCounts ignores archived", () => {
    expect([...collectionCounts(list).entries()]).toEqual([
      ["c1", 2],
      ["c2", 1],
    ])
  })

  it("viewCounts applies the same view semantics", () => {
    expect(viewCounts(list)).toEqual({ all: 3, favourites: 1, archive: 1, unread: 2, dead: 0 })
  })
})
