import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("node:dns/promises", () => ({
  default: { lookup: vi.fn() },
}))

import dns from "node:dns/promises"
import { assertPublicUrl, isPrivateAddress, safeFetch } from "./ssrf-guard"

const lookup = vi.mocked(dns.lookup)

type LookupResult = Array<{ address: string; family: 4 | 6 }>
function resolveTo(addresses: string[]): void {
  const result: LookupResult = addresses.map((address) => ({
    address,
    family: address.includes(":") ? 6 : 4,
  }))
  lookup.mockResolvedValue(result as never)
}

describe("isPrivateAddress", () => {
  const privateCases = [
    "127.0.0.1",
    "127.255.255.254",
    "0.0.0.0",
    "0.1.2.3",
    "10.0.0.1",
    "10.255.255.255",
    "172.16.0.1",
    "172.31.255.255",
    "192.168.1.1",
    "169.254.169.254",
    "100.64.0.1",
    "100.127.255.255",
    "192.0.0.1",
    "192.0.2.1",
    "198.18.0.1",
    "198.19.255.255",
    "198.51.100.7",
    "203.0.113.9",
    "224.0.0.1",
    "239.255.255.255",
    "240.0.0.1",
    "255.255.255.255",
    "::1",
    "::",
    "[::1]",
    "fc00::1",
    "fd12:3456::1",
    "fe80::1",
    "fe80::1%en0",
    "febf::1",
    "ff02::1",
    "::ffff:127.0.0.1",
    "::ffff:10.0.0.5",
    "::ffff:169.254.169.254",
    "::ffff:7f00:1",
    "::127.0.0.1",
    "64:ff9b::7f00:1",
    "64:ff9b::127.0.0.1",
    "64:ff9b::a00:1",
    "2001:db8::1",
    // Numeric spellings the URL parser and browsers accept
    "0x7f000001",
    "0x7f.0.0.1",
    "0177.0.0.1",
    "2130706433",
    "127.1",
    "0xa9fea9fe",
    // Not an address at all: conservative reject
    "localhost",
    "example.com",
    "",
    "999.1.1.1",
  ]

  it.each(privateCases)("treats %j as private", (ip) => {
    expect(isPrivateAddress(ip)).toBe(true)
  })

  const publicCases = [
    "8.8.8.8",
    "1.1.1.1",
    "93.184.216.34",
    "172.15.255.255",
    "172.32.0.1",
    "100.63.255.255",
    "100.128.0.1",
    "192.0.1.1",
    "198.17.255.255",
    "198.20.0.1",
    "223.255.255.255",
    "2606:4700:4700::1111",
    "2001:4860:4860::8888",
    "::ffff:8.8.8.8",
    "::ffff:808:808",
    "64:ff9b::8.8.8.8",
    "0x08080808",
  ]

  it.each(publicCases)("treats %j as public", (ip) => {
    expect(isPrivateAddress(ip)).toBe(false)
  })
})

describe("assertPublicUrl", () => {
  beforeEach(() => {
    lookup.mockReset()
  })

  it("rejects non-http schemes without touching DNS", async () => {
    for (const url of ["ftp://example.com/x", "file:///etc/passwd", "gopher://example.com"]) {
      const result = await assertPublicUrl(url)
      expect(result).toMatchObject({ ok: false, error: { code: "BLOCKED_URL" } })
    }
    expect(lookup).not.toHaveBeenCalled()
  })

  it("rejects unparseable input as VALIDATION", async () => {
    expect(await assertPublicUrl("not a url")).toMatchObject({ ok: false, error: { code: "VALIDATION" } })
  })

  it.each([
    "http://localhost/",
    "http://LOCALHOST:3000/",
    "http://foo.localhost/",
    "http://printer.local/",
    "http://db.internal/",
    "http://127.0.0.1/",
    "http://[::1]/",
    "http://[::ffff:10.0.0.1]/",
    "http://169.254.169.254/latest/meta-data/",
    "http://0x7f000001/",
    "http://2130706433/",
    "http://0177.0.0.1/",
    "http://10.0.0.1:8080/admin",
  ])("blocks %s before DNS", async (url) => {
    const result = await assertPublicUrl(url)
    expect(result).toMatchObject({ ok: false, error: { code: "BLOCKED_URL" } })
    expect(lookup).not.toHaveBeenCalled()
  })

  it("accepts a public IP literal without DNS", async () => {
    const result = await assertPublicUrl("https://93.184.216.34/")
    expect(result.ok).toBe(true)
    expect(lookup).not.toHaveBeenCalled()
  })

  it("accepts a host that resolves only to public addresses", async () => {
    resolveTo(["93.184.216.34", "2606:2800:220:1:248:1893:25c8:1946"])
    const result = await assertPublicUrl("https://example.com/page")
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.data.href).toBe("https://example.com/page")
    expect(lookup).toHaveBeenCalledWith("example.com", { all: true })
  })

  it("blocks a host that resolves to a private address", async () => {
    resolveTo(["10.1.2.3"])
    expect(await assertPublicUrl("https://internal.example.com/")).toMatchObject({
      ok: false,
      error: { code: "BLOCKED_URL" },
    })
  })

  it("blocks when ANY resolved address is private", async () => {
    resolveTo(["93.184.216.34", "127.0.0.1"])
    expect(await assertPublicUrl("https://mixed.example.com/")).toMatchObject({
      ok: false,
      error: { code: "BLOCKED_URL" },
    })
  })

  it("blocks when a resolved IPv6 address maps to a private IPv4", async () => {
    resolveTo(["::ffff:192.168.0.10"])
    expect(await assertPublicUrl("https://v6.example.com/")).toMatchObject({
      ok: false,
      error: { code: "BLOCKED_URL" },
    })
  })

  it("reports DNS failure as UPSTREAM", async () => {
    lookup.mockRejectedValue(new Error("ENOTFOUND"))
    expect(await assertPublicUrl("https://nope.example.com/")).toMatchObject({
      ok: false,
      error: { code: "UPSTREAM" },
    })
  })

  it("reports an empty DNS answer as UPSTREAM", async () => {
    resolveTo([])
    expect(await assertPublicUrl("https://empty.example.com/")).toMatchObject({
      ok: false,
      error: { code: "UPSTREAM" },
    })
  })

  it("strips a trailing dot from the hostname before lookup", async () => {
    resolveTo(["93.184.216.34"])
    await assertPublicUrl("https://example.com./")
    expect(lookup).toHaveBeenCalledWith("example.com", { all: true })
  })
})

describe("safeFetch", () => {
  const fetchMock = vi.fn<typeof fetch>()

  function htmlResponse(body: string, init: ResponseInit = {}): Response {
    return new Response(body, {
      status: 200,
      headers: { "content-type": "text/html; charset=utf-8" },
      ...init,
    })
  }

  function redirect(status: number, location: string): Response {
    return new Response(null, { status, headers: { location } })
  }

  function requestedUrls(): string[] {
    return fetchMock.mock.calls.map(([input]) => (input instanceof URL ? input.href : String(input)))
  }

  beforeEach(() => {
    lookup.mockReset()
    resolveTo(["93.184.216.34"])
    fetchMock.mockReset()
    vi.stubGlobal("fetch", fetchMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("returns the body, status and content type of a plain response", async () => {
    fetchMock.mockResolvedValueOnce(htmlResponse("<html>hi</html>"))
    const result = await safeFetch("https://example.com/a")
    expect(result).toEqual({
      ok: true,
      data: {
        finalUrl: "https://example.com/a",
        status: 200,
        contentType: "text/html; charset=utf-8",
        body: "<html>hi</html>",
        redirected: false,
      },
    })
  })

  it("sends browser-like headers and manual redirect handling", async () => {
    fetchMock.mockResolvedValueOnce(htmlResponse(""))
    await safeFetch("https://example.com/", { accept: "text/plain" })
    const init = fetchMock.mock.calls[0]?.[1]
    expect(init?.redirect).toBe("manual")
    expect(init?.method).toBe("GET")
    const headers = init?.headers as Record<string, string>
    expect(headers["User-Agent"]).toMatch(/Mozilla/)
    expect(headers.Accept).toBe("text/plain")
  })

  it("refuses a redirect from https down to http", async () => {
    fetchMock.mockResolvedValueOnce(redirect(301, "http://example.com/plain"))
    const result = await safeFetch("https://example.com/a")
    expect(result).toMatchObject({ ok: false, error: { code: "BLOCKED_URL" } })
    expect(requestedUrls()).toEqual(["https://example.com/a"])
  })

  it("follows two redirects, re-validating each hop", async () => {
    fetchMock
      .mockResolvedValueOnce(redirect(301, "https://example.com/b"))
      .mockResolvedValueOnce(redirect(302, "/c?x=1"))
      .mockResolvedValueOnce(htmlResponse("final"))
    const result = await safeFetch("https://example.com/a")
    expect(result).toMatchObject({
      ok: true,
      data: { finalUrl: "https://example.com/c?x=1", status: 200, body: "final", redirected: true },
    })
    expect(requestedUrls()).toEqual([
      "https://example.com/a",
      "https://example.com/b",
      "https://example.com/c?x=1",
    ])
    expect(lookup).toHaveBeenCalledTimes(3)
  })

  it("blocks a redirect to a private address", async () => {
    fetchMock.mockResolvedValueOnce(redirect(302, "http://169.254.169.254/latest/meta-data/"))
    const result = await safeFetch("https://example.com/a")
    expect(result).toMatchObject({ ok: false, error: { code: "BLOCKED_URL" } })
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it("blocks a redirect to a host that resolves privately", async () => {
    fetchMock.mockResolvedValueOnce(redirect(302, "https://evil.example.com/"))
    lookup.mockReset()
    resolveTo(["93.184.216.34"])
    lookup.mockResolvedValueOnce([{ address: "93.184.216.34", family: 4 }] as never)
    lookup.mockResolvedValueOnce([{ address: "10.0.0.1", family: 4 }] as never)
    const result = await safeFetch("https://example.com/a")
    expect(result).toMatchObject({ ok: false, error: { code: "BLOCKED_URL" } })
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it("gives up after three redirects", async () => {
    fetchMock.mockImplementation(async () => redirect(302, "https://example.com/loop"))
    const result = await safeFetch("https://example.com/a")
    expect(result).toMatchObject({ ok: false, error: { code: "UPSTREAM", message: "too many redirects" } })
    expect(fetchMock).toHaveBeenCalledTimes(4)
  })

  it("returns non-2xx responses to the caller", async () => {
    fetchMock.mockResolvedValueOnce(htmlResponse("gone", { status: 404 }))
    const result = await safeFetch("https://example.com/missing")
    expect(result).toMatchObject({ ok: true, data: { status: 404, body: "gone" } })
  })

  it("returns an empty body for HEAD", async () => {
    fetchMock.mockResolvedValueOnce(htmlResponse("should not be read"))
    const result = await safeFetch("https://example.com/", { method: "HEAD" })
    expect(result).toMatchObject({ ok: true, data: { body: "" } })
    expect(fetchMock.mock.calls[0]?.[1]?.method).toBe("HEAD")
  })

  it("caps the body at maxBytes and stops reading the stream", async () => {
    let pulls = 0
    const endless = new ReadableStream<Uint8Array>({
      pull(controller) {
        pulls++
        controller.enqueue(new TextEncoder().encode("x".repeat(100)))
      },
    })
    fetchMock.mockResolvedValueOnce(new Response(endless, { status: 200, headers: { "content-type": "text/html" } }))
    const result = await safeFetch("https://example.com/big", { maxBytes: 250 })
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.data.body).toBe("x".repeat(250))
    expect(pulls).toBeLessThan(10)
  })

  it("decodes using the charset in the content type", async () => {
    const latin1 = new Uint8Array([0x63, 0x61, 0x66, 0xe9]) // "café" in ISO-8859-1
    fetchMock.mockResolvedValueOnce(
      new Response(latin1, { status: 200, headers: { "content-type": "text/html; charset=iso-8859-1" } }),
    )
    const result = await safeFetch("https://example.com/")
    expect(result).toMatchObject({ ok: true, data: { body: "café" } })
  })

  it("times out with an UPSTREAM error", async () => {
    fetchMock.mockImplementation(
      (_input, init) =>
        new Promise<Response>((_, reject) => {
          init?.signal?.addEventListener("abort", () => reject(init.signal?.reason))
        }),
    )
    const result = await safeFetch("https://example.com/slow", { timeoutMs: 20 })
    expect(result).toEqual({ ok: false, error: { code: "UPSTREAM", message: "timed out" } })
  })

  it("maps network errors to UPSTREAM", async () => {
    fetchMock.mockRejectedValueOnce(new TypeError("fetch failed", { cause: new Error("ECONNREFUSED") }))
    const result = await safeFetch("https://example.com/")
    expect(result).toEqual({ ok: false, error: { code: "UPSTREAM", message: "ECONNREFUSED" } })
  })

  it("does not fetch at all when the initial URL is blocked", async () => {
    const result = await safeFetch("http://127.0.0.1:8080/")
    expect(result).toMatchObject({ ok: false, error: { code: "BLOCKED_URL" } })
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
