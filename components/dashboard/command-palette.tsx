"use client"

import { Command } from "cmdk"
import { CheckCheck, ArrowDownUp, Dices, RotateCcw, Download, ExternalLink, Folder, FolderPlus, HeartPulse, Inbox, LayoutGrid, Moon, Plus, Rows3, Settings, Star, Sun, Upload, Keyboard, Tag } from "lucide-react"
import { useTheme } from "next-themes"
import { useRouter } from "next/navigation"
import { switchTheme } from "@/components/theme-toggle"
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
  const router = useRouter()
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
          <div className="flex items-center gap-2 border-b border-line px-4">
            <Command.Input
              autoFocus
              value={query}
              onValueChange={setQuery}
              placeholder={page === "collection" ? "Name the collection…" : page === "tag" ? "Tag to add…" : "Type a command, a word, or paste a link…"}
              className="h-12 min-w-0 flex-1 bg-transparent text-[15px] placeholder:text-ink-3"
              // The panel is the focus context; the global :focus-visible ring (unlayered) would box the input.
              style={{ outline: "none" }}
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
              <div className="px-2 py-3 text-[13px] text-ink-2">Press Enter to {page === "collection" ? "create it" : `tag ${state.selected.size} selected cards`}.</div>
            ) : (
              <>
                <Command.Empty className="px-2 py-6 text-center text-[13px] text-ink-2">No card or command matches.</Command.Empty>

                {isUrl ? (
                  <Command.Group heading={<Heading>Save</Heading>}>
                    <Item onSelect={run(() => void api.addBookmark(query.trim()))}><Plus size={14} /> Save <span className="min-w-0 truncate font-mono text-[12px] text-ink-2">{url}</span></Item>
                  </Command.Group>
                ) : null}

                {hits.length ? (
                  <Command.Group heading={<Heading>Cards</Heading>}>
                    {hits.map(({ bookmark }) => (
                      <Item key={bookmark.id} value={`card ${bookmark.id} ${bookmark.title}`} onSelect={run(() => api.open(bookmark))}>
                        <Favicon url={bookmark.url} src={bookmark.faviconUrl} />
                        <span className="min-w-0 truncate">{bookmark.title}</span>
                        <span className="ml-auto flex shrink-0 items-center gap-1 text-ink-3"><ExternalLink size={12} /></span>
                      </Item>
                    ))}
                  </Command.Group>
                ) : null}

                <Command.Group heading={<Heading>Go to</Heading>}>
                  <Item onSelect={go({ kind: "view", view: "all" })}><Inbox size={14} /> Inbox</Item>
                  <Item onSelect={go({ kind: "view", view: "favourites" })}><Star size={14} /> Starred</Item>
                  <Item value="done archive" onSelect={go({ kind: "view", view: "archive" })}><CheckCheck size={14} /> Done</Item>
                  {state.collections.map((c) => (
                    <Item key={c.id} value={`collection ${c.name}`} onSelect={go({ kind: "collection", id: c.id })}>
                      <Folder size={14} className="text-ink-3" /> {c.name}
                    </Item>
                  ))}
                </Command.Group>

                <Command.Group heading={<Heading>Actions</Heading>}>
                  <Item value="read something random unread" onSelect={run(() => api.readSomething())}><Dices size={14} /> Read something<span className="kbd ml-auto">⇧R</span></Item>
                  <Item onSelect={() => { setPage("collection"); setQuery("") }}><FolderPlus size={14} /> New collection</Item>
                  {state.selected.size ? (
                    <Item onSelect={() => { setPage("tag"); setQuery("") }}><Tag size={14} /> Tag {state.selected.size} selected</Item>
                  ) : null}
                  <Item onSelect={run(() => void api.checkHealth())}><HeartPulse size={14} /> Check links in this view</Item>
                  {state.bookmarks.some((b) => b.health === "dead" && !b.archivedAt) ? (
                    <Item onSelect={run(() => { api.dispatch({ type: "view", view: { kind: "view", view: "all" } }); api.dispatch({ type: "healthFilter", value: "dead" }) })}><HeartPulse size={14} /> Show dead links</Item>
                  ) : null}
                  {api.mode === "demo" ? (
                    <Item onSelect={run(() => void api.resetDemo())}><RotateCcw size={14} /> Reset demo</Item>
                  ) : null}
                  <Item onSelect={run(onImport)}><Upload size={14} /> Import bookmarks</Item>
                  <Item onSelect={run(onExport)}><Download size={14} /> Export</Item>
                  {api.mode === "cloud" ? (
                    <Item onSelect={run(() => router.push("/settings"))}><Settings size={14} /> Settings</Item>
                  ) : null}
                  <Item onSelect={run(() => api.setLayout(state.layout === "grid" ? "list" : "grid"))}>
                    {state.layout === "grid" ? <Rows3 size={14} /> : <LayoutGrid size={14} />} Switch to {state.layout === "grid" ? "list" : "grid"}
                  </Item>
                  <Item onSelect={run(() => switchTheme(setTheme, resolvedTheme === "dark" ? "light" : "dark"))}>
                    {resolvedTheme === "dark" ? <Sun size={14} /> : <Moon size={14} />} Switch to {resolvedTheme === "dark" ? "light" : "dark"} mode
                  </Item>
                  <Item onSelect={run(onHelp)}><Keyboard size={14} /> Keyboard shortcuts<span className="kbd ml-auto">?</span></Item>
                </Command.Group>

                <Command.Group heading={<Heading>Sort</Heading>}>
                  {SORTS.map(({ sort, label }) => (
                    <Item key={sort} value={`sort ${label}`} onSelect={run(() => api.dispatch({ type: "sort", sort }))}>
                      <ArrowDownUp size={14} /> {label}{state.sort === sort ? <span className="ml-auto text-[12px] text-ink-3">Current</span> : null}
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

const SORTS = [
  { sort: "newest", label: "Newest first" },
  { sort: "oldest", label: "Oldest first" },
] as const

const Heading = ({ children }: { children: string }) => <span className="block px-2 pb-1 pt-2 text-[12px] font-medium text-ink-3">{children}</span>

function Item({ children, onSelect, value }: { children: React.ReactNode; onSelect: () => void; value?: string }) {
  return (
    <Command.Item
      value={value}
      onSelect={onSelect}
      className="flex h-9 min-w-0 cursor-pointer items-center gap-2.5 rounded-[6px] px-2 text-[14px] data-[selected=true]:bg-surface-2"
    >
      {children}
    </Command.Item>
  )
}
