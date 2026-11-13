"use client"

import { useTheme } from "next-themes"
import { useEffect, useRef, useState } from "react"
import { Check, Copy } from "lucide-react"
import { toast } from "sonner"
import { useRouter } from "next/navigation"
import {
  clearAccountDataAction,
  importBookmarksAction,
  createCollectionAction,
  listBookmarksAction,
  listCollectionsAction,
} from "@/lib/actions/bookmarks"
import { exportFilename, toExportJson, toNetscapeHtml } from "@/lib/export"
import { signOutAction } from "@/lib/actions/auth"
import { LocalRepository } from "@/lib/repo/local"
import { useMounted } from "@/lib/client/use-mounted"
import { cn } from "@/lib/utils"

interface Props {
  email: string
  bookmarkCount: number
}

export function SettingsPanel({ email, bookmarkCount }: Props) {
  const { theme, setTheme } = useTheme()
  const mounted = useMounted()
  const router = useRouter()
  const [confirm, setConfirm] = useState("")
  const [busy, setBusy] = useState(false)

  const demoCount = mounted ? countDemo() : 0

  const bringDemo = async () => {
    setBusy(true)
    const repo = new LocalRepository(window.localStorage)
    const [bookmarks, collections] = await Promise.all([repo.listBookmarks(), repo.listCollections()])
    const idMap = new Map<string, string>()
    for (const c of collections) {
      const r = await createCollectionAction(c.name)
      if (r.ok) idMap.set(c.id, r.data.id)
    }
    const r = await importBookmarksAction(
      bookmarks.map((b) => ({
        url: b.url, title: b.title, description: b.description, summary: b.summary, tags: b.tags, category: b.category,
        faviconUrl: b.faviconUrl, imageUrl: b.imageUrl, favourite: b.favourite, readAt: b.readAt, archivedAt: b.archivedAt,
        enrichment: b.enrichment, readingMinutes: b.readingMinutes, createdAt: b.createdAt,
        collectionId: b.collectionId ? (idMap.get(b.collectionId) ?? null) : null,
      })),
    )
    setBusy(false)
    if (!r.ok) { toast.error(r.error.message); return }
    await repo.clear()
    toast.success(`Brought ${r.data.created.length} pages into your account${r.data.skipped ? `, ${r.data.skipped} already there` : ""}.`)
    router.push("/dashboard")
  }

  const wipe = async () => {
    setBusy(true)
    const r = await clearAccountDataAction()
    setBusy(false)
    if (!r.ok) { toast.error(r.error.message); return }
    setConfirm("")
    toast.success("All saved pages deleted.")
    router.refresh()
  }

  const exportAs = async (kind: "json" | "html") => {
    setBusy(true)
    const [b, c] = await Promise.all([listBookmarksAction(), listCollectionsAction()])
    setBusy(false)
    if (!b.ok) { toast.error(b.error.message); return }
    if (!c.ok) { toast.error(c.error.message); return }
    const body = kind === "json" ? toExportJson(b.data, c.data) : toNetscapeHtml(b.data, c.data)
    const blob = new Blob([body], { type: kind === "json" ? "application/json" : "text/html" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = exportFilename(kind)
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div>
      <Section title="Account">
        <Row label="Signed in as"><span className="text-[14px] text-ink">{email}</span></Row>
        <Row label="Saved pages"><span className="text-[14px] text-ink">{bookmarkCount}</span></Row>
        <Row label="Session">
          <form action={signOutAction}><button type="submit" className="btn btn-sm">Sign out</button></form>
        </Row>
      </Section>

      <Section title="Appearance">
        <Row label="Theme">
          <div className="inline-flex rounded-card bg-surface-2 p-0.5" role="radiogroup" aria-label="Theme">
            {(["system", "light", "dark"] as const).map((t) => {
              const on = mounted && theme === t
              return (
                <button
                  key={t}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onClick={() => setTheme(t)}
                  className={cn(
                    "h-8 rounded-btn px-3 text-[13px] font-medium capitalize transition-colors duration-[90ms]",
                    on ? "bg-surface text-ink shadow-[0_0_0_1px_var(--line)]" : "text-ink-2 hover:text-ink",
                  )}
                >
                  {t}
                </button>
              )
            })}
          </div>
        </Row>
      </Section>

      <Section title="Save from anywhere">
        <Bookmarklet />
      </Section>

      <Section title="Data">
        {demoCount > 0 ? (
          <Row label="Demo pages" hint={`${demoCount} pages saved in this browser before you signed in.`}>
            <button type="button" className="btn btn-sm btn-primary" disabled={busy} onClick={bringDemo}>Bring them in</button>
          </Row>
        ) : null}
        <Row label="Export" hint="Browser bookmarks HTML opens in any browser; JSON keeps summaries and tags.">
          <div className="flex gap-2">
            <button type="button" className="btn btn-sm" disabled={busy} onClick={() => exportAs("html")}>HTML</button>
            <button type="button" className="btn btn-sm" disabled={busy} onClick={() => exportAs("json")}>JSON</button>
          </div>
        </Row>
        <Row label="Delete all pages" hint="Removes every saved page and collection in your account. Type delete to confirm.">
          <div className="flex items-center gap-2">
            <label htmlFor="confirm-delete" className="sr-only">Type delete to confirm</label>
            <input id="confirm-delete" className="field h-[30px] w-28 text-[13px]" placeholder="delete" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
            <button type="button" className="btn btn-sm text-danger" disabled={confirm !== "delete" || busy} onClick={wipe}>Delete</button>
          </div>
        </Row>
      </Section>
    </div>
  )
}

/**
 * Drag-to-bookmarks-bar link. React 19 refuses javascript: URLs in JSX, so the
 * href is set on the DOM node after mount, with the origin known only on the client.
 */
function Bookmarklet() {
  const ref = useRef<HTMLAnchorElement>(null)
  const mounted = useMounted()
  const [copied, setCopied] = useState(false)
  const origin = mounted ? (process.env.NEXT_PUBLIC_SITE_URL || window.location.origin).replace(/\/$/, "") : ""
  const code = `javascript:location.href='${origin}/save?url='+encodeURIComponent(location.href)`

  useEffect(() => {
    if (origin) ref.current?.setAttribute("href", code)
  }, [origin, code])

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1600)
    } catch {
      toast.error("Couldn't copy. Select the snippet and copy it by hand.")
    }
  }

  return (
    <div className="py-4">
      <p className="text-[15px] text-ink-2">
        Drag the button to your bookmarks bar. Click it on any page to save that page here.
      </p>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <a
          ref={ref}
          className="btn cursor-grab active:cursor-grabbing"
          onClick={(e) => { e.preventDefault(); toast("Drag this to your bookmarks bar instead of clicking it.") }}
          title="Drag to your bookmarks bar"
        >
          Save to Bookmark-AI
        </a>
        <button type="button" className="btn btn-ghost btn-sm" onClick={copy} disabled={!origin}>
          {copied ? <Check size={14} /> : <Copy size={14} />}
          {copied ? "Copied" : "Copy code"}
        </button>
      </div>
      <code className="mt-3 block break-all rounded-card bg-surface-2 px-3 py-2 font-mono text-[12px] text-ink-2">
        {origin ? code : "\u00a0"}
      </code>
    </div>
  )
}

function countDemo(): number {
  try {
    const raw = window.localStorage.getItem("bookmark-ai:demo")
    if (!raw) return 0
    const parsed = JSON.parse(raw) as { bookmarks?: unknown[] }
    return parsed.bookmarks?.length ?? 0
  } catch {
    return 0
  }
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border-t border-line py-8 first:border-t-0 first:pt-0">
      <h2 className="text-[22px] leading-tight">{title}</h2>
      <div className="mt-3 divide-y divide-line">{children}</div>
    </section>
  )
}

function Row({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 py-3.5">
      <div className="min-w-0">
        <div className="text-[15px] font-medium text-ink">{label}</div>
        {hint ? <div className="mt-0.5 max-w-[46ch] text-[13px] text-ink-2">{hint}</div> : null}
      </div>
      {children}
    </div>
  )
}
