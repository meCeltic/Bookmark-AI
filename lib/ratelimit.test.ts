import { describe, expect, it } from "vitest"
import { RateLimiter } from "./ratelimit"

describe("RateLimiter", () => {
  it("allows capacity requests then blocks with a retry hint", () => {
    let t = 0
    const limiter = new RateLimiter({ capacity: 3, windowMs: 60_000 }, () => t)
    expect(limiter.take("a").allowed).toBe(true)
    expect(limiter.take("a").allowed).toBe(true)
    expect(limiter.take("a").allowed).toBe(true)
    const blocked = limiter.take("a")
    expect(blocked.allowed).toBe(false)
    expect(blocked.retryAfterSeconds).toBe(20)
    expect(limiter.take("b").allowed).toBe(true)
    t = 20_000
    expect(limiter.take("a").allowed).toBe(true)
  })

  it("sweeps idle buckets", () => {
    let t = 0
    const limiter = new RateLimiter({ capacity: 1, windowMs: 1000 }, () => t)
    limiter.take("a")
    t = 5000
    limiter.sweep()
    expect(limiter.take("a").allowed).toBe(true)
  })
})
