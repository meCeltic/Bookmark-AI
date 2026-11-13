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
    const { created } = await api.importItems(items)
    setBusy(false)
    onOpenChange(false)
    setItems(null)
    if (created) void api.readPending()
  }

  const folderOf = (i: ImportedBookmark) => i.folder.map((f) => f.trim()).filter(Boolean).join(" / ")
  const folders = items ? new Set(items.map(folderOf).filter(Boolean)).size : 0

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
              className={`flex w-full flex-col items-center justify-center gap-2 rounded-card border border-dashed px-6 py-10 text-center transition-colors duration-[90ms] ${dragging ? "border-action bg-action-soft/40" : "border-line-strong hover:border-ink-3"}`}
            >
              <FileUp size={22} className="text-ink-2" />
              <span className="text-[14px]">Drop a bookmarks file here, or click to choose</span>
              <span className="text-[13px] text-ink-3">An .html file from your browser, or a Bookmark-AI .json</span>
            </button>
          ) : (
            <div>
              <p className="text-[14px]">
                Found <strong>{items.length}</strong> links in this {kind}
                {folders ? <> across <strong>{folders}</strong> folders</> : null}. Links you already have will be skipped.
              </p>
              <ul className="quiet-scroll mt-3 max-h-48 divide-y divide-line overflow-y-auto rounded-card border border-line text-[13px]">
                {items.slice(0, 50).map((i, n) => (
                  <li key={n} className="flex min-w-0 items-center gap-2 px-3 py-1.5">
                    <span className="min-w-0 truncate">{i.title}</span>
                    {folderOf(i) ? <span className="ml-auto max-w-[40%] shrink-0 truncate text-[12px] text-ink-3">{folderOf(i)}</span> : null}
                  </li>
                ))}
                {items.length > 50 ? <li className="px-3 py-1.5 text-[12px] text-ink-3">…and {items.length - 50} more</li> : null}
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
