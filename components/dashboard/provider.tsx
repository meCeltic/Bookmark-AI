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
import type {
  Bookmark,
  BookmarkPatch,
  Collection,
  NewBookmark,
  SortOrder,
  ViewSelection,
} from "@/lib/domain/bookmark"
import type { AppError } from "@/lib/domain/result"
import type { BookmarkRepository, RepositoryMode } from "@/lib/repo/types"
import { materialize } from "@/lib/repo/shared"
import { requestEnrichment, requestHealth } from "@/lib/client/enrich"
import { readPrefs, writePrefs, type Layout } from "@/lib/client/prefs"
import { applyFilter, tagCounts, viewCounts, collectionCounts } from "@/lib/search/filter"
import { createSearchIndex, searchBookmarks, type SearchHit } from "@/lib/search/rank"
import { normalizeUrl, canonicalKey } from "@/lib/url/normalize"
import type { ImportedBookmark } from "@/lib/import/netscape"
import { dedupeImports } from "@/lib/import/netscape"

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

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "hydrate":
      return { ...state, bookmarks: action.bookmarks, collections: action.collections }
    case "upsert": {
      const exists = state.bookmarks.some((b) => b.id === action.bookmark.id)
      return {
        ...state,
        bookmarks: exists
          ? state.bookmarks.map((b) => (b.id === action.bookmark.id ? action.bookmark : b))
          : [action.bookmark, ...state.bookmarks],
      }
    }
    case "upsertMany": {
      const byId = new Map(action.bookmarks.map((b) => [b.id, b]))
      const merged = state.bookmarks.map((b) => byId.get(b.id) ?? b)
      const fresh = action.bookmarks.filter((b) => !state.bookmarks.some((x) => x.id === b.id))
      return { ...state, bookmarks: [...fresh, ...merged] }
    }
    case "remove": {
      const ids = new Set(action.ids)
      const selected = new Set([...state.selected].filter((id) => !ids.has(id)))
      return { ...state, bookmarks: state.bookmarks.filter((b) => !ids.has(b.id)), selected }
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
      return { ...state, view: action.view, selected: new Set(), healthFilter: null }
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
  }
}

export interface DashboardApi {
  mode: RepositoryMode
  state: State
  /** Bookmarks after view, tag, health and sort filters, before search. */
  visible: Bookmark[]
  /** Search hits when a query is active, else null. */
  hits: SearchHit[] | null
  counts: { views: ReturnType<typeof viewCounts>; collections: Map<string, number>; tags: ReturnType<typeof tagCounts> }
  dispatch: (action: Action) => void

  addBookmark: (raw: string, opts?: { collectionId?: string | null }) => Promise<Bookmark | null>
  reEnrich: (id: string) => Promise<void>
  patch: (id: string, patch: BookmarkPatch, opts?: { silent?: boolean }) => Promise<void>
  patchMany: (ids: string[], patch: BookmarkPatch, label: string) => Promise<void>
  remove: (ids: string[]) => Promise<void>
  open: (bookmark: Bookmark) => void
  addTag: (id: string, tag: string) => Promise<void>
  removeTag: (id: string, tag: string) => Promise<void>
  renameTag: (from: string, to: string) => Promise<void>

  createCollection: (name: string) => Promise<Collection | null>
  renameCollection: (id: string, name: string) => Promise<void>
  deleteCollection: (id: string) => Promise<void>

  importItems: (items: ImportedBookmark[]) => Promise<{ created: number; skipped: number }>
  checkHealth: (ids?: string[]) => Promise<void>
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

function describe(error: AppError): string {
  return error.message
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
    layout: "grid" as Layout,
    healthFilter: null,
  }))
  const [hydrated, setHydrated] = useState(mode === "cloud")
  const enrichAborts = useRef(new Map<string, AbortController>())

  const reload = useCallback(async () => {
    const [bookmarks, collections] = await Promise.all([repo.listBookmarks(), repo.listCollections()])
    dispatch({ type: "hydrate", bookmarks, collections })
  }, [repo])

  // Demo mode reads from localStorage after mount; cloud mode arrives hydrated from the server.
  useEffect(() => {
    const prefs = readPrefs()
    dispatch({ type: "layout", layout: prefs.layout })
    dispatch({ type: "sort", sort: prefs.sort })
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
        if (!silent) toast.error(describe(result.error))
      }
    },
    [repo],
  )

  const enrich = useCallback(
    async (bookmark: Bookmark) => {
      enrichAborts.current.get(bookmark.id)?.abort()
      const controller = new AbortController()
      enrichAborts.current.set(bookmark.id, controller)
      dispatch({ type: "pending", id: bookmark.id, on: true })
      try {
        const res = await requestEnrichment(bookmark.url, controller.signal)
        if (controller.signal.aborted) return
        if (!res.ok) {
          await applyRemotePatch(bookmark.id, { enrichment: "failed" }, undefined, true)
          if (res.error.code === "RATE_LIMITED") toast.error(res.error.message)
          return
        }
        const e = res.data
        const patch: BookmarkPatch = {
          title: e.title || bookmark.title,
          description: e.description,
          summary: e.summary,
          tags: e.tags.length ? e.tags : bookmark.tags,
          category: e.category,
          faviconUrl: e.faviconUrl,
          imageUrl: e.imageUrl,
          readingMinutes: e.readingMinutes,
          enrichment: e.source === "ai" ? "done" : e.source === "metadata" ? "fallback" : "failed",
        }
        await applyRemotePatch(bookmark.id, patch, undefined, true)
      } finally {
        if (enrichAborts.current.get(bookmark.id) === controller) enrichAborts.current.delete(bookmark.id)
        dispatch({ type: "pending", id: bookmark.id, on: false })
      }
    },
    [applyRemotePatch],
  )

  // ---- public api ---------------------------------------------------------

  const addBookmark = useCallback<DashboardApi["addBookmark"]>(
    async (raw, opts) => {
      const url = normalizeUrl(raw)
      if (!url) {
        toast.error("That does not look like a web address.")
        return null
      }
      const key = canonicalKey(url)
      const existing = state.bookmarks.find((b) => b.urlNormalized === key)
      if (existing) {
        toast("Already in your drawer", {
          description: `Saved ${new Date(existing.createdAt).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })}.`,
          action: { label: "Show", onClick: () => dispatch({ type: "query", query: existing.title }) },
        })
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
      dispatch({ type: "upsert", bookmark: optimistic })
      dispatch({ type: "pending", id: optimistic.id, on: true })

      const result = await repo.createBookmark(input)
      if (!result.ok) {
        dispatch({ type: "remove", ids: [optimistic.id] })
        dispatch({ type: "pending", id: optimistic.id, on: false })
        toast.error(describe(result.error))
        return null
      }
      // Swap the optimistic id for the real one before enrichment lands.
      dispatch({ type: "remove", ids: [optimistic.id] })
      dispatch({ type: "pending", id: optimistic.id, on: false })
      dispatch({ type: "upsert", bookmark: result.data })
      void enrich(result.data)
      return result.data
    },
    [repo, state.bookmarks, state.view, enrich],
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
    async (ids, p, label) => {
      const targets = state.bookmarks.filter((b) => ids.includes(b.id))
      if (!targets.length) return
      const stamp = new Date().toISOString()
      dispatch({ type: "upsertMany", bookmarks: targets.map((b) => ({ ...b, ...p, updatedAt: stamp })) })
      dispatch({ type: "select", ids: [], mode: "set" })
      const results = await Promise.all(targets.map((b) => repo.updateBookmark(b.id, p)))
      const failed = results.filter((r) => !r.ok).length
      if (failed) {
        dispatch({ type: "upsertMany", bookmarks: targets })
        toast.error(`Could not ${label} ${failed} of ${targets.length}.`)
      } else {
        toast(`${label.charAt(0).toUpperCase() + label.slice(1)} ${targets.length} ${targets.length === 1 ? "card" : "cards"}`, {
          action: {
            label: "Undo",
            onClick: () => {
              dispatch({ type: "upsertMany", bookmarks: targets })
              void Promise.all(targets.map((b) => repo.updateBookmark(b.id, revertPatch(b, p))))
            },
          },
        })
      }
    },
    [repo, state.bookmarks],
  )

  const remove = useCallback<DashboardApi["remove"]>(
    async (ids) => {
      const targets = state.bookmarks.filter((b) => ids.includes(b.id))
      if (!targets.length) return
      for (const b of targets) enrichAborts.current.get(b.id)?.abort()
      dispatch({ type: "remove", ids })
      const results = await Promise.all(targets.map((b) => repo.deleteBookmark(b.id)))
      if (results.some((r) => !r.ok)) {
        dispatch({ type: "upsertMany", bookmarks: targets })
        toast.error("Could not delete. Nothing was removed.")
        return
      }
      let undone = false
      toast(targets.length === 1 ? `Removed "${targets[0]?.title}"` : `Removed ${targets.length} cards`, {
        duration: 6000,
        action: {
          label: "Undo",
          onClick: async () => {
            if (undone) return
            undone = true
            const res = await repo.importBookmarks(targets.map(toNewBookmark))
            if (res.ok) {
              const restored = res.data.created.map((b, i) => ({
                ...b,
                health: targets[i]?.health ?? "unknown",
                lastOpenedAt: targets[i]?.lastOpenedAt ?? null,
              }))
              dispatch({ type: "upsertMany", bookmarks: restored })
            } else toast.error("Could not restore.")
          },
        },
      })
    },
    [repo, state.bookmarks],
  )

  const open = useCallback<DashboardApi["open"]>(
    (bookmark) => {
      window.open(bookmark.url, "_blank", "noopener,noreferrer")
      const stamp = new Date().toISOString()
      void patch(bookmark.id, { lastOpenedAt: stamp, readAt: bookmark.readAt ?? stamp }, { silent: true })
    },
    [patch],
  )

  const addTag = useCallback<DashboardApi["addTag"]>(
    async (id, tag) => {
      const current = state.bookmarks.find((b) => b.id === id)
      const clean = tag.trim().toLowerCase()
      if (!current || !clean || current.tags.includes(clean)) return
      if (current.tags.length >= 8) {
        toast.error("Eight tags is plenty for one card.")
        return
      }
      await patch(id, { tags: [...current.tags, clean] })
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
      const result = await repo.renameTag(from, to)
      if (!result.ok) {
        toast.error(describe(result.error))
        return
      }
      await reload()
      if (state.tags.includes(from)) {
        dispatch({ type: "tags", tags: state.tags.map((t) => (t === from ? to : t)).filter(Boolean) })
      }
      toast(to ? `Renamed "${from}" to "${to}" on ${result.data.affected} cards` : `Removed "${from}" from ${result.data.affected} cards`)
    },
    [repo, reload, state.tags],
  )

  const createCollection = useCallback<DashboardApi["createCollection"]>(
    async (name) => {
      const result = await repo.createCollection(name)
      if (!result.ok) {
        toast.error(describe(result.error))
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
        toast.error(describe(result.error))
        return
      }
      dispatch({ type: "collections", collections: state.collections.map((c) => (c.id === id ? result.data : c)) })
    },
    [repo, state.collections],
  )

  const deleteCollection = useCallback<DashboardApi["deleteCollection"]>(
    async (id) => {
      const result = await repo.deleteCollection(id)
      if (!result.ok) {
        toast.error(describe(result.error))
        return
      }
      dispatch({ type: "collections", collections: state.collections.filter((c) => c.id !== id) })
      dispatch({
        type: "upsertMany",
        bookmarks: state.bookmarks.filter((b) => b.collectionId === id).map((b) => ({ ...b, collectionId: null })),
      })
      if (state.view.kind === "collection" && state.view.id === id) dispatch({ type: "view", view: { kind: "view", view: "all" } })
      toast("Collection removed. Its cards are now unsorted.")
    },
    [repo, state.collections, state.bookmarks, state.view],
  )

  const importItems = useCallback<DashboardApi["importItems"]>(
    async (items) => {
      const existing = new Set(state.bookmarks.map((b) => b.urlNormalized))
      const { fresh, skipped } = dedupeImports(items, existing, canonicalKey)
      if (!fresh.length) return { created: 0, skipped }

      // Folders become collections, created on demand.
      const byName = new Map(state.collections.map((c) => [c.name.toLowerCase(), c]))
      const collections = [...state.collections]
      for (const item of fresh) {
        const folder = item.folder[0]?.trim()
        if (!folder || byName.has(folder.toLowerCase())) continue
        const result = await repo.createCollection(folder.slice(0, 60))
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
        collectionId: item.folder[0] ? (byName.get(item.folder[0].toLowerCase())?.id ?? null) : null,
        createdAt: item.addedAt ?? undefined,
        enrichment: "pending",
      }))
      const result = await repo.importBookmarks(inputs)
      if (!result.ok) {
        toast.error(describe(result.error))
        return { created: 0, skipped }
      }
      dispatch({ type: "upsertMany", bookmarks: result.data.created })
      return { created: result.data.created.length, skipped: skipped + result.data.skipped }
    },
    [repo, state.bookmarks, state.collections],
  )

  const checkHealth = useCallback<DashboardApi["checkHealth"]>(
    async (ids) => {
      const targets = (ids ? state.bookmarks.filter((b) => ids.includes(b.id)) : visible).slice(0, 40)
      if (!targets.length) return
      const id = toast.loading(`Checking ${targets.length} links…`)
      try {
        const results = await requestHealth(targets.map((b) => b.url))
        const byUrl = new Map(results.map((r) => [r.url, r.health]))
        const stamp = new Date().toISOString()
        const updated = targets.map((b) => ({ ...b, health: byUrl.get(b.url) ?? b.health, healthCheckedAt: stamp }))
        dispatch({ type: "upsertMany", bookmarks: updated })
        await Promise.all(updated.map((b) => repo.updateBookmark(b.id, { health: b.health, healthCheckedAt: stamp })))
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
    if (hydrated) writePrefs({ layout: state.layout, sort: state.sort })
  }, [state.layout, state.sort, hydrated])

  const api = useMemo<DashboardApi>(
    () => ({
      mode,
      state,
      visible,
      hits,
      counts,
      dispatch,
      addBookmark,
      reEnrich,
      patch,
      patchMany,
      remove,
      open,
      addTag,
      removeTag,
      renameTag,
      createCollection,
      renameCollection,
      deleteCollection,
      importItems,
      checkHealth,
      resetDemo,
      reload,
    }),
    [
      mode, state, visible, hits, counts, addBookmark, reEnrich, patch, patchMany, remove, open, addTag, removeTag,
      renameTag, createCollection, renameCollection, deleteCollection, importItems, checkHealth, resetDemo, reload,
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

/** Build the patch that undoes `applied` on `original`. */
function revertPatch(original: Bookmark, applied: BookmarkPatch): BookmarkPatch {
  const out: Record<string, unknown> = {}
  for (const key of Object.keys(applied) as (keyof BookmarkPatch)[]) out[key] = original[key]
  return out as BookmarkPatch
}
