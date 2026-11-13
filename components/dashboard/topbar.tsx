"use client"

import { ArrowDownUp, Check, Command, LayoutGrid, Menu, Rows3, Search, X } from "lucide-react"
import { useEffect, useId, useRef, useState, useSyncExternalStore } from "react"
import { domainOf, normalizeUrl } from "@/lib/url/normalize"
import { cn, isMac } from "@/lib/utils"
import { useMounted } from "@/lib/client/use-mounted"
import { ThemeToggle } from "@/components/theme-toggle"
import { Wordmark } from "@/components/wordmark"
import { MenuContent, MenuItem, MenuRoot, MenuTrigger } from "@/components/ui/menu"
import { useDashboard } from "./provider"

const SORTS = [
  { sort: "newest", label: "Newest" },
  { sort: "oldest", label: "Oldest" },
] as const

/** The search param /save hands over: the link to prefill in Save mode. */
export const SAVE_PARAM = "save"

const noSubscribe = () => () => {}
const readSaveParam = () => new URLSearchParams(window.location.search).get(SAVE_PARAM) ?? ""

/** The `#partial` being typed at the end of the box, if any. */
const TAG_TOKEN = /(?:^|\s)#([^\s#]*)$/
/** Every `#tag` token, removed before the text goes to search. */
const TAG_TOKENS = /(^|\s)#\S*/g

interface Props {
  onOpenPalette: () => void
  onOpenMenu: () => void
}

/** One input. Typing filters, `#` picks a tag, a pasted URL flips it into Save mode. */
export function TopBar({ onOpenPalette, onOpenMenu }: Props) {
  const api = useDashboard()
  const { state, counts } = api
  const [draft, setDraft] = useState("")
  const [saving, setSaving] = useState(false)
  const [focused, setFocused] = useState(false)
  const [highlight, setHighlight] = useState({ token: "", index: 0 })
  const [popDismissed, setPopDismissed] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const listId = useId()
  const mounted = useMounted()
  // Keyboards only: phones get no shortcut in the placeholder.
  const hintKey = mounted && typeof window.matchMedia === "function" && window.matchMedia("(hover: hover)").matches ? (isMac() ? "⌘K" : "Ctrl K") : ""
  const looksLikeUrl = draft.trim().length > 3 && normalizeUrl(draft.trim()) !== null && /[.:]/.test(draft) && !/\s/.test(draft.trim())

  // /save?url=… lands here as ?save=…; prefill it once, in Save mode.
  const prefill = useSyncExternalStore(noSubscribe, readSaveParam, () => "")
  const [prefilled, setPrefilled] = useState("")
  if (prefill && prefill !== prefilled) {
    setPrefilled(prefill)
    setDraft(prefill)
  }
  useEffect(() => {
    if (!prefill) return
    const url = new URL(window.location.href)
    url.searchParams.delete(SAVE_PARAM)
    window.history.replaceState(window.history.state, "", url)
    inputRef.current?.focus()
  }, [prefill])

  // Tag autocomplete.
  const tokenMatch = looksLikeUrl ? null : TAG_TOKEN.exec(draft)
  const token = tokenMatch ? (tokenMatch[1] ?? "").toLowerCase() : null
  const suggestions =
    token === null
      ? []
      : counts.tags
          .filter(({ tag }) => !state.tags.includes(tag) && tag.includes(token))
          .sort((a, b) => Number(b.tag.startsWith(token)) - Number(a.tag.startsWith(token)))
          .slice(0, 8)
  const popOpen = focused && token !== null && suggestions.length > 0 && popDismissed !== draft
  const activeIndex = highlight.token === token ? Math.min(highlight.index, suggestions.length - 1) : 0

  const pickTag = (tag: string) => {
    api.dispatch({ type: "tags", tags: [...state.tags, tag] })
    setDraft(draft.replace(TAG_TOKEN, "").trimEnd())
    inputRef.current?.focus()
  }

  // Debounce the search query; URLs never hit the search, #tags become filters instead.
  useEffect(() => {
    if (looksLikeUrl) {
      // Show what is already filed from that site while the Save button is up.
      api.dispatch({ type: "query", query: domainOf(normalizeUrl(draft.trim()) ?? "") })
      return
    }
    const words = draft.replace(TAG_TOKENS, " ").trim()
    const t = setTimeout(() => api.dispatch({ type: "query", query: words }), 120)
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

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (popOpen) {
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault()
        const delta = e.key === "ArrowDown" ? 1 : -1
        setHighlight({ token: token ?? "", index: (activeIndex + delta + suggestions.length) % suggestions.length })
        return
      }
      if (e.key === "Enter" || e.key === "Tab") {
        const pick = suggestions[activeIndex]
        if (pick) {
          e.preventDefault()
          pickTag(pick.tag)
          return
        }
      }
      if (e.key === "Escape") {
        e.preventDefault()
        setPopDismissed(draft)
        return
      }
    }
    if (e.key === "Escape") {
      setDraft("")
      e.currentTarget.blur()
    }
  }

  return (
    <header className="flex h-14 min-w-0 shrink-0 items-center gap-1.5 border-b border-line bg-bg px-3 sm:gap-2 sm:px-5">
      <button type="button" className="btn btn-ghost btn-icon lg:hidden" aria-label="Menu" onClick={onOpenMenu}>
        <Menu size={18} />
      </button>
      <span className="min-w-0 sm:hidden"><Wordmark href={api.mode === "demo" ? "/" : "/dashboard"} /></span>

      {/* Phones: a bar fixed to the bottom, above the home indicator. Wider: inline in the header. */}
      <form
        className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-bg px-3 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2 sm:static sm:z-auto sm:min-w-0 sm:max-w-[720px] sm:flex-1 sm:border-0 sm:bg-transparent sm:p-0"
        onSubmit={(e) => { e.preventDefault(); void save() }}
        role="search"
      >
        <div className="relative min-w-0">
          <Search size={15} aria-hidden className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-3" />
          <input
            ref={inputRef}
            id="omnibox"
            className={cn("field pl-9 text-[15px]", looksLikeUrl ? "pr-24" : draft ? "pr-10" : "pr-3")}
            // The shortcut rides in the placeholder while the box is idle; no chip.
            placeholder={`Search, #tag, or paste a link${!focused && hintKey ? `  ${hintKey}` : ""}`}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={onKeyDown}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            autoComplete="off"
            spellCheck={false}
            enterKeyHint={looksLikeUrl ? "done" : "search"}
            aria-label="Search or paste a link"
            role="combobox"
            aria-expanded={popOpen}
            aria-controls={listId}
            aria-autocomplete="list"
            aria-activedescendant={popOpen ? `${listId}-${activeIndex}` : undefined}
            // .field draws its own focus ring; the unlayered global :focus-visible outline would double it.
            style={{ outline: "none" }}
          />
          <span className="absolute right-1.5 top-1/2 flex -translate-y-1/2 items-center gap-1">
            {draft ? (
              <button type="button" className="btn btn-ghost btn-icon h-7 w-7" aria-label="Clear" onClick={() => { setDraft(""); inputRef.current?.focus() }}>
                <X size={14} />
              </button>
            ) : null}
            {looksLikeUrl ? (
              <button type="submit" className="btn btn-primary btn-sm h-7 px-3 anim-pop" disabled={saving}>
                {saving ? "Saving…" : "Save"}
              </button>
            ) : null}
          </span>

          {popOpen ? (
            <ul
              id={listId}
              role="listbox"
              aria-label="Tags"
              data-state="open"
              className="pop pop-anim absolute inset-x-0 bottom-full z-40 mb-2 max-h-64 overflow-y-auto p-1 [transform-origin:bottom_left] sm:bottom-auto sm:top-full sm:mb-0 sm:mt-1.5 sm:max-w-[320px] sm:[transform-origin:top_left]"
            >
              {suggestions.map(({ tag, count }, i) => (
                <li
                  key={tag}
                  id={`${listId}-${i}`}
                  role="option"
                  aria-selected={i === activeIndex}
                  // mousedown, not click: the input must not blur before the pick lands.
                  onMouseDown={(e) => { e.preventDefault(); pickTag(tag) }}
                  onMouseEnter={() => setHighlight({ token: token ?? "", index: i })}
                  className={cn("flex h-8 cursor-pointer items-center gap-2 rounded-[6px] px-2 text-[14px]", i === activeIndex && "bg-surface-2")}
                >
                  <span className="text-ink-3">#</span>
                  <span className="min-w-0 truncate">{tag}</span>
                  <span className="ml-auto text-[12px] tabular-nums text-ink-3">{count}</span>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </form>

      <div className="ml-auto flex shrink-0 items-center gap-0.5">
        <MenuRoot>
          <MenuTrigger asChild>
            <button type="button" className="btn btn-ghost btn-sm gap-1.5 px-2 text-ink-2" aria-label={`Sort: ${state.sort === "oldest" ? "oldest" : "newest"} first`}>
              <ArrowDownUp size={14} /> <span className="hidden md:inline">{state.sort === "oldest" ? "Oldest" : "Newest"}</span>
            </button>
          </MenuTrigger>
          <MenuContent className="min-w-[160px]">
            {SORTS.map(({ sort, label }) => (
              <MenuItem key={sort} onSelect={() => api.dispatch({ type: "sort", sort })}>
                {state.sort === sort ? <Check size={14} /> : <span className="w-[14px]" />} {label}
              </MenuItem>
            ))}
          </MenuContent>
        </MenuRoot>

        <div className="hidden items-center sm:flex" role="group" aria-label="Layout">
          <button type="button" className={cn("btn btn-ghost btn-icon h-8 w-8", state.layout === "list" ? "text-ink" : "text-ink-3")} aria-pressed={state.layout === "list"} aria-label="List" title="List (l)" onClick={() => api.setLayout("list")}><Rows3 size={15} /></button>
          <button type="button" className={cn("btn btn-ghost btn-icon h-8 w-8", state.layout === "grid" ? "text-ink" : "text-ink-3")} aria-pressed={state.layout === "grid"} aria-label="Grid" title="Grid (g)" onClick={() => api.setLayout("grid")}><LayoutGrid size={15} /></button>
        </div>

        <button type="button" className="btn btn-ghost btn-icon sm:hidden" aria-label="Commands" onClick={onOpenPalette}><Command size={16} /></button>
        <ThemeToggle />
      </div>
    </header>
  )
}
