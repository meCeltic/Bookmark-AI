"use client"

import { Archive, ArchiveRestore, BookOpen, Check, Copy, ExternalLink, FolderInput, MoreHorizontal, RefreshCw, Sparkles, Star, Tag, Trash2 } from "lucide-react"
import { memo, useState, type KeyboardEvent, type MouseEvent } from "react"
import { toast } from "sonner"
import type { Bookmark } from "@/lib/domain/bookmark"
import { domainOf } from "@/lib/url/normalize"
import { cn, formatDate } from "@/lib/utils"
import { Favicon } from "@/components/favicon"
import { MenuContent, MenuItem, MenuRoot, MenuSeparator, MenuSub, MenuTrigger } from "@/components/ui/menu"
import { useDashboard } from "./provider"

interface Props {
  bookmark: Bookmark
  layout: "grid" | "list"
  index: number
  focused: boolean
  pending: boolean
  selected: boolean
  onFocus: () => void
}

export const IndexCard = memo(function IndexCard({ bookmark, layout, index, focused, pending, selected, onFocus }: Props) {
  const api = useDashboard()
  const [tagDraft, setTagDraft] = useState<string | null>(null)
  const { state } = api
  const selecting = state.selected.size > 0

  const toggleSelect = (e?: MouseEvent) => {
    e?.stopPropagation()
    api.dispatch({ type: "select", ids: [bookmark.id], mode: "toggle" })
  }

  const openCard = (e: MouseEvent) => {
    if (selecting || e.metaKey || e.ctrlKey) {
      toggleSelect(e)
      return
    }
    api.open(bookmark)
  }

  const submitTag = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault()
      const value = (e.currentTarget.value || "").trim()
      if (value) void api.addTag(bookmark.id, value)
      setTagDraft(null)
    } else if (e.key === "Escape") setTagDraft(null)
  }

  const copy = async () => {
    await navigator.clipboard.writeText(bookmark.url)
    toast("Link copied")
  }

  const domain = domainOf(bookmark.url)
  const unread = bookmark.readAt === null && !bookmark.archivedAt
  const aiLabel =
    bookmark.enrichment === "done" ? "AI summary" : bookmark.enrichment === "fallback" ? "From page metadata" : bookmark.enrichment === "failed" ? "Could not read this page" : "Reading page…"

  const menu = (
    <MenuRoot>
      <MenuTrigger asChild>
        <button type="button" className="btn btn-ghost btn-icon h-7 w-7" aria-label="More" onClick={(e) => e.stopPropagation()}>
          <MoreHorizontal size={15} />
        </button>
      </MenuTrigger>
      <MenuContent onClick={(e) => e.stopPropagation()}>
        <MenuItem onSelect={() => api.open(bookmark)}><ExternalLink size={14} /> Open<span className="kbd ml-auto">↵</span></MenuItem>
        <MenuItem onSelect={copy}><Copy size={14} /> Copy link<span className="kbd ml-auto">c</span></MenuItem>
        <MenuSeparator />
        <MenuItem onSelect={() => api.patch(bookmark.id, { favourite: !bookmark.favourite })}>
          <Star size={14} /> {bookmark.favourite ? "Unfavourite" : "Favourite"}<span className="kbd ml-auto">f</span>
        </MenuItem>
        <MenuItem onSelect={() => api.patch(bookmark.id, { readAt: unread ? new Date().toISOString() : null })}>
          <BookOpen size={14} /> {unread ? "Mark as read" : "Mark unread"}<span className="kbd ml-auto">r</span>
        </MenuItem>
        <MenuItem onSelect={() => setTagDraft("")}><Tag size={14} /> Add tag<span className="kbd ml-auto">t</span></MenuItem>
        <MenuSub label={<><FolderInput size={14} /> Move to</>}>
          <MenuItem onSelect={() => api.patch(bookmark.id, { collectionId: null })}>
            {bookmark.collectionId === null ? <Check size={14} /> : <span className="w-[14px]" />} Unsorted
          </MenuItem>
          {state.collections.map((c) => (
            <MenuItem key={c.id} onSelect={() => api.patch(bookmark.id, { collectionId: c.id })}>
              {bookmark.collectionId === c.id ? <Check size={14} /> : <span className="w-[14px]" />} {c.name}
            </MenuItem>
          ))}
        </MenuSub>
        <MenuSeparator />
        <MenuItem onSelect={() => api.reEnrich(bookmark.id)} disabled={pending}><RefreshCw size={14} /> Read page again</MenuItem>
        <MenuItem onSelect={() => api.patch(bookmark.id, { archivedAt: bookmark.archivedAt ? null : new Date().toISOString() })}>
          {bookmark.archivedAt ? <ArchiveRestore size={14} /> : <Archive size={14} />} {bookmark.archivedAt ? "Restore" : "Archive"}<span className="kbd ml-auto">e</span>
        </MenuItem>
        <MenuItem danger onSelect={() => api.remove([bookmark.id])}><Trash2 size={14} /> Delete<span className="kbd ml-auto">⌫</span></MenuItem>
      </MenuContent>
    </MenuRoot>
  )

  const tags = (
    <div className="flex flex-wrap items-center gap-1.5">
      {bookmark.tags.map((tag) => (
        <button
          key={tag}
          type="button"
          className={cn("stamp anim-stamp", state.tags.includes(tag) && "stamp-active")}
          data-active={state.tags.includes(tag)}
          title={state.tags.includes(tag) ? `Stop filtering by ${tag}` : `Filter by ${tag}`}
          onClick={(e) => {
            e.stopPropagation()
            const next = state.tags.includes(tag) ? state.tags.filter((t) => t !== tag) : [...state.tags, tag]
            api.dispatch({ type: "tags", tags: next })
          }}
          onContextMenu={(e) => {
            e.preventDefault()
            void api.removeTag(bookmark.id, tag)
          }}
        >
          {tag}
        </button>
      ))}
      {tagDraft !== null ? (
        <input
          autoFocus
          className="h-5 w-24 border-b border-accent bg-transparent font-mono text-[10.5px] outline-none"
          placeholder="tag, enter"
          maxLength={32}
          value={tagDraft}
          onChange={(e) => setTagDraft(e.target.value)}
          onKeyDown={submitTag}
          onBlur={() => setTagDraft(null)}
          onClick={(e) => e.stopPropagation()}
        />
      ) : null}
      {pending && bookmark.tags.length === 0 ? (
        <span className="font-mono text-[10.5px] text-ink-3 caret">stamping tags</span>
      ) : null}
    </div>
  )

  const selectBox = (
    <button
      type="button"
      role="checkbox"
      aria-checked={selected}
      aria-label={selected ? "Deselect" : "Select"}
      onClick={toggleSelect}
      className={cn(
        "inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-[2px] border transition-colors",
        selected ? "border-accent bg-accent text-accent-ink" : "border-border-strong bg-surface opacity-0 group-hover:opacity-100 group-focus-within:opacity-100",
        selecting && "opacity-100",
      )}
    >
      {selected ? <Check size={11} strokeWidth={3} /> : null}
    </button>
  )

  // ---------------------------------------------------------------- list ----
  if (layout === "list") {
    return (
      <div
        role="row"
        tabIndex={-1}
        data-id={bookmark.id}
        data-selected={selected}
        data-focused={focused}
        onClick={openCard}
        onMouseEnter={onFocus}
        className={cn(
          "group flex min-h-[44px] cursor-pointer items-center gap-3 border-b border-border px-3 py-2 transition-colors hover:bg-surface",
          focused && "bg-surface ring-1 ring-inset ring-border-strong",
          selected && "bg-accent-soft/40",
        )}
      >
        {selectBox}
        <Favicon url={bookmark.url} src={bookmark.faviconUrl} />
        <div className="flex min-w-0 flex-1 items-baseline gap-3">
          <span className={cn("truncate font-display text-[15px] font-medium", unread && "font-semibold")}>{bookmark.title}</span>
          <span className="hidden truncate font-mono text-[11px] text-ink-3 sm:inline">{domain}</span>
        </div>
        <div className="hidden items-center gap-1.5 md:flex">{bookmark.tags.slice(0, 3).map((t) => <span key={t} className="stamp stamp-quiet pointer-events-none h-[18px]">{t}</span>)}</div>
        {bookmark.favourite ? <Star size={13} className="fill-accent text-accent" /> : null}
        {bookmark.health === "dead" ? <span className="font-mono text-[10px] uppercase text-danger">dead</span> : null}
        <span className="w-14 text-right font-mono text-[11px] text-ink-3">{formatDate(bookmark.createdAt)}</span>
        <div onClick={(e) => e.stopPropagation()}>{menu}</div>
      </div>
    )
  }

  // ---------------------------------------------------------------- grid ----
  return (
    <article
      tabIndex={-1}
      data-id={bookmark.id}
      data-selected={selected}
      data-focused={focused}
      style={{ "--i": Math.min(index, 8) } as React.CSSProperties}
      onClick={openCard}
      onMouseEnter={onFocus}
      className={cn(
        "card anim-enter group relative flex cursor-pointer flex-col p-4 outline-none",
        focused && "border-border-strong shadow-card",
        pending && "border-dashed",
      )}
    >
      {bookmark.imageUrl && !pending ? (
        <div className="-mx-4 -mt-4 mb-3 aspect-[3/2] overflow-hidden border-b border-border bg-surface-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={bookmark.imageUrl} alt="" loading="lazy" referrerPolicy="no-referrer" className="h-full w-full object-cover" onError={(e) => (e.currentTarget.parentElement!.style.display = "none")} />
        </div>
      ) : null}

      <header className="mb-2 flex items-center gap-2">
        {selectBox}
        <Favicon url={bookmark.url} src={bookmark.faviconUrl} />
        <span className="meta truncate">{domain}</span>
        <span className="meta shrink-0 before:mx-1.5 before:content-['·']">{formatDate(bookmark.createdAt)}</span>
        <span className="ml-auto flex shrink-0 items-center gap-1">
          {bookmark.favourite ? <Star size={13} className="fill-accent text-accent" /> : null}
          {unread ? <span className="h-1.5 w-1.5 rounded-full bg-accent" title="Unread" /> : null}
          {bookmark.health === "dead" ? <span className="font-mono text-[10px] uppercase text-danger">dead</span> : null}
          {bookmark.health === "redirected" ? <span className="font-mono text-[10px] uppercase text-ink-3">moved</span> : null}
        </span>
      </header>

      <h3 className={cn("line-clamp-2 font-display text-[17px] font-semibold leading-snug", pending && "text-ink-2")}>
        {pending && !bookmark.description ? <span className="caret">{bookmark.title}</span> : bookmark.title}
      </h3>

      {bookmark.summary ? (
        <p className="mt-1.5 line-clamp-3 text-[14px] leading-[1.45] text-ink-2">{bookmark.summary}</p>
      ) : pending ? (
        <p className="mt-1.5 font-mono text-[11px] text-ink-3">Reading page…</p>
      ) : bookmark.enrichment === "failed" ? (
        <p className="mt-1.5 font-mono text-[11px] text-ink-3">Couldn&rsquo;t read this page, kept the link.</p>
      ) : null}

      <div className="mt-3 flex items-end justify-between gap-2">
        {tags}
      </div>

      <footer className="mt-3 flex items-center gap-1 border-t border-border pt-2 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100 data-[focused=true]:opacity-100" data-focused={focused}>
        <span className="font-mono text-[10.5px] text-ink-3" title={aiLabel}>
          <Sparkles size={11} className={cn("mr-1 inline", bookmark.enrichment === "done" ? "text-accent" : "text-ink-3")} />
          {bookmark.enrichment === "done" ? "ai" : bookmark.enrichment === "fallback" ? "meta" : bookmark.enrichment === "failed" ? "no read" : "…"}
          {bookmark.readingMinutes ? ` · ${bookmark.readingMinutes} min` : ""}
        </span>
        <span className="ml-auto flex items-center">
          <button type="button" className="btn btn-ghost btn-icon h-7 w-7" title="Copy link" aria-label="Copy link" onClick={(e) => { e.stopPropagation(); void copy() }}><Copy size={14} /></button>
          <button type="button" className="btn btn-ghost btn-icon h-7 w-7" title="Favourite" aria-label="Favourite" onClick={(e) => { e.stopPropagation(); void api.patch(bookmark.id, { favourite: !bookmark.favourite }) }}>
            <Star size={14} className={cn(bookmark.favourite && "fill-accent text-accent")} />
          </button>
          <button type="button" className="btn btn-ghost btn-icon h-7 w-7" title="Add tag" aria-label="Add tag" onClick={(e) => { e.stopPropagation(); setTagDraft("") }}><Tag size={14} /></button>
          {menu}
        </span>
      </footer>
    </article>
  )
})
