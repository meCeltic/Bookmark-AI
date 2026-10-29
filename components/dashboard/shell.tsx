"use client"

import { useEffect, useState } from "react"
import * as DialogPrimitive from "@radix-ui/react-dialog"
import { X } from "lucide-react"
import { useDashboard } from "./provider"
import { Sidebar } from "./sidebar"
import { TopBar } from "./topbar"
import { BookmarkGrid } from "./bookmark-grid"
import { CommandPalette } from "./command-palette"
import { ImportDialog } from "./import-dialog"
import { ExportDialog } from "./export-dialog"
import { BulkBar } from "./bulk-bar"
import { HelpSheet } from "./help-sheet"
import { DemoBanner } from "./demo-banner"

interface Props {
  userLabel: string
  cloudAvailable: boolean
  onSignOut?: () => void
}

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
  const heading =
    view.kind === "collection"
      ? (state.collections.find((c) => c.id === view.id)?.name ?? "Collection")
      : { all: "All cards", unsorted: "Unsorted", favourites: "Favourites", reading: "Reading list", archive: "Archive" }[view.view]

  const shown = api.hits ? api.hits.length : api.visible.length

  return (
    <div className="flex h-dvh overflow-hidden">
      <Sidebar className="hidden lg:flex" userLabel={userLabel} onImport={() => setImporting(true)} onExport={() => setExporting(true)} onSignOut={onSignOut} />

      <DialogPrimitive.Root open={drawer} onOpenChange={setDrawer}>
        <DialogPrimitive.Portal>
          <DialogPrimitive.Overlay className="fixed inset-0 z-40 bg-ink/30 lg:hidden" />
          <DialogPrimitive.Content className="fixed inset-y-0 left-0 z-50 flex outline-none lg:hidden">
            <DialogPrimitive.Title className="sr-only">Navigation</DialogPrimitive.Title>
            <Sidebar userLabel={userLabel} onImport={() => { setDrawer(false); setImporting(true) }} onExport={() => { setDrawer(false); setExporting(true) }} onSignOut={onSignOut} onNavigate={() => setDrawer(false)} />
            <DialogPrimitive.Close className="btn btn-icon m-2 h-9 w-9 self-start" aria-label="Close menu"><X size={16} /></DialogPrimitive.Close>
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>

      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar onOpenPalette={() => setPalette(true)} onOpenMenu={() => setDrawer(true)} />
        {api.mode === "demo" ? <DemoBanner cloudAvailable={cloudAvailable} /> : null}

        <main className="quiet-scroll flex-1 overflow-y-auto px-3 pb-24 pt-4 sm:px-5">
          <div className="mb-4 flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <h1 className="font-display text-[22px] font-medium">{heading}</h1>
            <span className="font-mono text-[11.5px] text-ink-3">
              {api.hits ? `${shown} match${shown === 1 ? "" : "es"}` : `${shown} ${shown === 1 ? "card" : "cards"}`}
            </span>
            {state.tags.length ? (
              <span className="flex items-center gap-1.5">
                {state.tags.map((t) => (
                  <button key={t} type="button" className="stamp" data-active="true" onClick={() => api.dispatch({ type: "tags", tags: state.tags.filter((x) => x !== t) })}>{t} ×</button>
                ))}
              </span>
            ) : null}
            {state.healthFilter ? (
              <button type="button" className="stamp stamp-quiet" onClick={() => api.dispatch({ type: "healthFilter", value: null })}>dead links ×</button>
            ) : null}
          </div>
          <BookmarkGrid />
        </main>
      </div>

      <BulkBar />
      <CommandPalette open={palette} onOpenChange={setPalette} onImport={() => setImporting(true)} onExport={() => setExporting(true)} onHelp={() => setHelp(true)} />
      <ImportDialog open={importing} onOpenChange={setImporting} />
      <ExportDialog open={exporting} onOpenChange={setExporting} />
      <HelpSheet open={help} onOpenChange={setHelp} />
    </div>
  )
}
