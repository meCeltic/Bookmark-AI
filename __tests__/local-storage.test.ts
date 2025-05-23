import { getBookmarks, addBookmark, deleteBookmark, addTagToBookmark } from "@/lib/local-storage"

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {}
  return {
    getItem: jest.fn((key: string) => store[key] || null),
    setItem: jest.fn((key: string, value: string) => {
      store[key] = value
    }),
    clear: jest.fn(() => {
      store = {}
    }),
  }
})()

Object.defineProperty(window, "localStorage", { value: localStorageMock })

// Mock crypto.randomUUID
global.crypto = {
  ...global.crypto,
  randomUUID: () => "123e4567-e89b-12d3-a456-426614174000",
}

describe("Local Storage Functions", () => {
  beforeEach(() => {
    localStorageMock.clear()
    jest.clearAllMocks()
  })

  describe("getBookmarks", () => {
    it("returns an empty array when no bookmarks exist", () => {
      expect(getBookmarks("user123")).toEqual([])
    })

    it("returns only bookmarks for the specified user", () => {
      const bookmarks = [
        { id: "1", user_id: "user123", url: "https://example.com" },
        { id: "2", user_id: "user456", url: "https://example.org" },
      ]
      localStorageMock.setItem("bookmarks", JSON.stringify(bookmarks))

      const result = getBookmarks("user123")
      expect(result).toHaveLength(1)
      expect(result[0].id).toBe("1")
    })
  })

  describe("addBookmark", () => {
    it("adds a bookmark with a generated ID", () => {
      const bookmark = {
        url: "https://example.com",
        title: "Example",
        user_id: "user123",
        created_at: new Date().toISOString(),
      }

      const result = addBookmark(bookmark)

      expect(result.id).toBe("123e4567-e89b-12d3-a456-426614174000")
      expect(localStorageMock.setItem).toHaveBeenCalled()
    })
  })

  describe("deleteBookmark", () => {
    it("deletes a bookmark by ID", () => {
      const bookmarks = [
        { id: "1", user_id: "user123", url: "https://example.com" },
        { id: "2", user_id: "user123", url: "https://example.org" },
      ]
      localStorageMock.setItem("bookmarks", JSON.stringify(bookmarks))

      const result = deleteBookmark("1", "user123")

      expect(result).toBe(true)
      expect(localStorageMock.setItem).toHaveBeenCalled()

      // Verify the bookmark was removed
      const storedData = JSON.parse(localStorageMock.setItem.mock.calls[1][1])
      expect(storedData).toHaveLength(1)
      expect(storedData[0].id).toBe("2")
    })

    it("returns false if bookmark not found", () => {
      const bookmarks = [{ id: "1", user_id: "user123", url: "https://example.com" }]
      localStorageMock.setItem("bookmarks", JSON.stringify(bookmarks))

      const result = deleteBookmark("999", "user123")

      expect(result).toBe(false)
    })
  })

  describe("addTagToBookmark", () => {
    it("adds a tag to a bookmark", () => {
      const bookmarks = [{ id: "1", user_id: "user123", url: "https://example.com", tags: ["existing"] }]
      localStorageMock.setItem("bookmarks", JSON.stringify(bookmarks))

      const result = addTagToBookmark("1", "newtag", "user123")

      expect(result).toBe(true)

      // Verify the tag was added
      const storedData = JSON.parse(localStorageMock.setItem.mock.calls[1][1])
      expect(storedData[0].tags).toContain("newtag")
      expect(storedData[0].tags).toContain("existing")
    })

    it("does not add duplicate tags", () => {
      const bookmarks = [{ id: "1", user_id: "user123", url: "https://example.com", tags: ["existing"] }]
      localStorageMock.setItem("bookmarks", JSON.stringify(bookmarks))

      const result = addTagToBookmark("1", "existing", "user123")

      expect(result).toBe(false)
      expect(localStorageMock.setItem).not.toHaveBeenCalled()
    })
  })
})
