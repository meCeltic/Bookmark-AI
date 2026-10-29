# Bookmark-AI — Product Review (2026-10-30)

Method: used the running app at `localhost:3100` with Playwright (desktop 1440px, iPhone 390px, `prefers-reduced-motion`), no Gemini key, placeholder Supabase. Every feature in the brief was exercised; numbers below are measured. Note: commit `43a60ee` landed mid-review (cards became `<li>`, `t` shortcut, tag rename/merge); all findings were re-verified against that build. 268/268 tests pass.

## 1. Scores

**(a) Hiring manager, phone, 90 seconds: 7.5 / 10.**
Landing DOMContentLoaded in 130 ms, "Try the demo" is above the fold, `/demo` shows 22 real-looking cards with AI summaries, tags, favourites, reading minutes. The hero live card actually reads a pasted URL. Dark mode, reduced motion, 404 page, and auth redirects all behave. What costs points: on a phone there is no sort, no list view, selection is impossible (checkbox is hover-only), the bulk bar overflows the screen, and pasting a bad link quietly produces an "unread page" card with no explanation. The landing also advertises "Sign in / Create an account" that cannot work on this deployment, and a failed login says "Email or password did not match" rather than "accounts are not configured".

**(b) Power user, 800 real bookmarks: 5.5 / 10.**
Import of 800 links across 20 folders took 1.4 s, dedupe is correct (utm/www/hash), export round-trips, search over 825 cards is 220 ms. But: imported cards are never read (footer says "reading" forever, no summary, no tags, and "Read page again" is one card at a time); the drawer is not virtualised, so with 825 cards a sort change costs 1.6 s and a single `j` keypress 400 ms; "Check links" silently stops at 40 cards per click (21 clicks for 825); only 16 of 41 tags appear in the sidebar with no "more"; archive, collection delete and tag merge have no undo; nested folders are flattened. This person goes back to the browser after the first afternoon.

## 2. Bugs (ranked)

1. **Mobile bulk bar overflows the viewport.** 390px: select two cards (via ⌘-click or the hidden checkbox) → bar is 696px wide, positioned at x=-153. "Favourite", "Delete" and "Clear selection" are off-screen; nothing scrolls. Expected: wrapping or a scrollable row.
2. **Drawer is not virtualised.** Import 800 links → 825 `<li>` in DOM. Sort change 1.6 s, `Shift+A` 730 ms, `j` 413 ms, `f` 615 ms (each toggle re-renders the whole list). Expected: windowed list or pagination; README's roadmap says "past a few thousand", it is slow at 800.
3. **Imported bookmarks are never enriched.** Import any Netscape file → every card shows footer "READING" permanently, no summary, no tags (except `TAGS=` attr). Nothing queues enrichment; the only route is ⋯ → "Read page again" per card. Expected: background queue with progress, or at least a bulk "Read pages" action.
4. **Duplicate toast "Show" leaves a hidden filter.** Paste a URL already saved → toast "Already in your drawer / Show" → click Show → heading "1 match", omnibox empty, no clear (×) button, changing view does not clear it. Only typing then deleting a character clears it. Expected: the omnibox should show the query.
5. **Health check silently caps at 40.** With 825 visible, "Check links" toasts "Checking 40 links…" and stops. No continuation, no "checked 40 of 825". Expected: batch through everything with progress, or say the cap.
6. **Bad URLs save silently.** `https://httpstat.us/404`, `http://localhost:3100/demo` (SSRF-refused, 422 in console), a non-existent domain and a PDF all become cards titled with the hostname, footer "unread page", zero toast. Hero live card on the 404 shows title "httpstat.us", "no summary found" as if fine. Expected: a toast ("That page returned 404, kept the link") and a visible distinction between "dead" and "not HTML".
7. **Archive via `e` or ⋯ menu is irreversible from where you are.** Card vanishes, no toast, no undo, keyboard focus is dropped (`focus: none`), so the next `j` starts from the top. Bulk archive does toast with undo; single does not. Spec item 8 requires undo for archive.
8. **Collection delete and tag merge/remove have no confirm and no undo.** "Delete collection" → "Collection removed. Its cards are now unsorted." (23 cards unsorted, no undo). Sidebar tag "Rename or merge" `tool`→`design` affected 4 cards, no undo.
9. **Inline inputs lose text on blur.** New collection, rename collection, rename tag: type a name, click anywhere → input disappears, name discarded. Expected: commit on blur or keep the draft.
10. **Touch devices cannot select, rename or delete.** Card checkbox opacity 0 (hover-only), no long-press; "Options for <collection>" and "Options for tag" buttons in the drawer are also opacity 0. `x`/`Shift+A` are keyboard-only.
11. **Sort and grid/list unreachable on mobile.** Hidden at `md:`/`sm:`; the palette offers "Switch to list" but no sort entries (typing "sort" finds only "Unsorted").
12. **Sidebar tags capped at 16 of 41, no "more".** The other 25 tags can only be filtered by finding a card that carries them.
13. **"Show dead" lives in a 4 s toast.** After it fades there is no dead-link filter anywhere (sidebar, palette). The `moved` badge has no filter at all.
14. **Dismissing the demo banner removes "Reset demo" forever.** Not in palette ("reset" → no results) or sidebar.
15. **URL in search flips to Save instead of finding.** Typing `nextjs.org` shows all 24 cards plus a Save button; there is no "find by domain". Dedupe only tells you after Enter.
16. **Right-click on a tag deletes it from the card.** Undiscoverable (title says "Filter by …"), no toast, no undo; also fires on long-press on touch.
17. **Nested folders flatten.** `Bookmarks bar › Rust › Async › Tokio` is filed in "Rust"; "Async" is lost without notice.
18. **Login with placeholder Supabase**: submit returns "Email or password did not match." Expected the existing "not configured, use the demo" copy; and the landing should hide account CTAs when `cloudAvailable` is false.
19. Minor: palette "New collection" creates silently and does not navigate (sidebar path does). Toast grammar "Moved to Tools 3 cards". Search inside a collection shows "Design / 0 matches" with no "search all cards" escape.

## 3. Usability issues

**HIGH**
- Enrichment is invisible when it fails (bugs 3, 6). Fix: toast on failure with reason; a "Read 800 pages" bulk action with a progress toast and rate-limit-aware queue; distinguish `dead`/`not html`/`blocked` in the footer label.
- Mobile is read-only in practice (bugs 1, 10, 11). Fix: always-visible 44px checkbox on touch, long-press to select, wrap the bulk bar, add sort and layout to the palette and ⋯ overflow in the top bar.
- No undo for archive/collection delete/tag merge (7, 8). Fix: route single `patch` archive through the same `patchMany` toast; add undo to `deleteCollection` and `renameTag` (both are reversible data operations).
- Scale (2, 5). Fix: `@tanstack/react-virtual` on the grid, memoised card props, health check that walks all targets in batches of 40 with "checked n of N".

**MEDIUM**
- Hidden filter states (4, 13, 14). Fix: mirror `state.query` into the omnibox; add "Dead links" and "Moved links" under system views with counts; keep "Reset demo" in the palette.
- Tag discovery (12, 16). Fix: "Show all 41" toggle or a tag search; replace right-click removal with an × on hover plus toast undo.
- Blur-discards (9). Fix: commit on blur when non-empty.
- Folder flattening (17). Fix: keep the leaf folder or join with " / ".
- Search by URL (15). Fix: when input looks like a URL, show matching cards first and the Save row beneath, like the palette already does.

**LOW**
- Hero copy "no tags without an ai key" admits missing config on the public page; say "tags arrive with the AI key" or seed the live card with the pre-read samples only.
- Landing "Sign in" CTAs when accounts are off; `/login` should say so before submit.
- Tag input is 10.5px mono; on iOS a focused input under 16px zooms the page.
- Toast copy: "Moved 3 cards to Tools".

## 4. README claims not delivered

- "Delete and bulk actions are undoable from the toast" — single-card archive/restore from the keyboard or ⋯ menu has no toast at all; only delete and bulk operations are undoable.
- "Link health check … a filter for the dead ones" — the filter exists only as a 4-second toast action; and each run covers at most 40 cards without saying so.
- "Tags are filters with counts" — the sidebar lists 16 tags; the remaining ones (25 of 41 in the demo) have no count and no filter entry.
- "Folders become collections" — only the first folder below the toolbar; nested folders are discarded.
- "Reads the page for you" — true for pasted links only; imported cards are never read.
- "Sign up later and bring the demo cards with you" — code exists in `components/settings.tsx` but is unverifiable here (auth cannot run); not a false claim, an untested one.
- "Postgres unique index is the last word" on duplicates — unverifiable on this deployment; demo dedupe is JavaScript only.
- "~260 tests" — 268 pass; fine.

## 5. Spec items (docs/critique-product.md) missing or half-done

- **MUST 1 Supabase persistence** — present in code; cannot be exercised with the placeholder project, so unverified.
- **MUST 4 Collections "drop card onto collection"** — no drag-and-drop (`draggable` count 0); move is via ⋯ submenu or bulk bar only.
- **MUST 7 Import "progress"** — 800-link import shows only a disabled "Filing…" button; no progress. Dup skip and folder→collection work.
- **MUST 8 Optimistic + undo for add/delete/archive/move** — delete and bulk move/archive have undo; single archive and add do not.
- **MUST 9 Error states for every view** — enrichment failure, SSRF refusal and health errors are silent at the card level.
- **SHOULD 12 Health "filter by state"** — dead only, via toast; no redirected filter; concurrency 6 (spec said 10) and a 40-card cap per run.
- **SHOULD 15 Bulk "export selection"** — works through Export dialog when a selection exists, but no entry on the bulk bar, so it is undiscoverable.
- **SHOULD 16 Tag management** — rename/merge/delete now exist (new in `43a60ee`) but with no undo and the 16-tag sidebar cap.
- **Demo section** — "Bring my demo bookmarks" is in Settings, not offered at sign-up; Lighthouse ≥ 90 not measured here; no "20/min" message was hit in testing.
- **NICE 17 Reader view** — absent (roadmap). **NICE 18 og:image** — delivered.

Delivered and working as specified: demo mode, palette (incl. typo search), fuzzy search (`supabse`, `heuristcs`, `reagex` all hit), sort orders, grid/list persistence, keyboard set including the new `t`, delete undo restoring position/date/tags, bulk tag/move/archive/delete with undo, JSON and HTML export and JSON re-import (all skipped as dupes), reset demo, banner dismissal persistence, dark mode persistence, reduced motion (animations 0 s), `/dashboard` and `/settings` redirect to login.
