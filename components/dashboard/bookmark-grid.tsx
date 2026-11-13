"use client"

import { Fragment, useEffect, useMemo, useRef, useState } from "react"
import type { Bookmark } from "@/lib/domain/bookmark"
import { cn } from "@/lib/utils"
import { IndexCard } from "./index-card"
import { EmptyDrawer, EmptyView, NoMatch } from "./empty-state"
import { useDashboard } from "./provider"
import { useKeyboard } from "./keyboard"

const VIEW_EMPTY: Record<string, string> = {
  all: "Inbox zero. Paste a link to save the next one.",
  favourites: "Nothing starred yet. Press f on a card.",
  archive: "Nothing done yet. Press d on a card when you have read it.",
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

  // The Inbox reads top-down: unread first, then the ones already read.
  const inbox = !hits && state.view.kind === "view" && state.view.view === "all"
  const items: Bookmark[] = useMemo(() => {
    if (hits) return hits.map((h) => h.bookmark)
    if (!inbox) return visible
    return [...visible.filter((b) => b.readAt === null), ...visible.filter((b) => b.readAt !== null)]
  }, [hits, visible, inbox])
  const firstRead = inbox ? items.findIndex((b) => b.readAt !== null) : -1
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

  const preview = (id: string) => {
    setFocusId(id)
    api.dispatch({ type: "preview", id })
  }

  // The pane's Done moves on to the next card, as `d` does.
  useEffect(() => {
    const onAdvance = (e: Event) => {
      const id = (e as CustomEvent<string>).detail
      const at = items.findIndex((b) => b.id === id)
      const next = items[at + 1] ?? items[at - 1]
      if (at === -1 || !next) {
        api.dispatch({ type: "preview", id: null })
        return
      }
      setFocusId(next.id)
      api.dispatch({ type: "preview", id: next.id })
    }
    window.addEventListener("bookmark-ai:advance", onAdvance)
    return () => window.removeEventListener("bookmark-ai:advance", onAdvance)
  }, [items, api])

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
        grid ? "grid grid-cols-1 items-start gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4" : "-mx-2 flex max-w-[1040px] flex-col sm:-mx-3",
      )}
    >
      {items.slice(0, limit).map((b, i) => (
        // Keyed by the URL, which survives the optimistic-to-saved id swap, so a new card never remounts.
        <Fragment key={b.urlNormalized}>
          {i === firstRead && i > 0 ? (
            <li role="separator" aria-label="Read" style={{ viewTransitionName: "read-divider" }} className={cn("col-span-full flex items-center gap-3 text-[13px] text-ink-3", grid ? "pt-3" : "px-2 pb-1 pt-4 sm:px-3")}>
              <span>Read</span>
              <span aria-hidden className="h-px flex-1 bg-line" />
            </li>
          ) : null}
          <IndexCard
            bookmark={b}
            layout={state.layout}
            index={i}
            focused={focusId === b.id}
            pending={state.pending.has(b.id)}
            selected={state.selected.has(b.id)}
            previewed={state.preview === b.id}
            fresh={state.fresh.has(b.urlNormalized)}
            flash={flashId === b.id}
            transitionName={i < TRANSITION_CAP ? `card-${b.id}` : undefined}
            onFocus={() => setFocusId(b.id)}
            onPreview={() => preview(b.id)}
            titleRanges={titleRanges.get(b.id)}
          />
        </Fragment>
      ))}
      {limit < items.length ? (
        <li ref={sentinel} className="col-span-full py-6 text-center text-[13px] text-ink-3">
          {items.length - limit} more…
        </li>
      ) : null}
    </ul>
  )
}
