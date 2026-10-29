"use client"

import { normalizeUrl } from "@/lib/url/normalize"
import { useDashboard } from "./provider"

const EXAMPLES = ["nextjs.org/docs", "github.com/supabase/supabase", "paulgraham.com/ds.html"]

export function EmptyDrawer() {
  const api = useDashboard()
  return (
    <div className="mx-auto flex max-w-md flex-col items-center px-4 py-20 text-center">
      <Drawer />
      <h2 className="mt-6 font-display text-[28px] font-medium">Nothing filed yet.</h2>
      <p className="mt-2 text-ink-2">Paste any link in the bar above. The page gets read, summarised and tagged while you watch.</p>
      <div className="mt-5 flex flex-wrap justify-center gap-2">
        {EXAMPLES.map((u) => (
          <button key={u} type="button" className="stamp stamp-quiet h-6 px-2.5" onClick={() => api.addBookmark(u)}>{u}</button>
        ))}
      </div>
    </div>
  )
}

export function NoMatch({ query }: { query: string }) {
  const api = useDashboard()
  const url = normalizeUrl(query)
  return (
    <div className="mx-auto max-w-md px-4 py-20 text-center">
      <h2 className="font-display text-[22px] font-medium">
        No card matches <em className="font-normal">“{query}”</em>.
      </h2>
      {url && /[.]/.test(query) && !/\s/.test(query) ? (
        <button type="button" className="btn btn-primary mt-4" onClick={() => api.addBookmark(query)}>Save it as a bookmark</button>
      ) : (
        <p className="mt-2 text-ink-2">Try a different word, or clear the filters on the left.</p>
      )}
    </div>
  )
}

export function EmptyView({ label }: { label: string }) {
  return (
    <div className="mx-auto max-w-md px-4 py-20 text-center">
      <Drawer small />
      <h2 className="mt-4 font-display text-[22px] font-medium">{label}</h2>
    </div>
  )
}

function Drawer({ small }: { small?: boolean }) {
  const s = small ? 56 : 88
  return (
    <svg width={s} height={s * 0.7} viewBox="0 0 88 62" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-ink-3" aria-hidden>
      <path d="M8 22h72v34H8z" />
      <path d="M8 22l10-14h52l10 14" />
      <path d="M36 36h16" />
      <path d="M20 22v-6h48v6" strokeDasharray="2 3" />
    </svg>
  )
}
