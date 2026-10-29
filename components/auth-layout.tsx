import type { ReactNode } from "react"
import { Wordmark } from "@/components/wordmark"
import { ThemeToggle } from "@/components/theme-toggle"

interface Props {
  line: string
  card: { domain: string; title: string; summary: string; tags: string[] }
  children: ReactNode
}

/** Split auth layout: a quiet column with one line and a static index card, the form on the right. */
export function AuthLayout({ line, card, children }: Props) {
  return (
    <div className="flex min-h-dvh">
      <aside className="hidden w-[40%] flex-col justify-between border-r border-border bg-surface-2 p-8 md:flex">
        <Wordmark />
        <div>
          <p className="font-display text-[34px] font-medium leading-[1.1]">{line}</p>
          <div className="card mt-8 max-w-[360px] p-4">
            <div className="flex items-center gap-2">
              <span className="inline-flex h-4 w-4 items-center justify-center bg-surface-2 font-mono text-[10px] text-ink-2">{card.domain.charAt(0).toUpperCase()}</span>
              <span className="meta">{card.domain}</span>
            </div>
            <h3 className="mt-2 font-display text-[17px] font-semibold leading-snug">{card.title}</h3>
            <p className="mt-1.5 text-[14px] leading-[1.45] text-ink-2">{card.summary}</p>
            <div className="mt-3 flex flex-wrap gap-1.5">{card.tags.map((t) => <span key={t} className="stamp">{t}</span>)}</div>
          </div>
        </div>
        <p className="font-mono text-[11.5px] text-ink-3">Your drawer syncs across devices once you sign in.</p>
      </aside>
      <main className="relative flex flex-1 flex-col">
        <div className="flex h-16 items-center justify-between px-6 md:justify-end">
          <Wordmark className="md:hidden" />
          <ThemeToggle />
        </div>
        <div className="flex flex-1 items-center justify-center px-6 pb-16">{children}</div>
      </main>
    </div>
  )
}
