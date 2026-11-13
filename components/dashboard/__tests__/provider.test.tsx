import { describe, expect, it } from "vitest"
import { pickWeighted } from "../provider"

describe("pickWeighted", () => {
  const list = ["oldest", "middle", "newest"]
  it("covers the whole range and favours the oldest", () => {
    // Weights 3:2:1 over a total of 6.
    expect(pickWeighted(list, 0)).toBe("oldest")
    expect(pickWeighted(list, 0.49)).toBe("oldest")
    expect(pickWeighted(list, 0.51)).toBe("middle")
    expect(pickWeighted(list, 0.8)).toBe("middle")
    expect(pickWeighted(list, 0.9)).toBe("newest")
    expect(pickWeighted(list, 0.999999)).toBe("newest")
  })
  it("returns the only item of a single list", () => {
    expect(pickWeighted(["only"], 0.7)).toBe("only")
  })
})
