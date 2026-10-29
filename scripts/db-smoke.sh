#!/usr/bin/env bash
# Apply the migration to a throwaway Postgres and run the smoke test.
# Usage: DATABASE_URL=postgres://postgres:pg@localhost:5432/postgres scripts/db-smoke.sh
set -euo pipefail
cd "$(dirname "$0")/.."
: "${DATABASE_URL:?set DATABASE_URL to a disposable Postgres}"

psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -q -f supabase/tests/auth-stub.sql
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -q -f supabase/migrations/0001_init.sql
expected=$(grep -c '"expect:' supabase/tests/smoke.sql)
out=$(psql "$DATABASE_URL" -At -f supabase/tests/smoke.sql 2>&1 || true)
passed=$(printf '%s\n' "$out" | grep -c '^t$' || true)
printf '%s\n' "$out" | grep -E '^(t|f)$|ERROR' || true
if [ "$passed" -ne "$expected" ]; then
  echo "db smoke: $passed of $expected checks passed" >&2
  exit 1
fi
echo "db smoke: all $expected checks passed (the two ERROR lines above are the expected refusals)"
