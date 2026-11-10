# Staging

Staging is a separate Supabase project for testing ingestion and migrations
(PRD R7). Vercel preview deployments, including every pull request and the
`dev` branch, read it. Production deployments from `main` read production.

| | Production | Staging |
| --- | --- | --- |
| Supabase project | `xsoixhltejgyuhedhbdu` | `vdtkboqglndanzvzrqsn` (arch-recipe-lab-staging, us-east-2) |
| Deployed from | `main`, automatically | `dev` and pull requests, as Vercel previews |
| Strategy data | the source of truth | a copy of production, reset on demand |
| Images | production bucket | rows point at production's public images; new uploads go to the staging bucket |

Staging was created on 10 November 2026 in the Arch Public organization
($10 a month). It holds all 15 migrations, including `20261110000003`, and a
copy of production's 76 strategies and 165 screenshots whose fingerprint
matched production's. Vercel's preview environment points at it; production
and development keep production's values. Its admin list holds
alex@archpublic.com: invite that address from the staging dashboard to sign in.

Two differences from production, both harmless: `update_updated_at_column()`
was re-saved by hand in production (same behaviour), and production does not
yet have `20261110000003`.

The old project named in the repo, `latolckbjpwwnjpglgee`, no longer exists
(its address stopped resolving by 10 November 2026), so it cannot be reused.

## Set it up once

1. Create a Supabase project, for example `arch-recipe-lab-staging`, in the
   same organization as production.
2. Build the database and copy today's strategies. `PROD_ANON_KEY` is the
   publishable key the live site already ships to every browser.

   ```bash
   STAGING_DB_URL='postgresql://postgres:<password>@db.<staging-ref>.supabase.co:5432/postgres' \
   PROD_ANON_KEY='sb_publishable_...' \
   scripts/staging-setup.sh all
   ```

3. Point Vercel previews at staging:

   ```bash
   STAGING_URL='https://<staging-ref>.supabase.co' \
   STAGING_ANON_KEY='sb_publishable_...' \
   scripts/staging-vercel-env.sh
   ```

4. Add `ANTHROPIC_API_KEY` to the preview environment if it is not there, and
   add staging admins with the SQL in `docs/ADMIN_ACCESS.md`.

### Without a database password

Staging was first built through the Supabase connector, which has no
password. Two things learned there:

- Apply migrations one at a time. Two sent together got the same version
  timestamp and one was refused.
- `20251030000220` fails on an empty table (`setval` cannot take 0). The base
  migration's 13 sample rows must exist first, which the file order provides.

The copy then ran inside staging: `pg_net` fetched production's public
`recipes` and `recipe_screenshots` with the publishable key, and one
transaction replaced staging's rows with them.

## Reset staging to production's strategies

```bash
STAGING_DB_URL='...' PROD_ANON_KEY='...' scripts/staging-setup.sh seed
```

## Test a migration

1. Add the file to `supabase/migrations/`.
2. `npm run test:db` builds a fresh database locally and runs the checks in
   `tests/db/`. CI does the same on every pull request.
3. `scripts/staging-setup.sh migrate` applies new files to staging only. It
   records what it applied in `public._staging_applied`.
4. Apply to production from the Supabase SQL editor once staging looks right.

The migration files do not build a database in filename order: the two
`20250117` files need the table created in `20251016150231`.
`scripts/migration-order.sh` prints the order that works, and every script
here uses it.
