# Phase 3: Strategy Lab

PRD: [Strategy Lab + Strategy Lab Pro](https://claude.ai/artifact/2n3Hj7rdiwGuPU23VFgdk9), sections 9, 11, 12 and 13.

The public Strategy Lab is rebuilt beside Pro on the shared package, as a
server-rendered app in `apps/strategy-lab`. It reads only the public view, so
it cannot show a setting or a draft, and every figure on it is the store's.
It replaces the Lovable app and its second database.

## What a visitor sees

| Screen | Address (under archpublic.com) | PRD |
| --- | --- | --- |
| Home: hero with a featured strategy against its benchmark, the strategy finder, the library at a glance, top strategies, how it works, proof, what clients get, booking in place with an alert sign-up beside it | `/strategy-lab` | 9, S1 to S5 |
| All strategies, with filters and sort kept in the address, the account-size view and the alert sign-up | `/strategy-lab/strategies` | S4, S5, S15 |
| A strategy: results with basis label and disclaimer, the account-size view and "email me these figures", the chart or its benchmark comparison, how it trades, the settings label (Start free), similar strategies, booking about this strategy | `/strategy-lab/<slug>` | S6 to S9, D10, D12 |
| Partner landing pages, set up in the admin console | `/strategy-lab/p/<partner>` | S12 |
| Old addresses | `/strategy-lab/recipes` and `/strategy-lab/recipes/<record-id>` redirect (308) to the list and to the strategy's page | 13, Redirects |

Book a demo is in the header and, on a phone, in a bar fixed to the bottom
(S1). It opens in place: name, email, account size (prefilled from what the
visitor entered) and exchange, then the HubSpot scheduler prefilled with the
name and email, then a confirmation listing the strategies they looked at,
with a calendar hold (S11, S14).

## How it is built

| Piece | Where | Notes |
| --- | --- | --- |
| App | `apps/strategy-lab` | Next.js 15, App Router, `basePath: /strategy-lab`. Its own `package.json`; it imports `packages/core` as `@core`. |
| Store reads | `apps/strategy-lab/src/lib/data.ts` | `strategies_public`, `disclosures`, `site_content`, with the publishable key. Nothing else. |
| Rendering | Pages are generated at build and regenerated every 2 minutes and on demand | R4: a publish shows within 2 minutes even if the console's refresh call fails. |
| Figures | `ResultsBlock`, `Figure`, `ComparisonBars` | Formatting, scaling and the benchmark rule come from `@core` (R3). Every figure carries `data-field` and `data-raw`, inside a block with `data-results` (strategy id) and `data-version`. |
| Captures | `POST /strategy-lab/api/lead` | Booking, alerts and "email me this". Forwarded to HubSpot's form API and recorded in `store.leads` with the outcome. |
| Refresh | `POST /strategy-lab/api/revalidate` | Called by the admin console with the admin's session; the route asks the store whether the caller is an admin. |
| Page check | `GET /strategy-lab/api/page-check?slug=` | Returns the figures the page prints. The admin console calls it after each publish. |
| Indexing | `next.config.mjs` headers, `sitemap.ts`, canonical links | S18: canonical addresses are archpublic.com. Any request not marked by the archpublic.com proxy (header `X-Arch-Proxy`, any value) and not addressed to archpublic.com gets `X-Robots-Tag: noindex`. Set at the edge, so cached pages carry it too. Vercel replaces `x-forwarded-host` with its own host, so that header cannot be used. |
| Consent | `components/Tracking.tsx` | GA4 (`G-7KS3HK4626`, the existing Strategy Lab property) and HubSpot's tracking code load only after Accept. No advertising pixels. |

Moved into `packages/core`: `siteContent.ts` (the content schema and defaults,
shared with the admin editor) and `pageFigures.ts` (reading figures back from
page markup and comparing them with the store).

## Database: migration 20261113000001

Additive. Until it runs, Strategy Lab shows its default copy and still
forwards captures to HubSpot (but cannot keep its own record of them).

- `store.site_content` + `public.site_content` (key, value, updated time) +
  `public.admin_set_site_content(key, value)` for approvers and marketing
  editors, with every change in `store.site_content_history`. Keys: `home`,
  `booking`, `config`, `partner:<slug>`. A value that names a figure field is
  refused (R1, A10).
- `store.leads` + `public.submit_lead(kind, email, payload, hubspot_status)`,
  callable by anyone, with a flood guard of 20 an hour per address; readable
  only by admins through `public.admin_leads`.
- `public.admin_record_page_parity(...)`: the admin console records its
  public-page check in `store.parity_runs` with trigger `pages:publish`.

`tests/db/phase3.test.sql` covers it; `scripts/r8-anon-check.mjs` checks that
`site_content` exposes copy only and that leads, history and the new
functions are closed.

## Admin console

- **Strategy Lab content** button (approvers and marketing editors, S12, A10,
  C5): home page copy, the hero strategy, top strategies in order, section
  order, who runs the demo, booking link and response time, consent lines,
  the settings label, switches for the finder, account-size view, "email me
  this" and alerts, figures to hide, partner pages, and raw JSON for the rest
  (proof items, action labels). Saving refreshes Strategy Lab at once.
- **After a publish** (R4, R5, A8): the console asks Strategy Lab to refresh,
  reads the strategy's public page back until it shows the new version (five
  tries, four seconds apart), compares every figure, records the result and
  says so in a notice. Archiving refreshes too.
- Needs `VITE_STRATEGY_LAB_URL` in Pro's Vercel settings, e.g.
  `https://archpublic.com/strategy-lab`. Unset, the console skips these steps
  and Strategy Lab refreshes on its own within two minutes.

## Case studies, linked both ways

Most strategies came from a case study. Each case study scenario that is a
strategy's backtest now names it by number, once, in the case study's own
content (`scenarios[].strategyNumber` in alexarchpublic/case-studies). From that
one record:

- the case study page links the scenario to `archpublic.com/strategy-lab/strategy/<n>`,
  which Strategy Lab redirects to the strategy's page (or to the list when the
  strategy is not on the public list), keeping the campaign tags;
- the case study build lists the links in `case-studies.json`, and Strategy Lab
  reads that index (`CASE_STUDIES_INDEX_URL`, every 10 minutes and on refresh)
  to show a "Case study" block on each strategy page, linked to the exact
  scenario, and to fill the home page's proof section with the latest studies
  until marketing sets its own.

63 scenarios in 20 studies link to 60 strategies, 53 of them on the public
list. `docs/phase3/case-study-links.csv` lists every link and how it was
matched:

- **46 exact**: same ticker, chart and window, and the same return as the store.
- **3 cited**: Enduring the Drop names Recipes #18, #19 and #20.
- **14 figures differ**: same ticker, chart, window and benchmark figures, but
  the case study quotes a different strategy return than the store. The store's
  values match research's source entries, so Recipe Lab's figure stands on
  Strategy Lab. The largest gaps are INTC #74 (+95.9% in the study, +267.1% in
  the store), INTC #76 (+159.1% against +339.5%) and XLE #86 (+70.2% against
  +137.3%). The owner decides which is right; the case study page is a dated
  narrative, and Strategy Lab's block says so.

Not linked: 9 public strategies with no matching study (#22 to 24 Bitcoin
accumulation, #36 to 40 Market Wave crypto yield, #60 BTC 6h), and studies whose
scenarios are different runs from anything in the store.

Order: the case study change goes live only after `archpublic.com/strategy-lab`
routes to the new app, because its links point there.

## Checks

| Check | Where | When |
| --- | --- | --- |
| Page parity: every figure on the list, every strategy page and home against the public view | `scripts/parity-pages.mjs`, workflow `Strategy Lab page parity` | After each production deploy, daily at 06:45 UTC, on demand; and per strategy after each publish, from the console |
| R8: no settings, source screenshots or run-setting years in the public pages | `scripts/r8-anon-check.mjs` with `STRATEGY_LAB_URL` | After each production deploy and daily |
| Unit tests: page parsing and comparison, content merging, helpers | `tests/strategyLab.test.ts` | CI |
| Build against the public view, typecheck | CI job `strategy-lab` | Every push |

Run locally on 11 Nov 2026 against production's public view: page parity
clean on all 64 pages (62 strategies, list, home); R8 passes with the page
checks.

## Configuration

Strategy Lab's Vercel project (root directory `apps/strategy-lab`):

| Variable | Value | Required |
| --- | --- | --- |
| `SUPABASE_URL`, `SUPABASE_ANON_KEY` | The store's address and publishable key (production for Production, staging for Preview) | Yes |
| `HUBSPOT_FORM_GUID` | The Strategy Lab form in portal 43848678 | For captures to reach HubSpot |
| `HUBSPOT_MARKETING_SUBSCRIPTION_ID`, `HUBSPOT_CALLS_SUBSCRIPTION_ID` | Subscription types for the two consent lines (C4) | Recommended |
| `CANONICAL_ORIGIN` | `https://archpublic.com` (default) | No |
| `PRO_ORIGINS` | `https://recipes.archpublic.com` (default), allowed to call refresh | No |
| `INDEX_ALL_HOSTS` | `1` turns the noindex rule off, if the proxy can neither add `X-Arch-Proxy` nor strip `X-Robots-Tag` | No |

Repository variable `STRATEGY_LAB_URL` turns on the page parity workflow and
the R8 page checks.

### The HubSpot form

One form, "Strategy Lab capture", with these fields (create the `sl_`
properties as single-line text on contacts; `sl_email_me_this` as
multi-line). A field the form lacks is dropped and the rest still land, so
the form can be built up.

| Field | Holds |
| --- | --- |
| `email`, `firstname`, `lastname` | Contact |
| `purchasing_power` (exists) | Account size entered, in dollars |
| `partner_name` (exists) | Partner ID |
| `equitiesetf_algo_interest` (exists) | True when the visitor showed interest in stocks or ETFs |
| `sl_capture_kind` | booking_started, booking_completed, alert or email_me_this |
| `sl_account_size_range` | The range chosen in the booking step |
| `sl_goal`, `sl_exchange` | From the finder or the booking step |
| `sl_asset_interest` | Asset classes and assets of interest |
| `sl_strategy_in_view` | The strategy on screen at the capture |
| `sl_strategies_viewed` | The last five strategies viewed |
| `sl_first_touch`, `sl_last_touch` | Campaign source, medium, campaign, landing page, date |
| `sl_alert_asset_classes` | What the alert covers |
| `sl_email_me_this` | The figures to send |
| `sl_meeting_start` | The booked time |
| `sl_consent_calls` | The calls-and-texts consent, when no subscription type is set |

Two HubSpot workflows finish the job: send `sl_email_me_this` to the contact
when it is set (S4), and follow up a `booking_started` with no
`booking_completed` within a day (S11). Reminders and rescheduling come from
the meeting link's own settings.

## Rollout

Each step needs the owner's go-ahead.

1. **Migration 20261113000001 on staging** (`vdtkboqglndanzvzrqsn`), then R8 against staging.
2. **Vercel project** `arch-strategy-lab` in team `arch-public-082f875a`, git-linked to this
   repository, root directory `apps/strategy-lab`, production branch `main`, variables above.
3. **Migration 20261113000001 in production** (`xsoixhltejgyuhedhbdu`). Nothing a visitor sees changes.
4. **Merge the pull request.** Both projects deploy from `main`.
5. **HubSpot**: the form and properties above, its ID in `HUBSPOT_FORM_GUID`, the two workflows.
6. **Hand the owner the Vercel address.** The owner routes `archpublic.com/strategy-lab` to
   `https://arch-strategy-lab.vercel.app/strategy-lab` by rewrite or proxy, not an iframe (S18). The proxy adds the
   request header `X-Arch-Proxy: archpublic.com` (or strips `X-Robots-Tag` from responses); without it every page
   carries noindex.
7. **After routing**: set `STRATEGY_LAB_URL` (repository variable) and `VITE_STRATEGY_LAB_URL`
   (Pro); check that `curl -I https://archpublic.com/strategy-lab` carries no `X-Robots-Tag`,
   that `/strategy-lab/recipes/<record-id>` lands on the strategy, and that a test booking
   reaches HubSpot with its context.

Rollback: the owner points the route back at the old capture, which stays
deployable for 30 days (PRD 13, cutover safety).

## Status

- **Staging** (`vdtkboqglndanzvzrqsn`): migration 20261113000001 applied 10 Nov 2026 with the owner's OK. Function
  bodies match the file; R8 passes the new checks (its one failure is the 24 clean-up drafts staging never published).
- **Production** (`xsoixhltejgyuhedhbdu`): migration applied 10 Nov 2026 with the owner's OK. Function bodies match
  staging and the file; the store parity check is clean; all R8 checks pass.
- **Vercel**: project `arch-strategy-lab` (team `arch-public-082f875a`, root `apps/strategy-lab`, production branch
  `main`, Node 22) created 10 Nov 2026 with the owner's OK. Production reads production, previews read staging.
  **The address to route to: `https://arch-strategy-lab.vercel.app/strategy-lab`.** Its current production build
  came from this branch before the noindex fix; merging the pull request replaces it with `main`. Page parity
  clean on all 64 pages and R8 page checks pass against it.
- **HubSpot**: not done. The connector cannot create contact properties or forms, and the HubSpot CLI on this Mac
  is signed in to another account. Needs the owner in HubSpot (the form and fields below), then `HUBSPOT_FORM_GUID`
  in the Vercel project.

## Gate 4

| Item | How it is checked |
| --- | --- |
| Redirects verified | Step 7 above, on the live address |
| Counsel has reviewed the working pages | The owner's call; counsel's disclaimer wording goes in with the admin console's Disclaimer button |
| Four-week funnel baseline in hand | GA4 and HubSpot, from the day the route goes live |

## Content still owed (not code)

- **How it trades** (S13): none of the 62 public strategies has research's
  `how_it_trades`, rising-market or falling-market text yet. Pages show the
  algorithm, chart, horizon and aim until it is written. `config.requireNarrative`
  is ready for when it is.
- **Public chart images** (D9): none of the 62 has its cropped chart yet
  (admin console, review screen, "Public chart image"). Pages show the
  strategy against its benchmark until then.
- **#41 NVDA `best_for` is truncated to "Th"** in the store. Strategy Lab does
  not show `best_for` (Recipe Lab never did); correct it in a copy version.
- Who runs the demo (design principle 4), the sales response time (S11),
  case studies and testimonials, and a walkthrough video under the new name:
  all set in the admin console's Strategy Lab content once known.
- The demo booking link: the current HubSpot link is used until the owner
  supplies another.

## Not in Phase 3

Automated publish alerts and case studies in the store (Phase 4), compare on
the public list (S15 compare, P1), a nurture sequence (S16), and retiring the
Lovable app's database, which waits for the 30-day fallback window.
