"use client"

import { useMemo, useState } from "react"
import type { Bookmark } from "@/lib/domain/bookmark"
import { cn } from "@/lib/utils"
import { IndexCard } from "./index-card"
import { EmptyDrawer, EmptyView, NoMatch } from "./empty-state"
import { useDashboard } from "./provider"
import { useKeyboard } from "./keyboard"

const VIEW_EMPTY: Record<string, string> = {
  unsorted: "Everything is filed.",
  favourites: "No favourites yet. Press f on a card.",
  reading: "Reading list is clear.",
  archive: "Nothing archived.",
}

export function BookmarkGrid() {
  const api = useDashboard()
  const { state, visible, hits } = api
  const [rawFocusId, setFocusId] = useState<string | null>(null)

  const items: Bookmark[] = useMemo(() => (hits ? hits.map((h) => h.bookmark) : visible), [hits, visible])

  const focusId = rawFocusId && items.some((b) => b.id === rawFocusId) ? rawFocusId : null

  useKeyboard({ items, focusId, setFocusId })

  if (state.bookmarks.length === 0) return <EmptyDrawer />
  if (items.length === 0) {
    if (hits) return <NoMatch query={state.query} />
    const label =
      state.tags.length || state.healthFilter
        ? "No card matches these filters."
        : state.view.kind === "collection"
          ? "This collection is empty. Paste a link to file one here."
          : VIEW_EMPTY[state.view.view] ?? "Nothing here."
    return <EmptyView label={label} />
  }

  return (
    <ul
      className={cn(
        state.layout === "grid"
          ? "grid grid-cols-1 items-start gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4"
          : "card overflow-hidden",
      )}
    >
      {items.map((b, i) => (
        <IndexCard
          key={b.id}
          bookmark={b}
          index={i}
          layout={state.layout}
          focused={focusId === b.id}
          pending={state.pending.has(b.id)}
          selected={state.selected.has(b.id)}
          onFocus={() => setFocusId(b.id)}
        />
      ))}
    </ul>
  )
}
