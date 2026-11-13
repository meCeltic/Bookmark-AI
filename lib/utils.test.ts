import { describe, expect, it } from "vitest"
import { formatDate } from "./utils"

describe("formatDate", () => {
  it("writes day and three-letter month, never Sept", () => {
    const year = new Date().getFullYear()
    expect(formatDate(new Date(year, 8, 14, 12).toISOString())).toBe("14 Sep")
    expect(formatDate(new Date(year, 10, 3, 12).toISOString())).toBe("3 Nov")
  })
  it("adds the year outside this year, or when asked", () => {
    expect(formatDate(new Date(2019, 8, 14, 12).toISOString())).toBe("14 Sep 2019")
    const year = new Date().getFullYear()
    expect(formatDate(new Date(year, 0, 2, 12).toISOString(), { year: "always" })).toBe(`2 Jan ${year}`)
  })
})
