# Bookmark-AI — hiring-manager score (post-rebuild)

Stance as before: backend/full-stack hiring manager. 2026-10-30. Previous score 3/10.

## Score: 7.4 / 10 as it sits on disk; 8.6 once the pre-push checklist is done

## The 60-second read

Title, one-line pitch, a demo link, a CI badge, one real screenshot. "Why I rebuilt it" admits the first version was a take-home with a fake summary and a login that protected nothing. That paragraph alone flips my prior: someone who writes that is not hiding anything. `package.json` is `bookmark-ai@2.0.0`, 16 pinned dependencies, no `latest`, one lockfile, `next.config.ts` has no ignore-errors flags. `npm test` runs 273 tests in under a second. The demo page (`/demo`) loads, 22 seeded cards, no console errors, and the landing page is not a shadcn dashboard. I would keep reading.

What stops the 60-second read at "good" rather than "hire me now": the demo URL in the README 404s today, and `docs/` is the first folder alphabetically after `app/` and contains `critique-hiring.md`, which is literally a rubric this README was written against.

## The 30-minute read

**Architecture.** The README's ASCII diagram matches the code: `lib/repo/types.ts` is the interface, `local.ts` / `remote.ts` / `supabase.ts` the three implementations, `contract.test.ts` pins them. `lib/url/ssrf-guard.ts` does DNS resolution, private-range checks including IPv6-mapped and NAT64 prefixes, manual redirect hops and a streamed 1 MiB cap. `lib/enrich/gemini.ts` sends a `responseSchema` and re-parses with Zod; `pipeline.ts` falls back to meta description and records `source`. The migration has `setweight` tsvector, GIN + trigram indexes, RLS `using`/`with check`, and a comment explaining why `array_to_tsvector` was chosen for a generated column. Every claim in the README I checked exists in code.

**Comments and voice.** Comments are the kind a person leaves ("Safari writes its top-level H3s outside any root DL"), not JSDoc restating names. Two `console.error` calls, no narrating logs. The decisions table costs each choice honestly. No v0/generator traces anywhere.

**Git history.** Messages are excellent: imperative, scoped, a "Fix the search vector for generated-column immutability" that reads like a real bug. Timestamps are the problem. The 22 rebuild commits span 23:17 to 00:22, one night; seven of them share the minute 23:30. `git log --format='%ad'` is one click on GitHub. A reviewer will conclude the work was staged, not built. The messages are a credential; the clock contradicts them.

**Hygiene gaps found.** `.gitignore` has `.env*`, which swallows `.env.example`; `git ls-files .env.example` returns nothing, so the README's `cp .env.example .env.local` fails on a fresh clone. The committed screenshots (`public/screenshots/dashboard-light.png`, `mobile.png`) have the Next.js dev-tools "N" button baked in, overlapping the "Export" label in the sidebar.

## Original must-haves

| Must-have | Status |
|---|---|
| Hero GIF + live URL first screen | PARTIAL — static PNG, URL not deployed |
| First-person pitch, no filler | DONE |
| Architecture diagram + "how it works" with code pointers | DONE |
| Decisions table | DONE |
| LICENSE, `.env.example`, CI with badge, typecheck on | PARTIAL — `.env.example` untracked |
| One lockfile, pinned, renamed, no v0 | DONE |
| Delete unused ui components, empty files, duplicate SQL | DONE (2 ui files remain, both used) |
| `supabase/migrations/`, no runtime setup route | DONE |
| Tests matching claims (SSRF, validator, search, routes) | DONE — 15 files, 273 tests; search ranking tested in TS, not SQL |
| Small scoped commits over real days | PARTIAL — messages yes, cadence no |
| Roadmap 3-5 items, no "Time Spent" | DONE |

## Résumé line

"Bookmark-AI (live): Next.js app on Supabase Auth and PostgreSQL with AI page summaries."

- *Next.js app* — true, 16.4.3 App Router.
- *Supabase Auth* — true: `lib/actions/auth.ts` (`signInWithPassword`, `signUp`), `app/auth/callback/route.ts`, session refresh in `proxy.ts`.
- *PostgreSQL* — true: `supabase/migrations/0001_init.sql` with RLS, FTS, trigram.
- *AI page summaries* — true: `lib/enrich/gemini.ts` structured output, validated, with fallback.
- *(live)* — **false until deployed.** `CONTENT.md` line 133 still points at `bookmark-ai-beta.vercel.app` and lists Jina, drag-and-drop and localStorage offline; update it.

Suggested bullet: *Bookmark-AI (live): Next.js 16 on Supabase Auth and PostgreSQL (RLS, weighted full-text + trigram search); SSRF-guarded fetcher feeds schema-validated Gemini summaries with a metadata fallback; swappable repository gives a no-signup demo; 273 tests in CI.*

## Interview talking points

1. **Why the model is an upstream, not an oracle** — `lib/enrich/gemini.ts` (request schema + Zod), `lib/enrich/pipeline.ts` (fallback, `source` field). Be ready for "how do you measure fallback rate?"
2. **SSRF guard design** — `lib/url/ssrf-guard.ts`: why DNS-resolve before fetch, why re-validate every redirect, why IPv4-mapped IPv6 and NAT64 matter, why the health check shares the guard.
3. **Postgres FTS vs vector DB** — `supabase/migrations/0001_init.sql` lines 44-59 and `search_bookmarks`; the `array_to_tsvector` immutability fix; why `word_similarity` over `similarity`; what pgvector would add and when.
4. **Repository boundary and demo mode** — `lib/repo/types.ts`, `contract.test.ts`; how the same contract test runs against localStorage and Supabase, and why RLS lives in the database rather than in server actions.

## Pre-push checklist

1. **Remove `docs/critique-*.md`, `docs/review-*.md`, `docs/PLAN.md`** (and this file) from the public repo, or move them to a private branch. They document an AI-review loop and a rubric; a reviewer who reads `critique-hiring.md` next to the README will conclude the README was written to a checklist. Keep nothing in `docs/` or add a real `docs/architecture.md`.
2. **Fix the commit clock.** Either squash the rebuild into 6-8 commits with honest dates, or rebase with `GIT_COMMITTER_DATE`/`--date` spread across the days the work actually happened. Do not leave seven commits in the same minute.
3. **Track `.env.example`**: add `!.env.example` to `.gitignore`.
4. **Deploy before pushing the README**, or change "Live demo" to "Demo: coming" — a 404 on the first link is worse than no link. Then update `CONTENT.md` line 133.
5. **Retake screenshots** with the dev indicator disabled (`devIndicators: false` or a production build).
6. Replace the dashboard PNG with a 10-second GIF of paste → enrich → search.
7. Remove the old May-2025 commits' claims from the résumé (Jina, drag-and-drop).

## Three changes that move the score most

1. **Honest, spread-out commit history** (+0.6). The messages are already the story; the timestamps must not contradict it.
2. **Deployed demo + remove `docs/` working notes** (+0.5). Makes "live" true and removes the only remaining "written to a rubric" signal.
3. **One SQL-level search test in CI** (+0.3). Run `0001_init.sql` against a Postgres service container and assert `search_bookmarks('recat')` ranks the React card first. It turns the README's strongest paragraph into something a reviewer can watch pass.
