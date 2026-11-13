"use client"

import { useState, type CSSProperties } from "react"
import type { Bookmark } from "@/lib/domain/bookmark"
import { cn } from "@/lib/utils"
import { useDashboard } from "./provider"

/** The card's tags, each removable, plus an input that adds one on Enter. */
export function TagEditor({ bookmark, onEscape, stamp = true, className }: { bookmark: Bookmark; onEscape?: () => void; stamp?: boolean; className?: string }) {
  const api = useDashboard()
  const [draft, setDraft] = useState("")
  const add = () => {
    const value = draft.trim()
    if (value) void api.addTag(bookmark.id, value)
    setDraft("")
  }
  return (
    <div className={cn("flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1", className)} data-editing="true">
      {bookmark.tags.map((tag, i) => (
        <span key={tag} className={cn("stamp-group", stamp && "anim-stamp")} style={{ "--i": i } as CSSProperties}>
          <span className="tag cursor-default hover:no-underline">{tag}</span>
          <button type="button" className="stamp-x !inline-flex" aria-label={`Remove tag ${tag}`} onClick={() => void api.removeTag(bookmark.id, tag)}>×</button>
        </span>
      ))}
      <input
        className="h-6 w-24 min-w-0 rounded-[4px] bg-surface-2 px-1.5 text-[13px] outline-none placeholder:text-ink-3 focus:shadow-[0_0_0_2px_var(--action)]"
        placeholder="add tag"
        aria-label="Add a tag"
        maxLength={32}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") { e.preventDefault(); add() }
          if (e.key === "Escape") { e.preventDefault(); onEscape?.() }
        }}
      />
    </div>
  )
}

/** Pick the card's collection; "None" leaves it loose in the Inbox. */
export function CollectionSelect({ bookmark, className }: { bookmark: Bookmark; className?: string }) {
  const api = useDashboard()
  return (
    <label className={cn("flex min-w-0 items-center gap-2 text-[13px] text-ink-2", className)}>
      <span className="shrink-0">Collection</span>
      <select
        className="field h-8 min-w-0 flex-1 px-2 text-[13px]"
        value={bookmark.collectionId ?? ""}
        onChange={(e) => void api.patch(bookmark.id, { collectionId: e.target.value || null })}
      >
        <option value="">None</option>
        {api.state.collections.map((c) => (
          <option key={c.id} value={c.id}>{c.name}</option>
        ))}
      </select>
    </label>
  )
}
