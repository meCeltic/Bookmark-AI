"use client"

import { exportFilename, toExportJson, toNetscapeHtml } from "@/lib/export"
import { Dialog, DialogContent } from "@/components/ui/dialog"
import { useDashboard } from "./provider"

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function ExportDialog({ open, onOpenChange }: Props) {
  const api = useDashboard()
  const { bookmarks, collections, selected } = api.state
  const subset = selected.size ? bookmarks.filter((b) => selected.has(b.id)) : bookmarks

  const download = (kind: "json" | "html") => {
    const content = kind === "json" ? toExportJson(subset, collections) : toNetscapeHtml(subset, collections)
    const blob = new Blob([content], { type: kind === "json" ? "application/json" : "text/html" })
    const a = document.createElement("a")
    a.href = URL.createObjectURL(blob)
    a.download = exportFilename(kind)
    a.click()
    setTimeout(() => URL.revokeObjectURL(a.href), 10_000)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title="Export" description={`${subset.length} ${subset.length === 1 ? "card" : "cards"}${selected.size ? " (selected)" : ""}, with collections and tags.`}>
        <div className="grid gap-3 p-5 sm:grid-cols-2">
          <button type="button" className="card min-w-0 p-4 text-left" onClick={() => download("html")}>
            <div className="text-[17px] font-semibold">Browser HTML</div>
            <p className="mt-1 text-[13px] text-ink-2">Netscape format. Imports straight into Chrome, Firefox, Safari or Edge.</p>
          </button>
          <button type="button" className="card min-w-0 p-4 text-left" onClick={() => download("json")}>
            <div className="text-[17px] font-semibold">JSON</div>
            <p className="mt-1 text-[13px] text-ink-2">Everything, including summaries and read state. Re-importable here.</p>
          </button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
