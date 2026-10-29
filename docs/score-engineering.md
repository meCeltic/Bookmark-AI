# Engineering Score: bookmark-ai (post-rebuild)

Same reviewer as `docs/critique-engineering.md` (2.5/10). Verified 2026-10-30 against the working tree, `npm run verify`, and the dev server on :3100.

## Score: 8.3 / 10

As a hiring signal for a backend developer this now reads as production-minded work, not a scaffold. `npm run verify` is green: lint, `tsc --noEmit`, 273 tests in 1.3 s, clean Next 16 build with no `ignoreBuildErrors`. Every item that made v1 unhireable is gone: auth is enforced (`proxy.ts:46-53`, server pages re-check), the schema the UI uses is the schema in the repo, SSRF is guarded with 23 table-driven tests, the model is validated like any upstream, errors are typed `Result<T>` with correct HTTP codes.

Live probes: `127.0.0.1`, `169.254.169.254`, `0x7f000001` all return 422 `BLOCKED_URL`; malformed body 400; anonymous burst trips at request 13 with `Retry-After: 5`; `/api/health` marks `10.0.0.1` dead without touching it.

What keeps it under 9: the Postgres implementation has no automated test, there is no structured logging or request id, the SSRF guard's DNS-rebinding gap is documented rather than closed, and a few boundary checks are a layer too deep. A staff engineer would merge this with four or five review comments; they would not yet hand it to a junior as the reference.

## Target architecture status

| Item | Status | Evidence |
| --- | --- | --- |
| Migration: RLS `using`+`with check`, unique `(user_id,url_normalized)`, generated tsvector, GIN + trigram, cascade FKs, `updated_at` trigger | DONE | `0001_init.sql:44-81` |
| `search_bookmarks` RPC with trigram fallback | PARTIAL | Exists (`:88-103`) but unreachable from UI; `SupabaseRepository.search` (`supabase.ts:262`) is outside the interface. README roadmap owns this. |
| Tags table | DONE (changed) | `text[]` + GIN, justified in-line (`:27-29`) and in README. Accepted. |
| Layers: domain / url / repo / enrich / import / search / actions, one route handler | DONE | `lib/**` matches; `/api/health` added |
| Repository interface + Local + Supabase + contract tests | PARTIAL | Contract runs on `LocalRepository` only (`contract.test.ts:5-10`); Supabase impl untested |
| Server actions thin: auth → Zod → repo → revalidate, never throw | DONE | `actions/bookmarks.ts:23-42` |
| SSRF guard: http(s), private v4/v6, DNS re-check, 3 redirects re-validated, timeout, byte cap | DONE | `ssrf-guard.ts:182-332`; rebinding noted at `:14-16` |
| Gemini structured output + Zod parse + metadata fallback + status on row | DONE | `gemini.ts:72-100`, `pipeline.ts:52-73` |
| Rate limit: per-user/IP, `Retry-After`; daily cap; per-host cooldown | PARTIAL | Per-minute buckets only (`enrich/route.ts:21`); no daily cap, no host cooldown |
| Zod at every boundary | PARTIAL | Collections bypass it (below) |
| Logger with request id, no PII | MISSING | Two bare `console.error` (`actions/bookmarks.ts:39`, `repo/supabase.ts:26`); no correlation id |
| Dependency plan, exact pins, `.nvmrc`, `.env.example`, `engines` | DONE | `package.json`, both files present |
| CI: lint/typecheck/test/build, badge, security notes | DONE | `ci.yml`, README |
| CI migration job (`supabase db reset`), coverage | MISSING | Migration verified once by hand in Docker, not on every PR |

## Verified defects

1. `lib/http.ts:11-12`. Body cap is enforced after `request.text()` buffers the whole payload; a 200 KB chunked body without `content-length` was fully received before the 400. Read the stream and abort at 64 KB.
2. `lib/actions/bookmarks.ts:73-75,80`. `createCollectionAction`/`renameCollectionAction` pass `String(name)` with no schema; a 61+ char name hits the DB check (`0001_init.sql:11`) and surfaces as `INTERNAL` plus a server log instead of `VALIDATION`. The sidebar's `maxLength={60}` is the only guard.
3. `lib/repo/supabase.ts:127,181`. `select("*")` ships the generated `search` tsvector on every list and bulk update; Zod strips it, but it is dead bytes on the wire per row. Use an explicit column list.
4. `lib/repo/supabase.ts:219-222`. Collection `position` is read-then-insert; two concurrent creates collide. Use `max(position)+1` in the insert or a sequence.
5. `lib/repo/supabase.ts:268-273`. `clear()` is two statements, not one transaction; a failure between them leaves collections without bookmarks. Wrap in an RPC.
6. `lib/url/ssrf-guard.ts:299`. `fetch` re-resolves DNS after `assertPublicUrl`; a sub-TTL rebind bypasses the guard. Acknowledged in the file; still open.
7. `lib/url/ssrf-guard.ts:311`. An `https` page may redirect to `http`; no downgrade check.
8. `lib/ratelimit.ts:78-84`. `clientKey` and `limiterFor` have no tests; verified live that a changed `x-forwarded-for` gets a fresh bucket when no trusted proxy is in front, as the comment predicts.

## Three changes that move the score most

1. **Integration-test `SupabaseRepository` against real Postgres in CI.** Run `repositoryContract("supabase", …)` against a `postgres:16` service with the migration applied and a JWT-scoped client, plus a test that user B cannot read user A (RLS). Add a `migrations` job. This turns "checked by hand" into proof and is the single largest gap for a backend hire. (+0.5)
2. **Close the SSRF rebinding gap.** Use an undici `Agent` whose `connect.lookup` returns only the addresses already validated, and reject `https`→`http` redirects. Then delete the "known limit" comment. (+0.3)
3. **Structured logging with a request id.** One `pino` instance, `x-request-id` generated in `proxy.ts` and threaded through actions and route handlers; replace both `console.error` calls; log code and duration, never bodies or user objects. Pair with streaming body cap and Zod on collection names. (+0.3)

With all three this is a 9.2: a repo a staff engineer would cite.
