"use client"

import { BookOpen, CheckCheck, Download, FolderInput, Star, Tag, Trash2, X, HeartPulse } from "lucide-react"
import { useState } from "react"
import { cn } from "@/lib/utils"
import { usePresence } from "@/lib/client/use-presence"
import { MenuContent, MenuItem, MenuRoot, MenuTrigger } from "@/components/ui/menu"
import { useDashboard } from "./provider"

export function BulkBar({ onExport }: { onExport: () => void }) {
  const api = useDashboard()
  const { collections } = api.state
  const [tag, setTag] = useState<string | null>(null)
  // Stays mounted 140ms after the selection clears, so it can sink away.
  const { item: selected, state } = usePresence(api.state.selected.size ? api.state.selected : null)
  if (!selected) return null
  const ids = [...selected]

  return (
    // Phones: sits on top of the bottom omnibox. Wider: floats centred above the list.
    <div role="toolbar" aria-label="Selection" data-state={state} className={cn(state === "closed" && "pointer-events-none", "pop rise-anim fixed inset-x-2 bottom-[calc(4.25rem+env(safe-area-inset-bottom))] z-30 flex min-w-0 items-center gap-0.5 overflow-x-auto whitespace-nowrap px-1.5 py-1.5 sm:inset-x-0 sm:bottom-5 sm:mx-auto sm:w-max sm:max-w-[calc(100vw-24px)]")}>
      <span className="px-2 text-[13px] font-medium tabular-nums">{ids.length} selected</span>
      <button type="button" className="btn btn-ghost btn-sm" title="Done: mark read and archive" onClick={() => api.done(ids)}><CheckCheck size={14} /><span className="hidden md:inline">Done</span></button>
      <button type="button" className="btn btn-ghost btn-sm" title="Star" onClick={() => api.patchMany(ids, { favourite: true }, "starred")}><Star size={14} /><span className="hidden md:inline">Star</span></button>
      <button type="button" className="btn btn-ghost btn-sm" title="Mark read" onClick={() => api.patchMany(ids, { readAt: new Date().toISOString() }, "marked read")}><BookOpen size={14} /><span className="hidden md:inline">Read</span></button>
      <MenuRoot>
        <MenuTrigger asChild><button type="button" className="btn btn-ghost btn-sm" title="Move to collection"><FolderInput size={14} /><span className="hidden md:inline">Move</span></button></MenuTrigger>
        <MenuContent side="top">
          <MenuItem onSelect={() => api.patchMany(ids, { collectionId: null }, "took out of collections")}>No collection</MenuItem>
          {collections.map((c) => <MenuItem key={c.id} onSelect={() => api.patchMany(ids, { collectionId: c.id }, `moved to ${c.name}`)}>{c.name}</MenuItem>)}
        </MenuContent>
      </MenuRoot>
      {tag === null ? (
        <button type="button" className="btn btn-ghost btn-sm" title="Add tag" onClick={() => setTag("")}><Tag size={14} /><span className="hidden md:inline">Tag</span></button>
      ) : (
        <input
          autoFocus
          className="field h-8 w-28 text-[13px]"
          aria-label="Tag for selected cards"
          placeholder="tag, enter"
          value={tag}
          onChange={(e) => setTag(e.target.value)}
          onBlur={() => setTag(null)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && tag.trim()) { for (const id of ids) void api.addTag(id, tag); setTag(null); api.dispatch({ type: "select", ids: [], mode: "set" }) }
            if (e.key === "Escape") setTag(null)
          }}
        />
      )}
      <button type="button" className="btn btn-ghost btn-sm" title="Check links" onClick={() => api.checkHealth(ids)}><HeartPulse size={14} /><span className="hidden md:inline">Check</span></button>
      <button type="button" className="btn btn-ghost btn-sm" title="Export selection" onClick={onExport}><Download size={14} /><span className="hidden md:inline">Export</span></button>
      <button type="button" className="btn btn-ghost btn-sm text-danger" title="Delete" onClick={() => api.remove(ids)}><Trash2 size={14} /><span className="hidden md:inline">Delete</span></button>
      <button type="button" className="btn btn-ghost btn-icon sticky right-0 ml-auto h-7 w-7 bg-surface" aria-label="Clear selection" onClick={() => api.dispatch({ type: "select", ids: [], mode: "set" })}><X size={14} /></button>
    </div>
  )
}
