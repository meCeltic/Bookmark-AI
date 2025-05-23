import type { Bookmark } from "@/lib/types"

// Keys for localStorage
const BOOKMARKS_KEY = "bookmarks"
const BOOKMARK_ORDER_KEY = "bookmark_order"

// Helper to ensure ID is always a string
const ensureStringId = (id: string | number) => String(id);

// Get all bookmarks for a user
export const getBookmarks = (userId: string): Bookmark[] => {
  if (typeof window === "undefined") return []

  try {
    const storedData = localStorage.getItem(BOOKMARKS_KEY)
    if (!storedData) return []

    const allBookmarks = JSON.parse(storedData)
    const userBookmarks = allBookmarks
      .filter((bookmark: Bookmark) => bookmark.user_id === userId)
      .map((bookmark: Bookmark) => ({
        ...bookmark,
        id: ensureStringId(bookmark.id)
      }));

    // Check if we have a custom order for this user
    const orderData = localStorage.getItem(`${BOOKMARK_ORDER_KEY}_${userId}`)
    if (orderData) {
      const orderIds = JSON.parse(orderData).map(ensureStringId)

      // Sort bookmarks according to the saved order
      return userBookmarks.sort((a: Bookmark, b: Bookmark) => {
        const indexA = orderIds.indexOf(ensureStringId(a.id))
        const indexB = orderIds.indexOf(ensureStringId(b.id))

        // If both IDs are in the order list, sort by their position
        if (indexA !== -1 && indexB !== -1) {
          return indexA - indexB
        }

        // If only one ID is in the order list, prioritize it
        if (indexA !== -1) return -1
        if (indexB !== -1) return 1

        // If neither ID is in the order list, sort by created_at (newest first)
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      })
    }

    // Default sort by created_at (newest first)
    return userBookmarks.sort(
      (a: Bookmark, b: Bookmark) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    )
  } catch (error) {
    console.error("Error getting bookmarks from localStorage:", error)
    return []
  }
}

// Add a new bookmark
export const addBookmark = (bookmark: Omit<Bookmark, "id">): Bookmark => {
  if (typeof window === "undefined") throw new Error("Cannot access localStorage on the server")

  try {
    const storedData = localStorage.getItem(BOOKMARKS_KEY)
    const allBookmarks: Bookmark[] = storedData 
      ? JSON.parse(storedData).map((b: Bookmark) => ({
          ...b,
          id: ensureStringId(b.id)
        }))
      : [];

    // Create a new bookmark with a unique ID
    const newBookmark: Bookmark = {
      ...bookmark,
      id: ensureStringId(crypto.randomUUID()),
    }

    // Add to the beginning of the array
    allBookmarks.unshift(newBookmark)

    // Save back to localStorage
    localStorage.setItem(BOOKMARKS_KEY, JSON.stringify(allBookmarks))

    return newBookmark
  } catch (error) {
    console.error("Error adding bookmark to localStorage:", error)
    throw new Error("Failed to save bookmark")
  }
}

// Delete a bookmark
export const deleteBookmark = (id: string, userId: string): boolean => {
  if (typeof window === "undefined") throw new Error("Cannot access localStorage on the server")

  try {
    const storedData = localStorage.getItem(BOOKMARKS_KEY)
    if (!storedData) return false

    const allBookmarks: Bookmark[] = JSON.parse(storedData)

    // Find the bookmark
    const bookmarkIndex = allBookmarks.findIndex(
      (bookmark: Bookmark) => bookmark.id === id && bookmark.user_id === userId,
    )

    if (bookmarkIndex === -1) return false

    // Remove the bookmark
    allBookmarks.splice(bookmarkIndex, 1)

    // Save back to localStorage
    localStorage.setItem(BOOKMARKS_KEY, JSON.stringify(allBookmarks))

    // Update order if it exists
    const orderKey = `${BOOKMARK_ORDER_KEY}_${userId}`
    const orderData = localStorage.getItem(orderKey)
    if (orderData) {
      const orderIds = JSON.parse(orderData)
      const newOrderIds = orderIds.filter((bookmarkId: string) => bookmarkId !== id)
      localStorage.setItem(orderKey, JSON.stringify(newOrderIds))
    }

    return true
  } catch (error) {
    console.error("Error deleting bookmark from localStorage:", error)
    return false
  }
}

// Add a tag to a bookmark
export const addTagToBookmark = (id: string, tag: string, userId: string): boolean => {
  if (typeof window === "undefined") throw new Error("Cannot access localStorage on the server")

  try {
    const storedData = localStorage.getItem(BOOKMARKS_KEY)
    if (!storedData) return false

    const allBookmarks: Bookmark[] = JSON.parse(storedData)

    // Find the bookmark
    const bookmarkIndex = allBookmarks.findIndex(
      (bookmark: Bookmark) => bookmark.id === id && bookmark.user_id === userId,
    )

    if (bookmarkIndex === -1) return false

    // Add the tag if it doesn't already exist
    const bookmark = allBookmarks[bookmarkIndex]
    const tags = bookmark.tags || []

    if (!tags.includes(tag)) {
      bookmark.tags = [...tags, tag]

      // Save back to localStorage
      localStorage.setItem(BOOKMARKS_KEY, JSON.stringify(allBookmarks))

      // Return true to indicate success
      return true
    }

    return false
  } catch (error) {
    console.error("Error adding tag to bookmark in localStorage:", error)
    return false
  }
}

// Save bookmark order
export const saveBookmarkOrder = (bookmarkIds: string[], userId: string): void => {
  if (typeof window === "undefined") throw new Error("Cannot access localStorage on the server")

  try {
    const orderKey = `${BOOKMARK_ORDER_KEY}_${userId}`
    const stringIds = bookmarkIds.map(ensureStringId)
    localStorage.setItem(orderKey, JSON.stringify(stringIds))
  } catch (error) {
    console.error("Error saving bookmark order to localStorage:", error)
    throw new Error("Failed to save bookmark order")
  }
}

// Add a new function to get a single bookmark by ID
export const getBookmarkById = (id: string, userId: string): Bookmark | null => {
  if (typeof window === "undefined") return null

  try {
    const storedData = localStorage.getItem(BOOKMARKS_KEY)
    if (!storedData) return null

    const allBookmarks: Bookmark[] = JSON.parse(storedData)
    return allBookmarks.find((bookmark) => bookmark.id === id && bookmark.user_id === userId) || null
  } catch (error) {
    console.error("Error getting bookmark from localStorage:", error)
    return null
  }
}
