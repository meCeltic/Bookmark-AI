import { render, screen, fireEvent } from "@testing-library/react"
import BookmarkCard from "@/components/bookmark-card"
import type { Bookmark } from "@/lib/types"
import "@testing-library/jest-dom"

// Mock the local storage functions
jest.mock("@/lib/local-storage", () => ({
  addTagToBookmark: jest.fn().mockReturnValue(true),
}))

describe("BookmarkCard", () => {
  const mockBookmark: Bookmark = {
    id: "123",
    url: "https://example.com",
    title: "Example Website",
    favicon: "https://example.com/favicon.ico",
    summary: "This is a summary of the example website.",
    tags: ["test", "example"],
    created_at: new Date().toISOString(),
    user_id: "user123",
  }

  const mockOnDelete = jest.fn()
  const mockOnTagAdded = jest.fn()

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it("renders bookmark information correctly", () => {
    render(
      <BookmarkCard bookmark={mockBookmark} onDelete={mockOnDelete} userId="user123" onTagAdded={mockOnTagAdded} />,
    )

    expect(screen.getByText("Example Website")).toBeInTheDocument()
    expect(screen.getByText("This is a summary of the example website.")).toBeInTheDocument()
    expect(screen.getByText("example.com")).toBeInTheDocument()
    expect(screen.getByText("test")).toBeInTheDocument()
    expect(screen.getByText("example")).toBeInTheDocument()
  })

  it("shows delete confirmation dialog when delete button is clicked", () => {
    render(
      <BookmarkCard bookmark={mockBookmark} onDelete={mockOnDelete} userId="user123" onTagAdded={mockOnTagAdded} />,
    )

    fireEvent.click(screen.getByText("Delete"))
    expect(screen.getByText("Are you sure you want to delete this bookmark?")).toBeInTheDocument()
  })

  it("calls onDelete when delete is confirmed", () => {
    render(
      <BookmarkCard bookmark={mockBookmark} onDelete={mockOnDelete} userId="user123" onTagAdded={mockOnTagAdded} />,
    )

    fireEvent.click(screen.getByText("Delete"))
    fireEvent.click(screen.getByText("Delete", { selector: 'button[variant="destructive"]' }))
    expect(mockOnDelete).toHaveBeenCalledTimes(1)
  })

  it("shows add tag dialog when add tag button is clicked", () => {
    render(
      <BookmarkCard bookmark={mockBookmark} onDelete={mockOnDelete} userId="user123" onTagAdded={mockOnTagAdded} />,
    )

    fireEvent.click(screen.getByText("Add Tag"))
    expect(screen.getByText("Add a new tag to this bookmark.")).toBeInTheDocument()
  })
})
