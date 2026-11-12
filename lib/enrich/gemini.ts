import { GoogleGenAI, Type } from "@google/genai"
import { z } from "zod"
import { CATEGORIES, TAG_MAX, tagSchema } from "@/lib/domain/bookmark"

/**
 * Ask Gemini for a summary, tags and a category as structured JSON, then
 * validate it with Zod. The model's output is treated like any other untrusted
 * input: if it does not match the schema the caller falls back to metadata.
 */

export const aiOutputSchema = z.object({
  summary: z.string().trim().min(20).max(600),
  tags: z.array(tagSchema).min(1).max(TAG_MAX),
  category: z.enum(CATEGORIES),
})
export type AiOutput = z.infer<typeof aiOutputSchema>

export interface AiInput {
  url: string
  title: string
  description: string | null
  text: string
}

export interface GeminiConfig {
  apiKey: string
  /** Tried in order; the next one is used on a 404, 429, 503 or timeout. */
  models: string[]
  timeoutMs: number
}

/** Lite first: a bookmark summary does not need the big model, and lite answers in about a second. */
export const DEFAULT_MODELS = ["gemini-3.5-flash-lite", "gemini-3.5-flash", "gemini-3.8-flash"]

export function geminiConfigFromEnv(): GeminiConfig | null {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) return null
  const fromEnv = (process.env.GEMINI_MODEL ?? "").split(",").map((m) => m.trim()).filter(Boolean)
  const models = [...new Set([...fromEnv, ...DEFAULT_MODELS])]
  return { apiKey, models, timeoutMs: 15_000 }
}

const RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    summary: { type: Type.STRING, description: "Two or three plain sentences, max 280 characters." },
    tags: { type: Type.ARRAY, items: { type: Type.STRING }, description: "3 to 5 lowercase topic tags." },
    category: { type: Type.STRING, enum: [...CATEGORIES] },
  },
  required: ["summary", "tags", "category"],
} as const

export function buildPrompt(input: AiInput): string {
  const body = input.text.slice(0, 6000)
  return [
    "You write index cards for a personal bookmark library.",
    "Given a web page, return JSON with:",
    "- summary: what the page is and why someone would come back to it, 2-3 plain sentences, at most 280 characters, no marketing tone, no 'this page'.",
    "- tags: 3 to 5 short lowercase topic tags (single words or hyphenated), specific over generic.",
    `- category: one of ${CATEGORIES.join(", ")}.`,
    "",
    `URL: ${input.url}`,
    `Title: ${input.title}`,
    input.description ? `Meta description: ${input.description}` : "",
    "",
    "Page text:",
    body,
  ]
    .filter((line) => line !== "")
    .join("\n")
}

/** Errors worth trying the next model for: missing model, quota, overload, timeout. */
export function isRetryable(error: unknown): boolean {
  const text = error instanceof Error ? `${error.name} ${error.message}` : String(error)
  return /\b(404|429|503)\b|NOT_FOUND|RESOURCE_EXHAUSTED|UNAVAILABLE|high demand|AbortError|aborted|timeout/i.test(text)
}

export async function summarizeWithGemini(
  input: AiInput,
  config: GeminiConfig,
  client: GoogleGenAI = new GoogleGenAI({ apiKey: config.apiKey }),
): Promise<AiOutput | null> {
  const prompt = buildPrompt(input)
  let lastError: unknown = null
  // Each model gets two tries: an overloaded model often answers a second later.
  const attempts = config.models.flatMap((model) => [model, model])
  for (const [i, model] of attempts.entries()) {
    if (i % 2 === 1) await new Promise((r) => setTimeout(r, 1200))
    try {
      const response = await client.models.generateContent({
        model,
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: RESPONSE_SCHEMA,
          temperature: 0.2,
          maxOutputTokens: 1024,
          abortSignal: AbortSignal.timeout(config.timeoutMs),
        },
      })
      return parseAiOutput(response.text)
    } catch (error) {
      lastError = error
      if (!isRetryable(error)) throw error
    }
  }
  throw lastError ?? new Error("no model answered")
}

/** Exported for tests: malformed or off-schema output becomes null, never a throw. */
export function parseAiOutput(text: string | undefined): AiOutput | null {
  if (!text) return null
  try {
    const parsed = aiOutputSchema.safeParse(JSON.parse(text))
    if (!parsed.success) return null
    return {
      ...parsed.data,
      summary: parsed.data.summary.slice(0, 600),
      tags: [...new Set(parsed.data.tags)].slice(0, 5),
    }
  } catch {
    return null
  }
}
