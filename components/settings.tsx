"use client"

import { useTheme } from "next-themes"
import { useState } from "react"
import { toast } from "sonner"
import { useRouter } from "next/navigation"
import { clearAccountDataAction, importBookmarksAction, createCollectionAction } from "@/lib/actions/bookmarks"
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
    toast.success(`Brought ${r.data.created.length} cards into your account${r.data.skipped ? `, ${r.data.skipped} already there` : ""}.`)
    router.push("/dashboard")
  }

  const wipe = async () => {
    setBusy(true)
    const r = await clearAccountDataAction()
    setBusy(false)
    if (!r.ok) { toast.error(r.error.message); return }
    setConfirm("")
    toast.success("Your drawer is empty.")
    router.refresh()
  }

  return (
    <div className="space-y-10">
      <Section label="Account">
        <Row label="Signed in as"><span className="font-mono text-[13px]">{email}</span></Row>
        <Row label="Cards"><span className="font-mono text-[13px]">{bookmarkCount}</span></Row>
        <Row label="Session">
          <form action={signOutAction}><button type="submit" className="btn btn-sm">Sign out</button></form>
        </Row>
      </Section>

      <Section label="Appearance">
        <Row label="Theme">
          <div className="flex border border-border-strong" role="radiogroup" aria-label="Theme">
            {(["system", "light", "dark"] as const).map((t) => (
              <button key={t} type="button" role="radio" aria-checked={mounted && theme === t} onClick={() => setTheme(t)}
                className={cn("h-8 px-3 text-[13px] capitalize", mounted && theme === t ? "bg-surface-2 font-semibold" : "text-ink-2")}>{t}</button>
            ))}
          </div>
        </Row>
      </Section>

      <Section label="Data">
        {demoCount > 0 ? (
          <Row label="Demo drawer" hint={`${demoCount} cards saved in this browser before you signed in.`}>
            <button type="button" className="btn btn-sm btn-primary" disabled={busy} onClick={bringDemo}>Bring them in</button>
          </Row>
        ) : null}
        <Row label="Export" hint="Download everything as HTML or JSON from the dashboard sidebar."><span className="font-mono text-[12px] text-ink-3">sidebar → export</span></Row>
        <Row label="Delete all cards" hint="Removes every bookmark and collection in your account. Type delete to confirm.">
          <div className="flex items-center gap-2">
            <input className="rule-input w-24 py-1 text-[13px]" placeholder="delete" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
            <button type="button" className="btn btn-sm text-danger" disabled={confirm !== "delete" || busy} onClick={wipe}>Delete</button>
          </div>
        </Row>
      </Section>
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

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <section>
      <p className="meta border-b border-border-strong pb-2">{label}</p>
      <div className="divide-y divide-border">{children}</div>
    </section>
  )
}

function Row({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 py-3">
      <div>
        <div className="text-[14px] font-semibold">{label}</div>
        {hint ? <div className="text-[13px] text-ink-2">{hint}</div> : null}
      </div>
      {children}
    </div>
  )
}
