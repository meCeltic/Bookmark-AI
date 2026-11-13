"use client"

import { useEffect, useRef, useState } from "react"
import { Search } from "lucide-react"
import { Mark } from "@/components/mark"

/** Three pages from the demo drawer (lib/demo/seed.ts), each found by one word. */
const ROWS = [
  {
    word: "easing",
    initial: "R",
    title: "Invisible Details of Interaction Design",
    domain: "rauno.me",
    summary: "Rauno Freiberg on the tiny timing, easing and hit-area decisions that make an interface feel considered, with live examples for each.",
  },
  {
    word: "rls",
    initial: "S",
    title: "Row Level Security | Supabase Docs",
    domain: "supabase.com",
    summary: "Why every table should enable RLS, how policies use auth.uid(), and the performance habits that keep policies cheap.",
  },
  {
    word: "branches",
    initial: "J",
    title: "Git branches: intuition & reality",
    domain: "jvns.ca",
    summary: "Julia Evans unpicks why git feels hard: branches are pointers, history is a graph, and the commands name the wrong mental model.",
  },
] as const

const STEP_MS = 2600

/**
 * A small search box that cycles through three words; the row each word finds
 * stays at full ink with the word marked, the others drop to ink-3.
 * Whole-word crossfades only (no letter typing), paused off-screen, static under reduced motion.
 */
export function FindStrip() {
  const [index, setIndex] = useState(0)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return
    let timer: number | undefined
    const stop = () => { if (timer !== undefined) window.clearInterval(timer); timer = undefined }
    const start = () => {
      if (timer !== undefined) return
      timer = window.setInterval(() => setIndex((i) => (i + 1) % ROWS.length), STEP_MS)
    }
    const io = new IntersectionObserver(([entry]) => (entry?.isIntersecting ? start() : stop()), { threshold: 0.4 })
    io.observe(el)
    return () => { io.disconnect(); stop() }
  }, [])

  const word = (ROWS[index] ?? ROWS[0]).word

  return (
    <div ref={ref} className="w-full max-w-[640px]">
      <div className="flex h-10 items-center gap-2.5 rounded-card bg-surface-2 px-3" aria-hidden>
        <Search size={16} className="shrink-0 text-ink-3" />
        <span className="grid text-[15px] text-ink">
          {ROWS.map((r) => (
            <span
              key={r.word}
              className="col-start-1 row-start-1"
              style={{ opacity: r.word === word ? 1 : 0, transition: "opacity 180ms var(--ease-enter)" }}
            >
              {r.word}
            </span>
          ))}
        </span>
        <span className="ml-auto text-[13px] text-ink-3">1 match</span>
      </div>
      <p className="sr-only">Searching a drawer of saved pages for one word, such as easing, rls or branches, finds the page that mentions it.</p>
      <ul className="mt-3">
        {ROWS.map((row) => {
          const on = row.word === word
          return (
            <li
              key={row.word}
              className="grid grid-cols-[20px_minmax(0,1fr)] gap-x-3 border-b border-line py-4 last:border-b-0"
            >
              <span className="mt-0.5 inline-flex h-5 w-5 items-center justify-center rounded-[4px] bg-surface-2 text-[11px] font-bold text-ink-2" aria-hidden>
                {row.initial}
              </span>
              <div className="min-w-0">
                <div className="flex items-baseline gap-2">
                  <span className={`truncate text-[15px] font-semibold transition-colors duration-200 ${on ? "text-ink" : "text-ink-3"}`}>{row.title}</span>
                  <span className="shrink-0 text-[13px] text-ink-3">{row.domain}</span>
                </div>
                <p className={`mt-1 font-summary text-[17px] italic leading-snug transition-colors duration-200 ${on ? "text-ink-2" : "text-ink-3"}`}>
                  {on ? highlight(row.summary, word) : row.summary}
                </p>
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

function highlight(text: string, word: string) {
  const parts = text.split(new RegExp(`(${word})`, "i"))
  return parts.map((part, i) => (i % 2 === 1 ? <Mark key={i} className="text-ink">{part}</Mark> : part))
}
