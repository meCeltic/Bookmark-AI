"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { Card, CardContent, CardFooter, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import type { Bookmark } from "@/lib/types"
import { ExternalLink, Trash2, Tag, Globe, GripVertical } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { addTagToBookmark } from "@/lib/local-storage"
import { getDomainFromUrl } from "@/lib/url-utils"

interface BookmarkCardProps {
  bookmark: Bookmark
  onDelete: () => void
  userId: string
  onTagAdded?: () => void
}

export default function BookmarkCard({ bookmark, onDelete, userId, onTagAdded }: BookmarkCardProps) {
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [newTag, setNewTag] = useState("")
  const [tags, setTags] = useState<string[]>(bookmark.tags || [])
  const [faviconError, setFaviconError] = useState(false)
  const [faviconUrl, setFaviconUrl] = useState<string | null>(bookmark.favicon)

  // Validate favicon URL when component mounts
  useEffect(() => {
    if (bookmark.favicon) {
      try {
        // Test if it's a valid URL by creating a URL object
        new URL(bookmark.favicon)
        setFaviconUrl(bookmark.favicon)
      } catch (e) {
        console.error("Invalid favicon URL:", bookmark.favicon)
        setFaviconUrl(null)
        setFaviconError(true)
      }
    } else {
      setFaviconUrl(null)
    }
  }, [bookmark.favicon])

  const handleAddTag = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newTag.trim()) return

    try {
      if (addTagToBookmark(bookmark.id, newTag.trim(), userId)) {
        // Update local state
        const updatedTags = [...tags, newTag.trim()]
        setTags(updatedTags)

        // Update the bookmark object directly
        bookmark.tags = updatedTags

        setNewTag("")

        // Notify parent component that a tag was added
        if (onTagAdded) {
          onTagAdded()
        }
      }
    } catch (err) {
      console.error("Error adding tag:", err)
    }
  }

  // Safely get the hostname from the URL
  const getHostname = () => {
    try {
      return new URL(bookmark.url).hostname
    } catch (e) {
      return getDomainFromUrl(bookmark.url) || bookmark.url
    }
  }

  return (
    <Card className="glass-effect border-gray-300 dark:border-gray-700 transition-smooth hover-lift w-full h-full flex flex-col bg-white dark:bg-gray-800">
      <CardHeader className="flex flex-row items-start gap-4 space-y-0 border-b border-gray-200 dark:border-gray-700 pb-3">
        {faviconUrl && !faviconError ? (
          <img
            src={faviconUrl || "/placeholder.svg"}
            alt=""
            className="h-6 w-6 rounded-full flex-shrink-0"
            onError={() => setFaviconError(true)}
          />
        ) : (
          <div className="h-6 w-6 flex items-center justify-center bg-gray-100 dark:bg-gray-700 rounded-full flex-shrink-0">
            <Globe className="h-4 w-4 text-gray-500 dark:text-gray-400" />
          </div>
        )}
        <div className="flex-1 min-w-0 space-y-1">
          <CardTitle className="text-lg font-semibold text-gray-800 dark:text-white line-clamp-2">
            {bookmark.title || "Loading..."}
          </CardTitle>
          <CardDescription className="text-gray-600 dark:text-gray-400">
            <a
              href={bookmark.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs hover:underline flex items-center truncate"
            >
              <span className="truncate">{getHostname()}</span>
              <ExternalLink className="ml-1 h-3 w-3 flex-shrink-0" />
            </a>
          </CardDescription>
        </div>
      </CardHeader>
      
      <CardContent className="flex-1 pt-4 pb-4 space-y-4 min-h-0">
        <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-3 overflow-hidden">
          {bookmark.summary || "No summary available"}
        </p>
        <div className="flex flex-wrap gap-2 min-h-[24px]">
          {tags.map((tag) => (
            <Badge
              key={tag}
              variant="secondary"
              className="bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-600 text-xs"
            >
              {tag}
            </Badge>
          ))}
        </div>
      </CardContent>
      
      <CardFooter className="flex justify-between border-t border-gray-200 dark:border-gray-700 pt-4 mt-auto">
        <Dialog>
          <DialogTrigger asChild>
            <Button 
              variant="outline" 
              size="sm" 
              className="bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600"
            >
              <Tag className="mr-2 h-4 w-4" />
              Add Tag
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-white dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-700">
            <DialogHeader className="border-b border-gray-200 dark:border-gray-700 pb-2">
              <DialogTitle className="text-gray-800 dark:text-white">Add Tag</DialogTitle>
              <DialogDescription className="text-gray-600 dark:text-gray-400">
                Add a new tag to this bookmark.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleAddTag}>
              <Input
                value={newTag}
                onChange={(e) => setNewTag(e.target.value)}
                placeholder="Enter tag name"
                className="my-4 bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-800 dark:text-gray-200"
              />
              <DialogFooter className="border-t border-gray-200 dark:border-gray-700 pt-2">
                <Button type="submit" className="bg-indigo-500 hover:bg-indigo-600 text-white">
                  Add Tag
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
          <DialogTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className="text-red-500 hover:text-red-700 bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 hover:bg-red-50 dark:hover:bg-red-900/20"
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Delete
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-white dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-700">
            <DialogHeader className="border-b border-gray-200 dark:border-gray-700 pb-2">
              <DialogTitle className="text-gray-800 dark:text-white">Delete Bookmark</DialogTitle>
              <DialogDescription className="text-gray-600 dark:text-gray-400">
                Are you sure you want to delete this bookmark? This action cannot be undone.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="border-t border-gray-200 dark:border-gray-700 pt-4">
              <Button
                variant="outline"
                onClick={() => setShowDeleteDialog(false)}
                className="bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300"
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={() => {
                  onDelete()
                  setShowDeleteDialog(false)
                }}
                className="bg-red-500 hover:bg-red-600 text-white"
              >
                Delete
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardFooter>
    </Card>
  )
}