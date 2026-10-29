# Bookmark-AI — Design Score (final, after commit e1d18fd)

Playwright at 1440 (landing, demo, help sheet) and 390 / 640 touch, selecting via ⋯ → Select then tapping checkboxes. Hero sampled every 400ms for 12s, then every 100ms for its shortest frame. Previous: 8.8 / 9.0.

## Scores

**Visual design: 9.2 / 10** (was 8.8). The hero now holds the finished card through the whole URL-typing phase; the only short frame is the deliberate "reading page…" state (caret on the domain, ~700ms) and the 172px wrapper keeps the layout from jumping. The mobile bulk bar is a flush bottom strip at 390 and the centred pill from 640 up. Landing stage body is 12.5px mono, now matching the hero copy's optical weight.

**Passes as human-designed: 9.3 / 10** (was 9.0). No loading-bug frame left in the hero loop; the help sheet opens over a clean grid with `⌘K` and `⇧A` as single keys, matching the top bar; nothing behind the overlay keeps focus.

## Verified

| Claim | Result | Evidence |
|---|---|---|
| Hero holds during typing | PASS | +0–5.9s: PostgreSQL card, 146-char summary, 3 stamps, article 128px while the next URL types |
| Minimum rendered article height over 12s | 51px | at +6.0–6.9s, stage "reading page…" (favicon, domain, caret title); wrapper stays 172px; back to 97px at +7.3s, 128px at +8.7s |
| Mobile bulk bar full-width strip (<sm) | PASS | 390: `0,792 390×52`, bottom 0, radius 0, border-x 0, border-top 1px, one visual row, `overflow-x: auto` |
| Bulk bar pill on sm+ | PASS | 640: `12,780 616×49`, 15px off the bottom, radius 2px, 1px border, labels shown |
| Touch buttons in bar | PASS | all 36×36 (icon-only at 390) |
| Help sheet blurs active element | PASS | before: `BUTTON[role=checkbox]`; after `?`: `BODY`; 0 focused checkboxes; screenshot shows no ring behind the overlay |
| Help sheet single-key kbds | PASS | `["/","⌘K","j|/|k","↵","f","r","e","t","x","⇧A","c","⌫","g|/|l","?"]` |
| Landing stage body 12.5px | PASS | computed `12.5px / 20.3125px` |
| No console errors | PASS | 0 across all runs |

## Still worth a line

1. **Bulk bar overflows in the 390 and 640–~800 range.** At 390 `scrollWidth` 423 vs 390 (Delete sits on the edge, × is off-screen); at 640 the pill has 766px of content in 614 so "Archive · Delete · ×" are hidden behind a horizontal scroll with no affordance (`f2-bulk-640.png`). Fix in `bulk-bar.tsx`: keep labels `hidden md:inline` instead of `sm:inline`, or move Check/Export/Archive into an overflow menu below `md`, and pin the × with `sticky right-0`.
2. The "reading page…" frame is a real state, but 51px of card in a 172px well for ~0.7s is the one thin moment. Optional: keep the previous summary at 40% opacity until `title` lands.

## Would a design director ship it?

Yes. Every item from the last round is verified fixed; the bulk-bar overflow is a one-class change and never touches the first-run experience.
