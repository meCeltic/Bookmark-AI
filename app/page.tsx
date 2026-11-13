import Link from "next/link"
import { Wordmark } from "@/components/wordmark"
import { ThemeToggle } from "@/components/theme-toggle"
import { Mark } from "@/components/mark"
import { TrySave } from "@/components/landing/try-save"
import { FindStrip } from "@/components/landing/find-strip"

const REPO = "https://github.com/meCeltic/Bookmark-AI"

const link = "underline decoration-line-strong underline-offset-4 hover:text-action hover:decoration-current"

export default function Home() {
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-[1120px] flex-col overflow-x-clip px-4 sm:px-8">
      <header className="flex h-16 items-center justify-between gap-4">
        <Wordmark />
        <nav className="flex items-center gap-4 text-[14px] font-medium text-ink-2 sm:gap-5">
          <Link href="/demo" className="hover:text-ink">Demo</Link>
          <Link href="/login" className="hover:text-ink">Sign in</Link>
          <ThemeToggle className="-mr-2" />
        </nav>
      </header>

      <main className="flex-1">
        <section className="pb-16 pt-14 sm:pb-20 sm:pt-24">
          {/* Inline weight/tracking: the unlayered h1 rule in globals.css would beat utility classes. */}
          <h1
            className="isolate max-w-[11ch] text-[clamp(56px,8.5vw,132px)] leading-[0.92]"
            style={{ fontWeight: 900, letterSpacing: "-0.04em" }}
          >
            Save it now. Find it with <Mark animate className="ml-[0.08em]">one word</Mark>.
          </h1>
          <p className="mt-6 max-w-[46ch] text-[16px] leading-relaxed text-ink-2 sm:text-[17px]">
            Paste a link and Bookmark-AI writes the summary and tags, so the page is there when you need it again.
          </p>
          <div className="mt-8">
            <TrySave />
            <Link href="/demo" className="mt-4 inline-block text-[15px] text-ink-2 hover:text-action">
              or open the demo with 22 saved pages &rarr;
            </Link>
          </div>
        </section>

        <section className="border-t border-line py-14 sm:py-20" aria-labelledby="find-heading">
          <h2 id="find-heading" className="text-[22px] font-bold">Find it again</h2>
          <p className="mt-2 max-w-[52ch] text-[15px] text-ink-2">Months later, one word you remember is enough.</p>
          <div className="mt-8">
            <FindStrip />
          </div>
        </section>

        <section className="border-t border-line py-14 sm:py-20">
          <p className="max-w-[60ch] text-[22px] font-medium leading-snug">
            Every link you save gets a two-line summary and tags written for you, one search box that finds it by any
            word you remember, collections to group it, and an export whenever you want to take it all with you.
          </p>
        </section>
      </main>

      <footer className="flex flex-col gap-2 border-t border-line py-6 text-[13px] text-ink-3 sm:flex-row sm:flex-wrap sm:items-baseline sm:justify-between sm:gap-x-6">
        <p>
          Next.js · Supabase Postgres (row-level security) · Gemini ·{" "}
          <a href={`${REPO}#how-it-works`} className={`${link} whitespace-nowrap`}>How it works &rarr;</a> ·{" "}
          <a href={REPO} className={link}>Source</a>
        </p>
        <p>
          Built by <a href="https://github.com/meCeltic" className={link}>Ankit Singh</a>
        </p>
      </footer>
    </div>
  )
}
