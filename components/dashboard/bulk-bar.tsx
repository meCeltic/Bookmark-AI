"use client"

import { Archive, BookOpen, FolderInput, Star, Tag, Trash2, X, HeartPulse } from "lucide-react"
import { useState } from "react"
import { MenuContent, MenuItem, MenuRoot, MenuTrigger } from "@/components/ui/menu"
import { useDashboard } from "./provider"

export function BulkBar() {
  const api = useDashboard()
  const { selected, collections } = api.state
  const [tag, setTag] = useState<string | null>(null)
  if (selected.size === 0) return null
  const ids = [...selected]

  return (
    <div className="card anim-pop fixed bottom-5 left-1/2 z-30 flex -translate-x-1/2 items-center gap-1 px-2 py-1.5 shadow-card">
      <span className="px-2 font-mono text-[12px]">{ids.length} selected</span>
      <button type="button" className="btn btn-ghost btn-sm" onClick={() => api.patchMany(ids, { favourite: true }, "favourited")}><Star size={14} /> Favourite</button>
      <button type="button" className="btn btn-ghost btn-sm" onClick={() => api.patchMany(ids, { readAt: new Date().toISOString() }, "marked read")}><BookOpen size={14} /> Read</button>
      <MenuRoot>
        <MenuTrigger asChild><button type="button" className="btn btn-ghost btn-sm"><FolderInput size={14} /> Move</button></MenuTrigger>
        <MenuContent side="top">
          <MenuItem onSelect={() => api.patchMany(ids, { collectionId: null }, "unsorted")}>Unsorted</MenuItem>
          {collections.map((c) => <MenuItem key={c.id} onSelect={() => api.patchMany(ids, { collectionId: c.id }, `moved to ${c.name}`)}>{c.name}</MenuItem>)}
        </MenuContent>
      </MenuRoot>
      {tag === null ? (
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => setTag("")}><Tag size={14} /> Tag</button>
      ) : (
        <input
          autoFocus
          className="rule-input w-28 py-1 text-[13px]"
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
      <button type="button" className="btn btn-ghost btn-sm" onClick={() => api.checkHealth(ids)}><HeartPulse size={14} /> Check</button>
      <button type="button" className="btn btn-ghost btn-sm" onClick={() => api.patchMany(ids, { archivedAt: new Date().toISOString() }, "archived")}><Archive size={14} /> Archive</button>
      <button type="button" className="btn btn-ghost btn-sm text-danger" onClick={() => api.remove(ids)}><Trash2 size={14} /> Delete</button>
      <button type="button" className="btn btn-ghost btn-icon h-7 w-7" aria-label="Clear selection" onClick={() => api.dispatch({ type: "select", ids: [], mode: "set" })}><X size={14} /></button>
    </div>
  )
}
