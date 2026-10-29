# Bookmark-AI — Design Review (post-rebuild)

Reviewed 2026-10-29 against `docs/critique-design.md`. Evidence: Playwright at 1440×900 and 390×844, light and dark, `reducedMotion: 'reduce'`, computed-style sweeps on `/`, `/demo`, `/login`; source read for `app/globals.css`, `app/layout.tsx`, `app/page.tsx`, `components/**`, `README.md`.

## 1. Scores

**Visual design: 7.5 / 10.** The direction landed. Paper tones, hairlines, one oxblood, Fraunces/Source Sans 3/JetBrains Mono all visibly in use; 2px radius everywhere; no gradient, no backdrop-filter, no resting shadow, no hover lift in computed CSS. The landing page is the strongest screen: a 60px Fraunces hero with the WONK italic, a live card that actually reads pages, mono "01 Fetch, guarded" stages, a ruled mono footer. Points lost for three things a designer would have caught in a day of use: the grid card reserves a 33px invisible footer so every card has a dead band at the bottom; the hidden checkbox indents the meta line 22px past the title; and the global `:focus-visible` paints a 2px red box around every text input, including the omnibox on a plain mouse click.

**Could pass as human-designed: 8 / 10.** Nobody would file this with the v0 pile. The index-card metaphor is carried through to copy ("Nothing filed yet.", "Filed 12 cards", "Your drawer is empty."), to the letter-favicon fallback, to the mono call-number line. What still whispers "generated": the "Under the hood" three-column heading+sentence block; a `Sparkles` icon next to "ai" on the card footer (the one lucide icon every AI app uses for "AI"); and the tag cloud in the sidebar, which reads as a Tailwind chip dump at 24 items.

One structural bug blocks shipping regardless of score: every Radix dialog (palette, help, import, export) is not `fixed`. See HIGH-1.

## 2. The 15-point checklist

| # | Check | Result | Evidence |
|---|---|---|---|
| 1 | No `v0`/`lovable`/`generator` meta | PASS | `curl /` grep returns nothing; `meta[name=generator]` absent in DOM |
| 2 | No linear gradient | PASS | computed `background-image` sweep: 0 hits on all 3 routes, both themes |
| 3 | No `backdrop-filter` | PASS | 0 hits. `topbar.tsx` has `bg-bg/80 backdrop-blur-none`, harmless but delete both |
| 4 | No `gradient-text`/`glass-effect`/`hover-lift` | PASS | grep over app/components/lib: 0 |
| 5 | Three typefaces on the dashboard | PASS | h1 Fraunces 22px, body Source Sans 3 15px, `.meta` JetBrains Mono 11.5px; all loaded via `document.fonts` |
| 6 | Hero is a working component | PASS | `LiveCard` cycles 3 pre-read URLs and submits visitor URLs to `/api/enrich`; final frame shows favicon, "14 MIN", title, summary, stamped tags |
| 7 | No 3-col icon+heading+sentence grid | PASS (weak) | No icons anywhere. But "Under the hood" is `md:grid-cols-3` heading+one-paragraph, the same silhouette. See MED-3 |
| 8 | Radius ≤ 4px, tags only pills | PASS | sweep for radius > 4px excluding `.stamp`: 0. `.kbd` is 3px |
| 9 | No resting shadow, hover never translates | PASS | resting `box-shadow: none` on all cards; hovered card `transform: matrix(1,0,0,1,0,0)`, border → `#b9b2a3`, shadow token applied |
| 10 | One accent, headings uncoloured | PASS | h1/h2/h3 all `--text`; accent on primary button, focus rule, stamps, unread dot, favourite star, wordmark hyphen |
| 11 | One dashboard input that searches and saves | PASS | `#omnibox`; `https://example.com/some-page` flips border to accent and pops a "Save ↵" button |
| 12 | Card heights vary | PASS | `items-start`; Excalidraw card 2-line summary is shorter than Next.js card (189px vs 222px) |
| 13 | Entities decoded | PASS | "Git branches: intuition & reality", "Do Things that Don't Scale" render as characters; `entities decoded` is a stage in the extract step |
| 14 | Reduced motion kills stagger and transform | PASS | with `reducedMotion: reduce`: `.anim-enter` animation-name `none`, delay `0s`, transition `1e-06s`; `LiveCard` uses `reduced.current ? 0 : ms` |
| 15 | Delete undoable, no permanent red button | PASS | `⌫` → toast `Removed "Server Actions and Mutations \| Next.js"` + Undo; Delete lives in ⋯ |

15/15 by the letter. The failures below are things the checklist did not ask about.

## 3. Fixes, ranked

### HIGH

**HIGH-1. Dialogs are not fixed; they render below the page and scroll the window.** `app/globals.css` line ~86: `body > * { position: relative; z-index: 1 }` is unlayered, so it beats Tailwind's layered `.fixed` on every Radix portal appended to `<body>`. Measured: palette `[role=dialog]` computed `position: relative`, top 422–772px, `window.scrollY` 604 after ⌘K; help sheet at top 1008px (off-screen, `help.png` shows nothing); overlay also `relative`, so no dim. Dropdown menus survive only because Radix popper sets inline `position: fixed`. Fix: delete the `body > *` rule entirely and change `body::before` to `z-index: -1` (html carries the background, so the grain still shows). Then verify the palette sits at `top: 14vh` with a dimmed overlay.

**HIGH-2. 2px red outline on every focused text input.** `:focus-visible { outline: 2px solid var(--accent) }` in `globals.css` applies to `<input>` even on mouse click (inputs always match `:focus-visible`). `savemode.png` and `palette.png` show a thick red box around the omnibox and the palette input, contradicting the brief's "accent rule on focus". Add `input:focus-visible, textarea:focus-visible, [cmdk-input]:focus-visible { outline: none }` right after the global rule. The bottom rule already turns accent via `focus-within:border-accent` on the form.

**HIGH-3. Grid card dead band.** `components/dashboard/index-card.tsx` footer `card-actions mt-auto … border-t pt-1.5` is `opacity: 0` but keeps its 33px plus the `pb-3` above it, so every resting card ends with ~45px of blank paper (`demo.png`, all three columns). Keep the mono status (`ai · 12 min`) visible at rest: it is useful and fills the line. Only the icon buttons should fade. Move `card-actions` from the `<footer>` to the `<span className="ml-auto …">` wrapper, change `pb-3` on the tag row to `pb-2`, and drop the `border-t` (the hairline is what makes the empty band look like a missing row).

**HIGH-4. Hidden checkbox indents the meta line.** Same file, `selectBox` is `h-4 w-4 opacity-0` inside the header flex, so favicon starts at x=289 while the title starts at x=267 (`demo.png`: "NEXTJS.ORG" sits 22px right of "Server Actions"). Make the checkbox `absolute left-4 top-4` and give the header `pl-0`; on hover/selecting, swap it in place of the favicon (`group-hover:[&>img]:opacity-0`), or move it to the right of the header next to the star. List rows have the same offset (`list.png`) and benefit from the same change.

### MEDIUM

**MED-1. Mobile tap targets.** At 390px: stamps 20px tall, card icon buttons 26×26, banner dismiss 23×23, select checkbox 15×15, "Reset demo" link 20px tall. `globals.css` `.stamp` → `height: 24px; padding: 0 9px` under `@media (hover: none)`, and `.btn-icon` → 36px; `index-card.tsx` action buttons `h-7 w-7` → `h-9 w-9 sm:h-7 sm:w-7`.

**MED-2. `--text-3` contrast.** `#9a9284` on `#f4f1ea` = 2.73:1 light, `#6b655b` on `#141311` = 3.22:1 dark. It carries dates, domains in list view, placeholders, sidebar counts and the "22 cards" count. Fine for placeholders; too faint for the 11px mono dates and counts. Change `--text-3` to `#857d6f` (light, 3.6:1) and `#7d7566` (dark, 4.1:1). `--text-2` is fine (5.1/6.0).

**MED-3. "Under the hood" is a three-column feature grid in disguise.** `app/page.tsx` last section: `md:grid-cols-3` with Fraunces heading + paragraph, three equal cells. Turn it into a two-column ruled list like the "How it reads" section (label on the left in `.meta`, paragraph on the right, `border-t` per row), or fold the three paragraphs into the README link. Also "Built like a backend, dressed like a desk." is the one line on the page that sounds like a tagline; keep it only if the grid goes.

**MED-4. `Sparkles` icon for "ai".** `index-card.tsx` line 241. It is the universal AI-app glyph. Replace with the mono text alone, or a 6px filled square in accent before "ai" (the stamp vocabulary already in use).

**MED-5. Sidebar tag cloud.** `sidebar.tsx` renders up to 24 `.stamp-quiet` chips wrapping in a 200px column (`demo.png` left). It reads as a chip dump and breaks the card-catalogue voice (the brief asked for a ruled list "react 12"). Render tags as the same rows as collections: name left, count right in mono, `max-h-[240px] overflow-y-auto`, and a "more…" row. Keep stamps for tags *on cards*.

**MED-6. Fraunces payload.** `layout.tsx` loads Fraunces with `axes: ["opsz","WONK","SOFT"]`, both styles, full 100–900 range: 149KB + 121KB woff2 before any card renders. `weight: ["500","600"]` with the three axes brings it under 60KB per style. Keep `display: "swap"`.

### LOW

**LOW-1. Wordmark hyphen in accent** (`wordmark.tsx`). Accent is for three things; a coloured hyphen in a 19px wordmark is a fourth and reads like a logo trick. Set it to `--text-3`, or drop the hyphen and set "Bookmark AI" with a thin space.

**LOW-2. Topbar leftovers.** `topbar.tsx` header `bg-bg/80 backdrop-blur-none` → `bg-bg`. The `⌘ K` hint is two separate `.kbd` boxes; one box reading `⌘K` is tidier.

**LOW-3. Landing stage cards.** `Stage` items are `.card` with mono body at 11.5px; four of them leave 90px of air under the left column at 1440px. Drop the card border and use `border-t` rows, body 12.5px.

**LOW-4. Hero card idle state.** Between cycles the card shows a lone "…" for ~400ms. Keep the previous card until the next URL starts typing.

**LOW-5. Copy.** Honestly good: no "seamlessly", no exclamation marks, no triplets, no hedging. Two nits. Landing: "Search forgives typos. The keyboard does the rest." is the one heading that is a slogan; "Type one word" fits the hero's promise better. `import-dialog.tsx`: "That file has no bookmarks I can read." — the app has not spoken in the first person anywhere else; "No bookmarks found in that file. Export from your browser as HTML." README: clean; "a JavaScript hope" in the Postgres paragraph is the only wink, and it earns it.

## 4. Three things that must not be lost

1. **The hero is the product.** `components/landing/live-card.tsx` typing a real URL, resolving a real favicon, typing the summary character by character, stamping tags with the 2° settle, and letting a visitor paste their own link through the same `/api/enrich` route. Nothing else on the page needs to sell the app.

2. **The mono call-number line.** `R RAUNO.ME · 27 OCT` in uppercase JetBrains Mono at 11.5px with the letter-square fallback, repeated identically on landing, dashboard, auth panel and palette rows. It is the single detail that makes the metaphor read without being explained, and it is what a template cannot produce.

3. **The undo-first, modal-free interaction model.** One omnibox that flips to Save, `⋯` instead of red buttons, toasts in the app's own voice ("Removed … / Undo", "Filed 12 cards, skipped 3 already saved"), the pending card that types itself in place, `j`/`k`/`f`/`e`/`⌫` with the hints inside the menu. Once HIGH-1 is fixed, the palette joins this; until then it is the one thing that breaks the illusion.
