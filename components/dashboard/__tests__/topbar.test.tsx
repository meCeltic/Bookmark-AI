// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest"
import { fireEvent, screen } from "@testing-library/react"
import { mountWithRepo } from "./harness"
import { TopBar } from "../topbar"

vi.mock("sonner", () => ({ toast: Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn(), loading: vi.fn() }) }))

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
})
