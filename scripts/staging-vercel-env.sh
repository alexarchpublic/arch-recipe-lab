#!/usr/bin/env bash
# Point Vercel preview deployments at the staging database (PRD R7).
#
# Today VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY are one value for
# production, preview and development, so every preview deployment reads and
# writes production. This narrows those two to production and development and
# adds preview-only values for staging. Production values are not changed.
#
#   STAGING_URL=https://<ref>.supabase.co STAGING_ANON_KEY=sb_publishable_... \
#     scripts/staging-vercel-env.sh
#
# Then redeploy the dev branch (or any preview) to pick the values up.
set -euo pipefail

: "${STAGING_URL:?Set STAGING_URL to the staging project URL}"
: "${STAGING_ANON_KEY:?Set STAGING_ANON_KEY to the staging publishable key}"
TEAM="${VERCEL_TEAM:-arch-public-082f875a}"
PROJECT="${VERCEL_PROJECT:-arch-recipe-lab}"

case "$STAGING_URL" in
  *xsoixhltejgyuhedhbdu*) echo "Refusing: STAGING_URL is production." >&2; exit 1 ;;
esac

envs="$(vercel api "/v9/projects/$PROJECT/env?teamId=$TEAM" --raw)"

for key in VITE_SUPABASE_URL VITE_SUPABASE_PUBLISHABLE_KEY; do
  id="$(printf '%s' "$envs" | node -e '
    const d = JSON.parse(require("fs").readFileSync(0, "utf8"));
    const e = (d.envs || []).find(x => x.key === process.argv[1] && (x.target || []).includes("production"));
    process.stdout.write(e ? e.id : "");
  ' "$key")"
  if [[ -z "$id" ]]; then echo "No production $key found; nothing changed." >&2; exit 1; fi
  echo "$key: limiting the production value to production and development"
  printf '{"target":["production","development"]}' |
    vercel api "/v9/projects/$PROJECT/env/$id?teamId=$TEAM" -X PATCH --input - --silent
done

add_preview() {
  echo "$1: adding the staging value for preview"
  node -e 'process.stdout.write(JSON.stringify({key: process.argv[1], value: process.argv[2], type: "encrypted", target: ["preview"]}))' "$1" "$2" |
    vercel api "/v10/projects/$PROJECT/env?teamId=$TEAM&upsert=true" -X POST --input - --silent
}
add_preview VITE_SUPABASE_URL "$STAGING_URL"
add_preview VITE_SUPABASE_PUBLISHABLE_KEY "$STAGING_ANON_KEY"

echo "Done. Preview deployments now use $STAGING_URL."
