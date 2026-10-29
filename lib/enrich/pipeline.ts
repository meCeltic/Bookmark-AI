import { enrichmentSchema, type Enrichment } from "@/lib/domain/bookmark"
import { fail, ok, type Result } from "@/lib/domain/result"
import { safeFetch } from "@/lib/url/ssrf-guard"
import { extractPage, type ExtractedPage } from "./extract"
import { geminiConfigFromEnv, summarizeWithGemini, type AiOutput } from "./gemini"

/**
 * url -> guarded fetch -> extract -> (Gemini | metadata) -> validated Enrichment.
 *
 * Every stage degrades instead of failing: an unreachable page still yields a
 * card with the hostname as title; a missing or failing AI key yields the page's
 * own description, labelled as such.
 */

export interface PipelineDeps {
  fetchPage: (url: string) => ReturnType<typeof safeFetch>
  summarize: ((page: ExtractedPage, url: string) => Promise<AiOutput | null>) | null
}

export function defaultDeps(): PipelineDeps {
  const gemini = geminiConfigFromEnv()
  return {
    fetchPage: (url) => safeFetch(url, { method: "GET", accept: "text/html" }),
    summarize: gemini
      ? (page, url) =>
          summarizeWithGemini(
            { url, title: page.title, description: page.description, text: page.text },
            gemini,
          )
      : null,
  }
}

export async function enrichUrl(url: string, deps: PipelineDeps = defaultDeps()): Promise<Result<Enrichment>> {
  const fetched = await deps.fetchPage(url)
  if (!fetched.ok) {
    if (fetched.error.code === "BLOCKED_URL") return fetched
    return ok(unreachable(url))
  }
  const { body, contentType, finalUrl, status } = fetched.data
  if (status >= 400 || !contentType.includes("html")) return ok(unreachable(url, contentType))

  const page = extractPage(body, finalUrl)
  const base = {
    title: page.title,
    description: page.description,
    faviconUrl: page.faviconUrl,
    imageUrl: page.imageUrl,
    readingMinutes: page.readingMinutes,
  }

  if (deps.summarize && page.text.length >= 200) {
    try {
      const ai = await deps.summarize(page, finalUrl)
      if (ai) {
        return ok(enrichmentSchema.parse({ ...base, summary: ai.summary, tags: ai.tags, category: ai.category, source: "ai" }))
      }
    } catch {
      // Quota, network, or a refusal: fall through to metadata. The status tells the UI.
    }
  }

  return ok(
    enrichmentSchema.parse({
      ...base,
      summary: page.description,
      tags: [],
      category: null,
      source: page.description ? "metadata" : "none",
    }),
  )
}

function unreachable(url: string, contentType = ""): Enrichment {
  const host = safeHost(url)
  const kind = contentType.split(";")[0]?.trim()
  return {
    title: kind && !kind.includes("html") ? `${host} (${kind})` : host,
    description: null,
    summary: null,
    tags: [],
    category: null,
    faviconUrl: null,
    imageUrl: null,
    readingMinutes: null,
    source: "none",
  }
}

function safeHost(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "")
  } catch {
    return url
  }
}

export function pipelineFailure(message: string): Result<Enrichment> {
  return fail("UPSTREAM", message)
}
