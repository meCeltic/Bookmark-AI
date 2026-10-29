// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest"
import { screen } from "@testing-library/react"
import { mountWithRepo } from "./harness"
import { BookmarkGrid } from "../bookmark-grid"

vi.mock("sonner", () => ({ toast: Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn(), loading: vi.fn() }) }))

describe("empty drawer", () => {
  it("shows the empty state with example links when nothing is filed", async () => {
    await mountWithRepo(<BookmarkGrid />)
    expect(screen.getByText("Nothing filed yet.")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "nextjs.org/docs" })).toBeInTheDocument()
  })
})
