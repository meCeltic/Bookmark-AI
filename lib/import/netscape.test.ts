import { describe, expect, it } from "vitest"
import { makeBookmark, makeCollection } from "@/lib/test/fixtures"
import { toExportJson } from "@/lib/export"
import { decodeEntities, dedupeImports, parseImportFile, parseNetscapeHtml } from "./netscape"

const CHROME = `<!DOCTYPE NETSCAPE-Bookmark-file-1>
<!-- This is an automatically generated file.
     It will be read and overwritten.
     DO NOT EDIT! -->
<META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">
<TITLE>Bookmarks</TITLE>
<H1>Bookmarks</H1>
<DL><p>
    <DT><H3 ADD_DATE="1700000000" LAST_MODIFIED="1700000100" PERSONAL_TOOLBAR_FOLDER="true">Bookmarks bar</H3>
    <DL><p>
        <DT><A HREF="https://react.dev/" ADD_DATE="1700000001" ICON="data:image/png;base64,AAAA">React</A>
        <DT><H3 ADD_DATE="1700000002" LAST_MODIFIED="1700000003">Dev</H3>
        <DL><p>
            <DT><A HREF="https://nextjs.org/docs" ADD_DATE="1700000004">Next.js Docs</A>
            <DT><H3 ADD_DATE="1700000005">Tools</H3>
            <DL><p>
                <DT><A HREF="https://vitest.dev/" ADD_DATE="1700000006">Vitest</A>
            </DL><p>
        </DL><p>
    </DL><p>
    <DT><A HREF="https://example.org/top" ADD_DATE="1700000007">Top level</A>
</DL><p>
`

const FIREFOX = `<!DOCTYPE NETSCAPE-Bookmark-file-1>
<!-- This is an automatically generated file.
     It will be read and overwritten.
     DO NOT EDIT! -->
<META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'none'; img-src data: *; object-src 'none'"></meta>
<TITLE>Bookmarks</TITLE>
<H1>Bookmarks Menu</H1>

<DL><p>
    <DT><A HREF="https://www.mozilla.org/en-US/firefox/central/" ADD_DATE="1690000000" LAST_MODIFIED="1690000001">Getting Started</A>
    <DT><H3 ADD_DATE="1690000002" LAST_MODIFIED="1690000003" PERSONAL_TOOLBAR_FOLDER="true">Bookmarks Toolbar</H3>
    <DD>Add bookmarks to this folder to see them displayed on the Bookmarks Toolbar
    <DL><p>
        <DT><A HREF="https://developer.mozilla.org/" ADD_DATE="1690000004" LAST_MODIFIED="1690000005" TAGS="docs,Web, reference">MDN Web Docs</A>
        <DT><H3 ADD_DATE="1690000006" LAST_MODIFIED="1690000007">Reading</H3>
        <DL><p>
            <DT><A HREF="https://example.com/long-read" ADD_DATE="1690000008" LAST_MODIFIED="1690000009" TAGS="longread">A long read</A>
        </DL><p>
    </DL><p>
    <DT><H3 ADD_DATE="1690000010" LAST_MODIFIED="1690000011" UNFILED_BOOKMARKS_FOLDER="true">Other Bookmarks</H3>
    <DL><p>
        <DT><A HREF="https://example.com/other" ADD_DATE="1690000012">Other thing</A>
        <DT><A HREF="place:sort=8&maxResults=10" ADD_DATE="1690000013">Recent tags</A>
    </DL><p>
</DL>
`

const SAFARI = `<!DOCTYPE NETSCAPE-Bookmark-file-1>
<HTML>
<META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">
<Title>Bookmarks</Title>
<H1>Bookmarks</H1>
<DT><H3 FOLDED>Favorites</H3>
<DL><p>
<DT><A HREF="https://www.apple.com/">Apple</A>
<DT><A HREF="https://www.icloud.com/">iCloud</A>
<DT><H3 FOLDED>Work</H3>
<DL><p>
<DT><A HREF="https://github.com/">GitHub</A>
</DL><p>
</DL><p>
<DT><H3 FOLDED>Bookmarks Menu</H3>
<DL><p>
<DT><A HREF="https://news.ycombinator.com/">Hacker News</A>
</DL><p>
</HTML>
`

const MESSY = `<!DOCTYPE NETSCAPE-Bookmark-file-1>
<DL><p>
    <DT><A HREF="javascript:void(0)" ADD_DATE="1">Bookmarklet</A>
    <DT><A HREF="file:///Users/me/notes.html">Local file</A>
    <DT><A HREF="" ADD_DATE="2">Empty href</A>
    <DT><A HREF="not a url">Garbage</A>
    <DT><A HREF="https://example.com/?a=1&amp;b=2" ADD_DATE="1700000000">Tom &amp; Jerry &lt;3 &quot;quotes&quot; &#39;apos&#39; &#8212; dash &#x2014;</A>
    <DT><A HREF='https://example.com/single-quoted' ADD_DATE=1700000001>Single   quoted
      title</A>
    <DT><A HREF="https://example.com/untitled"></A>
</DL><p>
`

describe("decodeEntities", () => {
  it("decodes named, decimal and hex entities and leaves unknown ones alone", () => {
    expect(decodeEntities("&amp;&lt;&gt;&quot;&#39;&#8212;&#x2014;&bogus;")).toBe("&<>\"'——&bogus;")
  })
})

describe("parseNetscapeHtml", () => {
  it("parses a Chrome export, dropping the Bookmarks bar container and nesting folders", () => {
    const items = parseNetscapeHtml(CHROME)
    expect(items.map((i) => [i.url, i.folder])).toEqual([
      ["https://react.dev/", []],
      ["https://nextjs.org/docs", ["Dev"]],
      ["https://vitest.dev/", ["Dev", "Tools"]],
      ["https://example.org/top", []],
    ])
    expect(items[0]?.title).toBe("React")
    expect(items[0]?.addedAt).toBe("2023-11-14T22:13:21.000Z")
    expect(items[0]?.tags).toEqual([])
  })

  it("parses a Firefox export with TAGS, <DD> descriptions and place: links", () => {
    const items = parseNetscapeHtml(FIREFOX)
    expect(items.map((i) => i.url)).toEqual([
      "https://www.mozilla.org/en-US/firefox/central/",
      "https://developer.mozilla.org/",
      "https://example.com/long-read",
      "https://example.com/other",
    ])
    const mdn = items[1]
    expect(mdn?.title).toBe("MDN Web Docs")
    expect(mdn?.folder).toEqual([])
    expect(mdn?.tags).toEqual(["docs", "web", "reference"])
    expect(items[2]?.folder).toEqual(["Reading"])
    expect(items[3]?.folder).toEqual([])
  })

  it("parses a Safari export where the top-level <DT><H3> sits outside any <DL>", () => {
    const items = parseNetscapeHtml(SAFARI)
    expect(items.map((i) => [i.title, i.folder, i.addedAt])).toEqual([
      ["Apple", ["Favorites"], null],
      ["iCloud", ["Favorites"], null],
      ["GitHub", ["Favorites", "Work"], null],
      ["Hacker News", [], null],
    ])
  })

  it("skips non-http(s) and empty hrefs, decodes entities and collapses whitespace", () => {
    const items = parseNetscapeHtml(MESSY)
    expect(items.map((i) => i.url)).toEqual([
      "https://example.com/?a=1&b=2",
      "https://example.com/single-quoted",
      "https://example.com/untitled",
    ])
    expect(items[0]?.title).toBe("Tom & Jerry <3 \"quotes\" 'apos' — dash —")
    expect(items[1]?.title).toBe("Single quoted title")
    expect(items[1]?.addedAt).toBe("2023-11-14T22:13:21.000Z")
    expect(items[2]?.title).toBe("https://example.com/untitled")
  })

  it("returns nothing for an empty or non-bookmark document", () => {
    expect(parseNetscapeHtml("")).toEqual([])
    expect(parseNetscapeHtml("<html><body><p>hello</p></body></html>")).toEqual([])
  })

  it("tolerates a truncated file with an unclosed anchor", () => {
    const items = parseNetscapeHtml('<DL><p><DT><A HREF="https://example.com/x">Cut off')
    expect(items).toEqual([
      { url: "https://example.com/x", title: "Cut off", folder: [], addedAt: null, tags: [] },
    ])
  })

  it("treats a container-named folder as real when nested", () => {
    const html = `<DL><p>
      <DT><H3>Projects</H3>
      <DL><p>
        <DT><H3>Other bookmarks</H3>
        <DL><p><DT><A HREF="https://example.com/n">Nested</A></DL><p>
      </DL><p>
    </DL><p>`
    expect(parseNetscapeHtml(html)[0]?.folder).toEqual(["Projects", "Other bookmarks"])
  })
})

describe("parseImportFile", () => {
  it("detects Netscape HTML by doctype", () => {
    const parsed = parseImportFile(CHROME)
    expect(parsed.kind).toBe("netscape")
    expect(parsed.items).toHaveLength(4)
  })

  it("detects Netscape HTML without a doctype by its <DT><A HREF> shape", () => {
    const parsed = parseImportFile('<DT><A HREF="https://example.com/">x</A>')
    expect(parsed.kind).toBe("netscape")
    expect(parsed.items).toHaveLength(1)
  })

  it("detects and maps our own JSON export", () => {
    const col = makeCollection({ id: "c1", name: "Work" })
    const inWork = makeBookmark({ collectionId: "c1", tags: ["ts", "node"], createdAt: "2026-02-03T04:05:06.000Z" })
    const loose = makeBookmark({ collectionId: null })
    const orphan = makeBookmark({ collectionId: "missing" })
    const parsed = parseImportFile(toExportJson([inWork, loose, orphan], [col]))
    expect(parsed.kind).toBe("bookmark-ai-json")
    expect(parsed.items).toEqual([
      { url: inWork.url, title: inWork.title, folder: ["Work"], addedAt: "2026-02-03T04:05:06.000Z", tags: ["ts", "node"] },
      { url: loose.url, title: loose.title, folder: [], addedAt: loose.createdAt, tags: [] },
      { url: orphan.url, title: orphan.title, folder: [], addedAt: orphan.createdAt, tags: [] },
    ])
  })

  it("reports unknown for JSON that is not an export and for plain text", () => {
    expect(parseImportFile('{"hello":"world"}')).toEqual({ kind: "unknown", items: [] })
    expect(parseImportFile("{not json")).toEqual({ kind: "unknown", items: [] })
    expect(parseImportFile("just some words")).toEqual({ kind: "unknown", items: [] })
    expect(parseImportFile("")).toEqual({ kind: "unknown", items: [] })
  })
})

describe("dedupeImports", () => {
  const item = (url: string) => ({ url, title: url, folder: [], addedAt: null, tags: [] })
  const keyOf = (url: string) => url.toLowerCase().replace(/\/$/, "")

  it("drops items already present and intra-file duplicates, keeping the first", () => {
    const items = [
      item("https://a.com/"),
      item("https://b.com/"),
      item("https://A.com"),
      item("https://c.com/"),
      item("https://c.com"),
    ]
    const { fresh, skipped } = dedupeImports(items, new Set([keyOf("https://b.com/")]), keyOf)
    expect(fresh.map((i) => i.url)).toEqual(["https://a.com/", "https://c.com/"])
    expect(skipped).toBe(3)
  })

  it("passes everything through when nothing collides", () => {
    const items = [item("https://a.com/"), item("https://b.com/")]
    expect(dedupeImports(items, new Set(), keyOf)).toEqual({ fresh: items, skipped: 0 })
  })
})
