# Bookmark-AI — Design Score (post-fix)

Playwright at 1440 and 390, both themes, reduced motion, computed-style sweeps on all four routes plus every interaction state. (The round "N" badge is the Next.js dev indicator.)

## Scores

**Visual design: 8.3 / 10** (was 2.5, review 7.5). The desk direction is consistent on every surface: paper tones, hairlines, one oxblood, three typefaces, 2px radii, no gradients, blur, resting shadow or lift. The review's HIGHs are verified gone: dialogs `position: fixed` at `top: 126px` with dimmed overlay; inputs focus with an accent rule only (`outline: none`); `AI SUMMARY · 12 MIN` stays at rest with icons revealing on hover; `--text-3` is `#857d6f` / `#7d7566`; sidebar tags and "Under the hood" are ruled rows. What keeps it under 9: the touch layout is cluttered, the bulk bar wraps, the help sheet opens with a loud focus ring, and the hero card idles empty.

**Passes as human-designed: 8.7 / 10** (review 8). The split auth page, mono call-number line, ⋯ menu with inline key hints, undo toasts and "No card matches *zzzqqq*." all read as decisions. The last tells are small: a `⌘` `K` pair of kbd boxes, an accent hyphen in the wordmark, and × remove badges pinned on every tag on touch.

## 15-point checklist

| # | Check | Result | Evidence |
|---|---|---|---|
| 1 | No `v0`/`lovable`/`generator` meta | PASS | HTML grep empty |
| 2 | No linear gradient | PASS | 0 computed gradients, 3 routes, both themes |
| 3 | No `backdrop-filter` | PASS | 0 hits |
| 4 | No `gradient-text`/`glass-effect`/`hover-lift` | PASS | 0 in rendered classes |
| 5 | Three typefaces on dashboard | PASS | all three rendering |
| 6 | Hero is a working component | PASS | `LiveCard` types `rauno.me/craft/…`, resolves favicon, 14 MIN, summary, stamps |
| 7 | No 3-col icon+heading+sentence grid | PASS | "Under the hood" is three ruled label/paragraph rows |
| 8 | Radius ≤ 4px, tags only pills | PASS | only unread dot and tag × are round |
| 9 | No resting shadow, hover never translates | PASS | `box-shadow: none`; hovered `transform: matrix(1,0,0,1,0,0)` |
| 10 | One accent, headings uncoloured | PASS | all h1–h3 `#1c1a17` / `#ece7dc` |
| 11 | One input searches and saves | PASS | `https://example.com/some-page` → accent rule + "Save ↵" |
| 12 | Card heights vary | PASS | 197 / 217 / 241 px across the 22 demo cards |
| 13 | Entities decoded | PASS | "Git branches: intuition & reality", "Don't Scale" |
| 14 | Reduced motion kills stagger/transform | PASS | `animation-name: none`, durations `1e-06s` |
| 15 | Delete undoable, no permanent red button | PASS | Delete in ⋯ and bulk bar, toast with Undo |

## Remaining issues, ranked (checklist 15/15)

1. **Touch layout is cluttered and under-sized.** At 390px every card shows a 16×16 checkbox at the edge and a 15×15 × badge on the corner of every stamp, so a three-tag card carries five extra controls at rest; stamps 20px tall, icon buttons 26×26 (review `MED-1` not applied). Fix: under `@media (hover: none)` hide `.stamp .remove` entirely (removal already lives in ⋯ → tags), keep the checkbox hidden until a long-press or the bulk bar is open, `.stamp { height: 24px; padding: 0 9px }`, card icon buttons `h-9 w-9 sm:h-7 sm:w-7`.
2. **Hero card idles empty.** On load and between cycles the card shows a lone "…" for 1–2s with ~90px of blank paper under the tags, so the first paint of the page's strongest element is an empty box (`s-landing.png`). Fix in `live-card.tsx`: start typing at 150ms; keep the previous card until the next URL's first character; `min-height` = tallest sample, not 290px.
3. **Bulk bar wraps to two rows at 1440px.** "Delete ×" lands on a second line. Fix: `whitespace-nowrap`, drop `max-w`, move Export and Check into an overflow ⋯.
4. **Help sheet opens with a 2px accent ring on the × button**. Fix: `onOpenAutoFocus={(e) => e.preventDefault()}` on the sheet content, or focus the first row.
5. **Tag × badge overlaps the stamp text on hover** ("essay ×" collides). Fix: render × as a trailing glyph inside the stamp (`padding-right: 4px`, `opacity 0 → 1`), not an absolute `-right-1.5 -top-1.5` bubble.
6. **Selection check protrudes 8px into the gutter** outside the card border and, in list view, a half-clipped checkbox shows on the hovered row. Fix: `left-3 top-3` inside the card, swapping with the favicon in the same slot.
7. **Letter-favicon fallback is missing when the image 404s** (joelonsoftware.com, ai.google.dev show a blank 16px slot). Fix: `onError` → swap to the existing letter square.
8. **Landing stage cards** still four bordered boxes, 11.5px mono, 90px of air under the left column. Fix: `border-t` rows, body 12.5px.
9. **Small tells**: `⌘` `K` as two kbd boxes (make one `⌘K`); wordmark hyphen in accent (set to `--text-3`).

## The three changes that move the score most

1. **Touch pass (issue 1).** Mobile undoes the restraint the desktop earns. ~+0.5.
2. **Hero never empty (issue 2).** An empty box in the first second costs more than any other frame. ~+0.3.
3. **Bulk bar + help-sheet focus + stamp × (issues 3–5).** Interaction-state polish a director notices in the first minute. ~+0.3, which clears 9.
