# Bookmark-AI — Design Score (rescore after commit 858f609)

Playwright at 1440 (light + dark) and 390 touch (`hover: none` true), grid and list, computed styles and bounding boxes on every changed control, hero sampled every ~500ms for 12.5s. Previous: 8.3 / 8.7.

## Scores

**Visual design: 8.8 / 10** (was 8.3). Touch is now as restrained as desktop: a card at rest on 390px shows favicon, title, summary, stamps and four 36×36 buttons, nothing else. The selection check lives in the favicon's 16px slot (icon → 0, check → 1 on hover; box fully inside the card border in grid and list). The stamp × is a 20px inline tail that squares the stamp's right corners, no overlap in either theme. The bulk bar is one row at 1440. Landing stages are ruled rows. Two things keep it under 9: the hero still half-empties between cycles, and the mobile bulk bar is a 195×125 floating icon blob.

**Passes as human-designed: 9.0 / 10** (was 8.7). `⌘K` is one kbd, the wordmark hyphen is plain, the ⋯ menu gained "Select x" so touch has a route into bulk mode. The only tell left is the mid-cycle hero frame, which looks like a loading bug rather than a decision.

## Verified (each with a probe)

| Claim | Result | Evidence |
|---|---|---|
| Touch stamps 26px | PASS | `.stamp` 66×26, 11.5px mono |
| Touch icon buttons 36px | PASS | Copy / Favourite / Add tag / More all 36×36, opacity 1 |
| Check and × hidden on touch at rest | PASS | check opacity 0, `.stamp-x` display none |
| ⋯ menu has Select | PASS | items: Open, Copy link, **Select x**, Favourite… |
| Select via menu reveals checks | PASS | check 1 / icon 0 on every card; bulk bar appears |
| Tag-edit shows × tails on touch | PASS | `data-editing=true`, × 29×26 beside each stamp, "tag, enter" input |
| Hero starts on a finished card | PASS | at +476ms: PostgreSQL title, 3 stamps, input filled |
| Previous card stays while next URL types | PARTIAL | title and header stay; summary and stamps vanish (see 1) |
| Bulk bar nowrap on sm+ | PASS | 778×43, `flex-wrap: nowrap`, one row |
| Help sheet no autofocus on × | PASS | active element unchanged on open |
| Stamp × inline tail | PASS | stamp 55×20 + x 18×20, radius `0 999px 999px 0`, border-right 0 on stamp |
| Check in favicon slot, nothing protrudes | PASS | grid 267,171 inside 251,154; list check 16px inside the 44px row |
| Zero-size favicon → letter | PASS | 0 blank imgs visible, 5 letter fallbacks |
| Landing stages ruled rows | PASS | `li` transparent, `py-4`, `divide-y` + `border-y` on the ol |
| ⌘K one kbd | PASS | `['⌘K']` |
| Wordmark hyphen plain | PASS | innerHTML `Bookmark-AI` |
| No console errors | PASS | 0 across all runs |

## Remaining issues, ranked

1. **Hero half-empties while the next URL types (≈1.2s every cycle).** `play()` sets `stage = "typing"` before `begin()`, and the summary/tags guards in the JSX only allow `summary | tags | done`, so the card drops to header + title with ~110px of blank paper (`v2-hero-5200.png`; the full-page landing shot caught this frame). Fix in `components/landing/live-card.tsx`: add `"typing"` to both guards — `{(stage === "summary" || stage === "tags" || stage === "done" || stage === "typing") && …}` and the same for the tags block — so the finished card persists until `begin()` resets it.
2. **Mobile bulk bar is a floating 195×125 icon cluster** (3 rows, 9 unlabeled icons) overlapping card text. Fix in `bulk-bar.tsx`: below `sm`, make it a full-width bottom strip (`inset-x-0 bottom-0 translate-x-0 rounded-none border-x-0`), one row of `N selected · Favourite · Read · Tag · ⋯ · ×` with Move/Check/Export/Archive/Delete inside an overflow menu.
3. **Help sheet leaves an accent focus ring on the card behind the overlay** when opened from a focused check (`v1-help.png`, supabase card). Fix: in `onOpenAutoFocus` call `(document.activeElement as HTMLElement)?.blur()` after `preventDefault()`, or focus the sheet's `<dl>` with `tabIndex={-1}`.
4. **Help sheet still renders `⌘` `K` as two kbd boxes** while the top bar now shows `⌘K`. Fix: in `help-sheet.tsx` ROWS, render combos as one kbd (`⌘K`, `⇧A`) and keep `/`-separated alternates (`j / k`) as they are.
5. **Landing stage body is 11.5px mono** at 1440 (issue 8's 12.5px not applied). Fix: `text-[12.5px]` on the `Stage` paragraph.

## Would a design director ship it?

Yes, with issue 1 fixed first — it is a 4-line guard change and it is the frame most visitors will see first. Issues 2–5 can follow in a mobile polish pass; none of them undermines the direction, which now holds on every surface, both themes, and touch.
