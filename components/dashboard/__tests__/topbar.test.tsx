// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest"
import { fireEvent, screen, waitFor } from "@testing-library/react"
import { mountWithRepo } from "./harness"
import { TopBar } from "../topbar"
import { BookmarkGrid } from "../bookmark-grid"

vi.mock("sonner", () => ({ toast: Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn(), loading: vi.fn() }) }))

const seed = [
  { url: "https://www.postgresql.org/docs/", title: "Postgres docs", tags: ["postgres", "search"], enrichment: "done" as const },
  { url: "https://react.dev/", title: "React", tags: ["react"], enrichment: "done" as const },
]

describe("TopBar", () => {
  it("stays in search mode for words and flips to Save mode for a pasted link", async () => {
    await mountWithRepo(<TopBar onOpenPalette={() => {}} onOpenMenu={() => {}} />)
    const box = screen.getByLabelText("Search or paste a link")
    fireEvent.change(box, { target: { value: "postgres search" } })
    expect(screen.queryByRole("button", { name: /Save/ })).toBeNull()
    fireEvent.change(box, { target: { value: "github.com/supabase/supabase" } })
    expect(screen.getByRole("button", { name: /Save/ })).toBeInTheDocument()
    fireEvent.change(box, { target: { value: "not a url at all" } })
    expect(screen.queryByRole("button", { name: /Save/ })).toBeNull()
  })

  it("focuses the input when / is pressed outside a field", async () => {
    await mountWithRepo(<TopBar onOpenPalette={() => {}} onOpenMenu={() => {}} />)
    const box = screen.getByLabelText("Search or paste a link")
    expect(document.activeElement).not.toBe(box)
    fireEvent.keyDown(window, { key: "/" })
    expect(document.activeElement).toBe(box)
  })

  it("typing # suggests existing tags, and picking one filters by it", async () => {
    await mountWithRepo(
      <>
        <TopBar onOpenPalette={() => {}} onOpenMenu={() => {}} />
        <BookmarkGrid />
      </>,
      seed,
    )
    const box = screen.getByLabelText("Search or paste a link")
    fireEvent.focus(box)
    fireEvent.change(box, { target: { value: "#pos" } })
    const option = screen.getByRole("option", { name: /postgres/ })
    expect(screen.queryByRole("option", { name: /react/ })).toBeNull()
    fireEvent.mouseDown(option)
    expect(box).toHaveValue("")
    await waitFor(() => expect(screen.queryByRole("link", { name: "React" })).toBeNull())
    expect(screen.getByRole("link", { name: "Postgres docs" })).toBeInTheDocument()
  })

  it("prefills Save mode from ?save= and cleans the address bar", async () => {
    window.history.replaceState(null, "", "/demo?save=" + encodeURIComponent("https://example.com/post"))
    await mountWithRepo(<TopBar onOpenPalette={() => {}} onOpenMenu={() => {}} />)
    expect(screen.getByLabelText("Search or paste a link")).toHaveValue("https://example.com/post")
    expect(screen.getByRole("button", { name: /Save/ })).toBeInTheDocument()
    await waitFor(() => expect(window.location.search).toBe(""))
  })
})
