# Phase 4: Strategy Lab public page redesign

PRD: [Strategy Lab public page redesign: build PRD](https://claude.ai/artifact/BuaZCev9QAGMR4uqp136GT).
Approved design: the "Strategy Lab Public Page" canvas (artboards Main and
Strategy), approved by Alex on 2026-11-11.

The public pages now lead with each strategy's chart, shown whole, as the
TradingView screenshot was uploaded (decision P1, "we do not want to crop
charts ever"). Every figure still comes from the store and passes the page
parity and R8 checks.

**Status:** built on branch `phase-4-public-redesign`; nothing is in
production yet. Production waits for Alex at three gates (below).

**Launch date:** _set at Gate C step 4_. Compare demo bookings and "email me
these figures" per visitor in GA4 and HubSpot for the weeks before and after
this date (PRD section 8). New GA4 events from launch: `chart_opened` (slug,
placement) and `market_filter_used` (value, page).

## What changed

| Area | Change |
| --- | --- |
| Store | Migration `20261114000001_public_charts.sql`: `chart_url` at the end of `strategies_public` and `strategies_pro` (kind `chart` first, else first by order, else null; ties keep snapshot order). `public_image_uncropped` removed from `run_parity_check`; `chart_url` added to the allowlist; `market_tags` accepted as a site content key. `public_chart_url` and the `strategy-public` bucket stay, unused. |
| Shared package | `PublicStrategy.chart_url`; `publicChartScreenshot()` (the same rule as the view); section ids `read` and `size`, default order read, top, size, how, clients, book; `home.read`, `home.size`, `home.hero.case`, eyebrows; the `{count}` token (`fillTokens`, applied by `mergeSiteContent(rows, { count })`); `marketTags` (`readMarketTags`); thousands grouping in `formatSignedPercent`; `formatSignedCurrency(v, { plus })`. |
| Public app | New hero (case card plus the chart, whole), "How to read a chart", the library with asset-class chips and live counts, "Your numbers", how it works, the Pro band, booking. Strategy page: headline tiles, the chart, benchmarks, results at your account size, case studies, how it trades, the Pro prompt, similar strategies, a sticky side panel (after results on phones). Cards with their chart in a 5:4 frame (fitted, never cropped). List page: chips, a market filter, server-rendered cards. Partner pages: hero, read, top, how, clients, book (no finder). |
| Images | Charts go through the Next image optimizer (`images.remotePatterns` for the production storage host), rendered on the server with `getImageProps`, so no image component ships to the browser. |
| Admin console | The crop step and `PublicChartCrop.tsx` are gone; version review shows, read-only, the screenshot that will go public. Site content gains a Market tags tab, the hero case line and the new section ids. |
| Checks | `scripts/r8-rules.mjs` (content rules, fixture-tested in `tests/r8Rules.test.ts`); `scripts/r8-anon-check.mjs` checks 1 to 3 and 11 changed as PRD 7.1 says; `tests/db/phase4.test.sql`. |
| Case studies | Seven public strategies differ from their published case study (P8). Six corrected drafts were rehearsed on staging; #47 is blocked (below). `docs/phase3/case-study-links.csv` updated for the six. |

## Production, in order (Gates A to C)

1. **Gate A**, any time before step 4: publish the case-study corrections, one
   approval per strategy (figures in the pull request).
2. **Gate C, 1**: apply `20261114000001_public_charts.sql` (comment-stripped,
   then compare function bodies with a local build).
3. **Gate B / C, 2**: merge the pull request; wait for both Vercel deploys.
4. **Gate C, 3**: site content: `home.hero.featured`, `home.hero.case`,
   `home.featured`, `market_tags` (values in the pull request). Last, because
   the old app ignores ids it does not know.
5. Run `scripts/parity-pages.mjs` and `scripts/r8-anon-check.mjs` against
   production; open home, two strategy pages and the list.

Rollback: revert the merge, then run `scripts/phase4/rollback.sql` (tested on
a fresh build: views without `chart_url`, the uncropped test back, parity
clean, and the migration re-applies cleanly after it).

## Still open

- **#47 MSTR Daily 3y**: the case study's window ends 17 Jun 2026; the
  strategy's settings end 1 Jul 2026, and the store refuses a test end that
  differs from the settings (`test_end_vs_settings`, an error). Correcting it
  needs either the settings' end date changed (a settings version) or a
  decision that the case study's window is a chart reading. Draft left on
  staging, unpublished.
- **#76**: the case study prints buy and hold (−0.6%), which the store did not
  hold or show. The rehearsal adds it and shows both benchmarks; Alex to
  confirm at Gate A.
- **Q1** (valuation gap without a case study): the pull request lists every
  public strategy whose test window ends 30+ days before its as-of date with
  shares still held. No figure changed.
- **Q2 to Q5** of the PRD: defaults applied (Pro-only #15 to #21 untouched;
  launch market tags as in PRD 7.2; finder, library and proof out of the
  default order; titles shown as stored).
- A publish shows on the public pages at once when the console's refresh call
  succeeds; on the timer alone it took about 3 minutes in the staging test
  (page and data caches each refresh every 2 minutes).
