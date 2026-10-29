import { NextResponse } from "next/server"
import { z } from "zod"
import type { LinkHealth } from "@/lib/domain/bookmark"
import { errorResponse, readJsonBody } from "@/lib/http"
import { clientKey, limiterFor } from "@/lib/ratelimit"
import { getSessionUser } from "@/lib/supabase/server"
import { safeFetch } from "@/lib/url/ssrf-guard"
import { logger, requestId } from "@/lib/log"

export const runtime = "nodejs"

const bodySchema = z.object({ urls: z.array(z.url()).min(1).max(40) })
const CONCURRENCY = 6

/**
 * POST /api/health { urls } -> { results: { url, health, status }[] }
 * HEAD each link through the SSRF guard with bounded concurrency, falling back
 * to GET for servers that reject HEAD.
 */
export async function POST(request: Request) {
  const user = await getSessionUser()
  const limiter = limiterFor("health", { capacity: 10, windowMs: 60_000 })
  const verdict = limiter.take(clientKey(request.headers, user?.id))
  if (!verdict.allowed) {
    logger({ route: "health", requestId: requestId(request.headers) }).warn("rate limited", { retryAfter: verdict.retryAfterSeconds })
    return errorResponse(
      { code: "RATE_LIMITED", message: "Checked a lot of links recently. Try again in a minute." },
      { "Retry-After": String(verdict.retryAfterSeconds) },
    )
  }

  const body = bodySchema.safeParse(await readJsonBody(request))
  if (!body.success) return errorResponse({ code: "VALIDATION", message: "Expected a list of urls." })

  const results = await mapWithConcurrency(body.data.urls, CONCURRENCY, checkOne)
  return NextResponse.json({ results }, { headers: { "Cache-Control": "no-store" } })
}

async function checkOne(url: string): Promise<{ url: string; health: LinkHealth; status: number | null }> {
  let res = await safeFetch(url, { method: "HEAD", timeoutMs: 6000 })
  if (res.ok && (res.data.status === 405 || res.data.status === 403 || res.data.status === 501)) {
    res = await safeFetch(url, { method: "GET", timeoutMs: 6000, maxBytes: 16_384 })
  }
  if (!res.ok) return { url, health: "dead", status: null }
  const { status, redirected } = res.data
  if (status >= 400) return { url, health: "dead", status }
  return { url, health: redirected ? "redirected" : "ok", status }
}

async function mapWithConcurrency<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length)
  let next = 0
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const index = next++
      results[index] = await fn(items[index] as T)
    }
  })
  await Promise.all(workers)
  return results
}
