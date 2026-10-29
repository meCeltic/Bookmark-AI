import { enrichmentSchema, type Enrichment } from "@/lib/domain/bookmark"
import { ok, type Result } from "@/lib/domain/result"
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

  // No model: the page's own description, or failing that its opening sentences.
  const summary = page.description ?? openingOf(page.text)
  return ok(
    enrichmentSchema.parse({
      ...base,
      summary,
      tags: [],
      category: null,
      source: summary ? "metadata" : "none",
    }),
  )
}

/** The first sentences of the readable text, cut at a sentence end where possible, max 280 chars. */
export function openingOf(text: string, max = 280): string | null {
  const clean = text.replace(/\s+/g, " ").trim()
  if (clean.length < 40) return null
  if (clean.length <= max) return clean
  const slice = clean.slice(0, max)
  const end = Math.max(slice.lastIndexOf(". "), slice.lastIndexOf("? "), slice.lastIndexOf("! "))
  return end >= 40 ? slice.slice(0, end + 1) : slice.slice(0, slice.lastIndexOf(" ")) + "…"
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

