"use client"

import { useEffect, useState, useSyncExternalStore } from "react"
import { ArchiveRestore, CheckCheck, ExternalLink, Star, X } from "lucide-react"
import { domainOf } from "@/lib/url/normalize"
import { cn, formatDate } from "@/lib/utils"
import { usePresence } from "@/lib/client/use-presence"
import { readFlag, writeFlag } from "@/lib/client/prefs"
import { Favicon } from "@/components/favicon"
import { useDashboard } from "./provider"
import { CollectionSelect, TagEditor } from "./tag-editor"

const WIDE = "(min-width: 1024px)"
const subscribeWide = (cb: () => void) => {
  if (typeof window.matchMedia !== "function") return () => {}
  const mq = window.matchMedia(WIDE)
  mq.addEventListener("change", cb)
  return () => mq.removeEventListener("change", cb)
}
const readWide = () => typeof window.matchMedia === "function" && window.matchMedia(WIDE).matches

/**
 * The card in full beside the list: whole summary, editable tags, collection,
 * Open / Done / Star. Wide screens: a 380px column on the right. Below lg: a
 * bottom sheet. j/k carry it along the list, Esc closes it (keyboard.tsx).
 */
export function PreviewPane() {
  const api = useDashboard()
  const { state } = api
  const live = state.preview ? state.bookmarks.find((b) => b.id === state.preview) : undefined
  // Below lg the sheet stays mounted for its 140ms exit. At lg the column renders from live
  // state: opening and closing run inside a view transition (provider.setPreview), which slides it.
  const wide = useSyncExternalStore(subscribeWide, readWide, () => false)
  const sheet = usePresence(live)
  const bookmark = wide ? (live ?? null) : sheet.item
  const presence = wide ? "open" : sheet.state
  // The star pops when it is added, never on open or when moving between cards.
  const [starSeen, setStarSeen] = useState({ id: "", fav: false, pops: 0 })
  if (bookmark && (starSeen.id !== bookmark.id || starSeen.fav !== bookmark.favourite)) {
    const added = starSeen.id === bookmark.id && bookmark.favourite
    setStarSeen({ id: bookmark.id, fav: bookmark.favourite, pops: added ? starSeen.pops + 1 : starSeen.id === bookmark.id ? starSeen.pops : 0 })
  }
  // The key hints show on the first open in this browser only; after that `?` has them all.
  const [hints, setHints] = useState<boolean | null>(null)
  if (bookmark && hints === null) setHints(!readFlag("pane-keys"))
  if (!bookmark && hints) setHints(false)
  useEffect(() => {
    if (hints) writeFlag("pane-keys")
  }, [hints])
  if (!bookmark) return null
  const starPop = starSeen.id === bookmark.id && starSeen.pops > 0 && bookmark.favourite

  const close = () => api.setPreview(null)
  const pending = state.pending.has(bookmark.id)
  const archived = Boolean(bookmark.archivedAt)
  const meta = [
    bookmark.readingMinutes ? `${bookmark.readingMinutes} min read` : null,
    `Saved ${formatDate(bookmark.createdAt)}`,
    bookmark.readAt ? "Read" : archived ? null : "Unread",
  ].filter(Boolean)

  const finish = () => {
    if (archived) {
      void api.toggleArchive(bookmark)
      return
    }
    // Move along first, so the pane never shows a card that just left the list. The list
    // cancels the event when it moved on; otherwise this was the last card and the pane
    // closes inside done's own view transition (two transitions would cut each other short).
    const advanced = !window.dispatchEvent(new CustomEvent("bookmark-ai:advance", { detail: bookmark.id, cancelable: true }))
    void api.done([bookmark.id], { closePreview: !advanced })
  }

  return (
    <>
      <div aria-hidden data-state={presence} className="fade-anim fixed inset-0 z-40 bg-ink/20 lg:hidden dark:bg-black/50" onClick={close} />
      <aside
        aria-label="Preview"
        data-state={presence}
        className={cn(
          "pane-anim quiet-scroll fixed inset-x-0 bottom-0 z-50 max-h-[82dvh] min-w-0 overflow-y-auto rounded-t-[12px] border-t border-line bg-surface px-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] pt-4 shadow-pop",
          "lg:static lg:z-auto lg:max-h-none lg:w-[380px] lg:shrink-0 lg:[view-transition-name:preview] lg:rounded-none lg:border-l lg:border-t-0 lg:bg-bg lg:pb-8 lg:pt-5 lg:shadow-none",
          presence === "closed" && "pointer-events-none",
        )}
      >
        <div aria-hidden className="mx-auto -mt-1 mb-3 h-1 w-9 rounded-full bg-line-strong lg:hidden" />
        <div key={bookmark.id} className="anim-fade min-w-0">
          <header className="flex min-w-0 items-center gap-2 text-[13px] text-ink-3">
            <Favicon url={bookmark.url} src={bookmark.faviconUrl} />
            <span className="min-w-0 truncate">{domainOf(bookmark.url)}</span>
            {bookmark.health === "dead" ? <span className="shrink-0 text-[12px] font-medium text-danger">Dead link</span> : null}
            <button type="button" className="btn btn-ghost btn-icon -mr-2 ml-auto h-8 w-8 shrink-0" aria-label="Close preview" title="Close (esc)" onClick={close}>
              <X size={15} />
            </button>
          </header>

          <h2 className="mt-2 text-[20px] font-bold leading-[1.25] tracking-[-0.015em]">
            <a
              href={bookmark.url}
              target="_blank"
              rel="noopener noreferrer"
              className="outline-none hover:underline focus-visible:underline"
              onClick={() => api.markOpened(bookmark)}
            >
              {bookmark.title}
            </a>
          </h2>

          {bookmark.summary ? (
            <p className="mt-3 font-summary text-[16px] italic leading-[1.5] text-ink-2">{bookmark.summary}</p>
          ) : pending ? (
            <p className="mt-3 text-[13px] text-ink-3">Reading the page…</p>
          ) : bookmark.enrichment === "failed" ? (
            <p className="mt-3 text-[13px] text-ink-3">Couldn&rsquo;t read this page. The link is kept.</p>
          ) : null}

          <p className="mt-3 text-[13px] text-ink-3">{meta.join(" · ")}</p>

          <div className="mt-5 flex flex-wrap items-center gap-2">
            <button type="button" className="btn btn-primary btn-sm" onClick={() => api.open(bookmark)}>
              <ExternalLink size={14} /> Open
            </button>
            <button type="button" className="btn btn-ghost h-[30px] px-2.5 text-[14px] font-medium" onClick={finish} title={archived ? "Move to Inbox (u)" : "Mark read, clear from Inbox (d)"}>
              {archived ? <><ArchiveRestore size={14} /> Move to Inbox</> : <><CheckCheck size={14} /> Done</>}
            </button>
            <button
              type="button"
              className="btn btn-ghost h-[30px] px-2.5 text-[14px] font-medium"
              aria-pressed={bookmark.favourite}
              onClick={() => void api.patch(bookmark.id, { favourite: !bookmark.favourite })}
            >
              <Star key={starSeen.pops} size={14} className={cn(starPop && "anim-star", bookmark.favourite && "fill-mark text-ink")} />
              {bookmark.favourite ? "Starred" : "Star"}
            </button>
          </div>

          <div className="mt-6 border-t border-line pt-4">
            <p className="text-[13px] font-medium text-ink-2">Tags</p>
            <TagEditor bookmark={bookmark} onEscape={close} className="mt-2" />
            <CollectionSelect bookmark={bookmark} className="mt-3 -ml-0.5" />
          </div>

          {hints ? (
            <p className="mt-6 hidden text-[12px] text-ink-3 lg:block">
              <span className="kbd">j</span> <span className="kbd">k</span> next and previous · <span className="kbd">o</span> open · <span className="kbd">d</span> done · <span className="kbd">esc</span> close · <span className="kbd">?</span> all keys
            </p>
          ) : null}
        </div>
      </aside>
    </>
  )
}
