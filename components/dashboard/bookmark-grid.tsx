"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import type { Bookmark } from "@/lib/domain/bookmark"
import { cn } from "@/lib/utils"
import { IndexCard } from "./index-card"
import { EmptyDrawer, EmptyView, NoMatch } from "./empty-state"
import { useDashboard } from "./provider"
import { useKeyboard } from "./keyboard"

const VIEW_EMPTY: Record<string, string> = {
  all: "Inbox zero. Paste a link to save the next one.",
  favourites: "Nothing starred yet. Press f on a card.",
  archive: "Nothing archived. Press d on a card when you are done with it.",
}

/** Only this many cards get a view-transition-name; more costs frames for nothing visible. */
const TRANSITION_CAP = 40
const FLASH_MS = 1200

type RevealDetail = string | { id: string; flash?: boolean }

export function BookmarkGrid() {
  const api = useDashboard()
  const { state, visible, hits } = api
  const [rawFocusId, setFocusId] = useState<string | null>(null)
  const [flashId, setFlashId] = useState<string | null>(null)

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

  // A duplicate save, a palette hit or j/k past the slice: scroll to the card and focus it.
  const flashTimer = useRef<number | undefined>(undefined)
  useEffect(() => {
    const onReveal = (e: Event) => {
      const detail = (e as CustomEvent<RevealDetail>).detail
      const { id, flash } = typeof detail === "string" ? { id: detail, flash: false } : detail
      const at = items.findIndex((b) => b.id === id)
      if (at >= limit) setLimit(at + PAGE)
      setFocusId(id)
      if (flash) {
        setFlashId(id)
        window.clearTimeout(flashTimer.current)
        flashTimer.current = window.setTimeout(() => setFlashId(null), FLASH_MS)
      }
      // Wait a frame (two, if the view just changed) for the card to exist.
      requestAnimationFrame(() =>
        requestAnimationFrame(() => document.querySelector<HTMLElement>(`[data-id="${id}"]`)?.scrollIntoView({ block: "center" })),
      )
    }
    window.addEventListener("bookmark-ai:reveal", onReveal)
    return () => window.removeEventListener("bookmark-ai:reveal", onReveal)
  }, [items, limit])
  useEffect(() => () => window.clearTimeout(flashTimer.current), [])

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

  const grid = state.layout === "grid"

  return (
    <ul
      className={cn(
        "min-w-0",
        grid ? "grid grid-cols-1 items-start gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4" : "-mx-2 flex flex-col sm:-mx-3",
      )}
    >
      {items.slice(0, limit).map((b, i) => (
        <IndexCard
          key={b.id}
          bookmark={b}
          layout={state.layout}
          focused={focusId === b.id}
          pending={state.pending.has(b.id)}
          selected={state.selected.has(b.id)}
          fresh={state.fresh.has(b.urlNormalized)}
          flash={flashId === b.id}
          transitionName={i < TRANSITION_CAP ? `card-${b.id}` : undefined}
          onFocus={() => setFocusId(b.id)}
          titleRanges={titleRanges.get(b.id)}
        />
      ))}
      {limit < items.length ? (
        <li ref={sentinel} className="col-span-full py-6 text-center text-[13px] text-ink-3">
          {items.length - limit} more…
        </li>
      ) : null}
    </ul>
  )
}
