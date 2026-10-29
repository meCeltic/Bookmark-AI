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
  model: string
}

export function geminiConfigFromEnv(): GeminiConfig | null {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) return null
  return { apiKey, model: process.env.GEMINI_MODEL || "gemini-2.5-flash" }
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

export async function summarizeWithGemini(
  input: AiInput,
  config: GeminiConfig,
  client: GoogleGenAI = new GoogleGenAI({ apiKey: config.apiKey }),
): Promise<AiOutput | null> {
  const response = await client.models.generateContent({
    model: config.model,
    contents: buildPrompt(input),
    config: {
      responseMimeType: "application/json",
      responseSchema: RESPONSE_SCHEMA,
      temperature: 0.2,
      maxOutputTokens: 400,
    },
  })
  return parseAiOutput(response.text)
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
