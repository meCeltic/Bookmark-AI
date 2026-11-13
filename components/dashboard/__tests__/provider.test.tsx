import { describe, expect, it } from "vitest"
import { pickWeighted } from "../provider"
import { createLandingQueue } from "@/lib/client/transition"

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

describe("createLandingQueue", () => {
  it("lands updates queued in the same frame together, in order, and resolves each", async () => {
    const land = createLandingQueue()
    const ran: string[] = []
    const a = land(() => ran.push("a"))
    const b = land(() => ran.push("b"))
    expect(ran).toEqual([])
    await Promise.all([a, b])
    expect(ran).toEqual(["a", "b"])
    await land(() => ran.push("c"))
    expect(ran).toEqual(["a", "b", "c"])
  })
})
