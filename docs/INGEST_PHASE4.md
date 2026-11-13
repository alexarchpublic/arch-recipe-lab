# Auto-ingestion, Phase 4: pipeline, live

PRD: [Case Study to Strategy Lab Auto-Ingestion and Cross-Linking](https://claude.ai/artifact/7gqahsVHFo2Ey7pHrA3PWm), "Build phases", row 4. Builds on Phase 3 (`docs/INGEST_PHASE3.md`).

Done when: one new case study goes from publish to both labs in under 30 minutes with no human action. **Proven on staging, 12 Nov 2026** (below); production waits for the rollout.

## What changed

| Area | Change | PRD |
| --- | --- | --- |
| Store | `pipeline_publish(version, author)`: publishes a case study draft the pipeline saved. Errors block. A review check blocks unless it is on `store.pipeline_acknowledgeable()`: `roi_vs_extraction`, `net_profit_vs_extraction`, `cash_profit_vs_extraction` (the case study's figure stands, EX5) and `end_date_vs_chart` (its window end stands, EX6). `approved_by` records "case study `<slug>` at `<commit>`, published by `<author>`". Then the parity check. | GR1, GR3, PB1, A8 |
| Store | `pipeline_attach_screenshots` may replace a published strategy's screenshots when its scenario changes, unless the strategy originates in another case study. | PB5 |
| Store | `pipeline_save_draft`: a scenario with no number reuses the strategy it was already published as, so a scenario never becomes two strategies even when its number did not reach the case study. `pipeline_scenario_state` returns that number. | NO4 |
| Store | `pipeline_sync_case_study_refs` (links from the live index), `pipeline_record_baseline` (hashes of numbered scenarios, once). | LK1, BF2 |
| Store | `run_parity_check` also accepts the pipeline role, which runs it after its own publishes. Otherwise unchanged. | A8 |
| Runner | `plan --live` (needs `--state`): a numbered scenario with no recorded hash is a baseline, not an update; a scenario without a number takes the store's if it has one. `write` in live mode attaches screenshots, publishes, refreshes Strategy Lab as the pipeline, checks Pro (its view) and the public page (number and title), syncs links (`--sync-index`), and writes `numbers.json`: every published scenario the case study did not number, including ones an interrupted run left. | PB1, PB3, NO2 |
| Strategy Lab | `/api/revalidate` accepts the pipeline role as well as the three people roles. An anonymous call is refused (401). | PB3 |
| Case studies | `set_strategy_numbers.py` adds `"strategyNumber": N` after the scenario's key, one line, no reformatting, never changing a number. The workflow's live mode writes the numbers back to `main` (refresh titles, build, check, commit, push), and files the run report as an issue assigned to `INGEST_OWNER`, which GitHub emails. | NO2, NO3, GR4, Q7 |

## The two runs a new case study causes

1. The case study's deploy starts a run: new scenarios are read, named, checked and published; both labs refresh and are checked; the numbers are pushed to `main`; the report goes to the owner.
2. That push deploys the case study again (now showing each strategy's number, title and both lab links) and starts a second run: every scenario is unchanged, nothing is read, and the links sync from the new index, so both labs link back.

Running either again changes nothing (TR4): a published scenario's hash is on its version.

## Staging proof, 12 Nov 2026

A scratch copy of the case studies with IBIT's "accumulator" scenario stripped of its number and given a new key, so it was a new scenario; MSFT's two numbered scenarios with screenshots as baselines.

| Step | Result |
| --- | --- |
| Plan | 1 new, 2 baselines (#64, #66), 3 skipped (no screenshots). |
| Read | Claude, on the owner's subscription: 2 minutes. Title "Accumulate IBIT in a falling market". |
| Publish | Strategy **#98**, public, four screenshots, parity ok, no review check needed. Approval: "case study ibit at d169fcbf20fa, published by Pipeline test". |
| Labs | Pro view shows #98 and its title. Strategy Lab (this branch, run locally against staging) refreshed on the pipeline's call and its page showed "Strategy #98" and the title. |
| Write-back | One line added to `case-study.json`; the rebuilt page shows "Strategy #98 · Accumulate IBIT in a falling market" with both lab links; `check.py` passes. |
| Second run | 3 unchanged, nothing read or written; links synced (+1). #98's page links to its scenario. |

Found and fixed on the way: the parity check refused the pipeline (fixed above); a transient storage "fetch failed" (uploads now retry); a published scenario whose number had not reached the case study would have been ingested again, and its number never written back (both fixed, with a database test).

Total pipeline time on staging, after the deploy: under 3 minutes. In GitHub Actions add about a minute to install, and a minute for the second deploy.

## Rollout to production (each step needs the owner's go-ahead)

1. Apply `20261117000001_ingest_pipeline_drafts.sql` then `20261118000001_ingest_pipeline_publish.sql` to production; compare function fingerprints with staging; parity check. **Done 12 Nov 2026** with the owner's OK: production started where staging did (the 20261115 parity check, no pipeline objects, 76 Pro, 62 public, 63 links, parity clean). After both files: the ten affected functions are identical to staging (md5 of `prosrc`); parity clean with the same counts; anon cannot call the pipeline functions; R8 passes. No pipeline account exists in production yet, so nothing can call them.
2. Create the production pipeline account (as on staging, its own password), and put its login in the case-studies repository secrets.
3. Merge alexarchpublic/arch-recipe-lab#18 (Strategy Lab's refresh route must accept the pipeline before a live run).
4. Case-studies settings: `CLAUDE_CODE_OAUTH_TOKEN` (owner runs `claude setup-token`), `RECIPE_LAB_DEPLOY_KEY`, `PIPELINE_*` for production, `STORE_*`, `PIPELINE_STORE_*` (production), `STRATEGY_LAB_URL=https://arch-strategy-lab.vercel.app`, `CASE_STUDIES_INDEX_URL=https://arch-case-studies.vercel.app/case-studies.json`, `INGEST_OWNER`. Then merge alexarchpublic/case-studies#3.
5. A first run by hand in dry-run mode on one study; then `INGEST_MODE=live` and remove `INGEST_PAUSED`.
6. The acceptance test: publish one new case study and time it.

Existing production scenarios have no source screenshots apart from the ten added for Phase 3, and those are already numbered: a live run records their baselines and changes nothing.

Rollback: `INGEST_PAUSED=true`. A strategy the pipeline published is undone with the admin screen's restore, or archived if it was the first version (GR7).

## Tests

- `scripts/db-test.sh`: `tests/db/ingest_phase4.test.sql` (only the pipeline publishes, and only its own drafts; no screenshots holds; on-list checks pass and are recorded, off-list ones hold; the approval names the case study, commit and author; a published scenario without a number is never a second strategy; links sync; baselines fill only empty hashes; screenshots stay on a strategy from another case study; parity holds).
- `npm test` (planning, including baselines).
- The local DB tests run as a direct database session, which every caller check lets through. Staging is where a check against the pipeline's own API session is proven.
