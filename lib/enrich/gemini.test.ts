import { describe, expect, it } from "vitest"
import { buildPrompt, parseAiOutput } from "./gemini"

describe("parseAiOutput", () => {
  it("accepts a well-formed response and dedupes tags", () => {
    const out = parseAiOutput(
      JSON.stringify({
        summary: "A guide to Postgres row-level security and the policies that enforce it.",
        tags: ["Postgres", "security", "postgres", "rls"],
        category: "documentation",
      }),
    )
    expect(out?.tags).toEqual(["postgres", "security", "rls"])
    expect(out?.category).toBe("documentation")
  })

  it("returns null for malformed JSON, missing fields, bad enum or bad tags", () => {
    expect(parseAiOutput("not json")).toBeNull()
    expect(parseAiOutput(undefined)).toBeNull()
    expect(parseAiOutput(JSON.stringify({ summary: "x" }))).toBeNull()
    expect(
      parseAiOutput(JSON.stringify({ summary: "long enough summary text here", tags: ["a"], category: "meme" })),
    ).toBeNull()
    expect(
      parseAiOutput(JSON.stringify({ summary: "long enough summary text here", tags: ["<script>"], category: "tool" })),
    ).toBeNull()
  })

  it("knows which model errors are worth a fallback", async () => {
    const { isRetryable } = await import("./gemini")
    expect(isRetryable(new Error('{"error":{"code":503,"status":"UNAVAILABLE"}}'))).toBe(true)
    expect(isRetryable(new Error('{"error":{"code":404,"status":"NOT_FOUND"}}'))).toBe(true)
    expect(isRetryable(Object.assign(new Error("This operation was aborted"), { name: "AbortError" }))).toBe(true)
    expect(isRetryable(new Error('{"error":{"code":400,"status":"INVALID_ARGUMENT"}}'))).toBe(false)
  })

  it("falls through the model chain on retryable errors and stops on the first answer", async () => {
    const { summarizeWithGemini } = await import("./gemini")
    const calls: string[] = []
    const client = {
      models: {
        generateContent: async ({ model }: { model: string }) => {
          calls.push(model)
          if (model === "busy") throw new Error('{"error":{"code":503,"status":"UNAVAILABLE"}}')
          return { text: JSON.stringify({ summary: "A long enough summary for the schema to accept.", tags: ["a"], category: "tool" }) }
        },
      },
    }
    const out = await summarizeWithGemini(
      { url: "https://a.com", title: "A", description: null, text: "x".repeat(300) },
      { apiKey: "k", models: ["busy", "good", "never"], timeoutMs: 1000 },
      client as never,
    )
    expect(calls).toEqual(["busy", "busy", "good"])
    expect(out?.category).toBe("tool")
  })

  it("caps the page text in the prompt", () => {
    const prompt = buildPrompt({ url: "https://a.com", title: "A", description: null, text: "x".repeat(10_000) })
    expect(prompt.length).toBeLessThan(7000)
    expect(prompt).not.toContain("Meta description")
  })
})
