import { NextResponse } from "next/server"
import { z } from "zod"
import { errorResponse, readJsonBody } from "@/lib/http"
import { enrichUrl } from "@/lib/enrich/pipeline"
import { clientKey, limiterFor } from "@/lib/ratelimit"
import { getSessionUser } from "@/lib/supabase/server"
import { normalizeUrl } from "@/lib/url/normalize"
import { logger, requestId } from "@/lib/log"

export const runtime = "nodejs"

const bodySchema = z.object({ url: z.string().min(1).max(2048) })

/**
 * POST /api/enrich { url } -> Enrichment
 * Callable by signed-in users and by demo visitors (rate-limited per IP).
 * The handler never writes; the client decides what to do with the result,
 * which keeps demo and cloud modes on the same path.
 */
export async function POST(request: Request) {
  const user = await getSessionUser()
  const log = logger({ route: "enrich", requestId: requestId(request.headers), user: user?.id ?? "anon" })
  const limiter = limiterFor("enrich", user ? { capacity: 30, windowMs: 60_000 } : { capacity: 12, windowMs: 60_000 })
  const verdict = limiter.take(clientKey(request.headers, user?.id))
  if (!verdict.allowed) {
    log.warn("rate limited", { retryAfter: verdict.retryAfterSeconds })
    return errorResponse(
      { code: "RATE_LIMITED", message: "Too many pages at once. Try again shortly." },
      { "Retry-After": String(verdict.retryAfterSeconds) },
    )
  }

  const body = bodySchema.safeParse(await readJsonBody(request))
  const url = body.success ? normalizeUrl(body.data.url) : null
  if (!url) return errorResponse({ code: "VALIDATION", message: "That does not look like a web address." })

  const result = await enrichUrl(url)
  if (!result.ok) {
    log.warn("enrich refused", { code: result.error.code, host: new URL(url).hostname })
    return errorResponse(result.error)
  }
  log.info("enriched", { host: new URL(url).hostname, source: result.data.source })
  return NextResponse.json(result.data, { headers: { "Cache-Control": "no-store" } })
}
