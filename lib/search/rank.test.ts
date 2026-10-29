import { describe, expect, it } from "vitest"
import { makeBookmark } from "@/lib/test/fixtures"
import { createSearchIndex, highlightRanges, searchBookmarks } from "./rank"

describe("searchBookmarks", () => {
  const titleHit = makeBookmark({ id: "title", title: "React hooks guide" })
  const summaryHit = makeBookmark({ id: "summary", title: "Vue basics", summary: "A guide to react hooks" })
  const tagged = makeBookmark({ id: "tagged", title: "Something else", tags: ["react"] })
  const fuzzyTitle = makeBookmark({ id: "fuzzy", title: "Reactive programming" })
  const unrelated = makeBookmark({ id: "unrelated", title: "Baking sourdough", summary: "flour and water" })
  const index = createSearchIndex([unrelated, summaryHit, fuzzyTitle, titleHit, tagged])

  it("returns nothing for an empty or whitespace query", () => {
    expect(searchBookmarks(index, "")).toEqual([])
    expect(searchBookmarks(index, "   ")).toEqual([])
  })

  it("ranks a title match above a summary match", () => {
    const hits = searchBookmarks(index, "react hooks guide").map((h) => h.bookmark.id)
    expect(hits.indexOf("title")).toBeLessThan(hits.indexOf("summary"))
  })

  it("ranks an exact tag match first, ahead of fuzzy title matches", () => {
    const hits = searchBookmarks(index, "React")
    expect(hits[0]?.bookmark.id).toBe("tagged")
    expect(hits[0]?.score).toBe(1)
    expect(hits[0]?.matches).toEqual([{ key: "tags", indices: [[0, 4]] }])
    expect(hits.map((h) => h.bookmark.id)).toContain("fuzzy")
    expect(hits.filter((h) => h.bookmark.id === "tagged")).toHaveLength(1)
  })

  it("survives a typo", () => {
    const hits = searchBookmarks(index, "recat").map((h) => h.bookmark.id)
    expect(hits).toContain("title")
    expect(hits).not.toContain("unrelated")
  })

  it("reports match indices with keys and respects the limit", () => {
    const [first] = searchBookmarks(index, "sourdough", 1)
    expect(first?.bookmark.id).toBe("unrelated")
    expect(first?.matches[0]?.key).toBe("title")
    expect(first?.matches[0]?.indices[0]).toEqual([7, 15])
    expect(searchBookmarks(index, "react", 2)).toHaveLength(2)
  })

  it("scores higher for better matches, within [0, 1]", () => {
    const hits = searchBookmarks(index, "sourdough")
    for (const h of hits) {
      expect(h.score).toBeGreaterThan(0)
      expect(h.score).toBeLessThanOrEqual(1)
    }
  })
})

describe("highlightRanges", () => {
  it("splits text into plain and hit segments", () => {
    expect(highlightRanges("React hooks guide", [[0, 4], [12, 16]])).toEqual([
      { text: "React", hit: true },
      { text: " hooks ", hit: false },
      { text: "guide", hit: true },
    ])
  })

  it("handles unsorted, overlapping and out-of-range indices", () => {
    expect(highlightRanges("abcdef", [[3, 9], [1, 2], [2, 3], [-2, 0]])).toEqual([
      { text: "abcdef", hit: true },
    ])
    expect(highlightRanges("abcdef", [[4, 4], [0, 1], [1, 1]])).toEqual([
      { text: "ab", hit: true },
      { text: "cd", hit: false },
      { text: "e", hit: true },
      { text: "f", hit: false },
    ])
  })

  it("returns the whole text as plain when there are no indices", () => {
    expect(highlightRanges("plain", [])).toEqual([{ text: "plain", hit: false }])
    expect(highlightRanges("", [])).toEqual([])
  })
})
