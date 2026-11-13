// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { act, fireEvent, screen, waitFor, within } from "@testing-library/react"
import { mountWithRepo } from "./harness"
import { DashboardShell } from "../shell"
import { BookmarkGrid } from "../bookmark-grid"
import { PreviewPane } from "../preview-pane"
import { TagEditor } from "../tag-editor"
import { useDashboard } from "../provider"

vi.mock("next/link", () => ({ default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => <a href={href} {...rest}>{children}</a> }))
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }) }))
vi.mock("sonner", () => ({ toast: Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn(), loading: vi.fn(), dismiss: vi.fn() }) }))

const day = (d: number) => new Date(Date.now() - d * 86_400_000).toISOString()
const seed = [
  { url: "https://one.example/a", title: "Postgres search guide", summary: "All about tsvector.", createdAt: day(1) },
  { url: "https://two.example/b", title: "React hooks", createdAt: day(2) },
  { url: "https://three.example/c", title: "Postgres indexes", archivedAt: day(1), readAt: day(1), createdAt: day(3) },
]

beforeEach(() => {
  Element.prototype.scrollIntoView = vi.fn()
  window.matchMedia = vi.fn().mockImplementation((q: string) => ({ matches: false, media: q, addEventListener: vi.fn(), removeEventListener: vi.fn() }))
})
afterEach(() => window.localStorage.clear())

const shell = () => mountWithRepo(<DashboardShell userLabel="Demo" cloudAvailable={false} />, seed)
const box = () => screen.getByLabelText("Search or paste a link")

describe("Inbox flow", () => {
  it("a link in the omnibox replaces the list with one Save row and hides the count", async () => {
    await shell()
    expect(screen.getByText("2 to read · 0 read")).toBeInTheDocument()
    fireEvent.change(box(), { target: { value: "https://example.com/post" } })
    const row = await screen.findByRole("button", { name: /Save example\.com\/post/ })
    expect(row).toHaveAttribute("type", "submit")
    expect(row).toHaveAttribute("form", "omnibox-form")
    expect(within(row).getByText("Saves to Inbox")).toBeInTheDocument()
    expect(screen.queryByRole("link", { name: "React hooks" })).toBeNull()
    expect(screen.queryByText(/to read/)).toBeNull()
    expect(screen.queryByText(/Paste any link/)).toBeNull()
  })

  it("says when the link is already saved", async () => {
    await shell()
    fireEvent.change(box(), { target: { value: "https://two.example/b" } })
    const row = await screen.findByRole("button", { name: /Show two\.example\/b/ })
    expect(within(row).getByText(/Already saved on/)).toBeInTheDocument()
  })

  it("search heading counts hits here and in Done; the arrow switches to Done keeping the query", async () => {
    await shell()
    fireEvent.change(box(), { target: { value: "postgres" } })
    await waitFor(() => expect(screen.getByText("1 in Inbox", { exact: false })).toBeInTheDocument())
    const across = screen.getByRole("button", { name: /1 in Done/ })
    fireEvent.click(across)
    await waitFor(() => expect(screen.getByRole("heading", { name: "Done" })).toBeInTheDocument())
    expect(box()).toHaveValue("postgres")
    expect(screen.getByRole("link", { name: /indexes/ })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /1 in Inbox/ })).toBeInTheDocument()
  })

  it("no placeholder shortcut and no paste hint while the Inbox has cards", async () => {
    await shell()
    expect(box().getAttribute("placeholder")).toBe("Search, #tag, or paste a link")
    expect(screen.queryByText(/Paste any link/)).toBeNull()
    expect(screen.queryByRole("button", { name: "Commands" })).toBeNull()
  })

  it("Done explains itself, and u or the hover action moves a card back to the Inbox", async () => {
    const { repo } = await shell()
    fireEvent.click(screen.getAllByRole("button", { name: /^Done/ })[0]!)
    await waitFor(() => expect(screen.getByText(/Done items leave your Inbox/)).toBeInTheDocument())
    expect(screen.getByRole("button", { name: "Move to Inbox" })).toBeInTheDocument()
    const link = screen.getByRole("link", { name: "Postgres indexes" })
    act(() => { link.focus() })
    link.blur()
    fireEvent.keyDown(document.body, { key: "u" })
    await waitFor(async () => expect((await repo.listBookmarks()).find((b) => b.title === "Postgres indexes")!.archivedAt).toBeNull())
  })
})

describe("Collection picker and tags", () => {
  it("the pane files a card through a plain-text menu, not a <select>", async () => {
    const { container } = await mountWithRepo(<><BookmarkGrid /><PreviewPane /></>, seed.slice(0, 1))
    expect(container.querySelector("select")).toBeNull()
    fireEvent.click(screen.getByRole("link", { name: /Postgres search guide/ }).closest("li")!)
    const pane = screen.getByRole("complementary", { name: "Preview" })
    expect(pane.querySelector("select")).toBeNull()
    expect(within(pane).getByRole("button", { name: "Add to collection" })).toHaveTextContent("Add to collection…")
    // Done and Star are quiet text buttons; Open is the one filled button.
    expect(within(pane).getByRole("button", { name: /Open/ })).toHaveClass("btn-primary")
    expect(within(pane).getByRole("button", { name: /^Done/ })).toHaveClass("btn-ghost")
    expect(within(pane).getByRole("button", { name: /Star/ })).toHaveClass("btn-ghost")
  })

  it("the tag editor stamps only tags that arrive on their own, not ones already there or typed", async () => {
    let api: ReturnType<typeof useDashboard> | null = null
    const Probe = () => {
      api = useDashboard()
      const b = api.state.bookmarks[0]
      return b ? <TagEditor bookmark={b} /> : null
    }
    const { container } = await mountWithRepo(<Probe />, [{ url: "https://x.example/", title: "X", tags: ["old"] }])
    await waitFor(() => expect(container.querySelector(".stamp-group")).not.toBeNull())
    expect(container.querySelector(".anim-stamp")).toBeNull()
    // A dashed "+ tag" pill until clicked, then the input.
    expect(screen.queryByLabelText("Add a tag")).toBeNull()
    fireEvent.click(screen.getByRole("button", { name: "+ tag" }))
    const input = screen.getByLabelText("Add a tag")
    fireEvent.change(input, { target: { value: "mine" } })
    fireEvent.keyDown(input, { key: "Enter" })
    await waitFor(() => expect(screen.getByLabelText("Remove tag mine")).toBeInTheDocument())
    expect(container.querySelector(".anim-stamp")).toBeNull()
    const id = api!.state.bookmarks[0]!.id
    await act(async () => { await api!.patch(id, { tags: ["old", "mine", "ai"] }) })
    await waitFor(() => expect(screen.getByLabelText("Remove tag ai")).toBeInTheDocument())
    expect(screen.getByLabelText("Remove tag ai").closest(".stamp-group")).toHaveClass("anim-stamp")
    expect(container.querySelectorAll(".anim-stamp")).toHaveLength(1)
  })
})

describe("Counts and focus", () => {
  const mixed = [
    { url: "https://one.example/a", title: "Unread one", createdAt: day(1) },
    { url: "https://two.example/b", title: "Unread two", createdAt: day(2) },
    { url: "https://three.example/c", title: "Read before", readAt: day(1), createdAt: day(3) },
  ]

  it("a held card counts as read in the header, the fold and the sidebar alike", async () => {
    const open = vi.spyOn(window, "open").mockImplementation(() => null)
    await mountWithRepo(<DashboardShell userLabel="Demo" cloudAvailable={false} />, mixed)
    expect(screen.getByText("2 to read · 1 read")).toBeInTheDocument()
    fireEvent.keyDown(document.body, { key: "j" })
    fireEvent.keyDown(document.body, { key: "o" })
    await waitFor(() => expect(screen.getByText("1 to read · 2 read")).toBeInTheDocument())
    // Held in place above the fold, yet the fold counts it.
    expect(screen.getByRole("link", { name: "Unread one" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /^2 read/ })).toBeInTheDocument()
    const inbox = screen.getAllByRole("button", { name: /Inbox/ }).find((b) => b.getAttribute("aria-current") === "page")!
    expect(inbox).toHaveTextContent("1")
    open.mockRestore()
  })

  it("list keys take DOM focus from the sidebar, so only one indicator shows", async () => {
    await mountWithRepo(<DashboardShell userLabel="Demo" cloudAvailable={false} />, mixed)
    const navButton = screen.getAllByRole("button", { name: /Inbox/ })[0]!
    act(() => { navButton.focus() })
    expect(document.activeElement).toBe(navButton)
    fireEvent.keyDown(navButton, { key: "j" })
    expect(document.activeElement).toBe(screen.getByRole("list", { name: "Links" }))
  })
})

