"use client"

import { CheckCheck, Download, FolderPlus, HeartPulse, Inbox, LogOut, MoreHorizontal, Pencil, RotateCcw, Settings, Star, Trash2, Upload } from "lucide-react"
import Link from "next/link"
import { useState, type ReactNode } from "react"
import type { SystemView, ViewSelection } from "@/lib/domain/bookmark"
import { cn } from "@/lib/utils"
import { Wordmark } from "@/components/wordmark"
import { Mark } from "@/components/mark"
import { MenuContent, MenuItem, MenuRoot, MenuSeparator, MenuTrigger } from "@/components/ui/menu"
import { useDashboard } from "./provider"

const VIEWS: Array<{ view: SystemView; label: string; icon: ReactNode }> = [
  { view: "all", label: "Inbox", icon: <Inbox size={15} /> },
  { view: "favourites", label: "Starred", icon: <Star size={15} /> },
  { view: "archive", label: "Done", icon: <CheckCheck size={15} /> },
]

interface Props {
  userLabel: string
  /** Demo only: whether "Sign up to sync" can lead anywhere. */
  cloudAvailable?: boolean
  onImport: () => void
  onExport: () => void
  onSignOut?: () => void
  className?: string
  onNavigate?: () => void
}

/**
 * A number that rolls in when the user changes it, never on first load.
 * `rev` comes from the provider and only moves on user-caused changes.
 */
export function Count({ value, className }: { value: number; className?: string }) {
  const { state } = useDashboard()
  const [seen, setSeen] = useState({ value, rev: state.rev })
  const [roll, setRoll] = useState(false)
  if (seen.value !== value) {
    // Adjusting state during render (not in an effect) keeps the roll in the same paint.
    setSeen({ value, rev: state.rev })
    setRoll(state.rev !== seen.rev)
  }
  if (!value) return null
  return (
    <span className={cn("ml-auto inline-flex overflow-hidden text-[12px] tabular-nums text-ink-3", className)}>
      <span key={value} className={cn("inline-block", roll && "anim-roll")}>{value}</span>
    </span>
  )
}

function NavItem({ active, icon, label, count, onClick, tone }: { active: boolean; icon: ReactNode; label: string; count?: number; onClick: () => void; tone?: "danger" }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex h-8 w-full min-w-0 items-center gap-2.5 rounded-[6px] px-2 text-left text-[14px] text-ink-2 transition-colors duration-[90ms] hover:bg-surface-2 hover:text-ink",
        active && "font-semibold text-ink",
      )}
    >
      <span className={cn("shrink-0", active ? "text-ink" : "text-ink-3", tone === "danger" && "text-danger")}>{icon}</span>
      <span className="isolate min-w-0 truncate">{active ? <Mark insetY=".22em" tilt="-1.5deg">{label}</Mark> : label}</span>
      {count !== undefined ? <Count value={count} className={cn(tone === "danger" && "text-danger")} /> : null}
    </button>
  )
}

export function Sidebar({ userLabel, cloudAvailable = false, onImport, onExport, onSignOut, className, onNavigate }: Props) {
  const api = useDashboard()
  const { state, counts } = api
  const [newName, setNewName] = useState<string | null>(null)
  const [renaming, setRenaming] = useState<{ id: string; name: string } | null>(null)
  const deadCount = counts.views.dead

  const select = (view: ViewSelection) => {
    api.dispatch({ type: "view", view })
    onNavigate?.()
  }

  const viewCount = (view: SystemView): number | undefined =>
    view === "all" ? counts.views.unread : view === "favourites" ? counts.views.favourites : undefined

  return (
    <aside className={cn("quiet-scroll flex h-full w-[208px] shrink-0 flex-col overflow-y-auto border-r border-line bg-bg", className)}>
      {/* 56px, one line: matches the top bar so both borders meet. */}
      <div className="flex h-14 shrink-0 items-center border-b border-line px-4">
        <Wordmark href={api.mode === "demo" ? "/" : "/dashboard"} />
      </div>

      <nav className="mt-3 flex flex-col gap-px px-2" aria-label="Views">
        {VIEWS.map(({ view, label, icon }) => (
          <NavItem
            key={view}
            label={label}
            icon={icon}
            count={viewCount(view)}
            active={state.view.kind === "view" && state.view.view === view && !state.healthFilter}
            onClick={() => select({ kind: "view", view })}
          />
        ))}
        {deadCount > 0 ? (
          <NavItem
            label="Dead links"
            icon={<HeartPulse size={15} />}
            count={deadCount}
            tone="danger"
            active={state.healthFilter === "dead"}
            onClick={() => {
              api.dispatch({ type: "view", view: { kind: "view", view: "all" } })
              api.dispatch({ type: "healthFilter", value: "dead" })
              onNavigate?.()
            }}
          />
        ) : null}
      </nav>

      <div className="mt-6 flex items-center justify-between pl-4 pr-2">
        <span className="text-[13px] font-medium text-ink-2">Collections</span>
        <button type="button" className="btn btn-ghost btn-icon h-6 w-6" title="New collection" aria-label="New collection" onClick={() => setNewName("")}>
          <FolderPlus size={14} />
        </button>
      </div>
      <div className="mt-1 flex flex-col gap-px px-2">
        {state.collections.map((c) => {
          const active = state.view.kind === "collection" && state.view.id === c.id
          if (renaming?.id === c.id) {
            return (
              <input
                key={c.id}
                autoFocus
                className="field h-8 text-[14px]"
                aria-label={`Rename ${c.name}`}
                value={renaming.name}
                maxLength={60}
                onChange={(e) => setRenaming({ id: c.id, name: e.target.value })}
                onBlur={() => { if (renaming.name.trim() && renaming.name.trim() !== c.name) void api.renameCollection(c.id, renaming.name); setRenaming(null) }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") e.currentTarget.blur()
                  if (e.key === "Escape") { setRenaming({ id: c.id, name: c.name }); e.currentTarget.blur() }
                }}
              />
            )
          }
          return (
            <div key={c.id} className="group relative flex min-w-0 items-center">
              <NavItem
                label={c.name}
                icon={null}
                count={counts.collections.get(c.id) ?? 0}
                active={active}
                onClick={() => select({ kind: "collection", id: c.id })}
              />
              <MenuRoot>
                <MenuTrigger asChild>
                  <button type="button" className="hover-reveal touch-show btn btn-ghost btn-icon absolute right-1 h-6 w-6 bg-surface-2" aria-label={`Options for ${c.name}`}>
                    <MoreHorizontal size={13} />
                  </button>
                </MenuTrigger>
                <MenuContent>
                  <MenuItem onSelect={() => setRenaming({ id: c.id, name: c.name })}><Pencil size={13} /> Rename</MenuItem>
                  <MenuItem danger onSelect={() => api.deleteCollection(c.id)}><Trash2 size={13} /> Delete collection</MenuItem>
                </MenuContent>
              </MenuRoot>
            </div>
          )
        })}
        {newName !== null ? (
          <input
            autoFocus
            className="field h-8 text-[14px]"
            placeholder="Collection name"
            aria-label="New collection name"
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
          <p className="px-2 py-1 text-[13px] text-ink-3">No collections yet.</p>
        ) : null}
      </div>

      {api.mode === "demo" ? (
        <p className="mt-auto px-4 pt-6 text-[13px] leading-snug text-ink-3">
          Demo · stays in this browser
          {cloudAvailable ? (
            <>
              <br />
              <Link href="/signup" className="font-medium text-action underline-offset-2 hover:underline" onClick={onNavigate}>Sign up to sync</Link>
            </>
          ) : null}
        </p>
      ) : null}
      <div className={cn("flex min-w-0 items-center gap-1 px-2 pb-3", api.mode === "demo" ? "pt-2" : "mt-auto pt-6")}>
        <MenuRoot>
          <MenuTrigger asChild>
            <button type="button" className="btn btn-ghost btn-sm min-w-0 flex-1 justify-start gap-2 px-2 text-ink-2" aria-label="More">
              <MoreHorizontal size={15} className="shrink-0" />
              <span className="truncate">More</span>
            </button>
          </MenuTrigger>
          <MenuContent side="top" align="start">
            <MenuItem onSelect={() => api.checkHealth()}><HeartPulse size={14} /> Check links</MenuItem>
            <MenuItem onSelect={onImport}><Upload size={14} /> Import bookmarks</MenuItem>
            <MenuItem onSelect={onExport}><Download size={14} /> Export</MenuItem>
            {api.mode === "demo" ? (
              <MenuItem onSelect={() => api.resetDemo()}><RotateCcw size={14} /> Reset demo</MenuItem>
            ) : null}
            {api.mode === "cloud" ? (
              <MenuItem asChild>
                <Link href="/settings"><Settings size={14} /> Settings</Link>
              </MenuItem>
            ) : null}
            <MenuSeparator />
            <div className="truncate px-2 py-1 text-[12px] text-ink-3" title={userLabel}>{userLabel}</div>
            {onSignOut ? (
              <MenuItem onSelect={onSignOut}><LogOut size={14} /> Sign out</MenuItem>
            ) : null}
          </MenuContent>
        </MenuRoot>
      </div>
    </aside>
  )
}
