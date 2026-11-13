"use client"

import { useEffect, useState } from "react"
import * as DialogPrimitive from "@radix-ui/react-dialog"
import { ArrowRight, MoreHorizontal, Pencil, Trash2, X } from "lucide-react"
import { MenuContent, MenuItem, MenuRoot, MenuTrigger } from "@/components/ui/menu"
import { cn } from "@/lib/utils"
import { useDashboard } from "./provider"
import { Sidebar } from "./sidebar"
import { TopBar } from "./topbar"
import { BookmarkGrid } from "./bookmark-grid"
import { CommandPalette } from "./command-palette"
import { ImportDialog } from "./import-dialog"
import { ExportDialog } from "./export-dialog"
import { BulkBar } from "./bulk-bar"
import { HelpSheet } from "./help-sheet"
import { SaveToast } from "./save-toast"
import { PreviewPane } from "./preview-pane"

interface Props {
  userLabel: string
  cloudAvailable: boolean
  onSignOut?: () => void
}

const VIEW_HEADING = { all: "Inbox", favourites: "Starred", archive: "Done" } as const

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`

export function DashboardShell({ userLabel, cloudAvailable, onSignOut }: Props) {
  const api = useDashboard()
  const { state } = api
  const [palette, setPalette] = useState(false)
  const [importing, setImporting] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [help, setHelp] = useState(false)
  const [drawer, setDrawer] = useState(false)

  useEffect(() => {
    const onHelp = () => setHelp(true)
    window.addEventListener("bookmark-ai:help", onHelp)
    return () => window.removeEventListener("bookmark-ai:help", onHelp)
  }, [])

  const view = state.view
  const heading = state.healthFilter
    ? "Dead links"
    : view.kind === "collection"
      ? (state.collections.find((c) => c.id === view.id)?.name ?? "Collection")
      : VIEW_HEADING[view.view]

  const shown = api.hits ? api.hits.length : api.visible.length
  const unreadHere = api.visible.filter((b) => b.readAt === null && !b.archivedAt).length
  const inInbox = view.kind === "view" && view.view === "all" && !state.healthFilter
  const inDone = view.kind === "view" && view.view === "archive"
  // Searching: where the hits are, with a way across to the other drawer.
  const elsewhere = api.elsewhere
  const summary = api.hits
    ? (
        <>
          {`${shown} in ${heading}`}
          {elsewhere && elsewhere.count > 0 ? (
            <>
              {" · "}
              <button
                type="button"
                className="inline-flex items-center gap-0.5 text-action hover:underline"
                onClick={() => api.dispatch({ type: "view", view: { kind: "view", view: elsewhere.view } })}
              >
                {elsewhere.count} in {elsewhere.view === "archive" ? "Done" : "Inbox"} <ArrowRight size={12} aria-hidden />
              </button>
            </>
          ) : null}
        </>
      )
    : inInbox
      ? `${unreadHere} to read · ${shown - unreadHere} read`
      : view.kind === "view" && view.view === "archive"
        ? `${shown} done`
        : view.kind === "view" && view.view === "favourites"
          ? `${shown} starred`
          : plural(shown, "link", "links")

  return (
    <div className="flex h-dvh min-w-0 overflow-hidden">
      <Sidebar className="hidden lg:flex" userLabel={userLabel} cloudAvailable={cloudAvailable} onImport={() => setImporting(true)} onExport={() => setExporting(true)} onSignOut={onSignOut} />

      <DialogPrimitive.Root open={drawer} onOpenChange={setDrawer}>
        <DialogPrimitive.Portal>
          <DialogPrimitive.Overlay className="fade-anim fixed inset-0 z-40 bg-ink/30 lg:hidden dark:bg-black/60" />
          <DialogPrimitive.Content className="fade-anim fixed inset-y-0 left-0 z-50 flex max-w-[calc(100vw-48px)] outline-none lg:hidden">
            <DialogPrimitive.Title className="sr-only">Navigation</DialogPrimitive.Title>
            <Sidebar userLabel={userLabel} cloudAvailable={cloudAvailable} onImport={() => { setDrawer(false); setImporting(true) }} onExport={() => { setDrawer(false); setExporting(true) }} onSignOut={onSignOut} onNavigate={() => setDrawer(false)} />
            <DialogPrimitive.Close className="btn btn-icon m-2 h-9 w-9 self-start" aria-label="Close menu"><X size={16} /></DialogPrimitive.Close>
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>

      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar onOpenPalette={() => setPalette(true)} onOpenMenu={() => setDrawer(true)} />
        <div className="flex min-h-0 min-w-0 flex-1">
          <main className="quiet-scroll min-w-0 flex-1 overflow-y-auto overflow-x-hidden px-4 pb-[calc(6rem+env(safe-area-inset-bottom))] pt-5 sm:px-6 sm:pb-24">
            {/* The list keeps a reading measure: at most 1100px, centred in whatever room the pane leaves. */}
            <div className={cn("mx-auto w-full min-w-0", (state.layout === "list" || state.omniUrl) && "max-w-[1100px]")}>
            <div className="flex min-w-0 flex-wrap items-baseline gap-x-3 gap-y-1">
              <h1 className="min-w-0 truncate text-[22px] font-bold tracking-[-0.02em]">{heading}</h1>
              {state.omniUrl ? null : <span className="text-[13px] tabular-nums text-ink-3">{summary}</span>}
              {state.tags.length ? (
                <span className="flex min-w-0 flex-wrap items-center gap-x-2">
                  {state.tags.map((t) => <ActiveTag key={t} tag={t} />)}
                </span>
              ) : null}
              {state.healthFilter ? (
                <button type="button" className="btn btn-ghost btn-sm h-6 px-1.5 text-[13px]" onClick={() => api.dispatch({ type: "healthFilter", value: null })}>
                  Show all <X size={12} />
                </button>
              ) : null}
            </div>
            {state.omniUrl || api.hits ? null : inInbox && api.visible.length === 0 && state.bookmarks.length > 0 ? (
              <p className="mt-1 text-[13px] text-ink-3">Paste any link in the search box to save it</p>
            ) : inDone && api.visible.length > 0 ? (
              <p className="mt-1 text-[13px] text-ink-3">Done items leave your Inbox · <span className="kbd">u</span> moves one back</p>
            ) : null}
            <div className="mt-4">
              <BookmarkGrid />
            </div>
            </div>
          </main>
          <PreviewPane />
        </div>
      </div>

      <BulkBar onExport={() => setExporting(true)} />
      <SaveToast />
      <CommandPalette open={palette} onOpenChange={setPalette} onImport={() => setImporting(true)} onExport={() => setExporting(true)} onHelp={() => setHelp(true)} />
      <ImportDialog open={importing} onOpenChange={setImporting} />
      <ExportDialog open={exporting} onOpenChange={setExporting} />
      <HelpSheet open={help} onOpenChange={setHelp} />
    </div>
  )
}

/** An active tag filter: click to drop it; its menu renames, merges or removes the tag everywhere. */
function ActiveTag({ tag }: { tag: string }) {
  const api = useDashboard()
  const { state } = api
  const [renaming, setRenaming] = useState<string | null>(null)

  if (renaming !== null) {
    return (
      <input
        autoFocus
        className="field h-7 w-44 text-[13px]"
        value={renaming}
        maxLength={32}
        aria-label={`Rename #${tag}`}
        placeholder="New name, empty removes"
        onChange={(e) => setRenaming(e.target.value)}
        onBlur={() => { if (renaming.trim() !== tag) void api.renameTag(tag, renaming); setRenaming(null) }}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.currentTarget.blur()
          if (e.key === "Escape") { setRenaming(tag); e.currentTarget.blur() }
        }}
      />
    )
  }

  return (
    <span className="inline-flex items-center">
      <button
        type="button"
        className="tag"
        data-active="true"
        title={`Stop filtering by #${tag}`}
        onClick={() => api.dispatch({ type: "tags", tags: state.tags.filter((x) => x !== tag) })}
      >
        {tag}
      </button>
      <MenuRoot>
        <MenuTrigger asChild>
          <button type="button" className="btn btn-ghost btn-icon h-6 w-6 text-ink-3" aria-label={`Options for tag ${tag}`}>
            <MoreHorizontal size={13} />
          </button>
        </MenuTrigger>
        <MenuContent align="start" onCloseAutoFocus={(e) => e.preventDefault()}>
          <MenuItem onSelect={() => api.dispatch({ type: "tags", tags: state.tags.filter((x) => x !== tag) })}><X size={13} /> Stop filtering</MenuItem>
          <MenuItem onSelect={() => setRenaming(tag)}><Pencil size={13} /> Rename or merge</MenuItem>
          <MenuItem danger onSelect={() => api.renameTag(tag, "")}><Trash2 size={13} /> Remove from all cards</MenuItem>
        </MenuContent>
      </MenuRoot>
    </span>
  )
}
