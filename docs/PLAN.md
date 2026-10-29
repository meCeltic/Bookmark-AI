# Bookmark-AI rebuild plan (2026-10-29)

Consolidated from the four critiques in this folder. Current scores: product 3, design 2.5,
engineering 2.5, hiring 3. Target: every critic above 9.

## Non-negotiables
- Résumé line must be literally true: "Next.js app on Supabase Auth and PostgreSQL with AI page summaries", live.
- A stranger with the link is using a populated app in three seconds (demo mode, no signup).
- Must not read as generated: no gradients, no glass, no v0 meta, three typefaces, one accent,
  variable card heights, undoable delete, reduced-motion respected, human README voice.

## Stack
Next 16.4 (App Router, server actions, proxy.ts) · React 19.3 · TypeScript 5.9 · Tailwind 4 (CSS-first tokens)
Supabase (@supabase/ssr, Postgres, RLS, tsvector + pg_trgm) · @google/genai structured output · Zod 4
cmdk · sonner · next-themes · lucide · fuse.js (demo search) · Vitest + Testing Library · GitHub Actions

## Build order (one commit per step)
1. Strip scaffold: unused shadcn, dead routes, duplicate lockfile, v0 metadata, jest; rename package.
2. Toolchain: Tailwind 4, Vitest, ESLint flat config, strict TS, .nvmrc, .env.example, scripts.
3. Domain: `lib/domain` types + Zod schemas (Bookmark, Collection, Tag, Result/AppError).
4. Pure modules + tests: `lib/url/normalize`, `lib/url/ssrf-guard`, `lib/import/netscape`, `lib/export`, `lib/search/rank`, `lib/enrich/extract`.
5. Repository: `BookmarkRepository` interface, `LocalRepository` (demo), contract tests, demo seed.
6. Supabase: migration (schema, RLS, search RPC, updated_at trigger), SSR clients, proxy.ts auth gate, `SupabaseRepository`, server actions.
7. Enrichment: `POST /api/enrich` (SSRF-guarded fetch → extract → Gemini JSON → Zod → fallback), token-bucket rate limit.
8. Design system: tokens (Index Card Desk), fonts (Fraunces / Source Sans 3 / JetBrains Mono), motion layer, primitives.
9. Screens: landing (live hero), auth (split layout), dashboard shell (sidebar, one input, ⌘K), cards (grid/list), add flow, empty states, settings.
10. Features: collections + system views, favourites/reading list/archive, sort, fuzzy search, import/export, bulk select, keyboard nav, duplicate detection, link health check, undo toasts.
11. Repo hygiene: README (human voice, architecture, decisions), CI, LICENSE, screenshots.
12. Review: 3 reviewers (code, design/"not AI", product), fix, then critic scoring ≥ 9.
