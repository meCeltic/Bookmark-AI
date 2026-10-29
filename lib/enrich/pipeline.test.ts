import { describe, expect, it } from "vitest"
import { ok, fail } from "@/lib/domain/result"
import { enrichUrl, openingOf, type PipelineDeps } from "./pipeline"

const html = (body: string, head = "") => `<html><head><title>Page title</title>${head}</head><body><main>${body}</main></body></html>`
const page = (body: string, head = "", contentType = "text/html") =>
  ok({ finalUrl: "https://example.com/post", status: 200, contentType, body: html(body, head), redirected: false })

describe("openingOf", () => {
  it("cuts at a sentence end and ignores stubs", () => {
    expect(openingOf("Too short.")).toBeNull()
    const long = "First sentence is here. Second sentence follows it. " + "x".repeat(300)
    expect(openingOf(long)).toBe("First sentence is here. Second sentence follows it.")
  })
})

describe("enrichUrl", () => {
  const paragraph = "Row level security lets Postgres decide which rows a user may see. ".repeat(6)

  it("uses the model when present and reports source ai", async () => {
    const deps: PipelineDeps = {
      fetchPage: async () => page(`<p>${paragraph}</p>`, '<meta name="description" content="A guide to RLS.">'),
      summarize: async () => ({ summary: "Postgres row level security explained, policy by policy.", tags: ["postgres", "security"], category: "documentation" }),
    }
    const r = await enrichUrl("https://example.com/post", deps)
    expect(r.ok && r.data.source).toBe("ai")
    expect(r.ok && r.data.tags).toEqual(["postgres", "security"])
    expect(r.ok && r.data.title).toBe("Page title")
  })

  it("falls back to the meta description, then to the opening text, when there is no model", async () => {
    const withMeta = await enrichUrl("https://example.com/post", {
      fetchPage: async () => page(`<p>${paragraph}</p>`, '<meta name="description" content="A guide to RLS.">'),
      summarize: null,
    })
    expect(withMeta.ok && withMeta.data.summary).toBe("A guide to RLS.")
    expect(withMeta.ok && withMeta.data.source).toBe("metadata")

    const noMeta = await enrichUrl("https://example.com/post", { fetchPage: async () => page(`<p>${paragraph}</p>`), summarize: null })
    expect(noMeta.ok && noMeta.data.summary?.startsWith("Row level security lets Postgres")).toBe(true)
    expect(noMeta.ok && noMeta.data.source).toBe("metadata")
  })

  it("keeps the link with the hostname as title when the page cannot be read", async () => {
    const r = await enrichUrl("https://example.com/post", {
      fetchPage: async () => ok({ finalUrl: "https://example.com/post", status: 404, contentType: "text/html", body: "", redirected: false }),
      summarize: null,
    })
    expect(r.ok && r.data).toMatchObject({ title: "example.com", summary: null, source: "none" })
    const pdf = await enrichUrl("https://example.com/a.pdf", { fetchPage: async () => page("", "", "application/pdf"), summarize: null })
    expect(pdf.ok && pdf.data.title).toBe("example.com (application/pdf)")
  })

  it("treats a model failure as a fallback, and a blocked url as an error", async () => {
    const r = await enrichUrl("https://example.com/post", {
      fetchPage: async () => page(`<p>${paragraph}</p>`),
      summarize: async () => { throw new Error("quota") },
    })
    expect(r.ok && r.data.source).toBe("metadata")
    const blocked = await enrichUrl("http://169.254.169.254/", { fetchPage: async () => fail("BLOCKED_URL", "no"), summarize: null })
    expect(blocked.ok).toBe(false)
  })
})
