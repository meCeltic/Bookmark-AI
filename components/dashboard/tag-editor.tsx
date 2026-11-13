"use client"

import { useState, type CSSProperties } from "react"
import { Check, FolderInput } from "lucide-react"
import type { Bookmark } from "@/lib/domain/bookmark"
import { cn } from "@/lib/utils"
import { MenuContent, MenuItem, MenuRoot, MenuSeparator, MenuTrigger } from "@/components/ui/menu"
import { useDashboard } from "./provider"

/**
 * The card's tags, each removable, plus an input that adds one on Enter.
 * Only tags that arrive on their own (the AI's, after mount) stamp in; the ones
 * already there and the ones typed here just appear.
 */
export function TagEditor({ bookmark, onEscape, className }: { bookmark: Bookmark; onEscape?: () => void; className?: string }) {
  const api = useDashboard()
  const [draft, setDraft] = useState("")
  // A dashed "+ tag" pill until clicked; then the input, until it blurs empty.
  const [adding, setAdding] = useState(false)
  const [seen] = useState(() => new Set(bookmark.tags))
  const [typed, setTyped] = useState<Set<string>>(() => new Set())
  const add = () => {
    const value = draft.trim()
    if (value) {
      setTyped((t) => new Set(t).add(value.toLowerCase()))
      void api.addTag(bookmark.id, value)
    }
    setDraft("")
  }
  let arrived = 0
  return (
    <div className={cn("flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1", className)} data-editing="true">
      {bookmark.tags.map((tag) => {
        const stamp = !seen.has(tag) && !typed.has(tag)
        return (
          <span key={tag} className={cn("stamp-group", stamp && "anim-stamp")} style={stamp ? ({ "--i": arrived++ } as CSSProperties) : undefined}>
            <span className="tag cursor-default hover:no-underline">{tag}</span>
            <button type="button" className="stamp-x !inline-flex" aria-label={`Remove tag ${tag}`} onClick={() => void api.removeTag(bookmark.id, tag)}>×</button>
          </span>
        )
      })}
      {adding ? (
        <input
          autoFocus
          className="h-6 w-24 min-w-0 rounded-full border border-dashed border-line-strong bg-transparent px-2 text-[13px] outline-none placeholder:text-ink-3 focus:border-solid focus:border-action"
          placeholder="tag"
          aria-label="Add a tag"
          maxLength={32}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => { if (!draft.trim()) setAdding(false) }}
          onKeyDown={(e) => {
            if (e.key === "Enter") { e.preventDefault(); add() }
            if (e.key === "Escape") {
              e.preventDefault()
              // Escape drops a half-typed tag first, then closes the pane as before.
              if (draft) { setDraft(""); setAdding(false) } else onEscape?.()
            }
          }}
        />
      ) : (
        <button
          type="button"
          className="inline-flex h-6 items-center rounded-full border border-dashed border-line-strong px-2 text-[13px] text-ink-3 transition-colors duration-[90ms] hover:border-ink-3 hover:text-ink"
          onClick={() => setAdding(true)}
        >
          + tag
        </button>
      )}
    </div>
  )
}

/** File the card in a collection. Plain text like a tag; the menu lists the collections and None. */
export function CollectionSelect({ bookmark, className }: { bookmark: Bookmark; className?: string }) {
  const api = useDashboard()
  const current = api.state.collections.find((c) => c.id === bookmark.collectionId)
  const pick = (id: string | null) => void api.patch(bookmark.id, { collectionId: id })
  return (
    <div className={cn("flex min-w-0 items-center", className)}>
      <MenuRoot>
        <MenuTrigger asChild>
          <button type="button" className="pick min-w-0" data-set={Boolean(current)} aria-label={current ? `Collection: ${current.name}` : "Add to collection"}>
            <FolderInput size={13} className="shrink-0" aria-hidden />
            <span className="truncate">{current ? current.name : "Add to collection…"}</span>
          </button>
        </MenuTrigger>
        <MenuContent align="start" className="min-w-[180px]">
          {api.state.collections.map((c) => (
            <MenuItem key={c.id} onSelect={() => pick(c.id)}>
              {bookmark.collectionId === c.id ? <Check size={14} /> : <span className="w-[14px]" />} {c.name}
            </MenuItem>
          ))}
          {api.state.collections.length ? <MenuSeparator /> : null}
          <MenuItem onSelect={() => pick(null)}>
            {bookmark.collectionId === null ? <Check size={14} /> : <span className="w-[14px]" />} None
          </MenuItem>
        </MenuContent>
      </MenuRoot>
    </div>
  )
}
