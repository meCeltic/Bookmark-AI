/**
 * In-memory token bucket. Good enough for one Node process (Vercel keeps warm
 * instances per region); the upgrade path is Upstash Redis with the same shape.
 */
interface Bucket {
  tokens: number
  updatedAt: number
}

export interface RateLimitOptions {
  /** Max requests allowed in a full window. */
  capacity: number
  /** Window length in milliseconds. */
  windowMs: number
}

export interface RateLimitVerdict {
  allowed: boolean
  remaining: number
  retryAfterSeconds: number
}

export class RateLimiter {
  private buckets = new Map<string, Bucket>()

  constructor(
    private readonly options: RateLimitOptions,
    private readonly now: () => number = Date.now,
  ) {}

  take(key: string): RateLimitVerdict {
    const { capacity, windowMs } = this.options
    const refillPerMs = capacity / windowMs
    const t = this.now()
    const bucket = this.buckets.get(key) ?? { tokens: capacity, updatedAt: t }
    bucket.tokens = Math.min(capacity, bucket.tokens + (t - bucket.updatedAt) * refillPerMs)
    bucket.updatedAt = t

    if (bucket.tokens >= 1) {
      bucket.tokens -= 1
      this.buckets.set(key, bucket)
      return { allowed: true, remaining: Math.floor(bucket.tokens), retryAfterSeconds: 0 }
    }
    this.buckets.set(key, bucket)
    const retryAfterSeconds = Math.ceil((1 - bucket.tokens) / refillPerMs / 1000)
    return { allowed: false, remaining: 0, retryAfterSeconds }
  }

  /** Drop idle buckets so a long-lived process does not grow without bound. */
  sweep(idleMs = this.options.windowMs * 2): void {
    const cutoff = this.now() - idleMs
    for (const [key, bucket] of this.buckets) {
      if (bucket.updatedAt < cutoff) this.buckets.delete(key)
    }
  }
}

/** One shared limiter per route; module scope survives between requests on a warm instance. */
const registry = new Map<string, RateLimiter>()

export function limiterFor(name: string, options: RateLimitOptions): RateLimiter {
  let limiter = registry.get(name)
  if (!limiter) {
    limiter = new RateLimiter(options)
    registry.set(name, limiter)
  }
  if (Math.random() < 0.01) limiter.sweep()
  return limiter
}

export function clientKey(headers: Headers, userId?: string | null): string {
  if (userId) return `user:${userId}`
  const forwarded = headers.get("x-forwarded-for")?.split(",")[0]?.trim()
  return `ip:${forwarded || headers.get("x-real-ip") || "unknown"}`
}
