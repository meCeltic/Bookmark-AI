"use client"

import { Fragment, useEffect, useMemo, useRef, useState } from "react"
import { ChevronRight } from "lucide-react"
import type { Bookmark } from "@/lib/domain/bookmark"
import { canonicalKey, domainOf, normalizeUrl } from "@/lib/url/normalize"
import { cn, formatDate } from "@/lib/utils"
import { useKeyNav } from "@/lib/client/use-key-nav"
import { Favicon } from "@/components/favicon"
import { IndexCard } from "./index-card"
import { EmptyDrawer, EmptyView, NoMatch } from "./empty-state"
import { useDashboard } from "./provider"
import { useKeyboard } from "./keyboard"

const VIEW_EMPTY: Record<string, string> = {
  all: "Inbox zero.",
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
  const { attach: attachKeyNav, isKeys } = useKeyNav<HTMLUListElement>()

  // The Inbox is a to-read list: unread first (plus the ones read during this visit, which
  // stay put), then the rest folded into one line. Search ignores the fold.
  const inbox = !hits && state.view.kind === "view" && state.view.view === "all" && !state.healthFilter
  const { toRead, read } = useMemo(() => {
    if (!inbox) return { toRead: visible, read: [] as Bookmark[] }
    const keep = (b: Bookmark) => b.readAt === null || state.held.has(b.id)
    return { toRead: visible.filter(keep), read: visible.filter((b) => !keep(b)) }
  }, [visible, inbox, state.held])
  const items: Bookmark[] = useMemo(() => {
    if (hits) return hits.map((h) => h.bookmark)
    return state.readOpen ? [...toRead, ...read] : toRead
  }, [hits, toRead, read, state.readOpen])
  // Title ranges from the ranker, so fuzzy hits are highlighted where they matched.
  const titleRanges = useMemo(() => {
    const map = new Map<string, [number, number][]>()
    for (const h of hits ?? []) {
      const ranges = h.matches.filter((m) => m.key === "title").flatMap((m) => m.indices)
      if (ranges.length) map.set(h.bookmark.id, ranges)
    }
    return map
  }, [hits])

  // View transition names go to the first 40 cards, and to the ones that were in the first 40
  // a moment ago: a card pushed to 41st by a save still slides instead of shrinking mid-way.
  const top = items.slice(0, TRANSITION_CAP).map((b) => b.id).join(" ")
  const [named, setNamed] = useState({ prev: "", cur: "" })
  if (named.cur !== top) setNamed({ prev: named.cur, cur: top })
  const namedIds = useMemo(() => new Set(`${named.prev} ${named.cur}`.split(" ").filter(Boolean)), [named])

  const focusId = rawFocusId && items.some((b) => b.id === rawFocusId) ? rawFocusId : null

  useKeyboard({ items, focusId, setFocusId })

  const preview = (id: string) => {
    setFocusId(id)
    api.setPreview(id)
  }

  // The pane's Done moves on to the next card, as `d` does.
  useEffect(() => {
    const onAdvance = (e: Event) => {
      const id = (e as CustomEvent<string>).detail
      const at = items.findIndex((b) => b.id === id)
      const next = items[at + 1] ?? items[at - 1]
      if (at === -1 || !next) {
        api.setPreview(null)
        return
      }
      setFocusId(next.id)
      api.setPreview(next.id)
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
      // A read card hides in the fold: open it first.
      if (inbox && !state.readOpen && read.some((b) => b.id === id)) api.dispatch({ type: "readOpen", open: true })
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
  }, [items, limit, inbox, read, state.readOpen, api])
  useEffect(() => () => window.clearTimeout(flashTimer.current), [])

  if (state.omniUrl) return <SaveRow url={state.omniUrl} />
  if (state.bookmarks.length === 0) return <EmptyDrawer />
  const folded = inbox && read.length > 0
  if (items.length === 0 && !folded) {
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
  const foldRow = folded ? (
    <li
      key="fold"
      style={{ viewTransitionName: "read-fold" }}
      className={cn("col-span-full flex items-center gap-3 text-[13px] text-ink-3", grid ? "pt-2" : "px-2 pb-1 pt-4 sm:px-3")}
    >
      <button
        type="button"
        className="inline-flex h-7 items-center gap-1 rounded-[6px] font-medium text-ink-2 hover:text-ink"
        aria-expanded={state.readOpen}
        onClick={() => api.setReadOpen(!state.readOpen)}
      >
        {read.length} read
        <ChevronRight size={14} aria-hidden className={cn("transition-transform duration-[140ms]", state.readOpen && "rotate-90")} />
      </button>
      <span aria-hidden>·</span>
      <button type="button" className="h-7 hover:text-ink hover:underline" onClick={() => void api.done(read.map((b) => b.id))}>
        Mark all done
      </button>
      <span aria-hidden className="h-px flex-1 bg-line" />
    </li>
  ) : null

  return (
    <ul
      ref={attachKeyNav}
      className={cn(
        "cards min-w-0",
        grid ? "grid grid-cols-1 items-start gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4" : "-mx-2 flex max-w-[1040px] flex-col sm:-mx-3",
      )}
    >
      {inbox && toRead.length === 0 ? (
        <li className={cn("col-span-full text-[15px] text-ink-2", grid ? "" : "px-2 py-2 sm:px-3")}>Nothing left to read.</li>
      ) : null}
      {items.slice(0, limit).map((b, i) => (
        // Keyed by the URL, which survives the optimistic-to-saved id swap, so a new card never remounts.
        <Fragment key={b.urlNormalized}>
          {folded && i === toRead.length ? foldRow : null}
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
            transitionName={namedIds.has(b.id) ? `card-${b.id}` : undefined}
            onFocus={() => setFocusId(b.id)}
            onHover={() => { if (!isKeys() && focusId !== b.id) setFocusId(b.id) }}
            onPreview={() => preview(b.id)}
            titleRanges={titleRanges.get(b.id)}
          />
        </Fragment>
      ))}
      {folded && items.length <= toRead.length ? foldRow : null}
      {limit < items.length ? (
        <li ref={sentinel} className="col-span-full py-6 text-center text-[13px] text-ink-3">
          {items.length - limit} more…
        </li>
      ) : null}
    </ul>
  )
}

/** A link in the omnibox: the list steps aside for one row that saves it. Enter does the same. */
function SaveRow({ url }: { url: string }) {
  const { state } = useDashboard()
  const normalized = normalizeUrl(url) ?? url
  const existing = state.bookmarks.find((b) => b.urlNormalized === canonicalKey(normalized))
  let shown = domainOf(normalized)
  try {
    const u = new URL(normalized)
    shown = `${u.hostname.replace(/^www\./, "")}${u.pathname === "/" ? "" : u.pathname.replace(/\/$/, "")}${u.search}`
  } catch {
    // domainOf already gave the host.
  }
  const target = state.view.kind === "collection" ? (state.collections.find((c) => c.id === (state.view as { id: string }).id)?.name ?? "Inbox") : "Inbox"
  return (
    <div className="-mx-2 max-w-[1040px] sm:-mx-3">
      <button
        type="submit"
        form="omnibox-form"
        className="row grid w-full min-w-0 cursor-pointer grid-cols-[16px_minmax(0,1fr)] items-center gap-x-3 px-2 py-2 text-left sm:grid-cols-[16px_minmax(0,1fr)_auto] sm:px-3"
        data-focused="true"
      >
        <Favicon url={normalized} src={existing?.faviconUrl ?? null} />
        <span className="flex min-w-0 items-center gap-2 text-[15px]">
          <span className="shrink-0 font-semibold">{existing ? "Show" : "Save"}</span>{" "}
          <span className="min-w-0 truncate font-mono text-[14px] text-ink-2">{shown}</span>
          <span className="kbd shrink-0" aria-hidden>↵</span>
        </span>
        <span className="col-start-2 text-[13px] text-ink-3 sm:col-start-auto">
          {existing ? `Already saved on ${formatDate(existing.createdAt)}` : `Saves to ${target}`}
        </span>
      </button>
    </div>
  )
}
