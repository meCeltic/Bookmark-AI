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

describe("clientKey and limiterFor", () => {
  it("keys signed-in callers by user and anonymous ones by the platform ip headers", async () => {
    const { clientKey } = await import("./ratelimit")
    expect(clientKey(new Headers(), "u1")).toBe("user:u1")
    expect(clientKey(new Headers({ "x-real-ip": "9.9.9.9", "x-forwarded-for": "1.1.1.1, 2.2.2.2" }))).toBe("ip:9.9.9.9")
    // Without x-real-ip, the last hop is the one the nearest proxy appended.
    expect(clientKey(new Headers({ "x-forwarded-for": "1.1.1.1, 2.2.2.2" }))).toBe("ip:2.2.2.2")
    expect(clientKey(new Headers())).toBe("ip:unknown")
  })

  it("keeps one limiter per route and tier", async () => {
    const { limiterFor } = await import("./ratelimit")
    const a = limiterFor("t", { capacity: 1, windowMs: 1000 })
    const b = limiterFor("t", { capacity: 5, windowMs: 1000 })
    expect(a).not.toBe(b)
    expect(limiterFor("t", { capacity: 1, windowMs: 1000 })).toBe(a)
  })
})
