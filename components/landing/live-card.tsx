"use client"

import { ArrowRight } from "lucide-react"
import { useEffect, useRef, useState } from "react"
import type { Enrichment } from "@/lib/domain/bookmark"
import { requestEnrichment } from "@/lib/client/enrich"
import { normalizeUrl, domainOf } from "@/lib/url/normalize"
import { Favicon } from "@/components/favicon"
import { cn } from "@/lib/utils"

/**
 * The hero is the product: a real index card being written. It cycles through
 * three pre-read pages, and a visitor can paste any link to watch their own
 * card build through the same /api/enrich route the app uses.
 */

interface Sample {
  url: string
  result: Enrichment
}

const SAMPLES: Sample[] = [
  {
    url: "https://www.postgresql.org/docs/current/textsearch-intro.html",
    result: {
      title: "PostgreSQL: Full Text Search introduction",
      description: null,
      summary: "The official tour of tsvector and tsquery: how documents are parsed into lexemes, why plain LIKE is not search, and where ranking and indexes fit.",
      tags: ["postgres", "search", "database"],
      category: "documentation",
      faviconUrl: "https://www.postgresql.org/favicon.ico",
      imageUrl: null,
      readingMinutes: 7,
      source: "ai",
    },
  },
  {
    url: "https://rauno.me/craft/interaction-design",
    result: {
      title: "Invisible Details of Interaction Design",
      description: null,
      summary: "Rauno Freiberg on the tiny timing, easing and hit-area decisions that make an interface feel considered, with live examples for each.",
      tags: ["design", "interaction", "motion"],
      category: "article",
      faviconUrl: "https://rauno.me/favicon.ico",
      imageUrl: null,
      readingMinutes: 14,
      source: "ai",
    },
  },
  {
    url: "https://paulgraham.com/ds.html",
    result: {
      title: "Do Things that Don't Scale",
      description: null,
      summary: "Paul Graham's essay arguing that early startups should recruit users by hand, delight them disproportionately and resist automating too soon.",
      tags: ["essay", "startups"],
      category: "article",
      faviconUrl: "https://paulgraham.com/favicon.ico",
      imageUrl: null,
      readingMinutes: 18,
      source: "ai",
    },
  },
]

type Stage = "idle" | "typing" | "reading" | "title" | "summary" | "tags" | "done"

export function LiveCard() {
  const [draft, setDraft] = useState("")
  const [url, setUrl] = useState<string | null>(null)
  const [result, setResult] = useState<Enrichment | null>(null)
  const [stage, setStage] = useState<Stage>("idle")
  const [shownSummary, setShownSummary] = useState("")
  const [shownTags, setShownTags] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [own, setOwn] = useState(false)
  const sampleIndex = useRef(0)
  const timers = useRef<number[]>([])
  const reduced = useRef(false)

  const clear = () => { for (const t of timers.current) window.clearTimeout(t); timers.current = [] }
  const later = (fn: () => void, ms: number) => { timers.current.push(window.setTimeout(fn, reduced.current ? 0 : ms)) }

  // Play a result through the stages: reading → title → summary typed → tags stamped.
  const play = (target: string, r: Enrichment, typeUrl: boolean) => {
    clear()
    setResult(null); setShownSummary(""); setShownTags(0); setError(null)
    setUrl(target)
    const begin = () => {
      setStage("reading")
      later(() => { setResult(r); setStage("title") }, 700)
      later(() => setStage("summary"), 1100)
      const text = r.summary ?? r.description ?? ""
      const step = Math.max(8, Math.floor(900 / Math.max(1, text.length)))
      for (let i = 1; i <= text.length; i++) later(() => setShownSummary(text.slice(0, i)), 1100 + i * step)
      const tagsAt = 1100 + text.length * step + 200
      later(() => setStage("tags"), tagsAt)
      r.tags.forEach((_, i) => later(() => setShownTags(i + 1), tagsAt + i * 160))
      later(() => setStage("done"), tagsAt + r.tags.length * 160 + 200)
    }
    if (typeUrl) {
      setStage("typing")
      setDraft("")
      const chars = target.replace(/^https?:\/\//, "")
      for (let i = 1; i <= chars.length; i++) later(() => setDraft(chars.slice(0, i)), i * 28)
      later(begin, chars.length * 28 + 350)
    } else begin()
  }

  // Cycle samples until the visitor takes over.
  useEffect(() => {
    reduced.current = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    let cancelled = false
    const loop = () => {
      if (cancelled) return
      const s = SAMPLES[sampleIndex.current % SAMPLES.length]!
      sampleIndex.current += 1
      play(s.url, s.result, true)
      timers.current.push(window.setTimeout(loop, reduced.current ? 6000 : 7500))
    }
    loop()
    return () => { cancelled = true; clear() }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    const target = normalizeUrl(draft)
    if (!target) { setError("That does not look like a web address."); return }
    clear(); setOwn(true); setResult(null); setShownSummary(""); setShownTags(0); setError(null)
    setUrl(target); setStage("reading")
    const res = await requestEnrichment(target)
    if (!res.ok) { setStage("idle"); setError(res.error.message); return }
    play(target, res.data, false)
  }

  const typing = stage === "typing"

  return (
    <div className="card p-4 sm:p-5">
      <form onSubmit={submit} className="flex items-center gap-2 border-b border-border-strong pb-2 focus-within:border-accent">
        <input
          aria-label="Paste a link"
          className="min-w-0 flex-1 bg-transparent font-mono text-[13px] outline-none placeholder:text-ink-3"
          placeholder="paste any link…"
          value={draft}
          onFocus={() => { clear(); setOwn(true); setStage("idle") }}
          onChange={(e) => { setDraft(e.target.value); setError(null) }}
          spellCheck={false}
        />
        <button type="submit" className="btn btn-primary btn-sm" aria-label="Read this page" disabled={typing || stage === "reading"}>
          {stage === "reading" ? "Reading…" : "Read"} <ArrowRight size={14} />
        </button>
      </form>
      {error ? <p className="mt-2 text-[13px] text-danger">{error}</p> : null}

      <div className="mt-4 min-h-[172px]">
        {url && stage !== "idle" && stage !== "typing" ? (
          <article className="anim-enter">
            <header className="flex items-center gap-2">
              <Favicon url={url} src={result?.faviconUrl ?? null} />
              <span className="meta truncate">{domainOf(url)}</span>
              {result?.readingMinutes ? <span className="meta before:mx-1.5 before:content-['·']">{result.readingMinutes} min</span> : null}
              <span className={cn("ml-auto font-mono text-[10.5px]", result?.source === "ai" ? "text-accent" : "text-ink-3")}>
                {stage === "reading" ? "reading page…" : result?.source === "ai" ? "ai summary" : result?.source === "metadata" ? "from page metadata" : "no summary found"}
              </span>
            </header>
            <h3 className="mt-2 font-display text-[19px] font-semibold leading-snug">
              {result ? result.title : <span className="caret text-ink-3">{domainOf(url)}</span>}
            </h3>
            {stage === "summary" || stage === "tags" || stage === "done" ? (
              <p className={cn("mt-1.5 text-[14px] leading-[1.45] text-ink-2", stage === "summary" && "caret")}>{shownSummary}</p>
            ) : null}
            {(stage === "tags" || stage === "done") && result ? (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {result.tags.slice(0, shownTags).map((t) => <span key={t} className="stamp anim-stamp">{t}</span>)}
                {result.tags.length === 0 ? <span className="font-mono text-[10.5px] text-ink-3">no tags without an ai key</span> : null}
              </div>
            ) : null}
          </article>
        ) : (
          <p className="font-mono text-[12px] text-ink-3">{own ? "paste a link and press read" : "…"}</p>
        )}
      </div>
    </div>
  )
}
