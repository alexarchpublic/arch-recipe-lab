# Auto-ingestion, Phase 2: links

PRD: [Case Study to Strategy Lab Auto-Ingestion and Cross-Linking](https://claude.ai/artifact/7gqahsVHFo2Ey7pHrA3PWm), "Build phases", row 2.

Done when: all 63 existing links resolve in both directions. **Met on staging, 12 Nov 2026**: `scripts/link-check.mjs` against the staging store, a local build of this branch and a local build of the case study site found 63 scenarios linking out and 53 public strategy pages linking back, with no problems.

Builds on Phase 1 (PR #16, merged as 944519f): it needs `store.case_study_refs` and the `case_studies` view column from `20261115000001`, which production has (checked 12 Nov 2026: table empty, views return `[]`, parity ok).

## What changed

| Area | Change | PRD |
| --- | --- | --- |
| Store | `store.sync_case_study_refs(index)` makes the links match a case study index (`case-studies.json`). Adds and updates links, removes those the index dropped (the strategy stays published), reports numbers with no published strategy. Refuses an index with no studies. Only `public.admin_sync_case_study_refs` (approver) and, from Phase 4, the pipeline call it. | LK1, PB6 |
| Store | Origins: a strategy keeps the origin it has; one without takes its earliest published case study. | BF4 |
| Backfill | The migration loads the 63 hand-matched scenarios (20 case studies, 60 strategies). #18, #19 and #20 take Oracle Protocol (5 Oct 2025) as origin; Enduring the Drop is "featured". | BF1, BF4, Q8 |
| Public lab | Links come from `strategies_public.case_studies`. The fetch of the case study index (`CASE_STUDIES_INDEX_URL`) is gone. Cards show "From the case study: title"; the strategy page shows the origin, then "Also featured in". Nothing shows for a strategy without one. | LK1, LK2, LK6 |
| Pro | Same links on the card and the strategy page, from `strategies_pro.case_studies`. | LK2 |
| Core | `caseStudyUrl()` builds every lab-to-case-study link: the study page, campaign tags (`utm_source=strategy_lab` or `strategy_lab_pro`, `utm_content=strategy-N`), `scenario=<anchor>`, then `#<anchor>`. The base is one setting, `CASE_STUDIES_URL` / `VITE_CASE_STUDIES_URL`, default `https://archpublic.com/case-studies`. | LK5, LK7, LK11 |
| Daily check | `scripts/link-check.mjs` and `.github/workflows/link-check.yml` (07:15 UTC, after each production deploy, on demand): index and store hold the same links; every scenario shows its number, title, Strategy Lab link (public strategies only) and Pro link, and the Strategy Lab link opens that strategy; every public strategy page links to its scenarios, and every scenario exists. | LK9 |

### Case study repository (alexarchpublic/case-studies)

Separate change in that repository:

- Every scenario gets a permanent `key` (122 of them, from the scenario title). `check.py` requires one, unique within the study. `case-studies.json` lists it beside each number. (NO7)
- Under each numbered scenario: "Strategy #N · title", then "View in Strategy Lab" (public strategies) and "Get the settings in Strategy Lab Pro (clients)". (LK3)
- `strategy-lab-pages.json` gains `titles`. `refresh_strategy_pages.py` reads pages from the public view and titles from the Pro view when `SUPABASE_URL` and `SUPABASE_ANON_KEY` are set (the publishable values both labs use); otherwise it reads pages from `/redirects.json` as before.
- The study page scrolls to `?scenario=<anchor>` when it arrives without a `#anchor`. archpublic.com's frame passes a link's query into the page but drops its anchor (checked 12 Nov 2026), so before this every link from a lab opened at the top of the study. (LK5, LK8)

## Rollout

Order matters: the daily check compares the live case study index with the store, and the store's links carry the new scenario keys.

1. Phase 1 first: `20261115000001` on production and PR #16 merged. **Done**.
2. Apply `supabase/migrations/20261116000001_ingest_links.sql` to staging. **Done 12 Nov 2026**: function bodies identical to a local build (md5 of comment-stripped source); 63 links, 60 strategies, 60 origins; #18 to #20 on Oracle Protocol; parity clean (76/62, 63 links); anon and editors cannot sync.
3. Apply it to production. Check: `select count(*) from store.case_study_refs` is 63, and `public.run_parity_check('manual')` is ok.
4. Merge the case-studies change. Vercel redeploys the case study site with keys in its index and the new link block.
5. Merge this pull request. Both labs read links from their views; the link check starts running.
6. Run the link check by hand (Actions, "Case study link check", Run workflow), or locally with the R8 values. Expect 63 scenarios and 53 public links, no problems.
7. Remove `CASE_STUDIES_INDEX_URL` from the `arch-strategy-lab` Vercel project if it is set; nothing reads it now.
8. After the dev team next refreshes the saved copies on archpublic.com: open one lab link to a case study inside the frame and check it lands on the scenario.

Between steps 3 and 5 the live public lab still shows links from the case study index (the old way), so nothing disappears.

Keeping links current until the pipeline runs (Phase 4): after a `strategyNumber` is added to a case study and deployed, the approver calls `admin_sync_case_study_refs` with the live `case-studies.json`. The daily check fails until that is done, which is the reminder.

Rollback: revert the pull requests. The links can stay in the store; the views only gain data. To remove them: `delete from store.case_study_refs` and drop the two functions.

## Tests

- `scripts/db-test.sh`: `tests/db/ingest_phase2.test.sql` (first load, no-op rerun, stable and moving origins, withdrawn study, re-pointed scenario, duplicate keys, access).
- `npm test`: `tests/caseStudyLinks.test.tsx` (addresses and campaign tags, view order, Pro card and page, nothing when there is no case study). The old test of the index fetch is removed with the fetch.
- `node scripts/link-check.mjs` (needs `SUPABASE_URL`, `SUPABASE_ANON_KEY`; `CASE_STUDIES_SITE` and `STRATEGY_LAB_APP` point it at other hosts).

## Not in this phase

Titles are today's titles (for example "MSFT 2026 YTD"); the rename is BF3 in Phase 5. The pipeline that writes numbers and calls the sync is Phases 3 and 4. `/case-studies/strategy/<n>` (NO8, P1) is not built.
