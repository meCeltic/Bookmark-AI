// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest"
import { act, fireEvent, screen, waitFor } from "@testing-library/react"
import { mountWithRepo } from "./harness"
import { BookmarkGrid } from "../bookmark-grid"
import { TopBar } from "../topbar"

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
  it("defaults to list rows: linked title, ink-2 serif summary, domain · age in its own column; no tags, dot or fold", async () => {
    const { container } = await mountWithRepo(<BookmarkGrid />, seed)
    const row = container.querySelector("li.row")!
    expect(row).not.toBeNull()
    const link = screen.getByRole("link", { name: /Full Text Search/ })
    expect(link).toHaveAttribute("href", seed[0]!.url)
    expect(link).toHaveAttribute("target", "_blank")
    expect(link).toHaveClass("font-semibold")
    expect(screen.getByText(/official tour/).className).toContain("font-summary")
    expect(screen.getByText(/official tour/)).toHaveClass("text-ink-2")
    // Wide screens: the meta sits in the right slot, which swaps to the actions on hover.
    const meta = row.querySelector(".row-slot .row-meta")!
    expect(meta.textContent).toMatch(/^postgresql\.org · /)
    expect(row.querySelector(".row-slot .row-actions")!.contains(screen.getByRole("button", { name: "Done" }))).toBe(true)
    expect(screen.queryByRole("button", { name: "postgres" })).toBeNull()
    expect(screen.queryByLabelText("Unread")).toBeNull()
    expect(row.querySelector(".fold")).toBeNull()
    expect(screen.queryByText(/ai summary/i)).toBeNull()
  })

  it("marks a favourite row with a small yellow star after the title, not a fold", async () => {
    const { container } = await mountWithRepo(<BookmarkGrid />, [{ ...seed[0]!, favourite: true }])
    const star = screen.getByLabelText("Starred")
    expect(star).toHaveAttribute("fill", "var(--mark)")
    expect(container.querySelector(".fold")).toBeNull()
  })

  it("folds the Read group in the Inbox into one line, unfolds on click and remembers it", async () => {
    await mountWithRepo(<BookmarkGrid />, [
      { url: "https://a.example/read", title: "Already read", readAt: new Date().toISOString() },
      { url: "https://b.example/new", title: "Still unread" },
    ])
    expect(screen.getAllByRole("link").map((a) => a.textContent)).toEqual(["Still unread"])
    const fold = screen.getByRole("button", { name: /1 read/ })
    expect(fold).toHaveAttribute("aria-expanded", "false")
    expect(screen.getByRole("button", { name: "Mark all done" })).toBeInTheDocument()
    fireEvent.click(fold)
    await waitFor(() => expect(screen.getAllByRole("link").map((a) => a.textContent)).toEqual(["Still unread", "Already read"]))
    expect(screen.getByRole("link", { name: "Already read" })).toHaveClass("font-normal")
    await waitFor(() => expect(JSON.parse(window.localStorage.getItem("bookmark-ai:prefs") ?? "{}").readOpen).toBe(true))
  })

  it("Mark all done clears the read ones out of the Inbox", async () => {
    const { repo } = await mountWithRepo(<BookmarkGrid />, [
      { url: "https://a.example/read", title: "Already read", readAt: new Date().toISOString() },
      { url: "https://b.example/new", title: "Still unread" },
    ])
    fireEvent.click(screen.getByRole("button", { name: "Mark all done" }))
    await waitFor(async () => expect((await repo.listBookmarks()).find((b) => b.title === "Already read")!.archivedAt).not.toBeNull())
    await waitFor(() => expect(screen.queryByRole("button", { name: /1 read/ })).toBeNull())
    expect((await repo.listBookmarks()).find((b) => b.title === "Still unread")!.archivedAt).toBeNull()
  })

  it("an opened link keeps its place, unbolded, until the view changes; then it joins the fold", async () => {
    vi.spyOn(window, "open").mockImplementation(() => null)
    const { container } = await mountWithRepo(<BookmarkGrid />, [
      { url: "https://a.example/one", title: "One", createdAt: new Date(Date.now() - 1000).toISOString() },
      { url: "https://b.example/two", title: "Two", createdAt: new Date(Date.now() - 2000).toISOString() },
    ])
    const link = screen.getByRole("link", { name: "One" })
    link.addEventListener("click", (e) => e.preventDefault())
    fireEvent.click(link)
    await waitFor(() => expect(screen.getByRole("link", { name: "One" })).toHaveClass("font-normal"))
    expect(screen.getAllByRole("link").map((a) => a.textContent)).toEqual(["One", "Two"])
    expect(screen.queryByRole("button", { name: /read$/ })).toBeNull()
    expect(container.querySelector("li.row")).not.toBeNull()
  })

  it("keyboard use puts data-keys on the list until the pointer really moves", async () => {
    Element.prototype.scrollIntoView = vi.fn()
    const { container } = await mountWithRepo(<BookmarkGrid />, seed)
    const list = container.querySelector("ul.cards")!
    expect(list.hasAttribute("data-keys")).toBe(false)
    fireEvent.keyDown(document.body, { key: "j" })
    expect(list.hasAttribute("data-keys")).toBe(true)
    fireEvent.mouseMove(document.body, { screenX: 10, screenY: 10 })
    expect(list.hasAttribute("data-keys")).toBe(false)
  })

  it("renders the card anatomy in grid layout: summary in the serif, plain tags, reading time only in the actions", async () => {
    useGrid()
    const { container } = await mountWithRepo(<BookmarkGrid />, seed)
    await waitFor(() => expect(container.querySelector("li.card")).not.toBeNull())
    const summary = screen.getByText(/official tour/)
    expect(summary.className).toContain("font-summary")
    expect(screen.getByRole("button", { name: "postgres" })).toHaveClass("tag")
    expect(screen.getByText("7 min").closest(".row-actions")).not.toBeNull()
    expect(screen.queryByText(/ai summary/i)).toBeNull()
    // Unread: a bold title, no dot.
    expect(screen.getByRole("heading", { name: /Full Text Search/ })).toHaveClass("font-bold")
    expect(screen.queryByLabelText("Unread")).toBeNull()
    expect(container.querySelector("li.card")).toHaveClass("p-5")
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
    await waitFor(async () => expect((await repo.listBookmarks())[0]!.tags).toContain("database"))
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

  it("highlights the searched word with native <mark> inside the row summary", async () => {
    const { container } = await mountWithRepo(<><TopBar onOpenPalette={() => {}} onOpenMenu={() => {}} /><BookmarkGrid /></>, seed)
    expect(container.querySelector("mark")).toBeNull()
    fireEvent.change(screen.getByLabelText("Search or paste a link"), { target: { value: "tsvector" } })
    await waitFor(() => expect(container.querySelector("li.row mark")?.textContent).toBe("tsvector"))
    expect(container.querySelector("li.row mark")!.closest(".font-summary")).not.toBeNull()
  })
})
