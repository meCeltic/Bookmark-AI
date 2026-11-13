"use client"

import { X } from "lucide-react"
import { useEffect, useRef, useState } from "react"
import { cn } from "@/lib/utils"
import { Favicon } from "@/components/favicon"
import { useDashboard } from "./provider"

const STAY_MS = 9000

/**
 * After a save: the title, the tags the page earned (removable, addable) and a
 * collection picker. It follows the live card, so AI tags appear as they land.
 * Lives inside the provider (sonner's toaster sits outside it).
 */
export function SaveToast() {
  const api = useDashboard()
  const [id, setId] = useState<string | null>(null)
  const [held, setHeld] = useState(false)
  const [draft, setDraft] = useState("")
  const timer = useRef<number | undefined>(undefined)

  useEffect(() => {
    const onSaved = (e: Event) => {
      setId((e as CustomEvent<string>).detail)
      setDraft("")
    }
    window.addEventListener("bookmark-ai:saved", onSaved)
    return () => window.removeEventListener("bookmark-ai:saved", onSaved)
  }, [])

  // Leaves on its own unless the pointer or focus is inside it.
  useEffect(() => {
    window.clearTimeout(timer.current)
    if (!id || held) return
    timer.current = window.setTimeout(() => setId(null), STAY_MS)
    return () => window.clearTimeout(timer.current)
  }, [id, held])

  const bookmark = id ? api.state.bookmarks.find((b) => b.id === id) : undefined
  if (!bookmark) return null
  const pending = api.state.pending.has(bookmark.id)

  const addTag = () => {
    const value = draft.trim()
    if (value) void api.addTag(bookmark.id, value)
    setDraft("")
  }

  return (
    <section
      aria-label="Saved"
      aria-live="polite"
      className={cn(
        "pop anim-rise fixed inset-x-3 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-40 min-w-0 p-3 sm:inset-x-auto sm:bottom-5 sm:right-5 sm:w-[360px]",
        pending && "reading",
      )}
      onPointerEnter={() => setHeld(true)}
      onPointerLeave={() => setHeld(false)}
      onFocus={() => setHeld(true)}
      onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setHeld(false) }}
    >
      <div className="flex min-w-0 items-start gap-2.5">
        <span className="mt-0.5"><Favicon url={bookmark.url} src={bookmark.faviconUrl} /></span>
        <div className="min-w-0 flex-1">
          <p className="text-[13px] text-ink-3">{pending ? "Saved. Reading the page…" : "Saved"}</p>
          <p className="truncate text-[15px] font-semibold">{bookmark.title}</p>
        </div>
        <button type="button" className="btn btn-ghost btn-icon -mr-1 -mt-1 h-7 w-7" aria-label="Close" onClick={() => setId(null)}>
          <X size={14} />
        </button>
      </div>

      <div className="mt-2.5 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 pl-[26px]" data-editing="true">
        {bookmark.tags.map((tag, i) => (
          <span key={tag} className="stamp-group anim-stamp" style={{ "--i": i } as React.CSSProperties}>
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
            if (e.key === "Enter") { e.preventDefault(); addTag() }
            if (e.key === "Escape") setId(null)
          }}
        />
      </div>

      <label className="mt-2.5 flex min-w-0 items-center gap-2 pl-[26px] text-[13px] text-ink-2">
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
    </section>
  )
}
