import { NextResponse } from "next/server"
import { z } from "zod"
import { HTTP_STATUS } from "@/lib/domain/result"
import { enrichUrl } from "@/lib/enrich/pipeline"
import { clientKey, limiterFor } from "@/lib/ratelimit"
import { getSessionUser } from "@/lib/supabase/server"
import { normalizeUrl } from "@/lib/url/normalize"

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
  const limiter = limiterFor("enrich", user ? { capacity: 30, windowMs: 60_000 } : { capacity: 12, windowMs: 60_000 })
  const verdict = limiter.take(clientKey(request.headers, user?.id))
  if (!verdict.allowed) {
    return NextResponse.json(
      { error: { code: "RATE_LIMITED", message: "Too many pages at once. Try again shortly." } },
      { status: 429, headers: { "Retry-After": String(verdict.retryAfterSeconds) } },
    )
  }

  const body = bodySchema.safeParse(await request.json().catch(() => null))
  const url = body.success ? normalizeUrl(body.data.url) : null
  if (!url) {
    return NextResponse.json(
      { error: { code: "VALIDATION", message: "That does not look like a web address." } },
      { status: 400 },
    )
  }

  const result = await enrichUrl(url)
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: HTTP_STATUS[result.error.code] })
  }
  return NextResponse.json(result.data, { headers: { "Cache-Control": "no-store" } })
}
