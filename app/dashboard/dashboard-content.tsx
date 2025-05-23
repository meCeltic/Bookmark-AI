"use client"

import type React from "react"
import { useState, useEffect, useRef, useMemo } from "react"
import Link from "next/link"
import type { User } from "@supabase/supabase-js"
import { useRouter } from "next/navigation"
import { DragDropContext, Droppable, Draggable } from "react-beautiful-dnd"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import type { Bookmark } from "@/lib/types"
import BookmarkCard from "@/components/bookmark-card"
import { Plus, LogOut, Sun, Moon } from "lucide-react"
import { createClient } from "@/lib/supabase"
import { getBookmarks, addBookmark, deleteBookmark, saveBookmarkOrder } from "@/lib/local-storage"
import { normalizeUrl } from "@/lib/url-utils"

// Workaround for react-beautiful-dnd in React 18
const isBrowser = typeof window !== "undefined"

interface DashboardContentProps {
  user: User
}

export default function DashboardContent({ user }: DashboardContentProps) {
  const [url, setUrl] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([])
  const [filter, setFilter] = useState("")
  const [darkMode, setDarkMode] = useState(true)
  const [isDragEnabled, setIsDragEnabled] = useState(true)
  const [isHydrated, setIsHydrated] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  // Hydration effect - ensures client-side rendering matches server-side
  useEffect(() => {
    setIsHydrated(true)
  }, [])

  // Load bookmarks and dark mode preference on component mount
  useEffect(() => {
    if (!isBrowser || !isHydrated) return;

    try {
      setIsDragEnabled(false);
      const loadedBookmarks = getBookmarks(user.id);
      
      // Ensure all bookmarks have string IDs
      const validatedBookmarks = loadedBookmarks.map(bookmark => ({
        ...bookmark,
        id: String(bookmark.id)
      }));

      setBookmarks(validatedBookmarks);
      
      // Load dark mode preference
      const savedDarkMode = localStorage.getItem("darkMode")
      const isDarkMode = savedDarkMode === null ? true : savedDarkMode === "true"
      setDarkMode(isDarkMode)

      // Apply dark mode class
      if (isDarkMode) {
        document.documentElement.classList.add("dark")
      } else {
        document.documentElement.classList.remove("dark")
      }

      // Save default dark mode preference if not set
      if (savedDarkMode === null) {
        localStorage.setItem("darkMode", "true")
      }

      // Enable drag after everything is loaded and validated
      const timer = setTimeout(() => {
        setIsDragEnabled(true);
      }, 50);

      return () => clearTimeout(timer);
    } catch (error) {
      console.error('Error loading bookmarks:', error);
      setBookmarks([]);
      setIsDragEnabled(false);
    }
  }, [user.id, isHydrated]);

  const handleAddBookmark = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    if (!url.trim()) {
      setError("Please enter a URL")
      setLoading(false)
      return
    }

    try {
      const normalizedUrl = normalizeUrl(url.trim())
      let parsedUrl: URL
      try {
        parsedUrl = new URL(normalizedUrl)
      } catch (e) {
        throw new Error("Invalid URL. Please enter a valid website address.")
      }

      let title = parsedUrl.hostname
      let favicon = null
      let summary = `Bookmark from ${parsedUrl.hostname}. No summary available.`

      try {
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), 10000)

        const response = await fetch("/api/metadata", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: normalizedUrl }),
          signal: controller.signal,
        })

        clearTimeout(timeoutId)

        if (response.ok) {
          const data = await response.json()
          if (data.title) title = data.title
          if (data.favicon) favicon = data.favicon
          if (data.summary) summary = data.summary
        }
      } catch (error) {
        console.warn("Error fetching metadata, using default values:", error)
      }

      const newBookmark = addBookmark({
        url: normalizedUrl,
        title,
        favicon,
        summary,
        user_id: user.id,
        tags: [],
        created_at: new Date().toISOString(),
      })

      setBookmarks([newBookmark, ...bookmarks])
      setUrl("")
    } catch (err: any) {
      console.error("Error adding bookmark:", err)
      setError(err.message || "Failed to add bookmark. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteBookmark = (id: string) => {
    try {
      setIsDragEnabled(false)
      if (deleteBookmark(id, user.id)) {
        setBookmarks(bookmarks.filter((bookmark) => bookmark.id !== id))
      }
      setTimeout(() => setIsDragEnabled(true), 100)
    } catch (err) {
      console.error("Error deleting bookmark:", err)
    }
  }

  const handleTagAdded = (bookmarkId: string) => {
    const updatedBookmarks = getBookmarks(user.id)
    setBookmarks(updatedBookmarks)
  }

  const handleSignOut = async () => {
    try {
      console.log("Signing out..."); // Debugging log
      const { error } = await supabase.auth.signOut();
      if (error) {
        console.error("Error during sign out:", error);
        return;
      }
      console.log("Sign out successful");
      await router.push("/login"); // Redirect to login page
      router.refresh();
    } catch (error) {
      console.error("Unexpected error during sign out:", error);
    }
  };

  const handleDragEnd = (result: any) => {
    if (!result.destination || result.destination.index === result.source.index) {
      return;
    }

    try {
      const items = Array.from(bookmarks).map(bookmark => ({
        ...bookmark,
        id: String(bookmark.id)
      }));
      
      const [reorderedItem] = items.splice(result.source.index, 1);
      items.splice(result.destination.index, 0, reorderedItem);

      setBookmarks(items);

      // Save the new order to localStorage
      const bookmarkIds = items.map(bookmark => String(bookmark.id));
      saveBookmarkOrder(bookmarkIds, user.id);
    } catch (error) {
      console.error('Error during drag end:', error);
      // Reset the state to ensure consistency
      const loadedBookmarks = getBookmarks(user.id);
      setBookmarks(loadedBookmarks.map(bookmark => ({
        ...bookmark,
        id: String(bookmark.id)
      })));
    }
  }

  const toggleDarkMode = () => {
    const newDarkMode = !darkMode
    setDarkMode(newDarkMode)
    
    // Update localStorage
    localStorage.setItem("darkMode", newDarkMode.toString())
    
    // Apply dark mode class immediately
    if (newDarkMode) {
      document.documentElement.classList.add("dark")
    } else {
      document.documentElement.classList.remove("dark")
    }
  }

  const filteredBookmarks = useMemo(
    () =>
      bookmarks.filter((bookmark) => {
        if (!filter) return true
        const searchTerm = filter.toLowerCase()
        return (
          bookmark.title?.toLowerCase().includes(searchTerm) ||
          bookmark.url.toLowerCase().includes(searchTerm) ||
          bookmark.summary?.toLowerCase().includes(searchTerm) ||
          bookmark.tags?.some((tag) => tag.toLowerCase().includes(searchTerm))
        )
      }),
    [bookmarks, filter],
  )

  const renderDraggableBookmarks = () => {
    // Always use draggable layout, even when filtering
    return (
      <DragDropContext onDragEnd={handleDragEnd}>
        <Droppable
          droppableId="bookmarks"
          direction="vertical"
          isDropDisabled={!isDragEnabled}
          isCombineEnabled={false}
        >
          {(provided) => (
            <div
              {...provided.droppableProps}
              ref={provided.innerRef}
              className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3"
            >
              {filteredBookmarks.map((bookmark, index) => {
                const draggableId = String(bookmark.id);
                
                return (
                  <Draggable
                    key={draggableId}
                    draggableId={draggableId}
                    index={index}
                    isDragDisabled={!isDragEnabled}
                  >
                    {(provided, snapshot) => (
                      <div
                        ref={provided.innerRef}
                        {...provided.draggableProps}
                        {...provided.dragHandleProps}
                        className={`touch-manipulation h-[300px] w-full transition-smooth hover-lift ${
                          snapshot.isDragging ? "z-50 shadow-2xl scale-105" : ""
                        } ${!isDragEnabled ? "cursor-default" : "cursor-grab active:cursor-grabbing"}`}
                        style={provided.draggableProps.style}
                      >
                        <BookmarkCard
                          bookmark={{ ...bookmark, id: draggableId }}
                          onDelete={() => handleDeleteBookmark(draggableId)}
                          userId={user.id}
                          onTagAdded={() => handleTagAdded(draggableId)}
                        />
                      </div>
                    )}
                  </Draggable>
                );
              })}
              {provided.placeholder}
            </div>
          )}
        </Droppable>
      </DragDropContext>
    )
  }

  // Don't render until hydrated to prevent hydration mismatches
  if (!isHydrated) {
    return null;
  }

  return (
    <div className="min-h-screen bg-white dark:bg-gradient-to-br dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 transition-colors duration-200">
      <div className="absolute inset-0 bg-[url('/grid.svg')] bg-center [mask-image:linear-gradient(180deg,white,rgba(255,255,255,0))] dark:block hidden"></div>
      <div className="absolute inset-0 bg-[url('/grid.svg')] bg-center [mask-image:linear-gradient(180deg,black,rgba(0,0,0,0))] dark:hidden block opacity-10"></div>

      <div className="relative container mx-auto px-4 py-8">
        <div className="flex flex-col sm:flex-row justify-between items-center mb-8 space-y-4 sm:space-y-0 animate-fade-in">
          <div className="flex items-center space-x-4">
            <h1 className="text-3xl font-bold gradient-text text-gray-800 dark:text-white">My Bookmarks</h1>
            <div className="flex items-center space-x-2">
              <Switch
                id="drag-switch"
                checked={isDragEnabled}
                onCheckedChange={setIsDragEnabled}
                className="data-[state=checked]:bg-indigo-500 transition-colors duration-200"
              />
              <Label htmlFor="drag-switch" className="text-gray-600 dark:text-gray-300">
                Reorder Mode
              </Label>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              onClick={toggleDarkMode}
              className="glass-effect text-gray-600 dark:text-gray-300 hover:text-gray-800 dark:hover:text-white transition-smooth hover-lift border-gray-300 dark:border-gray-700"
            >
              {darkMode ? <Sun className="h-4 w-4 mr-2" /> : <Moon className="h-4 w-4 mr-2" />}
              {darkMode ? "Light Mode" : "Dark Mode"}
            </Button>

            <Button
              variant="outline"
              onClick={() => handleSignOut()}
              className="glass-effect text-gray-600 dark:text-gray-300 hover:text-gray-800 dark:hover:text-white transition-smooth hover-lift border-gray-300 dark:border-gray-700"
            >
              <LogOut className="h-4 w-4 mr-2" />
              Sign Out
            </Button>
          </div>
        </div>

        <form onSubmit={handleAddBookmark} className="flex flex-col sm:flex-row gap-4 mb-8 animate-slide-up">
          <Input
            type="url"
            placeholder="Enter URL to bookmark..."
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            className="flex-1 glass-effect border-gray-300 dark:border-gray-700 text-gray-800 dark:text-gray-300 placeholder-gray-400 dark:placeholder-gray-500 focus:border-indigo-500 transition-smooth bg-white dark:bg-gray-800"
          />
          <Button
            type="submit"
            disabled={loading}
            className="bg-gradient-to-r from-indigo-500 to-purple-500 transition-smooth hover-lift"
          >
            {loading ? (
              <div className="flex items-center">
                <div className="animate-spin mr-2 h-4 w-4 border-2 border-white border-t-transparent rounded-full"></div>
                Adding...
              </div>
            ) : (
              <>
                <Plus className="h-4 w-4 mr-2" />
                Add Bookmark
              </>
            )}
          </Button>
        </form>

        <div className="space-y-4 animate-fade-in">
          {error && (
            <Alert variant="destructive" className="animate-fade-in">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <Input
            type="text"
            placeholder="Filter bookmarks..."
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="w-full glass-effect border-gray-300 dark:border-gray-700 text-gray-800 dark:text-gray-300 placeholder-gray-400 dark:placeholder-gray-500 focus:border-indigo-500 transition-smooth bg-white dark:bg-gray-800"
          />

          {isHydrated && isBrowser && renderDraggableBookmarks()}
        </div>
      </div>
    </div>
  );
}