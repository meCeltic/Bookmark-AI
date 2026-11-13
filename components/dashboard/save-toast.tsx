"use client"

import { X } from "lucide-react"
import { useEffect, useRef, useState } from "react"
import { cn } from "@/lib/utils"
import { usePresence } from "@/lib/client/use-presence"
import { Favicon } from "@/components/favicon"
import { useDashboard } from "./provider"
import { CollectionSelect, TagEditor } from "./tag-editor"

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
  const timer = useRef<number | undefined>(undefined)

  useEffect(() => {
    const onSaved = (e: Event) => setId((e as CustomEvent<string>).detail)
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

  const live = id ? api.state.bookmarks.find((b) => b.id === id) : undefined
  // Stays mounted for the exit, showing the card as it was last seen.
  const { item: bookmark, state } = usePresence(live)
  if (!bookmark) return null
  const pending = api.state.pending.has(bookmark.id)
  const close = () => { setId(null); setHeld(false) }

  return (
    <section
      key={bookmark.id}
      aria-label="Saved"
      aria-live="polite"
      data-state={state}
      className={cn(
        "pop rise-anim fixed inset-x-3 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-40 min-w-0 p-3 sm:inset-x-auto sm:bottom-5 sm:right-5 sm:w-[360px]",
        pending && "reading",
        state === "closed" && "pointer-events-none",
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
        <button type="button" className="btn btn-ghost btn-icon -mr-1 -mt-1 h-7 w-7" aria-label="Close" onClick={close}>
          <X size={14} />
        </button>
      </div>
      <TagEditor bookmark={bookmark} onEscape={close} className="mt-2.5 pl-[26px]" />
      <CollectionSelect bookmark={bookmark} className="mt-2.5 pl-[26px]" />
    </section>
  )
}
