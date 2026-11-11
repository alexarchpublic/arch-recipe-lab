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

1. **Gate A**, any time before step 4: publish the seven case-study
   corrections (#74, #76, #86, #89, #84, #87, #47), one approval per strategy
   (figures in the pull request).
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

Decided by Alex, 2026-11-11:

- **#47 MSTR Daily 3y**: use the case study's date. The correction also sets
  the settings' end date to 17 Jun 2026 (it was 1 Jul), which clears the
  store's `test_end_vs_settings` error; return derives to +181.5%, as the case
  study prints. Pro clients see the new end date; the change note says so.
  Rehearsed and published on staging.
- **#76**: left to my call. The correction adds buy and hold (−0.6%) and shows
  both benchmarks, because the case study is the source of truth and prints
  both.
- **#74's hero line** is set only after #74's correction is live.
- **Q1** (valuation gap without a case study): left to my judgement. No figure
  changed. Screenshot dates and window-end prices show the gap could be
  material for five strategies, but the store does not hold their cash
  balance, so which price their figures used cannot be settled from the store;
  estimating would break P3. They go to research to re-read each backtest at
  its window end:

  | Strategy | Window end | Close then | Screenshot | Close then | Size if valued at screenshot |
  | --- | --- | --- | --- | --- | --- |
  | #22 BTC | 2025-01-01 | $94,384 | 2025-11-05 | ~$103,976 | ~56 pts of +621.1% |
  | #23 BTC | 2025-01-01 | $94,384 | 2025-11-05 | ~$102,810 | ~56 pts of +691.0% |
  | #24 BTC | 2025-01-01 | $94,384 | 2025-11-05 | ~$103,229 | ~86 pts of +1,008.0% |
  | #50 NVDA | 2026-06-01 | $224.36 | 2026-07-08 | $204.12 | ~16 pts of +102.8%, understated |
  | #53 MSTR | 2026-06-17 | $116.56 | 2026-07-08 | $93.87 | ~27 pts of +88.7%, understated; its chart header shows the window-end close, so it may already be right |

  #72 and #73 match the AAPL case study exactly; #39's chart was taken the day
  after its window ended. Screenshot prices are the chart headers; window-end
  closes from Coinbase (BTC-USD) and Stock Analysis, read once on 2026-11-11.
- **Q2 to Q5** of the PRD: defaults applied (Pro-only #15 to #21 untouched;
  launch market tags as in PRD 7.2; finder, library and proof out of the
  default order; titles shown as stored).
- A publish shows on the public pages at once when the console's refresh call
  succeeds; on the timer alone it took about 3 minutes in the staging test
  (page and data caches each refresh every 2 minutes).
