"use client"

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  type ReactNode,
} from "react"
import { toast } from "sonner"
import {
  tagSchema,
  type Bookmark,
  type BookmarkPatch,
  type Collection,
  type NewBookmark,
  type SortOrder,
  type ViewSelection,
} from "@/lib/domain/bookmark"
import type { BookmarkRepository, RepositoryMode } from "@/lib/repo/types"
import { materialize } from "@/lib/repo/shared"
import { requestEnrichment, requestHealth } from "@/lib/client/enrich"
import { readFlag, readPrefs, writeFlag, writePrefs, type Layout } from "@/lib/client/prefs"
import { applyFilter, tagCounts, viewCounts, collectionCounts, isUnread, matchesView } from "@/lib/search/filter"
import { createLandingQueue, withTransition } from "@/lib/client/transition"
import { createSearchIndex, searchBookmarks, type SearchHit } from "@/lib/search/rank"
import { normalizeUrl, canonicalKey, domainOf } from "@/lib/url/normalize"
import type { ImportedBookmark } from "@/lib/import/netscape"
import { dedupeImports } from "@/lib/import/netscape"
import { undoToast } from "./undo-toast"

/**
 * One state tree for the whole dashboard. Mutations are optimistic: the
 * reducer applies them immediately, the repository confirms or we roll back.
 */

interface State {
  bookmarks: Bookmark[]
  collections: Collection[]
  /** Cards still being read (metadata in flight). Keyed by bookmark id. */
  pending: Set<string>
  selected: Set<string>
  view: ViewSelection
  tags: string[]
  query: string
  sort: SortOrder
  layout: Layout
  healthFilter: "dead" | null
  /** urlNormalized of cards saved moments ago; only these play the entrance animation. */
  fresh: Set<string>
  /** Bumped by changes the user caused (not hydration), so counters know when to roll. */
  rev: number
  /** The card shown in the preview pane, if open. */
  preview: string | null
  /**
   * Inbox cards read during this visit. They keep their place among the unread
   * until the view changes or the page reloads, then join the folded Read group.
   */
  held: Set<string>
  /** Inbox: the Read group is unfolded (remembered in prefs). */
  readOpen: boolean
  /** The link typed into the omnibox, when it holds one: the list becomes a Save row. */
  omniUrl: string | null
}

type Action =
  | { type: "hydrate"; bookmarks: Bookmark[]; collections: Collection[] }
  | { type: "upsert"; bookmark: Bookmark }
  | { type: "upsertMany"; bookmarks: Bookmark[] }
  | { type: "remove"; ids: string[] }
  | { type: "pending"; id: string; on: boolean }
  | { type: "collections"; collections: Collection[] }
  | { type: "select"; ids: string[]; mode: "set" | "toggle" | "add" }
  | { type: "view"; view: ViewSelection }
  | { type: "tags"; tags: string[] }
  | { type: "query"; query: string }
  | { type: "sort"; sort: SortOrder }
  | { type: "layout"; layout: Layout }
  | { type: "healthFilter"; value: "dead" | null }
  | { type: "swap"; from: string; bookmark: Bookmark }
  | { type: "fresh"; key: string; on: boolean }
  | { type: "preview"; id: string | null }
  | { type: "readOpen"; open: boolean }
  | { type: "omniUrl"; url: string | null }

/** Cards that just turned read while still in the Inbox stay put until the view changes. */
function holdNewlyRead(state: State, next: Bookmark[]): Set<string> {
  let held = state.held
  for (const b of next) {
    const prev = state.bookmarks.find((x) => x.id === b.id)
    if (prev && prev.readAt === null && b.readAt !== null && !b.archivedAt && !held.has(b.id)) {
      if (held === state.held) held = new Set(held)
      held.add(b.id)
    }
  }
  return held
}

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "hydrate":
      return { ...state, bookmarks: action.bookmarks, collections: action.collections }
    case "upsert": {
      const exists = state.bookmarks.some((b) => b.id === action.bookmark.id)
      return {
        ...state,
        rev: state.rev + 1,
        held: holdNewlyRead(state, [action.bookmark]),
        bookmarks: exists
          ? state.bookmarks.map((b) => (b.id === action.bookmark.id ? action.bookmark : b))
          : [action.bookmark, ...state.bookmarks],
      }
    }
    case "upsertMany": {
      const byId = new Map(action.bookmarks.map((b) => [b.id, b]))
      const merged = state.bookmarks.map((b) => byId.get(b.id) ?? b)
      const fresh = action.bookmarks.filter((b) => !state.bookmarks.some((x) => x.id === b.id))
      return { ...state, rev: state.rev + 1, held: holdNewlyRead(state, action.bookmarks), bookmarks: [...fresh, ...merged] }
    }
    case "remove": {
      const ids = new Set(action.ids)
      const selected = new Set([...state.selected].filter((id) => !ids.has(id)))
      const preview = state.preview && ids.has(state.preview) ? null : state.preview
      return { ...state, rev: state.rev + 1, bookmarks: state.bookmarks.filter((b) => !ids.has(b.id)), selected, preview }
    }
    case "pending": {
      const pending = new Set(state.pending)
      if (action.on) pending.add(action.id)
      else pending.delete(action.id)
      return { ...state, pending }
    }
    case "collections":
      return { ...state, collections: action.collections }
    case "select": {
      if (action.mode === "set") return { ...state, selected: new Set(action.ids) }
      const selected = new Set(state.selected)
      for (const id of action.ids) {
        if (action.mode === "toggle" && selected.has(id)) selected.delete(id)
        else selected.add(id)
      }
      return { ...state, selected }
    }
    case "view":
      return { ...state, view: action.view, selected: new Set(), healthFilter: null, preview: null, held: new Set() }
    case "tags":
      return { ...state, tags: action.tags }
    case "query":
      return { ...state, query: action.query }
    case "sort":
      return { ...state, sort: action.sort }
    case "layout":
      return { ...state, layout: action.layout }
    case "healthFilter":
      return { ...state, healthFilter: action.value }
    case "swap": {
      // Replace the optimistic card in place, so it keeps its slot and its reading state.
      const pending = new Set(state.pending)
      if (pending.delete(action.from)) pending.add(action.bookmark.id)
      return {
        ...state,
        pending,
        preview: state.preview === action.from ? action.bookmark.id : state.preview,
        bookmarks: state.bookmarks.map((b) => (b.id === action.from ? action.bookmark : b)),
      }
    }
    case "fresh": {
      const fresh = new Set(state.fresh)
      if (action.on) fresh.add(action.key)
      else fresh.delete(action.key)
      return { ...state, fresh }
    }
    case "preview":
      return state.preview === action.id ? state : { ...state, preview: action.id }
    case "readOpen":
      return { ...state, readOpen: action.open }
    case "omniUrl":
      return state.omniUrl === action.url ? state : { ...state, omniUrl: action.url }
  }
}

type MoveOpts = { move?: boolean; closePreview?: boolean }

export interface DashboardApi {
  mode: RepositoryMode
  state: State
  /** Bookmarks after view, tag, health and sort filters, before search. */
  visible: Bookmark[]
  /** Search hits when a query is active, else null. */
  hits: SearchHit[] | null
  counts: { views: ReturnType<typeof viewCounts>; collections: Map<string, number>; tags: ReturnType<typeof tagCounts> }
  dispatch: (action: Action) => void
  /** Search hits for the same query in the other drawer (Done, or the Inbox when in Done). */
  elsewhere: { view: "all" | "archive"; count: number } | null
  /** Open, move or close the preview pane; opening and closing slide on wide screens. */
  setPreview: (id: string | null) => void
  /** Fold or unfold the Inbox's Read group. */
  setReadOpen: (open: boolean) => void

  addBookmark: (raw: string, opts?: { collectionId?: string | null }) => Promise<Bookmark | null>
  reEnrich: (id: string) => Promise<void>
  patch: (id: string, patch: BookmarkPatch, opts?: { silent?: boolean }) => Promise<void>
  /** Apply one patch to many cards with an undo toast. `move` runs it as a view transition (cards leave the view). */
  patchMany: (ids: string[], patch: BookmarkPatch, label: string, opts?: MoveOpts) => Promise<void>
  /** Mark read and archive in one step. */
  /** `closePreview`: the pane closes in the same view transition (Done on the last card). */
  done: (ids: string[], opts?: { closePreview?: boolean }) => Promise<void>
  /** Move to Done without marking read, or restore to the Inbox. */
  toggleArchive: (bookmark: Bookmark, opts?: { closePreview?: boolean }) => Promise<void>
  /** Open a random unread card, weighted towards the oldest. */
  readSomething: () => void
  setLayout: (layout: Layout) => void
  remove: (ids: string[]) => Promise<void>
  /** Open the link in a new tab and mark it read. */
  open: (bookmark: Bookmark) => void
  /** Mark a card opened (the link itself opened elsewhere, e.g. a real <a>). */
  markOpened: (bookmark: Bookmark) => void
  addTag: (id: string, tag: string) => Promise<void>
  removeTag: (id: string, tag: string) => Promise<void>
  renameTag: (from: string, to: string) => Promise<void>

  createCollection: (name: string) => Promise<Collection | null>
  renameCollection: (id: string, name: string) => Promise<void>
  deleteCollection: (id: string) => Promise<void>

  importItems: (items: ImportedBookmark[]) => Promise<{ created: number; skipped: number }>
  /** Read every card still marked pending, a few at a time, with a progress toast. */
  readPending: () => Promise<void>
  /** How many cards are still waiting to be read. */
  pendingCount: number
  checkHealth: (ids?: string[]) => Promise<void>
  /** Scroll to a card and give it keyboard focus; `flash` marks it briefly. */
  reveal: (id: string, opts?: { flash?: boolean }) => void
  resetDemo: () => Promise<void>
  reload: () => Promise<void>
}

const DashboardContext = createContext<DashboardApi | null>(null)

export function useDashboard(): DashboardApi {
  const api = useContext(DashboardContext)
  if (!api) throw new Error("useDashboard must be used inside DashboardProvider")
  return api
}

interface ProviderProps {
  mode: RepositoryMode
  repo: BookmarkRepository
  initial: { bookmarks: Bookmark[]; collections: Collection[] }
  /** Demo mode: called when the store is empty to seed it. */
  seed?: (repo: BookmarkRepository) => Promise<void>
  children: ReactNode
}

export function DashboardProvider({ mode, repo, initial, seed, children }: ProviderProps) {
  const [state, dispatch] = useReducer(reducer, undefined, () => ({
    bookmarks: initial.bookmarks,
    collections: initial.collections,
    pending: new Set<string>(),
    selected: new Set<string>(),
    view: { kind: "view", view: "all" } as ViewSelection,
    tags: [],
    query: "",
    sort: "newest" as SortOrder,
    layout: "list" as Layout,
    healthFilter: null,
    fresh: new Set<string>(),
    rev: 0,
    preview: null,
    held: new Set<string>(),
    readOpen: false,
    omniUrl: null,
  }))
  const [hydrated, setHydrated] = useState(mode === "cloud")
  const enrichAborts = useRef(new Map<string, AbortController>())
  // Always the latest bookmarks, for callbacks that resolve after a state change.
  const latest = useRef(state.bookmarks)
  const latestCollections = useRef(state.collections)
  const latestView = useRef(state.view)
  const latestPreview = useRef(state.preview)
  useEffect(() => {
    latest.current = state.bookmarks
    latestCollections.current = state.collections
    latestView.current = state.view
    latestPreview.current = state.preview
  }, [state.bookmarks, state.collections, state.view, state.preview])

  const reload = useCallback(async () => {
    const [bookmarks, collections] = await Promise.all([repo.listBookmarks(), repo.listCollections()])
    dispatch({ type: "hydrate", bookmarks, collections })
  }, [repo])

  // Demo mode reads from localStorage after mount; cloud mode arrives hydrated from the server.
  useEffect(() => {
    const prefs = readPrefs()
    dispatch({ type: "layout", layout: prefs.layout })
    dispatch({ type: "sort", sort: prefs.sort })
    dispatch({ type: "readOpen", open: prefs.readOpen })
    if (mode === "cloud") return
    let cancelled = false
    ;(async () => {
      const existing = await repo.listBookmarks()
      if (existing.length === 0 && seed) await seed(repo)
      if (!cancelled) {
        await reload()
        setHydrated(true)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [mode, repo, seed, reload])

  // ---- derived ------------------------------------------------------------

  const visible = useMemo(
    () =>
      applyFilter(state.bookmarks, {
        view: state.view,
        tags: state.tags,
        health: state.healthFilter,
        sort: state.sort,
      }),
    [state.bookmarks, state.view, state.tags, state.healthFilter, state.sort],
  )

  const index = useMemo(() => createSearchIndex(visible), [visible])
  const hits = useMemo(
    () => (state.query.trim().length >= 2 ? searchBookmarks(index, state.query) : null),
    [index, state.query],
  )

  // While searching, how many hits the other drawer holds, so the heading can point there.
  const elsewhere = useMemo<DashboardApi["elsewhere"]>(() => {
    if (state.query.trim().length < 2) return null
    const other = state.view.kind === "view" && state.view.view === "archive" ? "all" : "archive"
    const pool = applyFilter(state.bookmarks, { view: { kind: "view", view: other }, tags: state.tags, health: null, sort: state.sort })
    return { view: other, count: pool.length ? searchBookmarks(createSearchIndex(pool), state.query).length : 0 }
  }, [state.bookmarks, state.view, state.tags, state.sort, state.query])

  const counts = useMemo(
    () => ({
      views: viewCounts(state.bookmarks),
      collections: collectionCounts(state.bookmarks),
      tags: tagCounts(state.bookmarks),
    }),
    [state.bookmarks],
  )

  // ---- helpers ------------------------------------------------------------

  const applyRemotePatch = useCallback(
    async (id: string, patch: BookmarkPatch, rollback: Bookmark | undefined, silent = false) => {
      const result = await repo.updateBookmark(id, patch)
      if (result.ok) {
        dispatch({ type: "upsert", bookmark: result.data })
      } else {
        if (rollback) dispatch({ type: "upsert", bookmark: rollback })
        if (!silent) toast.error(result.error.message)
      }
    },
    [repo],
  )

  // Summaries that arrive in the same frame land in one View Transition.
  const land = useMemo(() => createLandingQueue(), [])

  const enrich = useCallback(
    async (bookmark: Bookmark, quiet = false): Promise<"ok" | "failed" | "rate-limited"> => {
      enrichAborts.current.get(bookmark.id)?.abort()
      const controller = new AbortController()
      enrichAborts.current.set(bookmark.id, controller)
      dispatch({ type: "pending", id: bookmark.id, on: true })
      try {
        const res = await requestEnrichment(bookmark.url, controller.signal)
        if (controller.signal.aborted) return "failed"
        if (!res.ok) {
          if (res.error.code === "RATE_LIMITED") {
            if (!quiet) toast.error(res.error.message)
            return "rate-limited"
          }
          await applyRemotePatch(bookmark.id, { enrichment: "failed" }, undefined, true)
          if (res.error.code === "BLOCKED_URL") toast.error(res.error.message)
          else if (!quiet) toast(`Couldn't read ${domainOf(bookmark.url)}. Kept the link.`)
          return "failed"
        }
        if (res.data.source === "none" && !quiet) {
          toast(`${domainOf(bookmark.url)} didn't answer with a page. Kept the link.`)
        }
        const e = res.data
        // The user may have edited the card while it was being read; their
        // title wins and their tags are kept alongside the suggested ones.
        const current = latest.current.find((b) => b.id === bookmark.id) ?? bookmark
        const userTitled = current.title !== bookmark.title
        const patch: BookmarkPatch = {
          title: userTitled ? current.title : e.title || current.title,
          description: e.description,
          summary: e.summary,
          tags: [...new Set([...current.tags, ...e.tags])].slice(0, 8),
          category: e.category,
          faviconUrl: e.faviconUrl ?? current.faviconUrl,
          imageUrl: e.imageUrl ?? current.imageUrl,
          readingMinutes: e.readingMinutes,
          enrichment: e.source === "ai" ? "done" : e.source === "metadata" ? "fallback" : "failed",
        }
        const result = await repo.updateBookmark(bookmark.id, patch)
        if (result.ok) {
          // The summary and the end of the reading state land together, inside a transition.
          await land(() => {
            dispatch({ type: "upsert", bookmark: result.data })
            dispatch({ type: "pending", id: bookmark.id, on: false })
          })
        }
        return "ok"
      } finally {
        if (enrichAborts.current.get(bookmark.id) === controller) enrichAborts.current.delete(bookmark.id)
        dispatch({ type: "pending", id: bookmark.id, on: false })
      }
    },
    [applyRemotePatch, repo, land],
  )

  // ---- public api ---------------------------------------------------------

  const reveal = useCallback<DashboardApi["reveal"]>((id, opts) => {
    dispatch({ type: "query", query: "" })
    dispatch({ type: "tags", tags: [] })
    dispatch({ type: "healthFilter", value: null })
    // The card may live in another view (archived, or another collection).
    const card = latest.current.find((b) => b.id === id)
    if (card && !matchesView(card, latestView.current)) {
      dispatch({ type: "view", view: { kind: "view", view: card.archivedAt ? "archive" : "all" } })
    }
    window.dispatchEvent(new CustomEvent("bookmark-ai:reveal", { detail: { id, flash: opts?.flash ?? false } }))
  }, [])

  const readingRef = useRef(false)
  const readPending = useCallback<DashboardApi["readPending"]>(async () => {
    if (readingRef.current) return
    const queue = latest.current.filter((b) => b.enrichment === "pending" && !b.archivedAt)
    if (!queue.length) return
    readingRef.current = true
    const toastId = toast.loading(`Reading ${queue.length} pages…`)
    let done = 0
    let stopped = false
    try {
      // Two at a time keeps well under the per-minute limit; a 429 ends the run early.
      const worker = async () => {
        while (queue.length && !stopped) {
          const next = queue.shift()!
          const outcome = await enrich(next, true)
          if (outcome === "rate-limited") {
            stopped = true
            break
          }
          done += 1
          toast.loading(`Reading pages… ${done} of ${done + queue.length}`, { id: toastId })
        }
      }
      await Promise.all([worker(), worker()])
    } finally {
      readingRef.current = false
      if (stopped) {
        // The limiter refills within a minute; pick the queue back up on its own.
        toast(`Read ${done} pages, then hit the limit. The rest continue in a minute.`, { id: toastId, duration: 8000 })
        window.setTimeout(() => void readPendingRef.current?.(), 65_000)
      } else toast.success(`Read ${done} ${done === 1 ? "page" : "pages"}`, { id: toastId })
    }
  }, [enrich])
  const readPendingRef = useRef<DashboardApi["readPending"] | null>(null)
  useEffect(() => {
    readPendingRef.current = readPending
  }, [readPending])

  const addBookmark = useCallback<DashboardApi["addBookmark"]>(
    async (raw, opts) => {
      const url = normalizeUrl(raw)
      if (!url) {
        toast.error("That does not look like a web address.")
        return null
      }
      const key = canonicalKey(url)
      const existing = latest.current.find((b) => b.urlNormalized === key)
      if (existing) {
        // Not an error: take them to the card they already have.
        reveal(existing.id, { flash: true })
        toast(`Already saved on ${new Date(existing.createdAt).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })}`)
        return existing
      }

      const input: NewBookmark = {
        url,
        collectionId:
          opts?.collectionId !== undefined
            ? opts.collectionId
            : state.view.kind === "collection"
              ? state.view.id
              : null,
      }
      const optimistic = materialize(input)
      dispatch({ type: "fresh", key: optimistic.urlNormalized, on: true })
      const inserted = withTransition(() => {
        dispatch({ type: "upsert", bookmark: optimistic })
        dispatch({ type: "pending", id: optimistic.id, on: true })
      })
      window.setTimeout(() => dispatch({ type: "fresh", key: optimistic.urlNormalized, on: false }), 1200)

      const result = await repo.createBookmark(input)
      // The insert runs a frame late inside the transition; never swap before it lands.
      await inserted
      if (!result.ok) {
        withTransition(() => {
          dispatch({ type: "remove", ids: [optimistic.id] })
          dispatch({ type: "pending", id: optimistic.id, on: false })
        })
        toast.error(result.error.message)
        return null
      }
      // Swap the optimistic id for the real one before enrichment lands.
      dispatch({ type: "swap", from: optimistic.id, bookmark: result.data })
      writeFlag("saved-once")
      window.dispatchEvent(new CustomEvent("bookmark-ai:saved", { detail: result.data.id }))
      void enrich(result.data)
      return result.data
    },
    [repo, state.view, enrich, reveal],
  )

  const reEnrich = useCallback<DashboardApi["reEnrich"]>(
    async (id) => {
      const bookmark = state.bookmarks.find((b) => b.id === id)
      if (bookmark) await enrich(bookmark)
    },
    [state.bookmarks, enrich],
  )

  const patch = useCallback<DashboardApi["patch"]>(
    async (id, p, opts) => {
      const current = state.bookmarks.find((b) => b.id === id)
      if (!current) return
      dispatch({ type: "upsert", bookmark: { ...current, ...p, updatedAt: new Date().toISOString() } })
      await applyRemotePatch(id, p, current, opts?.silent)
    },
    [state.bookmarks, applyRemotePatch],
  )

  const patchMany = useCallback<DashboardApi["patchMany"]>(
    async (ids, p, label, opts) => {
      const targets = state.bookmarks.filter((b) => ids.includes(b.id))
      if (!targets.length) return
      const stamp = new Date().toISOString()
      const run = opts?.move ? withTransition : async (fn: () => void) => fn()
      const applied = run(() => {
        dispatch({ type: "upsertMany", bookmarks: targets.map((b) => ({ ...b, ...p, updatedAt: stamp })) })
        dispatch({ type: "select", ids: [], mode: "set" })
        // One transition for both: a second startViewTransition would cut the first short.
        if (opts?.closePreview) {
          latestPreview.current = null
          dispatch({ type: "preview", id: null })
        }
      })
      const result = await repo.updateBookmarks(targets.map((b) => b.id), p)
      await applied
      if (!result.ok) {
        run(() => dispatch({ type: "upsertMany", bookmarks: targets }))
        toast.error("Could not update those cards. Nothing changed.")
        return
      }
      dispatch({ type: "upsertMany", bookmarks: result.data })
      const what = targets.length === 1 ? `\u201c${targets[0]!.title}\u201d` : `${targets.length} cards`
      undoToast(`${label.charAt(0).toUpperCase() + label.slice(1)} ${what}`, async () => {
        run(() => dispatch({ type: "upsertMany", bookmarks: targets }))
        // The original values may differ per card, so undo is per card.
        await Promise.all(targets.map((b) => repo.updateBookmark(b.id, revertPatch(b, p))))
      })
    },
    [repo, state.bookmarks],
  )

  const done = useCallback<DashboardApi["done"]>(
    async (ids, opts) => {
      const stamp = new Date().toISOString()
      const one = ids.length === 1 ? state.bookmarks.find((b) => b.id === ids[0]) : undefined
      await patchMany(ids, { readAt: one?.readAt ?? stamp, archivedAt: stamp }, "finished", { move: true, closePreview: opts?.closePreview })
    },
    [patchMany, state.bookmarks],
  )

  const toggleArchive = useCallback<DashboardApi["toggleArchive"]>(
    async (b, opts) => {
      await patchMany([b.id], { archivedAt: b.archivedAt ? null : new Date().toISOString() }, b.archivedAt ? "restored" : "moved to Done", { move: true, closePreview: opts?.closePreview })
    },
    [patchMany],
  )

  const setPreview = useCallback<DashboardApi["setPreview"]>((id) => {
    // Wide screens: the pane is a column, so opening or closing it reflows the list; slide both.
    const wide = typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia("(min-width: 1024px)").matches
    const toggles = (latestPreview.current === null) !== (id === null)
    latestPreview.current = id
    if (wide && toggles) void withTransition(() => dispatch({ type: "preview", id }))
    else dispatch({ type: "preview", id })
  }, [])

  const setReadOpen = useCallback<DashboardApi["setReadOpen"]>((open) => {
    withTransition(() => dispatch({ type: "readOpen", open }))
  }, [])

  const setLayout = useCallback<DashboardApi["setLayout"]>((layout) => {
    withTransition(() => dispatch({ type: "layout", layout }))
  }, [])

  const remove = useCallback<DashboardApi["remove"]>(
    async (ids) => {
      const targets = state.bookmarks.filter((b) => ids.includes(b.id))
      if (!targets.length) return
      for (const b of targets) enrichAborts.current.get(b.id)?.abort()
      const removed = withTransition(() => dispatch({ type: "remove", ids }))
      const result = await repo.deleteBookmarks(targets.map((b) => b.id))
      await removed
      if (!result.ok) {
        withTransition(() => dispatch({ type: "upsertMany", bookmarks: targets }))
        toast.error("Could not delete. Nothing was removed.")
        return
      }
      undoToast(targets.length === 1 ? `Removed \u201c${targets[0]?.title}\u201d` : `Removed ${targets.length} cards`, async () => {
        const res = await repo.importBookmarks(targets.map(toNewBookmark))
        if (res.ok) {
          const byKey = new Map(targets.map((b) => [b.urlNormalized, b]))
          const restored = res.data.created.map((b) => {
            const was = byKey.get(b.urlNormalized)
            return { ...b, health: was?.health ?? "unknown", lastOpenedAt: was?.lastOpenedAt ?? null }
          })
          withTransition(() => dispatch({ type: "upsertMany", bookmarks: restored }))
        } else toast.error("Could not restore.")
      })
    },
    [repo, state.bookmarks],
  )

  const markOpened = useCallback<DashboardApi["markOpened"]>(
    (bookmark) => {
      const stamp = new Date().toISOString()
      const p: BookmarkPatch = { lastOpenedAt: stamp, readAt: bookmark.readAt ?? stamp }
      const current = latest.current.find((b) => b.id === bookmark.id) ?? bookmark
      // The row keeps its place (the reducer holds it) until the view changes.
      dispatch({ type: "upsert", bookmark: { ...current, ...p, updatedAt: stamp } })
      void applyRemotePatch(bookmark.id, p, current, true)
      if (!bookmark.archivedAt && !readFlag("done-hint")) {
        writeFlag("done-hint")
        toast("Read it? Press d to clear it from your Inbox", { duration: 6000 })
      }
    },
    [applyRemotePatch],
  )

  const open = useCallback<DashboardApi["open"]>(
    (bookmark) => {
      window.open(bookmark.url, "_blank", "noopener,noreferrer")
      markOpened(bookmark)
    },
    [markOpened],
  )

  const readSomething = useCallback<DashboardApi["readSomething"]>(() => {
    const unread = state.bookmarks.filter(isUnread).sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt))
    if (!unread.length) {
      toast("Nothing unread. Inbox zero.")
      return
    }
    const pick = pickWeighted(unread, Math.random())
    toast(`Opened \u201c${pick.title}\u201d`)
    open(pick)
  }, [state.bookmarks, open])

  const addTag = useCallback<DashboardApi["addTag"]>(
    async (id, tag) => {
      const current = state.bookmarks.find((b) => b.id === id)
      const parsed = tagSchema.safeParse(tag)
      if (!current) return
      if (!parsed.success) {
        toast.error("Tags are lowercase words, digits and - . + #")
        return
      }
      if (current.tags.includes(parsed.data)) return
      if (current.tags.length >= 8) {
        toast.error("Eight tags is plenty for one card.")
        return
      }
      await patch(id, { tags: [...current.tags, parsed.data] })
    },
    [state.bookmarks, patch],
  )

  const removeTag = useCallback<DashboardApi["removeTag"]>(
    async (id, tag) => {
      const current = state.bookmarks.find((b) => b.id === id)
      if (!current) return
      await patch(id, { tags: current.tags.filter((t) => t !== tag) })
    },
    [state.bookmarks, patch],
  )

  const renameTag = useCallback<DashboardApi["renameTag"]>(
    async (from, to) => {
      const target = to.trim()
      if (target && !tagSchema.safeParse(target).success) {
        toast.error("Tags are lowercase words, digits and - . + #")
        return
      }
      const before = latest.current.filter((b) => b.tags.includes(from))
      const result = await repo.renameTag(from, target)
      if (!result.ok) {
        toast.error(result.error.message)
        return
      }
      await reload()
      if (state.tags.includes(from)) {
        dispatch({ type: "tags", tags: state.tags.map((t) => (t === from ? target : t)).filter(Boolean) })
      }
      undoToast(target ? `Renamed #${from} to #${target} on ${result.data.affected} cards` : `Removed #${from} from ${result.data.affected} cards`, async () => {
        // Restore each card's exact tag list; a merge cannot be undone by renaming back.
        await Promise.all(before.map((b) => repo.updateBookmark(b.id, { tags: b.tags })))
        await reload()
      })
    },
    [repo, reload, state.tags],
  )

  const createCollection = useCallback<DashboardApi["createCollection"]>(
    async (name) => {
      const result = await repo.createCollection(name)
      if (!result.ok) {
        toast.error(result.error.message)
        return null
      }
      dispatch({ type: "collections", collections: [...state.collections, result.data] })
      return result.data
    },
    [repo, state.collections],
  )

  const renameCollection = useCallback<DashboardApi["renameCollection"]>(
    async (id, name) => {
      const result = await repo.renameCollection(id, name)
      if (!result.ok) {
        toast.error(result.error.message)
        return
      }
      dispatch({ type: "collections", collections: state.collections.map((c) => (c.id === id ? result.data : c)) })
    },
    [repo, state.collections],
  )

  const deleteCollection = useCallback<DashboardApi["deleteCollection"]>(
    async (id) => {
      const collection = state.collections.find((c) => c.id === id)
      const members = state.bookmarks.filter((b) => b.collectionId === id)
      const result = await repo.deleteCollection(id)
      if (!result.ok || !collection) {
        toast.error(result.ok ? "That collection is gone." : result.error.message)
        return
      }
      dispatch({ type: "collections", collections: state.collections.filter((c) => c.id !== id) })
      dispatch({ type: "upsertMany", bookmarks: members.map((b) => ({ ...b, collectionId: null })) })
      if (state.view.kind === "collection" && state.view.id === id) dispatch({ type: "view", view: { kind: "view", view: "all" } })
      undoToast(`Removed \u201c${collection.name}\u201d. Its ${members.length} cards stay in your Inbox.`, async () => {
        const again = await repo.createCollection(collection.name)
        if (!again.ok) {
          toast.error("Could not restore the collection.")
          return
        }
        dispatch({ type: "collections", collections: [...latestCollections.current, again.data] })
        if (members.length) {
          const moved = await repo.updateBookmarks(members.map((b) => b.id), { collectionId: again.data.id })
          if (moved.ok) dispatch({ type: "upsertMany", bookmarks: moved.data })
        }
      })
    },
    [repo, state.collections, state.bookmarks, state.view],
  )

  const importItems = useCallback<DashboardApi["importItems"]>(
    async (items) => {
      const existing = new Set(state.bookmarks.map((b) => b.urlNormalized))
      const { fresh, skipped } = dedupeImports(items, existing, canonicalKey)
      if (!fresh.length) {
        toast("Everything in that file was already saved.")
        return { created: 0, skipped }
      }
      const progress = toast.loading(`Filing ${fresh.length} cards…`)
      // "Bookmarks bar / Rust / Async" keeps nesting visible as one collection name.
      const folderName = (item: ImportedBookmark) => item.folder.map((f) => f.trim()).filter(Boolean).join(" / ").slice(0, 60)

      // Folders become collections, created on demand.
      const byName = new Map(state.collections.map((c) => [c.name.toLowerCase(), c]))
      const collections = [...state.collections]
      for (const item of fresh) {
        const folder = folderName(item)
        if (!folder || byName.has(folder.toLowerCase())) continue
        const result = await repo.createCollection(folder)
        if (result.ok) {
          byName.set(folder.toLowerCase(), result.data)
          collections.push(result.data)
        }
      }
      dispatch({ type: "collections", collections })

      const inputs: NewBookmark[] = fresh.map((item) => ({
        url: item.url,
        title: item.title.slice(0, 300),
        tags: item.tags.slice(0, 8),
        collectionId: folderName(item) ? (byName.get(folderName(item).toLowerCase())?.id ?? null) : null,
        createdAt: item.addedAt ?? undefined,
        enrichment: "pending",
      }))
      const result = await repo.importBookmarks(inputs)
      if (!result.ok) {
        toast.error(result.error.message, { id: progress })
        return { created: 0, skipped }
      }
      dispatch({ type: "upsertMany", bookmarks: result.data.created })
      const created = result.data.created.length
      const totalSkipped = skipped + result.data.skipped
      // Replace the loading toast in place; a dismiss can race the next render and stick.
      toast.success(
        created ? `Filed ${created} ${created === 1 ? "card" : "cards"}${totalSkipped ? `, skipped ${totalSkipped} already saved` : ""}` : "Everything in that file was already saved.",
        { id: progress },
      )
      return { created, skipped: totalSkipped }
    },
    [repo, state.bookmarks, state.collections],
  )

  const checkHealth = useCallback<DashboardApi["checkHealth"]>(
    async (ids) => {
      const targets = ids ? state.bookmarks.filter((b) => ids.includes(b.id)) : visible
      if (!targets.length) return
      const id = toast.loading(`Checking ${targets.length} links…`)
      try {
        // The route takes 40 at a time; walk the whole view in batches.
        const results: Awaited<ReturnType<typeof requestHealth>> = []
        for (let i = 0; i < targets.length; i += 40) {
          const batch = targets.slice(i, i + 40)
          results.push(...(await requestHealth(batch.map((b) => b.url))))
          toast.loading(`Checking links… ${Math.min(i + 40, targets.length)} of ${targets.length}`, { id })
        }
        const byUrl = new Map(results.map((r) => [r.url, r.health]))
        const stamp = new Date().toISOString()
        const updated = targets.map((b) => ({ ...b, health: byUrl.get(b.url) ?? b.health, healthCheckedAt: stamp }))
        dispatch({ type: "upsertMany", bookmarks: updated })
        // One round trip per health value rather than one per card.
        const groups = new Map<Bookmark["health"], string[]>()
        for (const b of updated) groups.set(b.health, [...(groups.get(b.health) ?? []), b.id])
        await Promise.all([...groups].map(([health, ids]) => repo.updateBookmarks(ids, { health, healthCheckedAt: stamp })))
        const dead = updated.filter((b) => b.health === "dead").length
        toast.success(dead ? `${dead} of ${targets.length} links look dead` : `All ${targets.length} links are alive`, {
          id,
          action: dead ? { label: "Show dead", onClick: () => dispatch({ type: "healthFilter", value: "dead" }) } : undefined,
        })
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Health check failed.", { id })
      }
    },
    [repo, state.bookmarks, visible],
  )

  const resetDemo = useCallback<DashboardApi["resetDemo"]>(async () => {
    await repo.clear()
    if (seed) await seed(repo)
    await reload()
    dispatch({ type: "view", view: { kind: "view", view: "all" } })
    toast("Demo reset to the starting drawer.")
  }, [repo, seed, reload])

  // Persist layout and sort.
  useEffect(() => {
    if (hydrated) writePrefs({ layout: state.layout, sort: state.sort, readOpen: state.readOpen })
  }, [state.layout, state.sort, state.readOpen, hydrated])

  const api = useMemo<DashboardApi>(
    () => ({
      mode,
      state,
      visible,
      hits,
      counts,
      dispatch,
      elsewhere,
      setPreview,
      setReadOpen,
      addBookmark,
      reEnrich,
      patch,
      patchMany,
      done,
      toggleArchive,
      readSomething,
      setLayout,
      remove,
      open,
      markOpened,
      addTag,
      removeTag,
      renameTag,
      createCollection,
      renameCollection,
      deleteCollection,
      importItems,
      readPending,
      pendingCount: state.bookmarks.filter((b) => b.enrichment === "pending" && !b.archivedAt).length,
      checkHealth,
      reveal,
      resetDemo,
      reload,
    }),
    [
      mode, state, visible, hits, counts, elsewhere, setPreview, setReadOpen, addBookmark, reEnrich, patch, patchMany, done, toggleArchive, readSomething, setLayout, remove, open, markOpened, addTag, removeTag,
      renameTag, createCollection, renameCollection, deleteCollection, importItems, readPending, checkHealth, reveal, resetDemo, reload,
    ],
  )

  return (
    <DashboardContext.Provider value={api}>
      <div data-hydrated={hydrated}>{children}</div>
    </DashboardContext.Provider>
  )
}

function toNewBookmark(b: Bookmark): NewBookmark {
  return {
    url: b.url,
    title: b.title,
    description: b.description,
    summary: b.summary,
    tags: b.tags,
    category: b.category,
    faviconUrl: b.faviconUrl,
    imageUrl: b.imageUrl,
    collectionId: b.collectionId,
    favourite: b.favourite,
    readAt: b.readAt,
    archivedAt: b.archivedAt,
    enrichment: b.enrichment,
    readingMinutes: b.readingMinutes,
    createdAt: b.createdAt,
  }
}

/**
 * Pick from a list sorted oldest first, weighted linearly towards the start:
 * the oldest card is n times as likely as the newest. `r` is in [0, 1).
 */
export function pickWeighted<T>(sortedOldestFirst: T[], r: number): T {
  const n = sortedOldestFirst.length
  const total = (n * (n + 1)) / 2
  let target = r * total
  for (let i = 0; i < n; i++) {
    target -= n - i
    if (target < 0) return sortedOldestFirst[i]!
  }
  return sortedOldestFirst[n - 1]!
}

/** Build the patch that undoes `applied` on `original`. */
function revertPatch(original: Bookmark, applied: BookmarkPatch): BookmarkPatch {
  const out: Record<string, unknown> = {}
  for (const key of Object.keys(applied) as (keyof BookmarkPatch)[]) out[key] = original[key]
  return out as BookmarkPatch
}
