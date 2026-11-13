"use client"

import { ArchiveRestore, BookOpen, Check, CheckCheck, Copy, ExternalLink, FolderInput, MoreHorizontal, PanelRight, RefreshCw, Star, Tag, Trash2 } from "lucide-react"
import { useEffect, useState, type CSSProperties, type KeyboardEvent, type MouseEvent, type ReactNode } from "react"
import { toast } from "sonner"
import type { Bookmark } from "@/lib/domain/bookmark"
import { bareName, domainOf, registrableDomain } from "@/lib/url/normalize"
import { cn, formatDate } from "@/lib/utils"
import { Favicon } from "@/components/favicon"
import { MenuContent, MenuItem, MenuRoot, MenuSeparator, MenuSub, MenuTrigger } from "@/components/ui/menu"
import { useDashboard } from "./provider"
import { highlightRanges } from "@/lib/search/rank"

/** Search hits are wrapped in native <mark>; globals.css paints it as the highlighter. */
function markRanges(text: string, ranges: [number, number][]): ReactNode {
  return highlightRanges(text, ranges).map((seg, i) => (seg.hit ? <mark key={i}>{seg.text}</mark> : <span key={i}>{seg.text}</span>))
}

/** Wrap the query words found in `text` with <mark>. */
function highlight(text: string, query: string): ReactNode {
  const words = query.trim().toLowerCase().split(/\s+/).filter((w) => w.length >= 2)
  if (!words.length) return text
  const lower = text.toLowerCase()
  const ranges: [number, number][] = []
  for (const w of words) {
    let at = lower.indexOf(w)
    while (at !== -1) {
      ranges.push([at, at + w.length - 1])
      at = lower.indexOf(w, at + w.length)
    }
  }
  if (!ranges.length) return text
  return markRanges(text, ranges)
}

interface Props {
  bookmark: Bookmark
  layout: "grid" | "list"
  /** Position in the list; staggers the dead-link stamps after a check. */
  index?: number
  focused: boolean
  pending: boolean
  selected: boolean
  /** Shown in the preview pane right now. */
  previewed?: boolean
  /** Saved moments ago: plays the entrance once. */
  fresh?: boolean
  /** Briefly marked after a duplicate save or a reveal. */
  flash?: boolean
  /** View transition name, only for the first few dozen visible cards. */
  transitionName?: string
  onFocus: () => void
  /** The pointer is over the card (the list ignores it while the keyboard drives). */
  onHover?: () => void
  /** Open this card in the preview pane. */
  onPreview?: () => void
  /** Inclusive index pairs in the title that matched the search, if any. */
  titleRanges?: [number, number][]
}

export function IndexCard({ bookmark, layout, index = 0, focused, pending, selected, previewed, fresh, flash, transitionName, onFocus, onHover, onPreview, titleRanges }: Props) {
  const api = useDashboard()
  const [tagDraft, setTagDraft] = useState<string | null>(null)
  // The star pops when it is added (click, `f`, bulk), never when it is taken away.
  const [starPops, setStarPops] = useState(0)
  const [wasFavourite, setWasFavourite] = useState(bookmark.favourite)
  if (wasFavourite !== bookmark.favourite) {
    setWasFavourite(bookmark.favourite)
    if (bookmark.favourite) setStarPops((n) => n + 1)
  }
  // What the card looked like when it mounted: a summary, tags or a dead link that arrive later get the reveal.
  const [hadSummary] = useState(Boolean(bookmark.summary))
  const [hadTags] = useState(bookmark.tags.length > 0)
  const [wasDead] = useState(bookmark.health === "dead")
  const { state } = api
  const selecting = state.selected.size > 0

  // "t" on a focused card opens the tag input (see keyboard.tsx).
  useEffect(() => {
    const onTag = (e: Event) => {
      if ((e as CustomEvent<string>).detail === bookmark.id) setTagDraft("")
    }
    window.addEventListener("bookmark-ai:tag", onTag)
    return () => window.removeEventListener("bookmark-ai:tag", onTag)
  }, [bookmark.id])

  const toggleSelect = (e?: MouseEvent) => {
    e?.stopPropagation()
    api.dispatch({ type: "select", ids: [bookmark.id], mode: "toggle" })
  }

  // A click opens the link in a new tab; ⌘/Ctrl-click previews; while selecting, a click toggles.
  const onCardClick = (e: MouseEvent) => {
    if (selecting) {
      toggleSelect(e)
      return
    }
    if ((e.metaKey || e.ctrlKey) && onPreview) {
      onPreview()
      return
    }
    api.open(bookmark)
  }

  // The title is a real link (new tab); it only needs to record the open.
  const onTitleClick = (e: MouseEvent<HTMLAnchorElement>) => {
    e.stopPropagation()
    if (selecting) {
      e.preventDefault()
      toggleSelect()
      return
    }
    api.markOpened(bookmark)
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

  const toggleStar = () => void api.patch(bookmark.id, { favourite: !bookmark.favourite })

  const domain = domainOf(bookmark.url)
  const unread = bookmark.readAt === null && !bookmark.archivedAt
  const archived = Boolean(bookmark.archivedAt)
  const title = titleRanges ? markRanges(bookmark.title, titleRanges) : highlight(bookmark.title, state.query)
  const summary = bookmark.summary ? highlight(bookmark.summary, state.query) : null
  const age = formatDate(bookmark.createdAt)
  const failed = !summary && bookmark.enrichment === "failed" && !pending

  const menu = (
    <MenuRoot>
      <MenuTrigger asChild>
        <button type="button" className="btn btn-ghost btn-icon h-7 w-7" aria-label="More" title="More" onClick={(e) => e.stopPropagation()}>
          <MoreHorizontal size={15} />
        </button>
      </MenuTrigger>
      <MenuContent onClick={(e) => e.stopPropagation()}>
        <MenuItem onSelect={() => api.open(bookmark)}><ExternalLink size={14} /> Open<span className="kbd ml-auto">o</span></MenuItem>
        {onPreview ? <MenuItem onSelect={onPreview}><PanelRight size={14} /> Details<span className="kbd ml-auto">space</span></MenuItem> : null}
        <MenuItem onSelect={copy}><Copy size={14} /> Copy link<span className="kbd ml-auto">c</span></MenuItem>
        <MenuItem onSelect={() => toggleSelect()}><Check size={14} /> {selected ? "Deselect" : "Select"}<span className="kbd ml-auto">x</span></MenuItem>
        <MenuSeparator />
        {archived ? (
          <MenuItem onSelect={() => api.toggleArchive(bookmark)}><ArchiveRestore size={14} /> Move to Inbox<span className="kbd ml-auto">u</span></MenuItem>
        ) : (
          <MenuItem onSelect={() => api.done([bookmark.id])}><CheckCheck size={14} /> Done<span className="kbd ml-auto">d</span></MenuItem>
        )}
        <MenuItem onSelect={() => api.patch(bookmark.id, { readAt: unread ? new Date().toISOString() : null })}>
          <BookOpen size={14} /> {unread ? "Mark as read" : "Mark unread"}<span className="kbd ml-auto">r</span>
        </MenuItem>
        <MenuItem onSelect={() => setTagDraft("")}><Tag size={14} /> Add tag<span className="kbd ml-auto">t</span></MenuItem>
        <MenuSub label={<><FolderInput size={14} /> Move to</>}>
          <MenuItem onSelect={() => api.patch(bookmark.id, { collectionId: null })}>
            {bookmark.collectionId === null ? <Check size={14} /> : <span className="w-[14px]" />} No collection
          </MenuItem>
          {state.collections.map((c) => (
            <MenuItem key={c.id} onSelect={() => api.patch(bookmark.id, { collectionId: c.id })}>
              {bookmark.collectionId === c.id ? <Check size={14} /> : <span className="w-[14px]" />} {c.name}
            </MenuItem>
          ))}
        </MenuSub>
        <MenuSeparator />
        <MenuItem onSelect={() => api.reEnrich(bookmark.id)} disabled={pending}><RefreshCw size={14} /> Read page again</MenuItem>
        <MenuItem danger onSelect={() => api.remove([bookmark.id])}><Trash2 size={14} /> Delete<span className="kbd ml-auto">⌫</span></MenuItem>
      </MenuContent>
    </MenuRoot>
  )

  const starButton = (
    <button
      type="button"
      className="btn btn-ghost btn-icon h-7 w-7"
      title={bookmark.favourite ? "Unstar (f)" : "Star (f)"}
      aria-label={bookmark.favourite ? "Unstar" : "Star"}
      aria-pressed={bookmark.favourite}
      onClick={(e) => { e.stopPropagation(); toggleStar() }}
    >
      <Star key={starPops} size={14} className={cn(starPops > 0 && bookmark.favourite && "anim-star", bookmark.favourite && "fill-mark text-ink")} />
    </button>
  )
  const copyButton = (
    <button type="button" className="btn btn-ghost btn-icon h-7 w-7" title="Copy link (c)" aria-label="Copy link" onClick={(e) => { e.stopPropagation(); void copy() }}>
      <Copy size={14} />
    </button>
  )
  // Hover actions. In Done they are about getting a card back, so they say so in words.
  const actions = (
    <span className="row-actions" onClick={(e) => e.stopPropagation()}>
      {archived ? (
        <button type="button" className="btn btn-ghost btn-sm h-7 px-2" title="Move to Inbox (u)" onClick={() => void api.toggleArchive(bookmark)}>
          Move to Inbox
        </button>
      ) : (
        <>
          {bookmark.readingMinutes ? <span className="mr-1 text-[12px] tabular-nums text-ink-3" title={`${bookmark.readingMinutes} min read`}>{bookmark.readingMinutes} min</span> : null}
          {starButton}
          <button type="button" className="btn btn-ghost btn-icon h-7 w-7" title="Done: mark read, clear from Inbox (d)" aria-label="Done" onClick={() => void api.done([bookmark.id])}>
            <CheckCheck size={14} />
          </button>
        </>
      )}
      {copyButton}
      <span className="row-more">{menu}</span>
    </span>
  )
  // Touch screens and phones have no hover: the ⋯ stays out.
  const touchMore = <span className="row-touch-more" onClick={(e) => e.stopPropagation()}>{menu}</span>

  const tagInput =
    tagDraft !== null ? (
      <input
        autoFocus
        className="h-6 w-28 min-w-0 shrink-0 rounded-[4px] bg-surface-2 px-1.5 text-[13px] font-normal outline-none focus:shadow-[0_0_0_2px_var(--action)]"
        placeholder="tag, enter"
        aria-label="New tag"
        maxLength={32}
        value={tagDraft}
        onChange={(e) => setTagDraft(e.target.value)}
        onKeyDown={submitTag}
        onBlur={() => setTagDraft(null)}
        onClick={(e) => e.stopPropagation()}
      />
    ) : null

  const toggleTag = (tag: string) => {
    const next = state.tags.includes(tag) ? state.tags.filter((t) => t !== tag) : [...state.tags, tag]
    api.dispatch({ type: "tags", tags: next })
  }

  const tags = (
    <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
      {bookmark.tags.map((tag, i) => (
        <span key={tag} className={cn("stamp-group", !hadTags && "anim-stamp")} style={{ "--i": i } as CSSProperties}>
          <button
            type="button"
            className="tag"
            data-active={state.tags.includes(tag)}
            title={state.tags.includes(tag) ? `Stop filtering by #${tag}` : `Filter by #${tag}`}
            onClick={(e) => { e.stopPropagation(); toggleTag(tag) }}
          >
            {tag}
          </button>
          <button
            type="button"
            aria-label={`Remove tag ${tag}`}
            title="Remove tag"
            className="stamp-x"
            onClick={(e) => { e.stopPropagation(); void api.removeTag(bookmark.id, tag) }}
          >
            ×
          </button>
        </span>
      ))}
      {tagInput}
    </div>
  )

  // The favicon's 16px slot doubles as the selection check on hover or while selecting.
  const selectSlot = (
    <span className="select-slot" data-selecting={selecting}>
      <span className="select-icon inline-flex"><Favicon url={bookmark.url} src={bookmark.faviconUrl} /></span>
      <button
        type="button"
        role="checkbox"
        aria-checked={selected}
        aria-label={selected ? "Deselect" : "Select"}
        onClick={toggleSelect}
        className={cn(
          "select-check hover-reveal inline-flex items-center justify-center rounded-[3px] border transition-colors",
          selected ? "border-action bg-action text-action-ink" : "border-line-strong bg-surface",
          selecting && "opacity-100",
        )}
      >
        {selected ? <Check size={11} strokeWidth={3} /> : null}
      </button>
    </span>
  )

  // Dead links found by a check stamp in one after another; ones already dead on load just sit there.
  const health =
    bookmark.health === "dead" ? (
      <span className={cn("inline-block shrink-0 text-[12px] font-medium text-danger", !wasDead && "anim-stamp")} style={{ "--i": index % 12 } as CSSProperties}>Dead link</span>
    ) : bookmark.health === "redirected" ? <span className="shrink-0 text-[12px] text-ink-3">Moved</span>
    : null

  const common = {
    "data-id": bookmark.id,
    "data-selected": selected,
    "data-focused": focused,
    "data-previewed": Boolean(previewed),
    "data-editing": tagDraft !== null,
    onClick: onCardClick,
    onMouseEnter: onHover ?? onFocus,
    onMouseMove: onHover,
    style: transitionName ? ({ viewTransitionName: transitionName } as CSSProperties) : undefined,
  }
  const titleLink = (className: string) => (
    // A real link: new tab, the URL in the status bar, Tab reaches every row.
    <a
      href={bookmark.url}
      target="_blank"
      rel="noopener noreferrer"
      onClick={onTitleClick}
      onAuxClick={(e) => { if (e.button === 1) api.markOpened(bookmark) }}
      onFocus={onFocus}
      className={className}
    >
      {title}
    </a>
  )

  // "domain · age" as one unit where only the domain gives way. A dead link: the domain struck, "Dead" for the age.
  const dead = bookmark.health === "dead"
  const tail = dead ? "Dead" : age
  const meta = (host: string) => (
    <>
      <span className={cn("min-w-0 truncate", dead && "line-through decoration-ink-3")}>{host}</span>
      <span className={cn("shrink-0 whitespace-pre", dead && !wasDead && "anim-stamp")} style={dead ? ({ "--i": index % 12 } as CSSProperties) : undefined}>{` · ${tail}`}</span>
    </>
  )

  // ---------------------------------------------------------------- list ----
  if (layout === "list") {
    return (
      <li
        {...common}
        className={cn(
          "row row-list group relative min-w-0 cursor-pointer gap-x-3 px-2 py-2 sm:px-3",
          pending && "reading",
          fresh && "anim-enter",
          flash && "flash-ring",
        )}
      >
        <span className="flex h-[22px] items-center self-start">{selectSlot}</span>
        <div className="min-w-0">
          <div className="flex h-[22px] min-w-0 items-center gap-1.5">
            {titleLink(cn("min-w-0 truncate text-[15px] leading-[22px] text-ink outline-none hover:underline", unread ? "font-semibold" : "font-normal", pending && !bookmark.summary && "text-ink-2"))}
            {bookmark.favourite ? <FavStar pops={starPops} /> : null}
            {/* A dead link shows in the meta column instead (struck domain, "Dead"). */}
            {bookmark.health === "dead" ? null : health}
            {tagInput}
          </div>
          {/* Line 2: the summary, stopping short of the meta column. Phones: up to two lines, meta on line 3. */}
          {summary ? (
            <p className={cn("mt-0.5 truncate font-summary text-[14px] italic leading-5 text-ink-2 max-sm:line-clamp-2 max-sm:whitespace-normal lg:max-w-[72ch]", !hadSummary && "anim-wipe")}>{summary}</p>
          ) : failed ? (
            <p className="mt-0.5 truncate text-[13px] leading-5 text-ink-3">Couldn&rsquo;t read this page</p>
          ) : null}
          <p className="mt-0.5 flex min-w-0 text-[13px] leading-5 text-ink-3 sm:hidden">{meta(domain)}</p>
        </div>
        {/* Wide: a fixed column for domain · age; hover swaps it for the actions, so nothing covers the summary. */}
        <div className="row-slot max-sm:hidden">
          {/* The domain gives way before the age does. */}
          <span className="row-meta flex min-w-0 text-[13px] text-ink-3" title={dead ? `${domain}: the link is dead` : domain}>{meta(metaHost(domain, tail))}</span>
          {actions}
        </div>
        {touchMore}
      </li>
    )
  }

  // ---------------------------------------------------------------- grid ----
  return (
    <li
      {...common}
      className={cn(
        "card group relative flex min-w-0 cursor-pointer flex-col p-5 outline-none",
        pending && "reading",
        fresh && "anim-enter",
        flash && "flash-ring",
      )}
    >
      <header className="flex h-5 min-w-0 items-center gap-2 text-[13px] text-ink-3">
        {selectSlot}
        <span className="min-w-0 truncate">{domain}</span>
        {bookmark.favourite ? <FavStar pops={starPops} /> : null}
        {health}
        <span className="row-slot ml-auto shrink-0 pr-1">
          <span className="row-meta">{age}</span>
          {actions}
        </span>
        {touchMore}
      </header>

      <h3 className={cn("mt-2 line-clamp-2 text-[17px] leading-snug tracking-[-0.01em]", unread ? "font-bold" : "font-normal", pending && !bookmark.summary && "text-ink-2")}>
        {titleLink("outline-none hover:underline")}
      </h3>

      {summary ? (
        <p className={cn("mt-1.5 line-clamp-2 font-summary text-[15px] italic leading-[1.45] text-ink-2", !hadSummary && "anim-wipe")}>{summary}</p>
      ) : failed ? (
        <p className="mt-1.5 text-[13px] text-ink-3">Couldn&rsquo;t read this page</p>
      ) : null}

      {bookmark.tags.length || tagDraft !== null ? <div className="mt-3">{tags}</div> : null}
    </li>
  )
}

/** The one favourite sign, list and grid alike: a 12px star, ink outline, yellow fill. */
function FavStar({ pops }: { pops: number }) {
  return (
    <Star
      key={pops}
      size={12}
      strokeWidth={1.5}
      absoluteStrokeWidth
      role="img"
      aria-label="Starred"
      fill="var(--mark)"
      stroke="var(--ink)"
      className={cn("shrink-0", pops > 0 && "anim-star")}
    />
  )
}

/**
 * The right slot's host: whole when it fits (joelonsoftware.com), otherwise the subdomain part
 * gives way first (cheatsheetseries.owasp.org → owasp.org); the registrable name never truncates.
 */
export function slotHost(host: string, max = 22): string {
  return host.length <= max ? host : registrableDomain(host)
}

/** Rough advance widths in em for the UI sans at 13px: enough to tell whether a label fits. */
function emWidth(text: string): number {
  let w = 0
  for (const ch of text) {
    if ("ijl.,:;'| ".includes(ch)) w += 0.3
    else if ("ftr-".includes(ch)) w += 0.4
    else if ("mwMW".includes(ch)) w += 0.85
    else if (/[0-9]/.test(ch)) w += 0.6
    else w += 0.56
  }
  return w
}

/** The slot holds about this many em of "domain · age" (12.5rem at 13px, less a margin). */
const SLOT_EM = 14.5

/**
 * The host for the meta slot, so "domain · age" fits whole: the subdomain goes first, then the
 * suffix (smashingmagazine.com → smashingmagazine). Never an ellipsis next to the age.
 */
export function metaHost(host: string, tail: string, budget = SLOT_EM): string {
  const fits = (h: string) => emWidth(`${h} · ${tail}`) <= budget
  const slot = slotHost(host)
  if (fits(slot)) return slot
  const reg = registrableDomain(host)
  if (fits(reg)) return reg
  return bareName(host)
}
