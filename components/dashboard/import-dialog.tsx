"use client"

import { FileUp } from "lucide-react"
import { useRef, useState, type DragEvent } from "react"
import { toast } from "sonner"
import { parseImportFile, type ImportedBookmark } from "@/lib/import/netscape"
import { Dialog, DialogContent } from "@/components/ui/dialog"
import { useDashboard } from "./provider"

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function ImportDialog({ open, onOpenChange }: Props) {
  const api = useDashboard()
  const [items, setItems] = useState<ImportedBookmark[] | null>(null)
  const [kind, setKind] = useState<string>("")
  const [busy, setBusy] = useState(false)
  const [dragging, setDragging] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const load = async (file: File) => {
    const text = await file.text()
    const parsed = parseImportFile(text)
    if (parsed.kind === "unknown" || parsed.items.length === 0) {
      toast.error("No bookmarks found in that file. Browsers export them as an HTML file.")
      return
    }
    setKind(parsed.kind === "netscape" ? "browser export" : "Bookmark-AI export")
    setItems(parsed.items)
  }

  const onDrop = (e: DragEvent) => {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) void load(file)
  }

  const confirm = async () => {
    if (!items) return
    setBusy(true)
    const { created, skipped } = await api.importItems(items)
    setBusy(false)
    onOpenChange(false)
    setItems(null)
    toast.success(created ? `Filed ${created} ${created === 1 ? "card" : "cards"}${skipped ? `, skipped ${skipped} already saved` : ""}` : "Everything in that file was already saved.")
  }

  const folders = items ? new Set(items.map((i) => i.folder[0]).filter(Boolean)).size : 0

  return (
    <Dialog open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) setItems(null) }}>
      <DialogContent title="Import bookmarks" description="Chrome, Firefox, Safari and Edge all export a bookmarks.html. Folders become collections.">
        <div className="p-5">
          {!items ? (
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
              onDragLeave={() => setDragging(false)}
              onDrop={onDrop}
              className={`flex w-full flex-col items-center justify-center gap-2 border border-dashed px-6 py-10 text-center transition-colors ${dragging ? "border-accent bg-accent-soft/30" : "border-border-strong hover:border-ink-2"}`}
            >
              <FileUp size={22} className="text-ink-2" />
              <span className="text-[14px]">Drop a bookmarks file here, or click to choose</span>
              <span className="font-mono text-[11px] text-ink-3">.html from your browser, or a Bookmark-AI .json</span>
            </button>
          ) : (
            <div>
              <p className="text-[14px]">
                Found <strong>{items.length}</strong> links in this {kind}
                {folders ? <> across <strong>{folders}</strong> folders</> : null}. Links you already have will be skipped.
              </p>
              <ul className="quiet-scroll mt-3 max-h-48 divide-y divide-border overflow-y-auto border border-border text-[13px]">
                {items.slice(0, 50).map((i, n) => (
                  <li key={n} className="flex items-center gap-2 px-3 py-1.5">
                    <span className="truncate">{i.title}</span>
                    {i.folder[0] ? <span className="ml-auto shrink-0 font-mono text-[10.5px] text-ink-3">{i.folder[0]}</span> : null}
                  </li>
                ))}
                {items.length > 50 ? <li className="px-3 py-1.5 font-mono text-[11px] text-ink-3">…and {items.length - 50} more</li> : null}
              </ul>
              <div className="mt-4 flex justify-end gap-2">
                <button type="button" className="btn" onClick={() => setItems(null)}>Choose another file</button>
                <button type="button" className="btn btn-primary" disabled={busy} onClick={confirm}>{busy ? "Filing…" : `Import ${items.length}`}</button>
              </div>
            </div>
          )}
          <input ref={fileRef} type="file" accept=".html,.htm,.json,text/html,application/json" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) void load(f); e.target.value = "" }} />
        </div>
      </DialogContent>
    </Dialog>
  )
}
