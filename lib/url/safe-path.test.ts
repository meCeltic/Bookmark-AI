import { describe, expect, it } from "vitest"
import { safeNextPath } from "./safe-path"

describe("safeNextPath", () => {
  it("keeps same-origin paths with their query", () => {
    expect(safeNextPath("/settings")).toBe("/settings")
    expect(safeNextPath("/dashboard?view=archive")).toBe("/dashboard?view=archive")
  })
  it("falls back for anything that could leave the origin", () => {
    for (const bad of ["//evil.com", "/\\evil.com", "/\\\\evil.com", "https://evil.com", "evil.com", "javascript:alert(1)", "", null, undefined]) {
      expect(safeNextPath(bad)).toBe("/dashboard")
    }
  })
})
