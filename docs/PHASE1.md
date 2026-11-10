# Phase 1: one store

PRD: [Strategy Lab + Strategy Lab Pro](https://claude.ai/artifact/2n3Hj7rdiwGuPU23VFgdk9), sections 6 to 8 and 13.

Every strategy now lives as versions in `store.strategy_versions`. Clients read
published versions only, through two database views. The admin console is the
only writer, and a named approver publishes.

## What is in the database

| Object | What it is | Who can read it |
| --- | --- | --- |
| `store.strategy_versions` | One immutable snapshot per version, with figures as numbers, the real test window, derived metrics and checks | Nobody through the API; admins through `admin_strategy_versions` |
| `store.extractions` | Provenance of each screenshot ingestion (A5) | Admins, through `admin_extractions` |
| `store.parity_runs` | Results of every parity check (R5) | Admins, through `admin_parity_runs` |
| `public.strategies_pro` | The published version of every strategy, settings included | Anyone until the login move (D6) |
| `public.strategies_public` | Allowlisted columns of published, listed strategies; never settings (D7) | Anyone |
| `admin_*` functions | Save draft, submit, publish, discard, restore, archive, record extraction | Signed-in admins; each checks the role |

Derived figures are computed once, by a trigger at save (D3): ending value,
return %, test years, CAGR (none under one year, D12), and the deltas against
buy and hold and DCA. Neither front end computes a figure.

Checks run on every save and again at publish:

- **error** blocks publish: test window, a test end after the as-of date, a
  far-future run end not resolved from the chart (D10, A16), start or end that
  disagrees with the settings, a shown benchmark without a value, the Market
  Wave settings schema (D2, new versions only).
- **review** blocks until the approver ticks it: no screenshots, figures that
  disagree with the stats screenshot, realised plus unrealised not equal to
  total P&L, ROI not equal to P&L over capital, chart header against settings
  panel (A9), model output not matching its schema, test end against the last
  bar the model read.
- **warning** is shown only: figures not read from screenshots in the console.

Roles (A1): `editor` drafts and submits; `approver` also publishes;
`marketing_editor` changes copy fields only (A10). alex@archpublic.com is the
approver; josh@archpublic.com stays an editor.

## Rollout to production

Production is `xsoixhltejgyuhedhbdu`. Each step needs the owner's go-ahead.
Apply migrations one at a time in the SQL editor or through the Supabase
connector. Steps 1 to 3 change nothing a client sees.

1. **Migrations 20261111000001, 0002, 0003.** Store, views, admin functions,
   the baseline version 1 of every strategy, and the daily parity check at
   06:15 UTC. The live app keeps reading `recipes` and does not notice.
   From here until step 4 is live, do not edit strategies in the old admin
   console: those edits would not reach the views.
2. **Clean-up drafts.** Run `scripts/phase1/cleanup-v2-drafts.sql`. It puts 24
   version 2 drafts in review, each with the test end read from the chart. The
   last query lists them. `docs/phase1/cleanup-review.csv` has the same list
   with how each date was read.
3. **Check.** `select public.run_parity_check('manual');` returns `ok: true`,
   and `node scripts/r8-anon-check.mjs --allow-open-base` against production
   fails only on "no run-setting end years" (those are the 24 drafts).
4. **Merge the pull request.** Vercel deploys `main`. The app reads
   `strategies_pro`; the admin console writes versions. Until the 24 drafts are
   published, those strategies show no end date rather than 2030 or 2999, and
   the CAGR they showed before.
5. **Publish the 24 drafts** in the admin console, after checking each end date
   against its chart. Each publish runs the parity check.
6. **Migration 20261111000004.** Closes `recipes` and `recipe_screenshots` to
   anonymous visitors and closes direct writes to `recipes`. Only after step 4
   is live: the old app read those tables.
7. **R8 in CI.** Set repository variables `R8_SUPABASE_URL` and
   `R8_SUPABASE_ANON_KEY` (public values). The `R8 anonymous access` workflow
   then runs after every production deploy and daily.

Gate 2 passes when every strategy has a published version with no error checks
(true after step 5) and the parity check has been clean for seven days.

## Staging

Steps 1 to 3 have run on staging (`vdtkboqglndanzvzrqsn`). The 24 drafts are in
review there and have not been published. A rolled-back dry run published all
24 as an approver: none refused, parity clean, no current version left with an
error. To try the console on staging, invite alex@archpublic.com from the
staging dashboard (docs/STAGING.md) and open a Vercel preview of this branch.

## Decisions taken in the build

- **Base tables stay in `public`.** The PRD moves them to an unexposed schema.
  Here the new tables are in `store`, and `recipes` and `recipe_screenshots`
  are closed by grants and policies instead (migration 0004): the same
  boundary, without rewriting every admin write. Anonymous visitors cannot read
  either table; R8 tests it.
- **The views run with their owner's rights.** That is the PRD's boundary:
  the view definition and the grants. Supabase's advisor flags each view as a
  "security definer view"; that is expected.
- **Version 1 copies what was live.** Clean-up arrives as version 2, so the
  history shows each change. One difference is visible on switching: strategies
  tested for under a year stop showing a CAGR (D12).
- **Legacy and older crypto strategies** (#15 to 21, #31, #25 to 30) are not on
  the public list (`listed_public = false`) until the owner decides (PRD 14,
  open question). They stay in Pro as today.
- **Settings are not rewritten in the clean-up.** Benchmark keys keep their
  three spellings in existing versions; the settings schema applies to new
  versions (D2). Rewriting them would type the change as a settings change and
  alert clients for nothing.
- **Six end dates beyond the audit's 18.** #96 META 6H also runs to 2030. MU
  #88 to 90 and META #94 and 95 have a run end one day after their upload, so
  their test end is the upload day. All 24 dates are approximate and need the
  owner's confirmation at review.
- **Public chart images (D9)** are cropped in the review screen and stored in
  the `strategy-public` bucket. None exist yet; Strategy Lab (Phase 3) needs
  them for the strategies it shows.

## Not in Phase 1

The public Strategy Lab site and its pages (Phase 3), so the parity check reads
the views, not page markup; dual preview of the public page shows the public
fields, not the page. The Pro redesign (Phase 2). Automated publish alerts
(Phase 4). Sign-in, and closing the Pro view and the screenshot bucket (the
login move).
