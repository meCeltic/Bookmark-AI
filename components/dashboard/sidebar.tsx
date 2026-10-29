"use client"

import { Archive, BookMarked, BookOpenText, Download, FolderPlus, Inbox, Library, LogOut, RotateCcw, Settings, Star, Upload, HeartPulse, MoreHorizontal, Pencil, Trash2 } from "lucide-react"
import Link from "next/link"
import { useState, type ReactNode } from "react"
import type { SystemView } from "@/lib/domain/bookmark"
import { cn } from "@/lib/utils"
import { Wordmark } from "@/components/wordmark"
import { MenuContent, MenuItem, MenuRoot, MenuTrigger } from "@/components/ui/menu"
import { useDashboard } from "./provider"

const VIEWS: Array<{ view: SystemView; label: string; icon: ReactNode }> = [
  { view: "all", label: "All cards", icon: <Library size={15} /> },
  { view: "unsorted", label: "Unsorted", icon: <Inbox size={15} /> },
  { view: "favourites", label: "Favourites", icon: <Star size={15} /> },
  { view: "reading", label: "Reading list", icon: <BookMarked size={15} /> },
  { view: "archive", label: "Archive", icon: <Archive size={15} /> },
]

interface Props {
  userLabel: string
  onImport: () => void
  onExport: () => void
  onSignOut?: () => void
  className?: string
  onNavigate?: () => void
}

export function Sidebar({ userLabel, onImport, onExport, onSignOut, className, onNavigate }: Props) {
  const api = useDashboard()
  const { state, counts } = api
  const [newName, setNewName] = useState<string | null>(null)
  const [renaming, setRenaming] = useState<{ id: string; name: string } | null>(null)
  const [tagEdit, setTagEdit] = useState<{ from: string; to: string } | null>(null)
  const [allTags, setAllTags] = useState(false)
  const deadCount = state.bookmarks.filter((b) => b.health === "dead" && !b.archivedAt).length

  const select = (view: typeof state.view) => {
    api.dispatch({ type: "view", view })
    onNavigate?.()
  }

  return (
    <aside className={cn("quiet-scroll flex h-full w-[232px] shrink-0 flex-col overflow-y-auto border-r border-border bg-surface-2", className)}>
      <div className="px-4 pb-3 pt-4">
        <Wordmark />
      </div>

      <nav className="px-2">
        {VIEWS.map(({ view, label, icon }) => {
          const active = state.view.kind === "view" && state.view.view === view
          return (
            <button
              key={view}
              type="button"
              onClick={() => select({ kind: "view", view })}
              className={cn(
                "flex w-full items-center gap-2.5 rounded-[2px] px-2 py-1.5 text-left text-[14px] transition-colors hover:bg-surface",
                active && "bg-surface font-semibold text-ink",
              )}
            >
              <span className={cn("text-ink-2", active && "text-accent")}>{icon}</span>
              {label}
              <span className="ml-auto font-mono text-[11px] text-ink-3">{counts.views[view] || ""}</span>
            </button>
          )
        })}
      </nav>

      {deadCount > 0 ? (
        <button
          type="button"
          onClick={() => { api.dispatch({ type: "view", view: { kind: "view", view: "all" } }); api.dispatch({ type: "healthFilter", value: "dead" }); onNavigate?.() }}
          className={cn("mx-2 mt-1 flex w-[calc(100%-16px)] items-center gap-2.5 rounded-[2px] px-2 py-1.5 text-left text-[14px] transition-colors hover:bg-surface", state.healthFilter === "dead" && "bg-surface font-semibold")}
        >
          <span className={cn("text-ink-2", state.healthFilter === "dead" && "text-danger")}><HeartPulse size={15} /></span>
          Dead links
          <span className="ml-auto font-mono text-[11px] text-danger">{deadCount}</span>
        </button>
      ) : null}

      <div className="mt-5 flex items-center justify-between px-4">
        <span className="meta">Collections</span>
        <button type="button" className="btn btn-ghost btn-icon h-6 w-6" title="New collection" aria-label="New collection" onClick={() => setNewName("")}>
          <FolderPlus size={14} />
        </button>
      </div>
      <div className="mt-1 px-2">
        {state.collections.map((c) => {
          const active = state.view.kind === "collection" && state.view.id === c.id
          const editing = renaming?.id === c.id
          return (
            <div key={c.id} className={cn("group flex items-center rounded-[2px] transition-colors hover:bg-surface", active && "bg-surface")}>
              {editing ? (
                <input
                  autoFocus
                  className="rule-input mx-2 my-1 text-[14px]"
                  value={renaming.name}
                  maxLength={60}
                  onChange={(e) => setRenaming({ id: c.id, name: e.target.value })}
                  onBlur={() => { if (renaming.name.trim() && renaming.name.trim() !== c.name) void api.renameCollection(c.id, renaming.name); setRenaming(null) }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") e.currentTarget.blur()
                    if (e.key === "Escape") { setRenaming({ id: c.id, name: c.name }); e.currentTarget.blur() }
                  }}
                />
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => select({ kind: "collection", id: c.id })}
                    className={cn("flex min-w-0 flex-1 items-center gap-2.5 px-2 py-1.5 text-left text-[14px]", active && "font-semibold")}
                  >
                    <span className="truncate">{c.name}</span>
                    <span className="ml-auto font-mono text-[11px] text-ink-3">{counts.collections.get(c.id) || ""}</span>
                  </button>
                  <MenuRoot>
                    <MenuTrigger asChild>
                      <button type="button" className="hover-reveal touch-show btn btn-ghost btn-icon mr-1 h-6 w-6" aria-label={`Options for ${c.name}`}>
                        <MoreHorizontal size={13} />
                      </button>
                    </MenuTrigger>
                    <MenuContent>
                      <MenuItem onSelect={() => setRenaming({ id: c.id, name: c.name })}><Pencil size={13} /> Rename</MenuItem>
                      <MenuItem danger onSelect={() => api.deleteCollection(c.id)}><Trash2 size={13} /> Delete collection</MenuItem>
                    </MenuContent>
                  </MenuRoot>
                </>
              )}
            </div>
          )
        })}
        {newName !== null ? (
          <input
            autoFocus
            className="rule-input mx-2 my-1 text-[14px]"
            placeholder="Collection name"
            maxLength={60}
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onBlur={async () => {
              const name = newName.trim()
              setNewName(null)
              if (!name) return
              const c = await api.createCollection(name)
              if (c) select({ kind: "collection", id: c.id })
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") e.currentTarget.blur()
              if (e.key === "Escape") { setNewName(""); e.currentTarget.blur() }
            }}
          />
        ) : null}
        {state.collections.length === 0 && newName === null ? (
          <p className="px-2 py-1 text-[12.5px] text-ink-3">No collections yet.</p>
        ) : null}
      </div>

      {counts.tags.length ? (
        <>
          <div className="mt-5 px-4"><span className="meta">Tags</span></div>
          <div className="mt-1 px-2">
            {(allTags ? counts.tags : counts.tags.slice(0, 12)).map(({ tag, count }) => {
              const active = state.tags.includes(tag)
              if (tagEdit?.from === tag) {
                return (
                  <input
                    key={tag}
                    autoFocus
                    className="rule-input mx-2 my-1 font-mono text-[12px]"
                    value={tagEdit.to}
                    maxLength={32}
                    placeholder="new name, empty removes"
                    onChange={(e) => setTagEdit({ from: tag, to: e.target.value })}
                    onBlur={() => { if (tagEdit.to.trim() !== tag) void api.renameTag(tag, tagEdit.to); setTagEdit(null) }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") e.currentTarget.blur()
                      if (e.key === "Escape") { setTagEdit({ from: tag, to: tag }); e.currentTarget.blur() }
                    }}
                  />
                )
              }
              return (
                <div key={tag} className="group flex items-center rounded-[2px] hover:bg-surface">
                  <button
                    type="button"
                    className={cn("flex min-w-0 flex-1 items-center gap-2 px-2 py-1 text-left font-mono text-[12px] transition-colors", active ? "text-accent" : "text-ink-2")}
                    aria-pressed={active}
                    onClick={() => api.dispatch({ type: "tags", tags: active ? state.tags.filter((t) => t !== tag) : [...state.tags, tag] })}
                  >
                    <span className={cn("w-2 text-center", active ? "text-accent" : "text-ink-3")}>{active ? "×" : "#"}</span>
                    <span className="truncate">{tag}</span>
                    <span className="ml-auto text-[11px] text-ink-3">{count}</span>
                  </button>
                  <MenuRoot>
                    <MenuTrigger asChild>
                      <button type="button" className="hover-reveal touch-show btn btn-ghost btn-icon mr-1 h-6 w-6" aria-label={`Options for tag ${tag}`}>
                        <MoreHorizontal size={13} />
                      </button>
                    </MenuTrigger>
                    <MenuContent>
                      <MenuItem onSelect={() => setTagEdit({ from: tag, to: tag })}><Pencil size={13} /> Rename or merge</MenuItem>
                      <MenuItem danger onSelect={() => api.renameTag(tag, "")}><Trash2 size={13} /> Remove from all cards</MenuItem>
                    </MenuContent>
                  </MenuRoot>
                </div>
              )
            })}
            {counts.tags.length > 12 ? (
              <button type="button" className="px-2 py-1 font-mono text-[11px] text-ink-3 underline-offset-2 hover:text-accent hover:underline" onClick={() => setAllTags((v) => !v)}>
                {allTags ? "fewer" : `all ${counts.tags.length} tags`}
              </button>
            ) : null}
          </div>
        </>
      ) : null}

      <div className="mt-auto border-t border-border px-2 pb-3 pt-3">
        {api.pendingCount > 0 ? (
          <SideAction icon={<BookOpenText size={14} />} label={`Read ${api.pendingCount} pending pages`} onClick={() => api.readPending()} />
        ) : null}
        <SideAction icon={<HeartPulse size={14} />} label="Check links" onClick={() => api.checkHealth()} />
        <SideAction icon={<Upload size={14} />} label="Import bookmarks" onClick={onImport} />
        <SideAction icon={<Download size={14} />} label="Export" onClick={onExport} />
        {api.mode === "demo" ? (
          <SideAction icon={<RotateCcw size={14} />} label="Reset demo" onClick={() => api.resetDemo()} />
        ) : null}
        {api.mode === "cloud" ? (
          <Link href="/settings" className="flex w-full items-center gap-2.5 rounded-[2px] px-2 py-1.5 text-[13.5px] text-ink-2 hover:bg-surface hover:text-ink">
            <Settings size={14} /> Settings
          </Link>
        ) : null}
        <div className="mt-2 flex items-center justify-between px-2">
          <span className="truncate font-mono text-[11px] text-ink-2" title={userLabel}>{userLabel}</span>
          {onSignOut ? (
            <button type="button" className="btn btn-ghost btn-icon h-6 w-6" title="Sign out" aria-label="Sign out" onClick={onSignOut}>
              <LogOut size={13} />
            </button>
          ) : null}
        </div>
      </div>
    </aside>
  )
}

function SideAction({ icon, label, onClick }: { icon: ReactNode; label: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="flex w-full items-center gap-2.5 rounded-[2px] px-2 py-1.5 text-left text-[13.5px] text-ink-2 hover:bg-surface hover:text-ink">
      {icon} {label}
    </button>
  )
}
