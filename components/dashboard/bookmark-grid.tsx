"use client"

import { useEffect, useMemo, useRef, useState } from "react"
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
  // Title ranges from the ranker, so fuzzy hits are highlighted where they matched.
  const titleRanges = useMemo(() => {
    const map = new Map<string, [number, number][]>()
    for (const h of hits ?? []) {
      const ranges = h.matches.filter((m) => m.key === "title").flatMap((m) => m.indices)
      if (ranges.length) map.set(h.bookmark.id, ranges)
    }
    return map
  }, [hits])

  const focusId = rawFocusId && items.some((b) => b.id === rawFocusId) ? rawFocusId : null

  useKeyboard({ items, focusId, setFocusId })

  // Large drawers render in slices; a sentinel at the bottom asks for the next slice.
  const PAGE = 90
  const [limit, setLimit] = useState(PAGE)
  const sentinel = useRef<HTMLLIElement>(null)
  useEffect(() => {
    const el = sentinel.current
    if (!el || limit >= items.length) return
    const io = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) setLimit((l) => l + PAGE)
    })
    io.observe(el)
    return () => io.disconnect()
  }, [limit, items.length])

  // "Show" on a duplicate toast, or a palette hit: scroll to the card and focus it.
  useEffect(() => {
    const onReveal = (e: Event) => {
      const id = (e as CustomEvent<string>).detail
      const at = items.findIndex((b) => b.id === id)
      if (at >= limit) setLimit(at + PAGE)
      setFocusId(id)
      requestAnimationFrame(() => document.querySelector<HTMLElement>(`[data-id="${id}"]`)?.scrollIntoView({ block: "center" }))
    }
    window.addEventListener("bookmark-ai:reveal", onReveal)
    return () => window.removeEventListener("bookmark-ai:reveal", onReveal)
  }, [items, limit])

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
      {items.slice(0, limit).map((b, i) => (
        <IndexCard
          key={b.id}
          bookmark={b}
          index={i}
          layout={state.layout}
          focused={focusId === b.id}
          pending={state.pending.has(b.id)}
          selected={state.selected.has(b.id)}
          onFocus={() => setFocusId(b.id)}
          titleRanges={titleRanges.get(b.id)}
        />
      ))}
      {limit < items.length ? (
        <li ref={sentinel} className="col-span-full py-6 text-center font-mono text-[11.5px] text-ink-3">
          {items.length - limit} more…
        </li>
      ) : null}
    </ul>
  )
}
