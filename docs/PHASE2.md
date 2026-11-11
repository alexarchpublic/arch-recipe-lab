# Phase 2: Strategy Lab Pro

PRD: [Strategy Lab + Strategy Lab Pro](https://claude.ai/artifact/2n3Hj7rdiwGuPU23VFgdk9), sections 5, 10, 11, 12 and 13.

Recipe Lab is renamed and redesigned as Strategy Lab Pro, at the same address
(recipes.archpublic.com) and still open without sign-in. It is built so the dev
team's login move changes two modules and one grant, not screens.

## What a client sees

| Screen | Address | PRD |
| --- | --- | --- |
| Strategies: browse, search, filters and sort that persist in the browser, compare picks | `/` | P6, P8 |
| A strategy's own page: results with basis label and disclaimer, assumptions, how it trades, settings as tested, source screenshots, version and change note | `/strategy/N` | P5, P7, C1 to C3 |
| Old Recipe Lab links | `/recipe/N` redirects (temporary) to `/strategy/N` | PRD 5, 13 |
| Portfolios: several, named; export to and open from a file; positions pinned to a version, with what changed and an update button; totals labelled as sums of separate backtests | `/portfolios` | P10 to P14 |
| Guided apply, one strategy at a time: suggested TradingView name, settings in panel order with a copy button on each value and one for the block, start date filled in as today, end date never printed, mark applied, concierge link on every step | `/portfolios/:id/apply` | P15 to P17, P19 |
| Compare two to four strategies | `/compare` | P8 |
| New and updated since your last visit (a visit ends after 30 minutes idle) | `/whats-new` | P9 |
| Help, including what moved from Recipe Lab | `/help` | PRD 13, client communication |

A dismissible notice announces the rename on every screen until the client
closes it. Pro carries no marketing copy or lead forms; the only marketing link
is the logo.

## Built for the login move (P3)

| Module | What it does | At the login move |
| --- | --- | --- |
| `src/data/proStrategies.ts` | The only reader of strategy data (`public.strategies_pro`) | Read with the client's session |
| `src/data/portfolioStore.ts` | The only store of portfolios and applied records. `PortfolioStorage` is asynchronous; `browserPortfolioStorage` is today's implementation | Point `portfolioStorage` at account storage; offer to import what `browserPortfolioStorage.load()` returns |
| `src/data/analytics.ts` | Pro events, anonymous per browser | Add the account id |
| Grant on `public.strategies_pro` | Open to `anon` | Revoke; set `R8_FLAGS=--pro-closed` |

`src/data/preferences.ts` holds filters, view capital, compare picks, the last
visit and dismissed notices. They stay in the browser after the move.

Recipe Lab's saved portfolio (`localStorage["portfolio:v1"]`) is read once into
the new store (`strategy-lab-pro:portfolios:v2`) and never written or removed,
so rolling back to Recipe Lab still finds it.

## Shared package

`packages/core` now also owns:

- `settings.ts`: scaling settings to a capital (moved from `src/utils/recipeScaling.ts`, which re-exports it), the settings rows in TradingView panel order for both the strategy page and apply, the copy-all block, and the suggested TradingView name (unchanged `R<n>` numbering).
- `disclosure.tsx`: `BasisLabel`, `DisclaimerSlot` and `ResultsDisclosure`, the components Strategy Lab (Phase 3) will import too (S8).
- `site.ts`: Pro's address as one setting (`VITE_PRO_SITE_URL` / `PRO_SITE_URL`, default `https://recipes.archpublic.com`), the concierge link and the walkthrough link. It replaces the old domain hard-coded across `api/`, `lib/` and `index.html`.

## Database: migration 20261112000001

Disclaimer wording as data (C2). Additive.

- `store.disclosures` (one row, `results`) and `store.disclosure_history` (every change, with who).
- `public.disclosures`: key, body and updated time, readable by anyone.
- `public.admin_disclosure_history`: admins only.
- `public.admin_set_disclosure(key, body)`: approvers and marketing editors. The admin console has a Disclaimer button for it.

Until it runs, the app shows the default wording from `packages/core/src/disclosure.tsx`
(the sentence from the Recipe Lab footer). `tests/db/phase2.test.sql` covers it;
`scripts/r8-anon-check.mjs` checks the view exposes wording only, and that the
history view and the function are closed to anonymous visitors.

## Not indexed (P2)

Every response carries `X-Robots-Tag: noindex, nofollow` (`vercel.json`), every
page has a `noindex` meta tag, and the link-preview pages from `api/` do too.
`robots.txt` allows crawling so search engines can see the noindex and link
previews keep working. There is no sitemap. Pro is not linked from public pages.

## Analytics (section 12)

Events go to the Pro GA4 property already on the page: `strategy_viewed`,
`portfolio_saved` (strategy@version list, allocations, capital range),
`apply_started`, `setting_copied`, `strategy_marked_applied`,
`portfolio_exported`, `portfolio_imported`, `portfolio_position_updated`. No
advertising pixels run in Pro.

## Tests

- `tests/pro.test.tsx`: P11 migration, export and import, version diffs (a wording-only version is not a change), apply rows (today's start, no run-setting year, plain-number copy values, panel order, unchanged TradingView names), every results block carrying the basis label and disclaimer, figures carrying their store field and raw value (the build-time check for Pro in R5), visits.
- `tests/db/phase2.test.sql`: the disclosure table, view, history and roles.

## Rollout to production

Each step needs the owner's go-ahead.

1. **Staging.** Apply 20261112000001 to `vdtkboqglndanzvzrqsn`. Open the
   Vercel preview of this branch and walk through browse, a strategy page,
   portfolios, apply and the admin Disclaimer button.
2. **Client notice, ahead of the day** (PRD 13): email and in-app banner, new
   name, new layout, same address, nothing to sign in to. The owner sends it.
3. **Migration 20261112000001 in production** (`xsoixhltejgyuhedhbdu`). The
   live app does not read it yet, so this changes nothing a client sees.
4. **Merge the pull request.** Vercel deploys `main`. R8 runs after the deploy.
5. **Check on the live site**: `/recipe/96` lands on `/strategy/96`; a browser
   holding a Recipe Lab portfolio opens it under Portfolios; response headers
   carry `X-Robots-Tag: noindex`.

Rollback: redeploy the previous production build in Vercel. Recipe Lab's
portfolio key is untouched, so clients find their portfolio as it was.

## Gate 3

| Item | How it is checked |
| --- | --- |
| Redesigned Pro live | Step 4 and 5 above |
| Old links work | `/recipe/N` redirect in `vercel.json` and the router; checked on the live site |
| Saved portfolios work | `tests/pro.test.tsx` (P11) and a browser holding a Recipe Lab portfolio |
| No settings in the public view | R8 in CI after every production deploy and daily |

## Still owed, not code

- The walkthrough video is titled for Recipe Lab (rename checklist). Help links to it and says so.
- The client notice in step 2.
- Counsel's disclaimer wording, set with the admin console's Disclaimer button.
