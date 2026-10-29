import { describe, expect, it } from "vitest"
import { readJsonBody } from "./http"

const request = (body: string, headers: Record<string, string> = {}) =>
  new Request("http://x/api", { method: "POST", body, headers: { "content-type": "application/json", ...headers } })

describe("readJsonBody", () => {
  it("parses a small body", async () => {
    expect(await readJsonBody(request('{"url":"https://a.com"}'))).toEqual({ url: "https://a.com" })
  })
  it("refuses a declared oversize, a streamed oversize and malformed json", async () => {
    expect(await readJsonBody(request("{}", { "content-length": String(10_000_000) }))).toBeNull()
    expect(await readJsonBody(request("x".repeat(70_000)))).toBeNull()
    expect(await readJsonBody(request("{not json"))).toBeNull()
  })
})
