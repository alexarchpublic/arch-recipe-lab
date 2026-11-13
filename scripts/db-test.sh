#!/usr/bin/env bash
# Build a database from supabase/migrations on plain Postgres and run the
# Phase 0 checks in tests/db. Needs Postgres 14+ binaries on PATH.
#
#   scripts/db-test.sh                 # throwaway local cluster
#   DATABASE_URL=postgres://... scripts/db-test.sh   # an existing empty database (CI)
set -euo pipefail
cd "$(dirname "$0")/.."

if [[ -z "${DATABASE_URL:-}" ]]; then
  tmp="$(mktemp -d)"
  port="${PGPORT_TEST:-55432}"
  initdb -D "$tmp/data" -U postgres -A trust >/dev/null
  pg_ctl -D "$tmp/data" -o "-p $port -k $tmp -c listen_addresses=''" -l "$tmp/log" start >/dev/null
  trap 'pg_ctl -D "$tmp/data" stop -m immediate >/dev/null; rm -rf "$tmp"' EXIT
  DATABASE_URL="postgresql://postgres@/postgres?host=$tmp&port=$port"
fi

run() { psql "$DATABASE_URL" -X -q -v ON_ERROR_STOP=1 "$@"; }

run -f tests/db/supabase_stub.sql
run -f tests/db/fixtures_before.sql
while read -r migration; do
  run -f "$migration"
done < <(scripts/migration-order.sh)
run -f tests/db/allowlist.test.sql
run -f tests/db/phase1.test.sql
run -f tests/db/phase2.test.sql
run -f tests/db/phase3.test.sql
run -f tests/db/phase4.test.sql
run -f tests/db/ingest_phase1.test.sql
run -f tests/db/ingest_phase2.test.sql
run -f tests/db/ingest_phase3.test.sql
run -f tests/db/ingest_phase4.test.sql
run -f tests/db/ingest_phase5.test.sql
