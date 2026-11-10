#!/usr/bin/env bash
# Print supabase/migrations in the order that builds a fresh database.
#
# Filenames are mostly chronological, but the first two (20250117...) were
# dated before the migration that creates the recipes table (20251016...),
# which they depend on. Production was built in the right order at the time,
# so the files are not renamed (renaming would change recorded versions);
# this list puts the table first.
set -euo pipefail
cd "$(dirname "$0")/.."
base="supabase/migrations/20251016150231_fedb4704-5dbb-4751-8e30-3c621ef61e26.sql"
echo "$base"
ls supabase/migrations/*.sql | sort | grep -vF "$base"
