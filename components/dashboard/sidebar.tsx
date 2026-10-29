"use client"

import { Archive, BookMarked, Download, FolderPlus, Inbox, Library, LogOut, Settings, Star, Upload, HeartPulse, MoreHorizontal, Pencil, Trash2 } from "lucide-react"
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
                  onBlur={() => setRenaming(null)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") { void api.renameCollection(c.id, renaming.name); setRenaming(null) }
                    if (e.key === "Escape") setRenaming(null)
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
                      <button type="button" className="btn btn-ghost btn-icon mr-1 h-6 w-6 opacity-0 group-hover:opacity-100 data-[state=open]:opacity-100" aria-label={`Options for ${c.name}`}>
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
            onBlur={() => setNewName(null)}
            onKeyDown={async (e) => {
              if (e.key === "Enter" && newName.trim()) {
                const c = await api.createCollection(newName)
                setNewName(null)
                if (c) select({ kind: "collection", id: c.id })
              }
              if (e.key === "Escape") setNewName(null)
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
            {counts.tags.slice(0, 16).map(({ tag, count }) => {
              const active = state.tags.includes(tag)
              return (
                <button
                  key={tag}
                  type="button"
                  className={cn("flex w-full items-center gap-2 rounded-[2px] px-2 py-1 text-left font-mono text-[12px] transition-colors hover:bg-surface", active ? "text-accent" : "text-ink-2")}
                  aria-pressed={active}
                  onClick={() => api.dispatch({ type: "tags", tags: active ? state.tags.filter((t) => t !== tag) : [...state.tags, tag] })}
                >
                  <span className={cn("w-2 text-center", active ? "text-accent" : "text-ink-3")}>{active ? "×" : "#"}</span>
                  <span className="truncate">{tag}</span>
                  <span className="ml-auto text-[11px] text-ink-3">{count}</span>
                </button>
              )
            })}
          </div>
        </>
      ) : null}

      <div className="mt-auto border-t border-border px-2 pb-3 pt-3">
        <SideAction icon={<HeartPulse size={14} />} label="Check links" onClick={() => api.checkHealth()} />
        <SideAction icon={<Upload size={14} />} label="Import bookmarks" onClick={onImport} />
        <SideAction icon={<Download size={14} />} label="Export" onClick={onExport} />
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
