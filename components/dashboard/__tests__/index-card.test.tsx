// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest"
import { fireEvent, screen, waitFor } from "@testing-library/react"
import { mountWithRepo } from "./harness"
import { BookmarkGrid } from "../bookmark-grid"

vi.mock("sonner", () => ({ toast: Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn(), loading: vi.fn() }) }))

const seed = [
  {
    url: "https://www.postgresql.org/docs/current/textsearch-intro.html",
    title: "PostgreSQL: Full Text Search introduction",
    summary: "The official tour of tsvector and tsquery.",
    tags: ["postgres", "search"],
    enrichment: "done" as const,
  },
]

describe("IndexCard", () => {
  it("renders the call-number line, title, summary and tag stamps", async () => {
    await mountWithRepo(<BookmarkGrid />, seed)
    expect(screen.getByText("postgresql.org")).toBeInTheDocument()
    expect(screen.getByRole("link", { name: /Full Text Search/ })).toHaveAttribute("href", seed[0]!.url)
    expect(screen.getByText(/official tour/)).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "postgres" })).toBeInTheDocument()
    expect(screen.getByText("ai summary")).toBeInTheDocument()
  })

  it("adds a tag through the inline input and persists it without touching the original object", async () => {
    const { repo } = await mountWithRepo(<BookmarkGrid />, seed)
    const before = (await repo.listBookmarks())[0]!
    fireEvent.click(screen.getByRole("button", { name: "Add tag" }))
    const input = screen.getByPlaceholderText("tag, enter")
    fireEvent.change(input, { target: { value: "Database" } })
    fireEvent.keyDown(input, { key: "Enter" })
    await waitFor(() => expect(screen.getByRole("button", { name: "database" })).toBeInTheDocument())
    const after = (await repo.listBookmarks())[0]!
    expect(after.tags).toEqual(["postgres", "search", "database"])
    expect(before.tags).toEqual(["postgres", "search"])
  })

  it("rejects a tag that breaks the schema and keeps the card unchanged", async () => {
    const { repo } = await mountWithRepo(<BookmarkGrid />, seed)
    fireEvent.click(screen.getByRole("button", { name: "Add tag" }))
    const input = screen.getByPlaceholderText("tag, enter")
    fireEvent.change(input, { target: { value: "<script>" } })
    fireEvent.keyDown(input, { key: "Enter" })
    await waitFor(async () => expect((await repo.listBookmarks())[0]!.tags).toEqual(["postgres", "search"]))
    expect(screen.queryByRole("button", { name: "<script>" })).toBeNull()
  })
})
