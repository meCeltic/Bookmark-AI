"use client"

import { Command } from "cmdk"
import { Archive, ArrowDownUp, BookMarked, BookOpenText, Download, ExternalLink, FolderPlus, HeartPulse, Inbox, LayoutGrid, Library, Moon, Plus, Rows3, Star, Sun, Upload, Keyboard, Tag } from "lucide-react"
import { SORT_ORDERS, type SortOrder } from "@/lib/domain/bookmark"
import { useTheme } from "next-themes"
import { useEffect, useMemo, useState } from "react"
import { normalizeUrl } from "@/lib/url/normalize"
import { createSearchIndex, searchBookmarks } from "@/lib/search/rank"
import { Favicon } from "@/components/favicon"
import { Dialog, DialogContent } from "@/components/ui/dialog"
import { useDashboard } from "./provider"

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  onImport: () => void
  onExport: () => void
  onHelp: () => void
}

export function CommandPalette({ open, onOpenChange, onImport, onExport, onHelp }: Props) {
  const api = useDashboard()
  const { state } = api
  const { resolvedTheme, setTheme } = useTheme()
  const [query, setQuery] = useState("")
  const [page, setPage] = useState<"root" | "collection" | "tag">("root")

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault()
        setQuery(""); setPage("root")
        onOpenChange(!open)
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [open, onOpenChange])

  const index = useMemo(() => createSearchIndex(state.bookmarks.filter((b) => !b.archivedAt)), [state.bookmarks])
  const hits = useMemo(() => (query.trim().length >= 2 ? searchBookmarks(index, query, 6) : []), [index, query])
  const url = normalizeUrl(query.trim())
  const isUrl = query.trim().length > 3 && url !== null && /[.]/.test(query) && !/\s/.test(query.trim())

  const run = (fn: () => void) => () => { onOpenChange(false); fn() }
  const go = (view: typeof state.view) => run(() => api.dispatch({ type: "view", view }))

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) { setQuery(""); setPage("root") } onOpenChange(o) }}>
      <DialogContent title="Command palette" description="Jump to a card or run a command" bare className="top-[14vh] w-[600px]">
        <Command label="Command palette" shouldFilter={page === "root" && !isUrl} loop className="outline-none">
          <div className="flex items-center gap-2 border-b border-border px-4">
            <Command.Input
              autoFocus
              value={query}
              onValueChange={setQuery}
              placeholder={page === "collection" ? "Name the collection…" : page === "tag" ? "Tag to add…" : "Type a command, a word, or paste a link…"}
              className="h-12 flex-1 bg-transparent text-[15px] outline-none placeholder:text-ink-3"
              onKeyDown={(e) => {
                if (page !== "root" && e.key === "Enter" && query.trim()) {
                  e.preventDefault()
                  if (page === "collection") void api.createCollection(query.trim())
                  if (page === "tag") for (const id of state.selected) void api.addTag(id, query.trim())
                  onOpenChange(false)
                }
                if (e.key === "Backspace" && !query && page !== "root") setPage("root")
              }}
            />
            <span className="kbd">esc</span>
          </div>

          <Command.List className="quiet-scroll max-h-[55vh] overflow-y-auto p-2">
            {page !== "root" ? (
              <div className="px-2 py-3 text-sm text-ink-2">Press Enter to {page === "collection" ? "create it" : `tag ${state.selected.size} selected cards`}.</div>
            ) : (
              <>
                <Command.Empty className="px-2 py-6 text-center text-sm text-ink-2">No card or command matches.</Command.Empty>

                {isUrl ? (
                  <Command.Group heading={<Heading>Save</Heading>}>
                    <Item onSelect={run(() => void api.addBookmark(query.trim()))}><Plus size={14} /> Save <span className="truncate font-mono text-[12px] text-ink-2">{url}</span></Item>
                  </Command.Group>
                ) : null}

                {hits.length ? (
                  <Command.Group heading={<Heading>Cards</Heading>}>
                    {hits.map(({ bookmark }) => (
                      <Item key={bookmark.id} value={`card ${bookmark.id} ${bookmark.title}`} onSelect={run(() => api.open(bookmark))}>
                        <Favicon url={bookmark.url} src={bookmark.faviconUrl} />
                        <span className="truncate">{bookmark.title}</span>
                        <span className="ml-auto flex shrink-0 items-center gap-1 text-ink-3"><ExternalLink size={12} /></span>
                      </Item>
                    ))}
                  </Command.Group>
                ) : null}

                <Command.Group heading={<Heading>Go to</Heading>}>
                  <Item onSelect={go({ kind: "view", view: "all" })}><Library size={14} /> All cards</Item>
                  <Item onSelect={go({ kind: "view", view: "unsorted" })}><Inbox size={14} /> Unsorted</Item>
                  <Item onSelect={go({ kind: "view", view: "favourites" })}><Star size={14} /> Favourites</Item>
                  <Item onSelect={go({ kind: "view", view: "reading" })}><BookMarked size={14} /> Reading list</Item>
                  <Item onSelect={go({ kind: "view", view: "archive" })}><Archive size={14} /> Archive</Item>
                  {state.collections.map((c) => (
                    <Item key={c.id} value={`collection ${c.name}`} onSelect={go({ kind: "collection", id: c.id })}>
                      <span className="w-[14px] text-center font-mono text-[11px] text-ink-3">#</span> {c.name}
                    </Item>
                  ))}
                </Command.Group>

                <Command.Group heading={<Heading>Actions</Heading>}>
                  <Item onSelect={() => { setPage("collection"); setQuery("") }}><FolderPlus size={14} /> New collection</Item>
                  {state.selected.size ? (
                    <Item onSelect={() => { setPage("tag"); setQuery("") }}><Tag size={14} /> Tag {state.selected.size} selected</Item>
                  ) : null}
                  {api.pendingCount > 0 ? (
                    <Item onSelect={run(() => void api.readPending())}><BookOpenText size={14} /> Read {api.pendingCount} pending pages</Item>
                  ) : null}
                  <Item onSelect={run(() => void api.checkHealth())}><HeartPulse size={14} /> Check links in this view</Item>
                  <Item onSelect={run(onImport)}><Upload size={14} /> Import bookmarks</Item>
                  <Item onSelect={run(onExport)}><Download size={14} /> Export</Item>
                  <Item onSelect={run(() => api.dispatch({ type: "layout", layout: state.layout === "grid" ? "list" : "grid" }))}>
                    {state.layout === "grid" ? <Rows3 size={14} /> : <LayoutGrid size={14} />} Switch to {state.layout === "grid" ? "list" : "grid"}
                  </Item>
                  <Item onSelect={run(() => setTheme(resolvedTheme === "dark" ? "light" : "dark"))}>
                    {resolvedTheme === "dark" ? <Sun size={14} /> : <Moon size={14} />} Switch to {resolvedTheme === "dark" ? "light" : "dark"} mode
                  </Item>
                  <Item onSelect={run(onHelp)}><Keyboard size={14} /> Keyboard shortcuts<span className="kbd ml-auto">?</span></Item>
                </Command.Group>

                <Command.Group heading={<Heading>Sort</Heading>}>
                  {SORT_ORDERS.map((s) => (
                    <Item key={s} value={`sort ${SORT_LABEL[s]}`} onSelect={run(() => api.dispatch({ type: "sort", sort: s }))}>
                      <ArrowDownUp size={14} /> {SORT_LABEL[s]}{state.sort === s ? <span className="ml-auto font-mono text-[11px] text-ink-3">current</span> : null}
                    </Item>
                  ))}
                </Command.Group>
              </>
            )}
          </Command.List>
        </Command>
      </DialogContent>
    </Dialog>
  )
}

const SORT_LABEL: Record<SortOrder, string> = {
  newest: "Newest first",
  oldest: "Oldest first",
  title: "Title A–Z",
  domain: "By site",
  opened: "Recently opened",
}

const Heading = ({ children }: { children: string }) => <span className="meta block px-2 pb-1 pt-2">{children}</span>

function Item({ children, onSelect, value }: { children: React.ReactNode; onSelect: () => void; value?: string }) {
  return (
    <Command.Item
      value={value}
      onSelect={onSelect}
      className="flex cursor-pointer items-center gap-2.5 rounded-[2px] px-2 py-2 text-[14px] data-[selected=true]:bg-surface-2"
    >
      {children}
    </Command.Item>
  )
}
