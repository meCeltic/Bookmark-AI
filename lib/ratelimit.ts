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
      return { allowed: true, retryAfterSeconds: 0 }
    }
    this.buckets.set(key, bucket)
    const retryAfterSeconds = Math.ceil((1 - bucket.tokens) / refillPerMs / 1000)
    return { allowed: false, retryAfterSeconds }
  }

  /** Drop idle buckets so a long-lived process does not grow without bound. */
  sweep(idleMs = this.options.windowMs * 2): void {
    const cutoff = this.now() - idleMs
    for (const [key, bucket] of this.buckets) {
      if (bucket.updatedAt < cutoff) this.buckets.delete(key)
    }
  }
}

/** One limiter per route and tier; module scope survives between requests on a warm instance. */
const registry = new Map<string, RateLimiter>()

export function limiterFor(name: string, options: RateLimitOptions): RateLimiter {
  const key = `${name}:${options.capacity}/${options.windowMs}`
  let limiter = registry.get(key)
  if (!limiter) {
    limiter = new RateLimiter(options)
    registry.set(key, limiter)
  }
  if (Math.random() < 0.01) limiter.sweep()
  return limiter
}

/**
 * Signed-in callers are keyed by user id. Anonymous callers are keyed by the
 * client IP as the platform reports it: Vercel sets x-real-ip and rewrites
 * x-forwarded-for, so neither can be spoofed there. Self-hosted behind nothing,
 * x-forwarded-for is client-controlled, so the last hop (the one the nearest
 * proxy appended) is used and absent headers share one bucket.
 */
export function clientKey(headers: Headers, userId?: string | null): string {
  if (userId) return `user:${userId}`
  const real = headers.get("x-real-ip")?.trim()
  const forwarded = headers.get("x-forwarded-for")?.split(",").map((s) => s.trim()).filter(Boolean)
  const ip = real || forwarded?.at(-1) || "unknown"
  return `ip:${ip}`
}
