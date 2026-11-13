import Link from "next/link"
import { Wordmark } from "@/components/wordmark"
import { ThemeToggle } from "@/components/theme-toggle"
import { Mark } from "@/components/mark"
import { TrySave } from "@/components/landing/try-save"
import { FindStrip } from "@/components/landing/find-strip"
import { getSessionUser } from "@/lib/supabase/server"
import { signOutAction } from "@/lib/actions/auth"

const REPO = "https://github.com/meCeltic/Bookmark-AI"

const link = "underline decoration-line-strong underline-offset-4 hover:text-action hover:decoration-current"

export default async function Home() {
  const user = await getSessionUser()
  return (
    <div className="overflow-x-clip">
      <div className="mx-auto w-full max-w-[1120px] px-4 sm:px-8">
      <header className="flex h-16 items-center justify-between gap-4">
        <Wordmark />
        <nav className="flex items-center gap-4 text-[14px] font-medium text-ink-2 sm:gap-5">
          {user ? (
            <>
              <Link href="/dashboard" className="hover:text-ink">Dashboard</Link>
              <form action={signOutAction}><button type="submit" className="hover:text-ink">Sign out</button></form>
            </>
          ) : (
            <>
              <Link href="/demo" className="hover:text-ink">Demo</Link>
              <Link href="/login" className="hover:text-ink">Sign in</Link>
            </>
          )}
          <ThemeToggle className="-mr-2" />
        </nav>
      </header>

      <main>
        {/* lg+: hero copy left (7/12), the live strip right (5/12) top-aligned with the second headline line. */}
        <div className="lg:grid lg:grid-cols-12 lg:gap-x-8 [--h1:clamp(56px,8.5vw,132px)] lg:[--h1:clamp(64px,6.6vw,96px)]">
          <section className="pb-16 pt-14 sm:pb-20 sm:pt-24 lg:col-span-7">
            {/* Inline weight/tracking: the unlayered h1 rule in globals.css would beat utility classes. */}
            <h1
              className="isolate max-w-[12ch] text-[length:var(--h1)] leading-[0.92]"
              style={{ fontWeight: 900, letterSpacing: "-0.04em" }}
            >
              Save it now. Find it with <Mark animate>one word</Mark>.
            </h1>
            <p className="mt-6 max-w-[46ch] text-[16px] leading-relaxed text-ink-2 sm:text-[17px]">
              Paste a link and Bookmark-AI writes the summary and tags, so the page is there when you need it again.
            </p>
            <div className="mt-8">
              <TrySave />
              {user ? (
                <Link href="/dashboard" className="mt-4 inline-block text-[15px] text-ink-2 hover:text-action">
                  or go to your Inbox &rarr;
                </Link>
              ) : (
                <Link href="/demo" className="mt-4 inline-block text-[15px] text-ink-2 hover:text-action">
                  or open the demo with 22 saved pages &rarr;
                </Link>
              )}
            </div>
          </section>

          {/* lg+: the strip's search box lines up with the second headline line; its small label sits above (2rem). */}
          <section
            className="border-t border-line py-14 sm:py-20 lg:col-span-5 lg:mt-[calc(6rem+0.92*var(--h1)+0.12*var(--h1)-2rem)] lg:self-start lg:border-t-0 lg:py-0"
            aria-labelledby="find-heading"
          >
            <div className="mb-8 lg:mb-3">
              <h2 id="find-heading" className="text-[32px] font-extrabold tracking-[-0.03em] lg:text-[13px] lg:font-medium lg:leading-5 lg:tracking-normal lg:text-ink-3">Find it again</h2>
              <p className="mt-2 max-w-[52ch] text-[15px] text-ink-2 lg:hidden">Months later, one word you remember is enough.</p>
            </div>
            <FindStrip />
          </section>
        </div>

        <section className="py-14 sm:py-20 lg:pl-[calc((100%-11*2rem)/12*2+2*2rem)]">
          <p className="max-w-[30ch] text-balance font-summary text-[clamp(36px,4vw,56px)] font-normal italic leading-[1.1] tracking-[-0.01em] text-ink">
            You&rsquo;ll forget why you saved it.<br className="hidden sm:inline" /> It won&rsquo;t.
          </p>
          <p className="mt-6 max-w-[60ch] text-[15px] leading-relaxed text-ink-2">
            A summary and tags on every save. Search by any word you remember. Collections, import and export.
          </p>
        </section>
      </main>
      </div>

      {/* lg+: one line on the hero's 12 columns, headline over the copy (1-7), form over the strip (8-12). */}
      <section className="bg-mark py-24 text-[#111216] lg:py-14" aria-labelledby="close-heading">
        <div className="mx-auto w-full max-w-[1120px] px-4 sm:px-8 lg:grid lg:grid-cols-12 lg:items-center lg:gap-x-8">
          <h2
            id="close-heading"
            className="text-[clamp(40px,5vw,72px)] leading-[0.95] text-[#111216] lg:col-span-7 lg:text-[clamp(32px,3vw,44px)] lg:leading-none"
            style={{ fontWeight: 900, letterSpacing: "-0.04em" }}
          >
            Paste your first link.
          </h2>
          <div className="mt-8 lg:col-span-5 lg:mt-0">
            <TrySave id="try-url-close" onMark />
          </div>
        </div>
      </section>

      <footer className="mx-auto w-full max-w-[1120px] px-4 sm:px-8">
        <div className="flex flex-col gap-2 py-6 text-[13px] text-ink-3 sm:flex-row sm:flex-wrap sm:items-baseline sm:justify-between sm:gap-x-6">
          <p>
            Next.js · Supabase Postgres (row-level security) · Gemini ·{" "}
            <a href={`${REPO}#how-its-built`} className={`${link} whitespace-nowrap`}>How it works &rarr;</a> ·{" "}
            <a href={REPO} className={link}>Source</a>
          </p>
          <p>
            Built by <a href="https://github.com/meCeltic" className={link}>Ankit Singh</a>
          </p>
        </div>
      </footer>
    </div>
  )
}
