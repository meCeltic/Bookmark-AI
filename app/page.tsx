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
    <div className="overflow-x-clip">
      <div className="mx-auto w-full max-w-[1120px] px-4 sm:px-8">
      <header className="flex h-16 items-center justify-between gap-4">
        <Wordmark />
        <nav className="flex items-center gap-4 text-[14px] font-medium text-ink-2 sm:gap-5">
          <Link href="/demo" className="hover:text-ink">Demo</Link>
          <Link href="/login" className="hover:text-ink">Sign in</Link>
          <ThemeToggle className="-mr-2" />
        </nav>
      </header>

      <main>
        <section className="pb-16 pt-14 sm:pb-20 sm:pt-24">
          {/* Inline weight/tracking: the unlayered h1 rule in globals.css would beat utility classes. */}
          <h1
            className="isolate max-w-[12ch] text-[clamp(56px,8.5vw,132px)] leading-[0.92]"
            style={{ fontWeight: 900, letterSpacing: "-0.04em" }}
          >
            Save it now. Find it with <Mark animate>one word</Mark>.
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
          <h2 id="find-heading" className="text-[32px] font-extrabold tracking-[-0.03em]">Find it again</h2>
          <p className="mt-2 max-w-[52ch] text-[15px] text-ink-2">Months later, one word you remember is enough.</p>
          <div className="mt-8">
            <FindStrip />
          </div>
        </section>

        <section className="border-t border-line py-14 sm:py-20">
          <p className="max-w-[34ch] font-summary text-[24px] italic leading-snug text-ink-2 sm:text-[28px]">
            You&rsquo;ll forget why you saved it. It won&rsquo;t.
          </p>
          <p className="mt-4 text-[13px] text-ink-3">
            Summary and tags on save · search by any word · collections · import and export
          </p>
        </section>
      </main>
      </div>

      <section className="bg-mark py-24 text-[#111216]" aria-labelledby="close-heading">
        <div className="mx-auto w-full max-w-[1120px] px-4 sm:px-8">
          <h2
            id="close-heading"
            className="text-[clamp(40px,5vw,72px)] leading-[0.95] text-[#111216]"
            style={{ fontWeight: 900, letterSpacing: "-0.04em" }}
          >
            Paste your first link.
          </h2>
          <div className="mt-8">
            <TrySave id="try-url-close" onMark />
          </div>
        </div>
      </section>

      <footer className="mx-auto flex w-full max-w-[1120px] flex-col gap-2 px-4 py-6 sm:px-8 text-[13px] text-ink-3 sm:flex-row sm:flex-wrap sm:items-baseline sm:justify-between sm:gap-x-6">
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
