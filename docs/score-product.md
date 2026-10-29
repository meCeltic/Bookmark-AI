# Bookmark-AI — Product Score (2026-10-30, final rescore after 343e587)

Method: drove `/demo` on :3100 with Playwright (1440px; 390px with touch), re-running every reproduction from the 7.8 pass. No Gemini key, placeholder Supabase. Reader view and drag-onto-collection are out of scope.

## Score: 8.6 / 10

Up from 7.8. All seven reproduced bugs are closed. The 800-link day now finishes on its own: import, 12 read, "The rest continue in a minute", and a minute later the queue drains untouched. Dead links are a place in the sidebar, not a fading toast. What keeps it under 9 is unchanged: the cloud path (the headline backend work) still cannot be exercised, plus the edges below.

## Verified (each was a reproduced bug last time)

| # | Fix | Result |
|---|-----|--------|
| 1 | Second import toast | Import 3 → "Filed 3 cards"; import 3 more → "Filed 3 cards"; no toast left at 9.5 s. Fixed |
| 2 | Dead-link filter | Check links → sidebar shows "Dead links 5" under the views; click → All cards with "dead links ×" chip, 5 cards; `⌘K` "dead" → "Show dead links". Fixed |
| 3 | Reset demo | Banner dismissed → `⌘K` "reset" lists "Reset demo"; also in the sidebar footer. Fixed |
| 4 | Import preview path | Rows read "Tokio · Rust / Async"; count says "across 1 folders" and the import creates exactly that one collection. Fixed |
| 5 | URL in omnibox | Type `https://nextjs.org/docs/foo` → list narrows to the one nextjs.org card with the Save button still up. Fixed |
| 6 | Touch drawer options | 390px, Menu → "Options for Engineering" opacity 1, tap → Rename / Delete collection; tag ⋯ visible too. Fixed |
| 7 | Imported cards stuck "READING" | Import 24 → "Read 12 pages, then hit the limit. The rest continue in a minute."; the other 12 say "not read yet"; at 75 s all 24 resolved with no action. Fixed |
| + | Highlighting | Query `supabase` → one `<mark>Supabase</mark>` in the title. Works |

## MUST / SHOULD status

MUST: stuck import toast — DONE; dead-link view — DONE; reset demo off the banner — DONE; auto-resume reading + "not read yet" — DONE; touch access to options — DONE.

SHOULD: preview path matches result — DONE; URL in omnibox finds filed cards — DONE; match highlighting — DONE (exact words only); live deployment proves the backend — OPEN; drag-onto-collection, reader view — out of scope.

## Still open

1. **Cloud mode unverifiable (unchanged).** `/login` → "Create an account" with placeholder Supabase shows none of the repository/migration work. Configure Supabase on the deployed link or hide account CTAs when it is not configured. This is the gap to 9.
2. **Fuzzy hits are not highlighted.** `supabse` finds the Supabase card but zero `<mark>`; only literal words are marked. Reuse the ranker's match ranges instead of `indexOf`.
3. **"unread page" vs "not read yet" read alike.** After the resume, 404 cards show "unread page" (title "Could not read this page") beside "not read yet" cards. A failed read should say so ("couldn't read").
4. **Resume finishes silently.** At 75 s the toast rail was empty; any "Read 12 pages" toast had faded within 4 s. Not a bug, but a longer-lived "Finished reading 12 pages" would close the loop the first toast opened.

Repro base for 2–4: `/demo` → Import a 24-link Netscape file → wait 75 s → inspect footers; then type `supabse` in `#omnibox`.
