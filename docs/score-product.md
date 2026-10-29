# Bookmark-AI — Product Score (2026-10-30, post-rebuild)

Method: used the app with Playwright (desktop 1440px, iPhone 390px) on `/demo`, `/`, `/login`; no Gemini key, placeholder Supabase. Numbers were re-taken after the :3100 reload loop was fixed. Read README.md.

## Score: 7.8 / 10

Up from 3.0. A stranger on `/demo` is organising a populated drawer in three seconds: paste a link and the card fills itself (page-meta badge when no key), `⌘K` finds anything with typos, `j/k/f/e/⌫` work, every destructive action I tried has an undo toast, 800 imported links filed in under 5 s into "Folder / Sub" collections with the list windowed to 90 DOM nodes, health check walked all 822 with progress. Bad links say so ("httpstat.us didn't answer with a page. Kept the link"). Someone would use this over browser bookmarks for a week.

Why not 9: the power-user day still has holes. Background reading stops at 12 of 800 imported pages (demo limit) and the rest stay "READING" until the user re-runs it ~65 times. The dead-link filter exists only inside a 4-second toast. A second import leaves a "Filing…" toast stuck. Cloud sync, the headline backend work, cannot be exercised, so a hiring manager who clicks "Create an account" sees none of it. No drag-to-collection, no match highlighting.

## Critique items

| # | Item | Status | Evidence |
|---|------|--------|----------|
| 1 | Supabase persistence behind repository | PARTIAL | Code and migration present; unverifiable with placeholder env |
| 2 | Demo mode, zero signup | DONE | First card at 199 ms, 22 seeded cards, reset in banner |
| 3 | Real AI summary + honest fallback | DONE | `PAGE META` badge, "didn't answer with a page" toast; Gemini path unverified |
| 4 | Collections + system views, drop card onto collection | PARTIAL | Views and counts work; `[draggable]` count 0, move is menu/bulk only |
| 5 | ⌘K palette | DONE | Cards, sort, export, "Read N pending pages" all reachable |
| 6 | Fuzzy search + highlighting | PARTIAL | `supabse` finds Supabase; zero `<mark>` elements |
| 7 | Import HTML (nested folders, dupes, progress) + export | DONE | "Rust / Async" created; "Filing 800 cards…" progress; dupes skipped |
| 8 | Optimistic UI + undo | DONE | Delete/archive/bulk/collection/tag all undo; focus stays on card after `e` |
| 9 | Empty / loading / error states | DONE | "No card matches … clear the filters on the left"; failed-read toasts |
| 10 | Drop drag reorder, add sort | DONE | Four sort orders in top bar and palette |
| 11 | Duplicate detection | DONE | utm/www variant → "Already in your drawer · Show" scrolls to card |
| 12 | Link health check + filter by state | PARTIAL | Batches whole view with progress; "Show dead" lives only in the toast, no moved filter |
| 13 | Grid / list toggle | DONE | `l`/`g`, persisted |
| 14 | Keyboard navigation + `?` sheet | DONE | |
| 15 | Bulk actions | DONE | Bar fits on 390px; export selection via dialog |
| 16 | Tag management | DONE | Rename/merge/remove with undo; "all 40 tags" toggle |
| 17 | Reader view | MISSING | Roadmap |
| 18 | og:image thumbnails | DONE | |

## Bugs reproduced

1. **Second import leaves a stuck loading toast.** `/demo` → Import a 3-link file → wait for "Filed 3 cards" → Import a different 3-link file. "Filing 3 cards…" never dismisses (still there after 12 s). The first import dismisses correctly.
2. **Dead-link filter is only in a toast.** Check links → "3 of 25 links look dead" fades → no "Dead" entry in sidebar or palette (`⌘K` "dead" → nothing).
3. **"Reset demo" vanishes with the banner.** Dismiss banner → `⌘K` "reset" → only sort entries.
4. **Import preview disagrees with the result.** File with `Bookmarks bar › Rust › Async › Tokio`: preview says "across 1 folders", labels Tokio "Rust"; import creates "Rust / Async". Preview reads `folder[0]` only.
5. **URL in the omnibox never finds.** Type `nextjs.org` with that card saved: all 23 cards plus a Save button; dedupe fires only after Enter.
6. **Touch: drawer options invisible.** 390px, open Menu: "Options for Engineering" has `opacity: 0`; collections cannot be renamed or deleted from a phone. Card checkbox is also opacity 0 (the visible ⋯ menu does offer Select).
7. **Imported cards stay "READING".** Import 800 → reading stops at 12 ("hit the limit"); the other 788 say "READING" though nothing is reading them.

## Three changes that would move the score most

1. **Make the live deployment prove the backend.** Configure Supabase on the Vercel link so "Create an account → bring my demo cards" works, or hide account CTAs when it is not. The most interesting engineering is currently invisible to the person the project exists for.
2. **Finish the 800-bookmark day.** Resume background reading automatically when the limiter opens, label unread imports "not read yet", add "Dead links" / "Moved links" system views, fix the stuck "Filing…" toast.
3. **Close the search loop.** Highlight matches; when the omnibox holds a URL, show matching cards above the Save row as the palette already does.
