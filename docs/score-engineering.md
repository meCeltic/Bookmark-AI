# Engineering Score: bookmark-ai (final, after e1d18fd)

Same reviewer as the 8.0 pass. Verified 2026-10-30 against commit e1d18fd.

## Score: 9.0 / 10 (up from 8.0)

The blocking defect is gone and cannot come back silently.

## What I verified

- `npm run verify` green: eslint clean, `tsc --noEmit` clean, 17 test files / 280 tests passing (was 275; +2 columns, +1 downgrade, +2 limiter), `next build` succeeds with all nine routes.
- `git show e1d18fd --stat`: 14 files; code changes confined to `lib/repo/supabase.ts`, two route handlers, three test files, plus cosmetic leftovers.
- `lib/repo/supabase.ts:20-22`: `BOOKMARK_COLUMNS` and `COLLECTION_COLUMNS` (`id,user_id,name,position,created_at`) are separate exports. Every `bookmarks` query uses the first, every `collections` query (`listCollections`, `createCollection`, `renameCollection`) uses the second. No remaining reference to the old shared `COLUMNS`.
- `lib/repo/columns.test.ts`: parses `create table public.<table> (` blocks from `supabase/migrations/0001_init.sql`, drops constraint lines, and asserts (a) bookmarks selects every column except exactly `["search"]`, the generated tsvector, and (b) collections matches exactly. Parser output matches the table definitions. Mutation check: I temporarily set `COLLECTION_COLUMNS = BOOKMARK_COLUMNS`, ran the test, it failed (`collections: the list matches the table exactly`), then restored the file (tree clean). The regression from the previous round would now fail `npm test`.
- `lib/url/ssrf-guard.test.ts:260-265`: `safeFetch("https://example.com/a")` with a 301 to `http://example.com/plain` returns `BLOCKED_URL` and makes exactly one request. Covers `ssrf-guard.ts:313`.
- `lib/ratelimit.test.ts:29-45`: `clientKey` prefers `x-real-ip`, falls back to the last `x-forwarded-for` hop, `user:<id>` when signed in, `ip:unknown` otherwise; `limiterFor` returns one instance per route+tier and distinct instances across tiers.
- `app/api/enrich/route.ts:22-42`: one logger per request with `requestId(request.headers)`, route and user id; logs rate-limit (with retryAfter), refusal (code + hostname only, no full URL) and success (hostname + source). `app/api/health/route.ts:25`: rate-limit log with request id. No PII beyond the user id.

## Still open (none blocking)

1. `lib/repo/supabase.ts:228-231`: collection `position` is read-then-insert (`max+1` computed in TypeScript). Concurrent creates tie on position; no data loss. Acknowledged; `coalesce(max(position),-1)+1` in SQL would close it.
2. `lib/repo/supabase.ts:277-282`: `clear()` is two deletes, not one transaction. A failure between them is recoverable by re-running.
3. `lib/repo/contract.test.ts:114`: the repository contract still runs only against `LocalRepository`. The column test now pins the SQL shape, and the `database` CI job (`scripts/db-smoke.sh`) exercises the schema, so the gap that bit last round is covered; behavioural parity of `SupabaseRepository` (error mapping, duplicate handling) remains untested end to end. Author has scoped this out (needs PostgREST); I accept that for a portfolio project.
4. `lib/actions/bookmarks.ts:40` and `lib/repo/supabase.ts:35`: server-action and repository error logs carry `scope` but no request id, so a failing action cannot be joined to the route log line. Threading an id through `withRepo` is a small follow-up.
5. `lib/url/ssrf-guard.ts:14-16`: DNS rebinding between the resolve and fetch remains, documented, not counted.

## Verdict

Mergeable. The blocking item was a wrong column list the suite could not see; this commit fixes it and adds a test that reads the migration itself, the right shape of fix. What remains is concurrency and observability polish with bounded blast radius. Citable as a portfolio project.
