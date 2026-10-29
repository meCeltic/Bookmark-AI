# Engineering Score: bookmark-ai (after fix round 3c8558f + 822c090)

Same reviewer as the 8.3 pass. Verified 2026-10-30 against the working tree, `npm run verify`, `scripts/db-smoke.sh` in a fresh `postgres:16-alpine` container, and curl probes on :3100.

## Score: 8.0 / 10 (down from 8.3)

The round did real work and then shipped a regression that breaks collections in production. `npm run verify` is green: lint, `tsc`, 275 tests, clean build. The database CI job is genuine: I ran `scripts/db-smoke.sh` cold in Docker and all 8 checks pass as `app_user` (RLS read and write isolation, unique canonical-url refusal, tsvector hit, trigram partial `postgre`, tag search, `rename_tag` merge-and-sort, `updated_at` trigger). Live probes: a 200 KB chunked body with no `content-length` gets 400 (the stream cap works, `lib/http.test.ts` covers it), malformed JSON 400, `169.254.169.254` 422 `BLOCKED_URL`.

But `select(COLUMNS)` was applied to the `collections` table as well as `bookmarks`. `COLUMNS` is the bookmark column list (`collection_id,url,title,...`); `collections` has `id,user_id,name,position,created_at`. Proven against the migrated DB: `select id,user_id,collection_id,url,title from public.collections` → `ERROR: column "collection_id" does not exist`. PostgREST returns 42703 for the same select, so on real Supabase every `createCollection` and `renameCollection` now returns `INTERNAL`. `LocalRepository` passes the contract tests, Supabase has none: exactly the gap the previous review flagged first, and it would block the merge.

Two claims in the round are also not true in the tree: collection `position` is still read-then-insert (`supabase.ts:224-227`, not `max+1`), and `requestId()` is defined (`lib/log.ts:29`) but never called, so no log line carries a request id.

## Target architecture status (changes only)

| Item | Status | Evidence |
| --- | --- | --- |
| CI migration job | DONE | `ci.yml` `database` job; `scripts/db-smoke.sh`; 8/8 locally |
| Supabase repository contract test | MISSING | `contract.test.ts:12` runs Local only; the regression above is the cost |
| Logger, no PII | PARTIAL | `lib/log.ts`; both `console.error` gone; no request id threaded |
| Zod on collection names | DONE | `actions/bookmarks.ts:46,76-86` |
| Streaming body cap | DONE | `lib/http.ts:12-32`, test + live probe |
| https→http downgrade refusal | DONE, untested | `ssrf-guard.ts:313`; no case in `ssrf-guard.test.ts` (23 cases, none for downgrade) |
| Explicit columns | DONE for bookmarks, BROKEN for collections | below |
| `.env.example` tracked | DONE | |

## Verified defects

1. **`lib/repo/supabase.ts:228` and `:242`.** `select(COLUMNS)` on `collections`. Must be `select("*")` or a `COLLECTION_COLUMNS` list. Blocking.
2. `lib/repo/supabase.ts:224-227`. `position` still read-then-insert; concurrent creates collide. Use `coalesce(max(position),-1)+1` in an RPC or a per-user sequence.
3. `lib/log.ts:29`. `requestId()` has no caller. Generate it in `proxy.ts`, pass to `logger({ requestId })` in the route handlers and `withRepo`.
4. `lib/url/ssrf-guard.ts:313`. Downgrade check has no unit test; one `redirect(302, "http://...")` case in the existing harness would do.
5. `lib/repo/supabase.ts:273-278`. `clear()` is still two statements, not a transaction.
6. `lib/ratelimit.ts:60,78`. `limiterFor` and `clientKey` still untested; `ratelimit.test.ts` covers the bucket only.
7. `lib/url/ssrf-guard.ts:14-16,299`. DNS rebinding remains open; documented, and not patching undici inside Next's fetch is defensible. Not counted further.

## Verdict

A staff engineer would not merge this as it stands: defect 1 breaks a user-facing feature on the production backend and the test suite cannot see it. With a one-line fix plus a Supabase contract run (the CI job already provisions the Postgres; PostgREST or a direct `pg` client against the migrated DB is the missing piece) this is a 9.0 and citable. The direction of the round is right; the execution needs a contract test behind it before a column-list refactor is safe to make.

## Three changes that move the score most

1. Fix the `collections` select, then run `repositoryContract("supabase", …)` in the `database` job against the migrated DB so a wrong column list fails CI. (+0.7)
2. Thread `requestId` from `proxy.ts` through actions and route handlers; log code and duration. (+0.2)
3. Add the downgrade test and the `clientKey`/`limiterFor` tests; move `position` to `max+1` in SQL. (+0.1)
