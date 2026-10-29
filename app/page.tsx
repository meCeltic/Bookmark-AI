import Link from "next/link"
import { ArrowRight } from "lucide-react"
import { Wordmark } from "@/components/wordmark"
import { ThemeToggle } from "@/components/theme-toggle"
import { LiveCard } from "@/components/landing/live-card"
import { isCloudConfigured } from "@/lib/supabase/env"

export default function Home() {
  const cloud = isCloudConfigured()
  return (
    <div className="mx-auto flex min-h-dvh max-w-[1120px] flex-col px-5 sm:px-8">
      <header className="flex h-16 items-center justify-between">
        <Wordmark />
        <nav className="flex items-center gap-1 sm:gap-2">
          <Link href="/demo" className="btn btn-ghost btn-sm">Try the demo</Link>
          {cloud ? <Link href="/login" className="btn btn-ghost btn-sm">Sign in</Link> : null}
          <ThemeToggle />
        </nav>
      </header>

      <main className="flex-1">
        {/* ------------------------------------------------------------ hero */}
        <section className="grid items-center gap-10 py-14 md:grid-cols-[1.05fr_1fr] md:py-24">
          <div>
            <h1 className="font-display text-[44px] font-medium leading-[1.02] tracking-[-0.02em] sm:text-[60px]">
              Save a page.<br />Get it back with <em className="font-normal" style={{ fontVariationSettings: "'WONK' 1, 'SOFT' 60" }}>one word</em>.
            </h1>
            <p className="mt-6 max-w-[46ch] text-[17px] leading-relaxed text-ink-2">
              Paste a link. Bookmark-AI reads the page, writes a two-line summary, stamps a few tags and files the card. Months later, type the one word you remember and it is back on the desk.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link href="/demo" className="btn btn-primary h-11 px-5 text-[15px]">
                Open the demo <ArrowRight size={16} />
              </Link>
              {cloud ? <Link href="/signup" className="btn h-11 px-5 text-[15px]">Create an account</Link> : null}
            </div>
            <p className="mt-3 font-mono text-[11.5px] text-ink-3">no sign-up for the demo · demo cards stay in this browser</p>
          </div>
          <LiveCard />
        </section>

        {/* ---------------------------------------------------- how it reads */}
        <section className="grid gap-10 border-t border-border py-16 md:grid-cols-2 md:py-24">
          <div>
            <p className="meta">How a card gets written</p>
            <h2 className="mt-3 font-display text-[30px] font-medium leading-tight">The page is read once, properly.</h2>
            <p className="mt-4 max-w-[48ch] text-ink-2">
              The server fetches the page through a guard that refuses private addresses and re-checks every redirect, extracts the article text, and hands six kilobytes of it to Gemini with a fixed JSON schema. Whatever comes back is validated before it touches the card. No key, no quota? The page&rsquo;s own description is used instead, and the card says so.
            </p>
          </div>
          <ol className="divide-y divide-border border-y border-border-strong">
            <Stage n="01" title="Fetch, guarded" body="http(s) only · DNS resolved and checked against private ranges · 3 redirects, re-validated · 1 MiB cap · 5 s budget" />
            <Stage n="02" title="Extract" body="og / twitter / title precedence · favicon and image resolved · article or main text · entities decoded · reading time" />
            <Stage n="03" title="Summarise, then verify" body="Gemini structured output · Zod-validated · 3–5 tags · a category · falls back to metadata, labelled honestly" />
            <Stage n="04" title="File" body="canonical URL (no utm, no www, no fragment) · duplicates refused by a unique index · full-text search vector maintained by Postgres" />
          </ol>
        </section>

        {/* ------------------------------------------------------- searching */}
        <section className="grid gap-10 border-t border-border py-16 md:grid-cols-2 md:py-24">
          <div className="card order-2 self-start p-1 md:order-1">
            <div className="flex items-center gap-2 border-b border-border px-3 py-2.5">
              <span className="text-[14px] text-ink-3">type a command, a word, or paste a link…</span>
              <span className="kbd ml-auto">esc</span>
            </div>
            <div className="p-2 text-[14px]">
              <p className="meta px-2 pb-1 pt-1">Cards</p>
              <Row label="Row Level Security | Supabase Docs" hint="supabase.com" />
              <Row label="PostgreSQL: Full Text Search introduction" hint="postgresql.org" active />
              <p className="meta px-2 pb-1 pt-3">Actions</p>
              <Row label="Check links in this view" />
              <Row label="Import bookmarks" />
              <Row label="Switch to list" />
            </div>
          </div>
          <div className="order-1 md:order-2">
            <p className="meta">Finding it again</p>
            <h2 className="mt-3 font-display text-[30px] font-medium leading-tight">Type the word you remember.</h2>
            <p className="mt-4 max-w-[48ch] text-ink-2">
              One input filters as you type and flips into Save mode the moment it sees a link. <kbd className="kbd">⌘K</kbd> opens the same drawer as a palette. <kbd className="kbd">j</kbd> and <kbd className="kbd">k</kbd> walk the cards; <kbd className="kbd">f</kbd>, <kbd className="kbd">e</kbd> and <kbd className="kbd">⌫</kbd> favourite, archive and delete, with undo. Import your browser&rsquo;s bookmarks file and folders become collections; export back to HTML whenever you like.
            </p>
            <ul className="mt-6 grid gap-x-8 gap-y-2 text-[14px] sm:grid-cols-2">
              {["Collections and five built-in views", "Fuzzy search over title, tags, summary", "Dead-link check with bounded concurrency", "Duplicate detection on save and import", "Grid and list, light and dark", "Everything undoable from a toast"].map((f) => (
                <li key={f} className="flex gap-2 border-b border-border pb-2"><span className="text-accent">—</span>{f}</li>
              ))}
            </ul>
          </div>
        </section>

        {/* ------------------------------------------------------ under the hood */}
        <section className="border-t border-border py-16 md:py-24">
          <p className="meta">Under the hood</p>
          <h2 className="mt-3 font-display text-[30px] font-medium leading-tight">Built like a backend, dressed like a desk.</h2>
          <dl className="mt-8 divide-y divide-border border-y border-border-strong">
            <Note title="One repository interface, three implementations" body="The dashboard talks to a BookmarkRepository. Demo mode gets a localStorage implementation; signed-in users get Postgres behind server actions. Same Zod types, same contract tests." />
            <Note title="Postgres does the hard parts" body="Row-level security on every table, a unique index on the canonical URL, a generated tsvector with weighted fields, a trigram index for typos, and two small SQL functions for search and tag renames." />
            <Note title="Untrusted in, validated out" body="URLs, import files, model output and localStorage are all parsed through schemas at the boundary. Route handlers return typed errors with proper status codes and Retry-After." />
          </dl>
        </section>
      </main>

      <footer className="flex flex-wrap items-center gap-x-6 gap-y-2 border-t border-border py-6 font-mono text-[11.5px] text-ink-2">
        <span>Built by <a href="https://github.com/meCeltic" className="underline underline-offset-2 hover:text-accent">Ankit Singh</a></span>
        <span>Next.js 16 · Supabase · Postgres · Gemini</span>
        <a href="https://github.com/meCeltic/Bookmark-AI" className="ml-auto underline underline-offset-2 hover:text-accent">Source on GitHub</a>
      </footer>
    </div>
  )
}

function Stage({ n, title, body }: { n: string; title: string; body: string }) {
  return (
    <li className="flex gap-4 py-4">
      <span className="font-mono text-[12px] text-accent">{n}</span>
      <div>
        <h3 className="font-display text-[17px] font-semibold">{title}</h3>
        <p className="mt-1 font-mono text-[12.5px] leading-relaxed text-ink-2">{body}</p>
      </div>
    </li>
  )
}

function Row({ label, hint, active }: { label: string; hint?: string; active?: boolean }) {
  return (
    <div className={`flex items-center gap-2 rounded-[2px] px-2 py-1.5 ${active ? "bg-surface-2" : ""}`}>
      <span className="truncate">{label}</span>
      {hint ? <span className="ml-auto font-mono text-[11px] text-ink-3">{hint}</span> : null}
    </div>
  )
}

function Note({ title, body }: { title: string; body: string }) {
  return (
    <div className="grid gap-2 py-5 md:grid-cols-[1fr_2fr] md:gap-10">
      <dt className="font-display text-[19px] font-semibold leading-snug">{title}</dt>
      <dd className="text-[15px] leading-relaxed text-ink-2">{body}</dd>
    </div>
  )
}
