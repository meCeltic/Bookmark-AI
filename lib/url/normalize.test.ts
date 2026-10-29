import { describe, expect, it } from "vitest"
import { canonicalKey, domainOf, normalizeUrl } from "./normalize"

describe("normalizeUrl", () => {
  const cases: ReadonlyArray<[input: string, expected: string | null]> = [
    ["https://github.com/foo", "https://github.com/foo"],
    ["http://example.com", "http://example.com/"],
    ["github.com/foo", "https://github.com/foo"],
    ["  github.com/foo  ", "https://github.com/foo"],
    ["www.example.com/path?q=1", "https://www.example.com/path?q=1"],
    ["//cdn.example.com/x.js", "https://cdn.example.com/x.js"],
    ["HTTPS://EXAMPLE.COM/Path", "https://example.com/Path"],
    ["localhost:3000/dev", "https://localhost:3000/dev"],
    ["example.com:8080", "https://example.com:8080/"],
    ["münchen.de/straße", "https://xn--mnchen-3ya.de/stra%C3%9Fe"],
    ["https://[::1]:8080/x", "https://[::1]:8080/x"],
    ["", null],
    ["   ", null],
    ["hello world", null],
    ["hello", null],
    ["ftp://example.com/file", null],
    ["mailto:someone@example.com", null],
    ["javascript:alert(1)", null],
    ["file:///etc/passwd", null],
    ["data:text/html,hi", null],
    ["http://", null],
    ["https://.example.com", null],
  ]

  it.each(cases)("normalizeUrl(%j) -> %j", (input, expected) => {
    expect(normalizeUrl(input)).toBe(expected)
  })
})

describe("canonicalKey", () => {
  const cases: ReadonlyArray<[input: string, expected: string]> = [
    ["https://example.com", "https://example.com"],
    ["https://example.com/", "https://example.com"],
    ["https://www.example.com/", "https://example.com"],
    ["HTTPS://WWW.EXAMPLE.COM/Docs/", "https://example.com/Docs"],
    ["https://example.com:443/a", "https://example.com/a"],
    ["http://example.com:80/a", "https://example.com/a"],
    ["http://example.com/a", "https://example.com/a"],
    ["https://example.com:8443/a", "https://example.com:8443/a"],
    ["https://example.com/a#section", "https://example.com/a"],
    ["https://example.com/a/?utm_source=x&utm_medium=y", "https://example.com/a"],
    ["https://example.com/a?fbclid=123&gclid=4&mkt_tok=z", "https://example.com/a"],
    ["https://example.com/a?UTM_Campaign=spring&id=7", "https://example.com/a?id=7"],
    ["https://example.com/a?z=1&a=2&m=3", "https://example.com/a?a=2&m=3&z=1"],
    ["https://example.com/a?b=2&b=1", "https://example.com/a?b=1&b=2"],
    ["https://example.com/a?q=hello%20world", "https://example.com/a?q=hello+world"],
    ["https://example.com/a///", "https://example.com/a"],
    ["github.com/Foo/Bar", "https://github.com/Foo/Bar"],
    ["https://münchen.de/", "https://xn--mnchen-3ya.de"],
    ["not a url", "not a url"],
  ]

  it.each(cases)("canonicalKey(%j) -> %j", (input, expected) => {
    expect(canonicalKey(input)).toBe(expected)
  })

  it("is idempotent", () => {
    const inputs = cases.map(([input]) => input)
    for (const input of inputs) {
      const once = canonicalKey(input)
      expect(canonicalKey(once)).toBe(once)
    }
  })

  it("gives the same key to URLs that differ only in noise", () => {
    const variants = [
      "https://www.example.com/blog/post/",
      "https://example.com/blog/post",
      "https://EXAMPLE.com/blog/post?utm_source=newsletter&utm_campaign=x",
      "https://example.com/blog/post#comments",
      "https://example.com/blog/post/?fbclid=abc",
      "example.com/blog/post",
      "http://example.com/blog/post",
    ]
    const keys = new Set(variants.map(canonicalKey))
    expect(keys.size).toBe(1)
  })

  it("keeps the same key when only query order differs", () => {
    expect(canonicalKey("https://example.com/s?page=2&sort=new")).toBe(
      canonicalKey("https://example.com/s?sort=new&page=2"),
    )
  })

  it("gives different keys to different paths, path case, meaningful params and ports", () => {
    const base = canonicalKey("https://example.com/blog/post")
    expect(canonicalKey("https://example.com/blog/other")).not.toBe(base)
    expect(canonicalKey("https://example.com/Blog/Post")).not.toBe(base)
    expect(canonicalKey("https://example.com/blog/post?page=2")).not.toBe(base)
    expect(canonicalKey("https://example.com:8443/blog/post")).not.toBe(base)
  })
})

describe("domainOf", () => {
  const cases: ReadonlyArray<[input: string, expected: string]> = [
    ["https://www.github.com/foo", "github.com"],
    ["https://docs.example.com:8443/x", "docs.example.com"],
    ["github.com/foo", "github.com"],
    ["HTTPS://WWW.Example.COM", "example.com"],
    ["https://wwwexample.com", "wwwexample.com"],
    ["not a url", ""],
  ]

  it.each(cases)("domainOf(%j) -> %j", (input, expected) => {
    expect(domainOf(input)).toBe(expected)
  })
})
