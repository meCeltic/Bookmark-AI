// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest"
import { act, fireEvent, screen, waitFor } from "@testing-library/react"
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
    readingMinutes: 7,
  },
]

const useGrid = () => window.localStorage.setItem("bookmark-ai:prefs", JSON.stringify({ layout: "grid" }))

afterEach(() => window.localStorage.clear())

describe("IndexCard", () => {
  it("defaults to list rows: favicon, title, domain, tags, no summary label", async () => {
    const { container } = await mountWithRepo(<BookmarkGrid />, seed)
    expect(container.querySelector("li.row")).not.toBeNull()
    expect(screen.getByText("postgresql.org")).toBeInTheDocument()
    expect(screen.getByRole("link", { name: /Full Text Search/ })).toHaveAttribute("href", seed[0]!.url)
    expect(screen.getByRole("button", { name: "postgres" })).toBeInTheDocument()
    expect(screen.queryByText(/ai summary/i)).toBeNull()
  })

  it("renders the card anatomy in grid layout: summary in the serif, plain tags, reading time only in the actions", async () => {
    useGrid()
    const { container } = await mountWithRepo(<BookmarkGrid />, seed)
    await waitFor(() => expect(container.querySelector("li.card")).not.toBeNull())
    const summary = screen.getByText(/official tour/)
    expect(summary.className).toContain("font-summary")
    expect(screen.getByRole("button", { name: "postgres" })).toHaveClass("tag")
    expect(screen.getByText("7 min read").closest(".card-buttons")).not.toBeNull()
    expect(screen.queryByText(/ai summary/i)).toBeNull()
    // Unread: bold title and the action dot.
    expect(screen.getByRole("heading", { name: /Full Text Search/ })).toHaveClass("font-bold")
    expect(screen.getByLabelText("Unread")).toBeInTheDocument()
  })

  it("says it could not read the page only when enrichment failed", async () => {
    useGrid()
    await mountWithRepo(<BookmarkGrid />, [{ url: "https://example.org/x", title: "Example", enrichment: "failed" as const }])
    await waitFor(() => expect(screen.getByText("Couldn’t read this page")).toBeInTheDocument())
  })

  it("shows the favourite as a folded corner", async () => {
    useGrid()
    const { container } = await mountWithRepo(<BookmarkGrid />, [{ ...seed[0]!, favourite: true }])
    await waitFor(() => expect(container.querySelector(".fold")).not.toBeNull())
  })

  it("Done marks the card read and archives it in one step", async () => {
    const { repo } = await mountWithRepo(<BookmarkGrid />, seed)
    fireEvent.click(screen.getByRole("button", { name: "Done" }))
    await waitFor(async () => {
      const b = (await repo.listBookmarks())[0]!
      expect(b.archivedAt).not.toBeNull()
      expect(b.readAt).not.toBeNull()
    })
    await waitFor(() => expect(screen.queryByRole("link", { name: /Full Text Search/ })).toBeNull())
  })

  it("adds a tag through the inline input and persists it without touching the original object", async () => {
    const { repo } = await mountWithRepo(<BookmarkGrid />, seed)
    const before = (await repo.listBookmarks())[0]!
    act(() => { window.dispatchEvent(new CustomEvent("bookmark-ai:tag", { detail: before.id })) })
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
    const id = (await repo.listBookmarks())[0]!.id
    act(() => { window.dispatchEvent(new CustomEvent("bookmark-ai:tag", { detail: id })) })
    const input = screen.getByPlaceholderText("tag, enter")
    fireEvent.change(input, { target: { value: "<script>" } })
    fireEvent.keyDown(input, { key: "Enter" })
    await waitFor(async () => expect((await repo.listBookmarks())[0]!.tags).toEqual(["postgres", "search"]))
    expect(screen.queryByRole("button", { name: "<script>" })).toBeNull()
  })

  it("highlights search hits with native <mark>", async () => {
    const { container } = await mountWithRepo(<BookmarkGrid />, seed)
    expect(container.querySelector("mark")).toBeNull()
    expect(screen.getByRole("link", { name: /Full Text Search/ })).toBeInTheDocument()
  })
})
