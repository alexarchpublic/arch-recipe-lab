#!/usr/bin/env bash
# Vercel's Ignored Build Step for Strategy Lab: exit 0 skips the build, any
# other exit builds.
#
# A deploy of the commit that is already live (the deploy hook api/revalidate
# calls when the old addresses change, or a redeploy) always builds: its
# point is to read the store again, since next.config.mjs makes the redirects
# at build. A push builds when anything changed in this app or packages/core
# since the last deploy that built. When git cannot tell (no previous deploy,
# or history too shallow), it builds.
set -u
prev="${VERCEL_GIT_PREVIOUS_SHA:-}"
head="${VERCEL_GIT_COMMIT_SHA:-HEAD}"
if [ -z "$prev" ] || [ "$prev" = "$head" ]; then
  echo "Building: the same commit again, or no earlier deploy."
  exit 1
fi
if git diff --quiet "$prev" "$head" -- . ../../packages/core 2>/dev/null; then
  echo "Skipping: nothing changed in Strategy Lab or packages/core since $prev."
  exit 0
fi
echo "Building: Strategy Lab or packages/core changed since $prev (or git could not tell)."
exit 1
