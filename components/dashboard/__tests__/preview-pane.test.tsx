// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { fireEvent, screen, waitFor, within } from "@testing-library/react"
import { toast } from "sonner"
import { mountWithRepo } from "./harness"
import { BookmarkGrid } from "../bookmark-grid"
import { PreviewPane } from "../preview-pane"

vi.mock("sonner", () => ({ toast: Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn(), loading: vi.fn() }) }))

const day = (d: number) => new Date(Date.now() - d * 86_400_000).toISOString()
const seed = [
  { url: "https://one.example/a", title: "First card", summary: "The first summary, in full.", tags: ["alpha"], readingMinutes: 4, createdAt: day(1) },
  { url: "https://two.example/b", title: "Second card", summary: "The second summary.", tags: ["beta"], createdAt: day(2) },
]

const mount = () => mountWithRepo(<><BookmarkGrid /><PreviewPane /></>, seed)
const rowOf = (title: string) => screen.getByRole("link", { name: title }).closest("li")!
const pane = () => screen.queryByRole("complementary", { name: "Preview" })

let openSpy: ReturnType<typeof vi.spyOn>
beforeEach(() => {
  openSpy = vi.spyOn(window, "open").mockImplementation(() => null)
  Element.prototype.scrollIntoView = vi.fn()
})
afterEach(() => { openSpy.mockRestore(); window.localStorage.clear(); vi.mocked(toast).mockClear() })

describe("PreviewPane", () => {
  it("opens on a ⌘-click with the full summary, reading time, tags and actions", async () => {
    await mount()
    expect(pane()).toBeNull()
    fireEvent.click(rowOf("First card"), { metaKey: true })
    const p = within(pane()!)
    expect(p.getByRole("link", { name: "First card" })).toHaveAttribute("target", "_blank")
    expect(p.getByText("The first summary, in full.")).toHaveClass("font-summary")
    expect(p.getByText(/4 min read/)).toBeInTheDocument()
    expect(p.getByLabelText("Remove tag alpha")).toBeInTheDocument()
    expect(p.getByRole("button", { name: /Open/ })).toBeInTheDocument()
    expect(p.getByRole("button", { name: /Done/ })).toBeInTheDocument()
    expect(p.getByRole("button", { name: /Star/ })).toBeInTheDocument()
    expect(openSpy).not.toHaveBeenCalled()
  })

  it("j moves the pane along, o opens the link, Esc closes it", async () => {
    await mount()
    fireEvent.click(rowOf("First card"), { metaKey: true })
    fireEvent.keyDown(document.body, { key: "j" })
    expect(within(pane()!).getByRole("link", { name: "Second card" })).toBeInTheDocument()
    fireEvent.keyDown(document.body, { key: "o" })
    expect(openSpy).toHaveBeenCalledWith("https://two.example/b", "_blank", "noopener,noreferrer")
    fireEvent.keyDown(document.body, { key: "Escape" })
    await waitFor(() => expect(pane()).toBeNull())
  })

  it("d marks the previewed card done and moves on to the next one", async () => {
    const { repo } = await mount()
    fireEvent.click(rowOf("First card"), { metaKey: true })
    fireEvent.keyDown(document.body, { key: "d" })
    await waitFor(async () => {
      const first = (await repo.listBookmarks()).find((b) => b.title === "First card")!
      expect(first.archivedAt).not.toBeNull()
      expect(first.readAt).not.toBeNull()
    })
    expect(within(pane()!).getByRole("link", { name: "Second card" })).toBeInTheDocument()
  })

  it("a plain click on a row opens the link instead of previewing, and the first open shows the d hint once", async () => {
    await mount()
    fireEvent.click(rowOf("First card"))
    expect(openSpy).toHaveBeenCalledTimes(1)
    expect(pane()).toBeNull()
    expect(toast).toHaveBeenCalledWith("Read it? Press d to clear it from your Inbox", expect.anything())
    fireEvent.click(rowOf("Second card"))
    expect(vi.mocked(toast).mock.calls.filter(([m]) => typeof m === "string" && m.startsWith("Read it?"))).toHaveLength(1)
  })

  it("the title link records the open without opening the pane", async () => {
    const { repo } = await mount()
    const link = screen.getByRole("link", { name: "Second card" })
    link.addEventListener("click", (e) => e.preventDefault())
    fireEvent.click(link)
    expect(pane()).toBeNull()
    await waitFor(async () => expect((await repo.listBookmarks()).find((b) => b.title === "Second card")!.readAt).not.toBeNull())
  })

  it("the star pops when added, and a different card starts with no pop", async () => {
    await mount()
    fireEvent.click(rowOf("First card"), { metaKey: true })
    fireEvent.click(within(pane()!).getByRole("button", { name: /Star/ }))
    await waitFor(() => expect(pane()!.querySelector(".anim-star")).not.toBeNull())
    fireEvent.keyDown(document.body, { key: "j" })
    expect(within(pane()!).getByRole("link", { name: "Second card" })).toBeInTheDocument()
    fireEvent.click(within(pane()!).getByRole("button", { name: /Star/ }))
    await waitFor(() => expect(within(pane()!).getByRole("button", { name: /Starred/ })).toBeInTheDocument())
    // Back on the first (already starred) card: no pop on arrival.
    fireEvent.keyDown(document.body, { key: "k" })
    expect(within(pane()!).getByRole("link", { name: "First card" })).toBeInTheDocument()
    expect(pane()!.querySelector(".anim-star")).toBeNull()
  })

  it("Done on the last card closes the pane along with the done", async () => {
    const { repo } = await mountWithRepo(<><BookmarkGrid /><PreviewPane /></>, seed.slice(0, 1))
    fireEvent.click(rowOf("First card"), { metaKey: true })
    fireEvent.click(within(pane()!).getByRole("button", { name: /^Done/ }))
    await waitFor(() => expect(pane()).toBeNull())
    await waitFor(async () => expect((await repo.listBookmarks())[0]!.archivedAt).not.toBeNull())
  })
})
