# Engineering Critique: bookmark-ai

Staff-level screen of a backend candidate's portfolio repo. Verified against the working tree on 2026-10-29; versions via `npm view`.

## 1. Score: 2.5 / 10 as a hiring signal

- **It reads as a v0.dev scaffold.** `package.json:2` (`my-v0-project`), `app/layout.tsx:11` (`generator: 'v0.dev'`), 50 shadcn components with 9 imported, `next.config.mjs:3-8` disabling ESLint and TypeScript errors at build.
- **Documented architecture is not the running one.** README says Supabase Postgres is the primary store; the dashboard (`app/dashboard/dashboard-content.tsx:19,52,139,162`) uses only localStorage. The four bookmark API routes and the `bookmarks` table are never called from the UI.
- **The auth gate is broken by a destructuring bug** (2.1), so it never closes.
- **Tests cannot run.** `jest`/`jest-environment-jsdom` are in neither `package.json` nor either lockfile; no `test` script; `@testing-library/*` sit in prod deps at `latest`.
- **Type safety is off in practice.** `User` is used without import (`app/api/bookmarks/route.ts:26`, `.../[id]/tags/route.ts:22`); compiles only via `ignoreBuildErrors`.

Credit for: small pure modules with tests (`lib/url-utils.ts`, `lib/local-storage.ts`), RLS policies, sensible scope.

## 2. Bugs and security issues

### Auth / session

1. **Wrong `getUser()` destructuring, auth never enforced.** It resolves to `{ data: { user } }`. `middleware.ts:17` does `const { data: user }`, so `user` is the always-truthy `{ user: null }` and the redirect at `:21` never fires. Same in `app/api/bookmarks/route.ts:17-19,125-127`, `app/api/bookmarks/[id]/route.ts:8-10`, `.../tags/route.ts:13-15`, `app/api/setup/route.ts:9-11`: every 401 branch is dead and `user.id` is `undefined` afterwards. Only `app/dashboard/page.tsx:10-12` is correct.
2. **Middleware logs the user object** (`middleware.ts:18`) and every path (`:6`): PII in server logs per request.
3. **Matcher is wrong regardless.** `middleware.ts:36` excludes only static assets; with bug 1 fixed, `/`, `/auth/callback` and `/api/*` would all redirect to `/login`.
4. **Duplicated env vars.** Server reads `SUPABASE_URL`/`SUPABASE_ANON_KEY` (`middleware.ts:11-12`, `lib/server-supabase.ts:10-11`, `lib/supabase-route-handler.ts:10-11`); the browser reads `NEXT_PUBLIC_*` (`lib/supabase.ts:12-13`). One pair suffices.
5. **Deprecated auth lib and async-API misuse.** `@supabase/auth-helpers-nextjs` is deprecated for `@supabase/ssr`. `cookies()` is async in Next 15 but called synchronously (`lib/server-supabase.ts:6`, `lib/supabase-route-handler.ts:6`); `params` is a Promise but read synchronously (`app/api/bookmarks/[id]/route.ts:4-5`, `.../tags/route.ts:4-5`). Both survive on deprecation shims that Next 16 removes.

### SSRF and the metadata fetcher

6. **Unrestricted server-side fetch of user URLs.** `app/api/metadata/route.ts:42` and `app/api/bookmarks/route.ts:49` fetch anything: `localhost:3000`, `127.0.0.1`, `169.254.169.254/latest/meta-data/`, `10.0.0.5:5432`. No scheme allow-list, no private-IP or DNS-rebinding check, redirects followed (`:44`) so a public URL can 302 to an internal one. `metadata/route.ts` never calls `getUser`, so it is an unauthenticated SSRF proxy.
7. **No body cap.** `response.text()` (`metadata/route.ts:76`, `bookmarks/route.ts:50`) buffers unbounded bodies; `bookmarks/route.ts:49` has no timeout.
8. **Jina URL is malformed.** `metadata/route.ts:173,177` and `bookmarks/route.ts:86-87` produce `https://r.jina.ai/http://https%3A%2F%2F…`; it can never resolve, so the README's "AI summaries" feature does not work. When Jina does respond it returns the whole page as markdown, not a summary.
9. **Errors returned as 200.** `metadata/route.ts:210-220` sends `{ error }` with `status: 200`; the client's `response.ok` check (`dashboard-content.tsx:129`) cannot see failures.
10. **Regex HTML parsing assumes attribute order** (`metadata/route.ts:80,89,153`; `lib/summary-generator.ts:6,13`).

### Database / RLS

11. **`exec_sql` is arbitrary SQL over the API.** `setup.sql:85-90` defines a public `exec_sql(sql_query text)`; Supabase exposes it as an RPC to the anon key. Delete it. (It also cannot work: `app/api/setup/route.ts:24-25` passes `{ sql }`, not `sql_query`.)
12. **Runtime schema management with the service-role key.** `app/api/setup/route.ts:49-55` POSTs SQL to `/rest/v1/` (which does not execute SQL). Migrations belong in `supabase/migrations/`.
13. **Invalid SQL.** `CREATE POLICY IF NOT EXISTS` (`setup.sql:17,22,27,32`, `setup/route.ts` policies array) is not Postgres syntax; `uuid_generate_v4()` (`setup-database.sql:3`) needs `uuid-ossp`, not enabled; use `gen_random_uuid()`.
14. **No index on `user_id`, no `ON DELETE CASCADE`** (`setup-database.sql:4`), so deleting a user fails. Two near-duplicate SQL files.
15. **JS ownership checks** (`app/api/bookmarks/[id]/route.ts:22-25`) duplicate RLS and, given bug 1, compare against `undefined`.

### Client

16. **localStorage per-user isolation is cosmetic.** `lib/local-storage.ts:19-20` filters by `user_id`, but one `bookmarks` key holds everyone's data.
17. **Prop mutation** at `components/bookmark-card.tsx:66` (`bookmark.tags = …`).
18. **Stale closure** `dashboard-content.tsx:149` (`setBookmarks([newBookmark, ...bookmarks])`); `handleTagAdded` (`:171`) ignores its argument.
19. **`react-beautiful-dnd`** (`package.json:51`) is archived and not React 19-safe, hence the `setTimeout(…, 50)` hacks (`dashboard-content.tsx:80-82,165`).
20. **Theme handled twice.** `next-themes` + `components/theme-provider.tsx` unused; `app/layout.tsx:20` hard-codes `dark`; `dashboard-content.tsx:63-77,222-235` toggles the class by hand.
21. **`lib/client-metadata.ts:26-33`** uses `mode: "no-cors"`, so `.ok` is always false and favicon is always nulled; the module is never imported.
22. **Dead/empty files:** `app/dashboard/components/BookmarkList.tsx`, `DarkModeToggle.tsx`, `lib/client-utils.ts`, `styles/animations.css` (0 bytes); `app/metadata.ts` and `styles/globals.css` duplicate `layout.tsx` / `app/globals.css`; `app/api/setup` and `app/api/bookmarks/**` unreachable from the UI.

### Build, deps, tests

23. **`latest` pins** (`package.json:31-35`) for Supabase and Testing Library, the latter in prod deps.
24. **Both `package-lock.json` and `pnpm-lock.yaml` committed**; `pnpm-workspace.yaml` is a placeholder.
25. **Tests broken as written.** `__tests__/bookmark-card.test.tsx:57` queries `button[variant="destructive"]`, but `variant` is a cva prop, not a DOM attribute. `local-storage.test.ts:79,104` depend on `mock.calls[1]` ordering.
26. **`tsconfig.json:5`** targets ES6; no ESLint config exists for `next lint`.
27. **No `.env.example`** (`.gitignore:20` ignores `.env*`).

## 3. Target architecture (one build session)

### Data model (`supabase/migrations/0001_init.sql`)

```sql
create extension if not exists pg_trgm;

create table collections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 60),
  position int not null default 0,
  created_at timestamptz not null default now(),
  unique (user_id, name)
);

create table bookmarks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  collection_id uuid references collections(id) on delete set null,
  url text not null,
  url_normalized text not null,
  title text, description text, summary text, category text, favicon_url text,
  enrichment_status text not null default 'pending'
    check (enrichment_status in ('pending','done','fallback','failed')),
  position int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  search tsvector generated always as (
    setweight(to_tsvector('english', coalesce(title,'')), 'A') ||
    setweight(to_tsvector('english', coalesce(summary,'')), 'B') ||
    setweight(to_tsvector('simple', coalesce(url_normalized,'')), 'C')) stored,
  unique (user_id, url_normalized)            -- dedupe in the DB, not in JS
);

create table tags (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null, unique (user_id, name)
);
create table bookmark_tags (
  bookmark_id uuid references bookmarks(id) on delete cascade,
  tag_id uuid references tags(id) on delete cascade,
  primary key (bookmark_id, tag_id)
);

create index on bookmarks (user_id, created_at desc);
create index on bookmarks using gin (search);
create index on bookmarks using gin (title gin_trgm_ops);

alter table bookmarks enable row level security;   -- and the other three
create policy own_rows on bookmarks for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
```

RPC `search_bookmarks(q text)`: order by `ts_rank_cd(search, websearch_to_tsquery('english', q))`, falling back to trigram `title % q` when the tsquery matches nothing. One `updated_at` trigger.

### Layers

```
app/
  (marketing)/page.tsx
  (app)/dashboard/page.tsx   server component: repository read -> props to client list
  api/enrich/route.ts        the only route handler (slow, rate-limited, demo-callable)
  auth/callback/route.ts
lib/
  domain/bookmark.ts         types + Zod schemas, single source of truth
  url/normalize.ts           pure: lower-case host, drop default port/fragment/trailing slash, strip utm_*/fbclid, sort query
  url/ssrf-guard.ts          http(s) only; reject loopback/RFC1918/link-local/CGNAT/IPv6-mapped literals; resolve DNS and re-check; max 3 redirects, re-validate each hop; 5 s timeout; 1 MiB cap; text/html only
  repo/BookmarkRepository.ts interface { list, get, create, update, remove, reorder, search, importMany }
  repo/supabase.repo.ts      server impl via @supabase/ssr
  repo/local.repo.ts         browser impl via localStorage (demo mode)
  enrich/gemini.ts           structured output -> { summary, tags[3..5], category }
  enrich/fallback.ts         meta description / og:description / first <p>
  import/netscape.ts         pure parser for browser bookmarks.html exports
  search/rank.ts             fuse.js ranking for demo mode
  actions/*.ts               server actions: create, delete, addTag, reorder, move
```

**Server actions vs route handlers.** Fast user-initiated mutations are server actions (typed args, CSRF handled, `revalidatePath`). `POST /api/enrich` is a route handler: slow, separately rate-limited, callable from demo mode. Reads happen in server components through the repository.

**Repository pattern.** The UI talks only to `BookmarkRepository`. Authenticated users get the Supabase implementation behind server actions; no session gets `LocalRepository` in the browser with a "Demo mode, data stays in this browser" banner and a one-click import into the account after sign-up. Same interface, same Zod types, same contract test suite run against both. This is the strongest talking point for a backend interview.

**AI enrichment.** `createBookmark` inserts with `enrichment_status='pending'` and returns; the client calls `/api/enrich`. The handler: Zod-validate body, load the row (RLS-scoped), SSRF-guarded fetch, take the first ~6 kB of text, and if `GEMINI_API_KEY` is set call `@google/genai` with `responseMimeType: 'application/json'` and a `responseSchema` (`summary` <= 280 chars, `tags` 3-5, `category` enum), then Zod-parse the model output (never trust it), upsert tags, set `done`. No key or any Gemini error: write the meta-description fallback and set `fallback`. Demo mode calls the same route with `{ url }` and stores the result locally.

**Rate limiting.** In-memory token bucket keyed by `user.id` (IP in demo mode): 10 enrichments/min, 100/day, per-host cooldown; `429` with `Retry-After`. README notes single-instance; Upstash Redis is the upgrade path.

**Validation and errors.** Zod at every boundary (action args, route bodies, Gemini output, imported HTML, localStorage reads). Actions return `Result<T, AppError>` (`{ ok, data } | { ok: false, code, message }`), never throw across the server/client line. Codes `VALIDATION | UNAUTHORIZED | NOT_FOUND | DUPLICATE | RATE_LIMITED | UPSTREAM | INTERNAL` map to 400/401/404/409/429/502/500. One pino logger with request id; no `console.log`; never log user objects or query strings.

**Testing (Vitest; node env for pure code, jsdom for components).**
- `url/normalize`: case, utm stripping, query sort, trailing slash, IDN, idempotence.
- `url/ssrf-guard`: table-driven loopback, 10/8, 172.16/12, 192.168/16, 169.254/16, `::1`, `::ffff:127.0.0.1`, decimal/octal IPs, `file:`, redirect-to-private with mocked fetch.
- `repo/contract`: one suite against `LocalRepository` and a mocked Supabase client (dedupe on `url_normalized`, reorder stability, tag idempotence).
- `import/netscape`: real Chrome/Firefox fixtures. `search/rank`: title beats summary, exact tag beats fuzzy. `enrich/gemini`: malformed JSON and schema violations fall back.
- Three component tests: add form (optimistic row, error state), card (tag add, no prop mutation), demo banner.

Target ~40 tests, under 5 s.

## 4. Dependency plan

**Remove:** `react-beautiful-dnd`, `@types/react-beautiful-dnd`, `@supabase/auth-helpers-nextjs`, `recharts`, `embla-carousel-react`, `react-day-picker`, `date-fns`, `input-otp`, `vaul`, `react-resizable-panels`, `react-hook-form`, `@hookform/resolvers`, `cmdk` (unless a palette ships), and `@radix-ui/react-{accordion, alert-dialog, aspect-ratio, avatar, checkbox, collapsible, context-menu, hover-card, menubar, navigation-menu, popover, progress, radio-group, scroll-area, select, separator, slider, tabs, toast, toggle, toggle-group, tooltip}`. Delete 41 of 50 files in `components/ui/` (keep `button, card, badge, dialog, input, label, switch, sonner, skeleton`), `use-toast`, `use-mobile`, `app/api/setup`, `setup.sql`, `lib/client-metadata.ts`, `lib/client-utils.ts`, `app/metadata.ts`, `styles/`, the empty dashboard components, `pnpm-lock.yaml` + `pnpm-workspace.yaml` (standardise on npm), and both `jest.*` files.

**Add / pin** (registry, 2026-10-29):

| Package | Version | Note |
|---|---|---|
| `next` | `16.4.3` | current major; `15.5.28` if anything lags |
| `react`, `react-dom` | `19.3.1` | |
| `@supabase/ssr` | `0.12.7` | replaces auth-helpers |
| `@supabase/supabase-js` | `2.118.0` | |
| `@google/genai` | `2.32.0` | `responseSchema` structured output |
| `zod` | `4.6.7` | |
| `@dnd-kit/core` / `@dnd-kit/sortable` | `6.3.1` / `10.0.0` | React 19-safe rbd replacement |
| `fuse.js` | `7.5.0` | demo-mode search only |
| `lucide-react` | `1.64.0` | |
| `next-themes` | `0.4.6` | wire it up this time |
| `sonner` | `2.0.8` | replaces radix toast |
| `tailwindcss` + `@tailwindcss/postcss` | `4.3.3` | **go to 4**: CSS-first config, no `tailwind.config.ts`, matches current shadcn; a rebuild is the cheapest moment to migrate |
| `cmdk` | `1.1.1` | optional |
| `zustand` | none | server components + `useOptimistic` suffice; a store here is padding |
| `vitest` / `@vitejs/plugin-react` / `jsdom` | `5.0.5` / `6.1.2` / `30.1.3` | dev |
| `@testing-library/react` / `jest-dom` | `16.3.3` / `7.0.1` | dev |
| `typescript` | `5.9.3` | dev; pin 5.x (7.0 is the Go-port preview) |
| `eslint-config-next` | `16.4.3` | dev |

Rename the package `bookmark-ai`; add `engines.node >=20`, `.nvmrc`, `.env.example`, scripts `lint`, `typecheck` (`tsc --noEmit`), `test`, `build`; remove `ignoreBuildErrors` / `ignoreDuringBuilds`.

## 5. CI: `.github/workflows/ci.yml`

```yaml
name: ci
on:
  push: { branches: [main] }
  pull_request:
concurrency: { group: ci-${{ github.ref }}, cancel-in-progress: true }
jobs:
  verify:
    runs-on: ubuntu-latest
    timeout-minutes: 10
    env:
      NEXT_PUBLIC_SUPABASE_URL: https://example.supabase.co
      NEXT_PUBLIC_SUPABASE_ANON_KEY: ci-placeholder
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version-file: .nvmrc, cache: npm }
      - run: npm ci
      - run: npm run lint
      - run: npm run typecheck
      - run: npm test -- --coverage --reporter=dot
      - run: npm run build
```

Add a `migrations` job running `supabase db reset` on the CLI local stack for PRs touching `supabase/migrations/**`. Require `verify` in branch protection. Put a CI badge and a short "Security notes" paragraph (SSRF guard, RLS, rate limits, no service-role key in the app) at the top of the README; a backend reviewer reads that first.
