import { enrichmentSchema, type Enrichment } from "@/lib/domain/bookmark"
import type { AppError } from "@/lib/domain/result"

/** Browser call to POST /api/enrich. Shared by the dashboard and the landing demo. */
export async function requestEnrichment(url: string, signal?: AbortSignal): Promise<
  { ok: true; data: Enrichment } | { ok: false; error: AppError }
> {
  try {
    const res = await fetch("/api/enrich", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url }),
      signal,
    })
    const json = (await res.json()) as unknown
    if (!res.ok) {
      const error = (json as { error?: AppError }).error
      return { ok: false, error: error ?? { code: "UPSTREAM", message: "Could not read the page." } }
    }
    const parsed = enrichmentSchema.safeParse(json)
    if (!parsed.success) return { ok: false, error: { code: "UPSTREAM", message: "Unexpected response." } }
    return { ok: true, data: parsed.data }
  } catch {
    return { ok: false, error: { code: "UPSTREAM", message: "Could not reach the server." } }
  }
}

export async function requestHealth(urls: string[]): Promise<Array<{ url: string; health: "ok" | "redirected" | "dead"; status: number | null }>> {
  const res = await fetch("/api/health", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ urls }),
  })
  if (!res.ok) throw new Error(res.status === 429 ? "Checked a lot of links recently. Try again in a minute." : "Health check failed.")
  const json = (await res.json()) as { results: Array<{ url: string; health: "ok" | "redirected" | "dead"; status: number | null }> }
  return json.results
}
