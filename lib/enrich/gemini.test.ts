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

  it("caps the page text in the prompt", () => {
    const prompt = buildPrompt({ url: "https://a.com", title: "A", description: null, text: "x".repeat(10_000) })
    expect(prompt.length).toBeLessThan(7000)
    expect(prompt).not.toContain("Meta description")
  })
})
