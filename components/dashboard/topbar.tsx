"use client"

import { ArrowDownUp, Command, LayoutGrid, Menu, Rows3, Search, X } from "lucide-react"
import { useEffect, useRef, useState } from "react"
import { SORT_ORDERS, type SortOrder } from "@/lib/domain/bookmark"
import { normalizeUrl } from "@/lib/url/normalize"
import { cn, isMac } from "@/lib/utils"
import { useMounted } from "@/lib/client/use-mounted"
import { ThemeToggle } from "@/components/theme-toggle"
import { MenuContent, MenuItem, MenuRoot, MenuTrigger } from "@/components/ui/menu"
import { useDashboard } from "./provider"

const SORT_LABEL: Record<SortOrder, string> = {
  newest: "Newest first",
  oldest: "Oldest first",
  title: "Title A–Z",
  domain: "By site",
  opened: "Recently opened",
}

interface Props {
  onOpenPalette: () => void
  onOpenMenu: () => void
}

/** One input. Typing filters; a pasted URL flips it into Save mode. */
export function TopBar({ onOpenPalette, onOpenMenu }: Props) {
  const api = useDashboard()
  const { state } = api
  const [draft, setDraft] = useState("")
  const [saving, setSaving] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const mounted = useMounted()
  const looksLikeUrl = draft.trim().length > 3 && normalizeUrl(draft.trim()) !== null && /[.:]/.test(draft) && !/\s/.test(draft.trim())

  // Debounce the search query; URLs never hit the search.
  useEffect(() => {
    if (looksLikeUrl) {
      api.dispatch({ type: "query", query: "" })
      return
    }
    const t = setTimeout(() => api.dispatch({ type: "query", query: draft }), 120)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft, looksLikeUrl])

  // "/" focuses the input from anywhere.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null
      const typing = target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)
      if (e.key === "/" && !typing) {
        e.preventDefault()
        inputRef.current?.focus()
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [])

  const save = async () => {
    if (!looksLikeUrl || saving) return
    setSaving(true)
    const created = await api.addBookmark(draft.trim())
    setSaving(false)
    if (created) setDraft("")
  }

  return (
    <header className="flex h-14 items-center gap-2 border-b border-border bg-bg/80 px-3 backdrop-blur-none sm:px-5">
      <button type="button" className="btn btn-ghost btn-icon lg:hidden" aria-label="Menu" onClick={onOpenMenu}>
        <Menu size={18} />
      </button>

      <form
        className={cn("relative flex h-9 flex-1 items-center gap-2 border-b border-border-strong transition-colors focus-within:border-accent", looksLikeUrl && "border-accent")}
        onSubmit={(e) => { e.preventDefault(); void save() }}
      >
        <Search size={15} className="shrink-0 text-ink-3" />
        <input
          ref={inputRef}
          id="omnibox"
          className="h-full min-w-0 flex-1 bg-transparent text-[15px] outline-none placeholder:text-ink-3"
          placeholder="Search, or paste a link to save it"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Escape") { setDraft(""); e.currentTarget.blur() } }}
          autoComplete="off"
          spellCheck={false}
          aria-label="Search or paste a link"
        />
        {draft ? (
          <button type="button" className="btn btn-ghost btn-icon h-7 w-7" aria-label="Clear" onClick={() => setDraft("")}>
            <X size={14} />
          </button>
        ) : (
          <button type="button" onClick={onOpenPalette} className="hidden items-center gap-1 text-ink-3 sm:flex" aria-label="Open command palette">
            <span className="kbd">{mounted && isMac() ? "⌘" : "Ctrl"}</span><span className="kbd">K</span>
          </button>
        )}
        {looksLikeUrl ? (
          <button type="submit" className="btn btn-primary btn-sm anim-pop" disabled={saving}>
            {saving ? "Saving…" : "Save"} <span className="kbd border-accent-ink/40 bg-transparent text-accent-ink">↵</span>
          </button>
        ) : null}
      </form>

      <MenuRoot>
        <MenuTrigger asChild>
          <button type="button" className="btn btn-ghost btn-sm gap-1.5 text-ink-2" aria-label="Sort">
            <ArrowDownUp size={14} /> <span className="hidden md:inline">{SORT_LABEL[state.sort]}</span>
          </button>
        </MenuTrigger>
        <MenuContent>
          {SORT_ORDERS.map((s) => (
            <MenuItem key={s} onSelect={() => api.dispatch({ type: "sort", sort: s })} className={cn(state.sort === s && "font-semibold")}>
              {SORT_LABEL[s]}
            </MenuItem>
          ))}
        </MenuContent>
      </MenuRoot>

      <div className="hidden items-center border border-border-strong sm:flex" role="group" aria-label="Layout">
        <button type="button" className={cn("btn btn-ghost btn-icon h-7 w-8 rounded-none", state.layout === "grid" && "bg-surface-2")} aria-pressed={state.layout === "grid"} title="Grid (g)" onClick={() => api.dispatch({ type: "layout", layout: "grid" })}><LayoutGrid size={15} /></button>
        <button type="button" className={cn("btn btn-ghost btn-icon h-7 w-8 rounded-none", state.layout === "list" && "bg-surface-2")} aria-pressed={state.layout === "list"} title="List (l)" onClick={() => api.dispatch({ type: "layout", layout: "list" })}><Rows3 size={15} /></button>
      </div>

      <button type="button" className="btn btn-ghost btn-icon sm:hidden" aria-label="Commands" onClick={onOpenPalette}><Command size={16} /></button>
      <ThemeToggle />
    </header>
  )
}
