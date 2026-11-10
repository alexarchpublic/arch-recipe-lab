#!/usr/bin/env bash
# Build the staging database (PRD R7) and fill it with today's strategies.
#
# Run once against a new, empty Supabase project, and again whenever staging
# should be reset to production's current strategies. It never writes to
# production: production is only read through its public API, the same way
# the live site reads it.
#
# Needs:
#   STAGING_DB_URL   Postgres connection string of the staging project
#                    (Project Settings > Database > Connection string, URI)
#   PROD_URL         https://xsoixhltejgyuhedhbdu.supabase.co (default)
#   PROD_ANON_KEY    production's publishable (anon) key, as the live site uses
#
#   scripts/staging-setup.sh migrate   # apply supabase/migrations in order
#   scripts/staging-setup.sh seed      # replace staging strategies with production's
#   scripts/staging-setup.sh all       # both
set -euo pipefail
cd "$(dirname "$0")/.."

: "${STAGING_DB_URL:?Set STAGING_DB_URL to the connection string of the staging project}"
PROD_URL="${PROD_URL:-https://xsoixhltejgyuhedhbdu.supabase.co}"

case "$STAGING_DB_URL" in
  *xsoixhltejgyuhedhbdu*) echo "Refusing: STAGING_DB_URL points at production." >&2; exit 1 ;;
esac

psql_staging() { psql "$STAGING_DB_URL" -X -q -v ON_ERROR_STOP=1 "$@"; }

migrate() {
  psql_staging -c "create table if not exists public._staging_applied (file text primary key, applied_at timestamptz default now())"
  while read -r migration; do
    name="$(basename "$migration")"
    if [[ "$(psql_staging -tA -c "select 1 from public._staging_applied where file = '$name'")" == "1" ]]; then
      continue
    fi
    echo "applying $name"
    psql_staging -1 -f "$migration" -c "insert into public._staging_applied (file) values ('$name')"
  done < <(scripts/migration-order.sh)
}

seed() {
  : "${PROD_ANON_KEY:?Set PROD_ANON_KEY to the publishable key of production}"
  tmp="$(mktemp -d)"; trap 'rm -rf "$tmp"' RETURN
  for table in recipes recipe_screenshots; do
    curl -fsS "$PROD_URL/rest/v1/$table?select=*" \
      -H "apikey: $PROD_ANON_KEY" -o "$tmp/$table.json"
  done
  echo "copying $(grep -o '"id":' "$tmp/recipes.json" | wc -l | tr -d ' ') strategies and $(grep -o '"id":' "$tmp/recipe_screenshots.json" | wc -l | tr -d ' ') screenshots"
  # Screenshot rows keep pointing at production's public image URLs (read only).
  psql_staging -1 \
    -v recipes="$(cat "$tmp/recipes.json")" \
    -v shots="$(cat "$tmp/recipe_screenshots.json")" <<'SQL'
delete from public.recipe_screenshots;
delete from public.recipes;
insert into public.recipes select * from json_populate_recordset(null::public.recipes, :'recipes'::json);
insert into public.recipe_screenshots select * from json_populate_recordset(null::public.recipe_screenshots, :'shots'::json);
select setval('public.recipes_display_number_seq', coalesce((select max(display_number) from public.recipes), 1));
SQL
}

case "${1:-all}" in
  migrate) migrate ;;
  seed) seed ;;
  all) migrate; seed ;;
  *) echo "usage: $0 [migrate|seed|all]" >&2; exit 2 ;;
esac
