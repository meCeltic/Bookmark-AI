import { describe, expect, it } from "vitest"
import { makeBookmark, makeCollection } from "@/lib/test/fixtures"
import { parseNetscapeHtml } from "@/lib/import/netscape"
import { EXPORT_VERSION, exportFileSchema, exportFilename, toExportJson, toNetscapeHtml } from "./index"

const NOW = new Date("2026-10-29T12:00:00.000Z")

describe("toExportJson", () => {
  it("round-trips through exportFileSchema", () => {
    const collections = [makeCollection({ position: 2 }), makeCollection({ position: 1 })]
    const bookmarks = [
      makeBookmark({ collectionId: collections[0]?.id ?? null, tags: ["a", "b"], summary: "s" }),
      makeBookmark({ archivedAt: "2026-01-02T00:00:00.000Z" }),
    ]
    const parsed = exportFileSchema.parse(JSON.parse(toExportJson(bookmarks, collections, NOW)))
    expect(parsed.app).toBe("bookmark-ai")
    expect(parsed.version).toBe(EXPORT_VERSION)
    expect(parsed.exportedAt).toBe(NOW.toISOString())
    expect(parsed.bookmarks).toEqual(bookmarks)
    expect(parsed.collections).toEqual([collections[1], collections[0]])
  })

  it("is deterministic regardless of input key order", () => {
    const b = makeBookmark()
    const shuffled = Object.fromEntries(Object.entries(b).reverse()) as typeof b
    expect(toExportJson([shuffled], [], NOW)).toBe(toExportJson([b], [], NOW))
    expect(toExportJson([b], [], NOW).startsWith('{\n  "app": "bookmark-ai",\n  "version": 1,')).toBe(true)
  })
})

describe("toNetscapeHtml", () => {
  it("starts with the Netscape doctype and escapes titles and urls", () => {
    const b = makeBookmark({
      url: "https://example.com/?a=1&b=2",
      title: 'Tom & Jerry <3 "quotes"',
      createdAt: "2023-11-14T22:13:21.000Z",
      tags: ["cats", "c++"],
    })
    const html = toNetscapeHtml([b], [], NOW)
    expect(html.startsWith("<!DOCTYPE NETSCAPE-Bookmark-file-1>\n")).toBe(true)
    expect(html).toContain(
      '<DT><A HREF="https://example.com/?a=1&amp;b=2" ADD_DATE="1700000001" TAGS="cats,c++">Tom &amp; Jerry &lt;3 &quot;quotes&quot;</A>',
    )
    expect(html).not.toContain("ICON=")
  })

  it("omits TAGS when empty and falls back to the url for untitled bookmarks", () => {
    const html = toNetscapeHtml([makeBookmark({ url: "https://x.io/p", title: "" })], [], NOW)
    expect(html).not.toContain("TAGS=")
    expect(html).toContain(">https://x.io/p</A>")
  })

  it("groups bookmarks under one H3 per collection, unsorted first, in position order", () => {
    const later = makeCollection({ id: "later", name: "Later", position: 5 })
    const first = makeCollection({ id: "first", name: "First & Co", position: 1 })
    const html = toNetscapeHtml(
      [
        makeBookmark({ title: "In later", collectionId: "later" }),
        makeBookmark({ title: "Loose" }),
        makeBookmark({ title: "In first", collectionId: "first" }),
        makeBookmark({ title: "Orphan", collectionId: "gone" }),
      ],
      [later, first],
      NOW,
    )
    const order = ["Loose", "Orphan", "First &amp; Co", "In first", "Later", "In later"].map((s) =>
      html.indexOf(s),
    )
    expect(order.every((i) => i >= 0)).toBe(true)
    expect([...order].sort((a, b) => a - b)).toEqual(order)
    expect(html.match(/<H3 /g)).toHaveLength(2)
  })

  it("can be read back by parseNetscapeHtml", () => {
    const col = makeCollection({ id: "c", name: "Dev <tools>" })
    const a = makeBookmark({ title: "A & B", tags: ["x", "y"], createdAt: "2024-01-01T00:00:00.000Z" })
    const b = makeBookmark({ title: "Inside", collectionId: "c", url: "https://example.com/?q=1&r=2" })
    const items = parseNetscapeHtml(toNetscapeHtml([a, b], [col], NOW))
    expect(items).toEqual([
      { url: a.url, title: "A & B", folder: [], addedAt: "2024-01-01T00:00:00.000Z", tags: ["x", "y"] },
      { url: b.url, title: "Inside", folder: ["Dev <tools>"], addedAt: b.createdAt, tags: [] },
    ])
  })
})

describe("exportFilename", () => {
  it("uses the UTC date and the requested extension", () => {
    expect(exportFilename("json", NOW)).toBe("bookmark-ai-2026-10-29.json")
    expect(exportFilename("html", NOW)).toBe("bookmark-ai-2026-10-29.html")
  })
})
