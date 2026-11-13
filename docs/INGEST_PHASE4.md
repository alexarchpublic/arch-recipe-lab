# Auto-ingestion, Phase 4: pipeline, live

PRD: [Case Study to Strategy Lab Auto-Ingestion and Cross-Linking](https://claude.ai/artifact/7gqahsVHFo2Ey7pHrA3PWm), "Build phases", row 4. Builds on Phase 3 (`docs/INGEST_PHASE3.md`).

Done when: one new case study goes from publish to both labs in under 30 minutes with no human action. **Met on production, 13 Nov 2026**: the NVDA Movements study's three scenarios were published as #99, #100 and #101 and linked both ways in 7½ minutes (below). Proven on staging first, 12 Nov 2026.

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
2. Create the production pipeline account (as on staging, its own password), and put its login in the case-studies repository secrets. **Account created 12 Nov 2026** with the owner's OK: `pipeline@archpublic.com`, role `pipeline`, its own password (only the bcrypt hash went to the database; the login is in the git-ignored `.env.ingest-production` in the Phase 3 worktree). Signed in as it on production: `admin_role()` is `pipeline`, `is_admin()` false; `admin_publish`, `admin_save_draft` and `admin_sync_case_study_refs` refuse it; it sees no admin versions; an upload outside `case-studies/` is refused. Nothing was written; parity clean, 76 Pro, 62 public.
3. Merge alexarchpublic/arch-recipe-lab#18 (Strategy Lab's refresh route must accept the pipeline before a live run). **Done 12 Nov 2026** (c6ca25c): post-merge CI, page parity, link check and R8 passed; live Strategy Lab returns 200 to the pipeline's refresh and 401 to an anonymous one.
4. Case-studies settings: `CLAUDE_CODE_OAUTH_TOKEN` (owner runs `claude setup-token`), `RECIPE_LAB_DEPLOY_KEY`, `PIPELINE_*` for production, `STORE_*`, `PIPELINE_STORE_*` (production), `STRATEGY_LAB_URL=https://arch-strategy-lab.vercel.app`, `CASE_STUDIES_INDEX_URL=https://arch-case-studies.vercel.app/case-studies.json`, `INGEST_OWNER`. Then merge alexarchpublic/case-studies#3. **Done 13 Nov 2026**: the owner set the four secrets; the variables were set on the owner's OK; #3 merged as f37bff8 with `INGEST_PAUSED=true`, and both triggers skipped.
5. A first run by hand in dry-run mode on one study, with `PIPELINE_STORE_*` and the pipeline secrets pointing at **staging** (a dry run refuses to write to production); then the production values, `INGEST_MODE=live`, and remove `INGEST_PAUSED`. **Done 13 Nov 2026.** The first two Claude tokens failed on GitHub (an empty paste, then a token cut at its line break by the paste prompt); the fix was to save it from the clipboard with line breaks removed, after a local check:

   ```bash
   t=$(pbpaste | tr -d '[:space:]'); case "$t" in sk-ant-oat01-*) if CLAUDE_CODE_OAUTH_TOKEN="$t" claude -p "Reply with OK" >/dev/null 2>&1; then printf %s "$t" | gh secret set CLAUDE_CODE_OAUTH_TOKEN --repo alexarchpublic/case-studies && echo "Token works; saved."; else echo "Claude rejected this token; nothing saved."; fi;; *) echo "Not a token; nothing saved.";; esac; unset t
   ```

   A sign-in failure now stops the read step with a message naming the secret (arch-recipe-lab#19). The dry run on GitHub (AAPL, IREN) then read both scenarios in 2½ minutes and held both for the expected reasons.
6. The acceptance test: publish one new case study and time it. **Done 13 Nov 2026**, below.

## Production: the NVDA Movements study, 13 Nov 2026

The first case study ingested end to end: the Movements NVDA study (published 11 Nov), three Market Wave scenarios with no strategy numbers. Its source screenshots were added in alexarchpublic/case-studies#4; arch-recipe-lab#19 handled its ticker list and its settings ending a day after its valuation date. The first live attempt stopped at planning, before reading anything (the plan step's store connection lacked the live permission; arch-recipe-lab#20). The second:

| Time (UTC) | Step |
| --- | --- |
| 03:03:07 | Run started by hand (workflow_dispatch, `movements-nvda-2026`) |
| 03:03:34 | Planned: 3 new |
| 03:06:04 to 03:09:10 | Claude read and named the three scenarios (two at a time) |
| 03:09:13 to 03:09:15 | Published #99, #100, #101; Strategy Lab refreshed; Pro view and public pages showed each number and title |
| 03:09:52 | Numbers written back to `main` (e77eb6a); report filed as alexarchpublic/case-studies#5, assigned to the owner |
| 03:10:34 | The write-back's deploy ran the pipeline again: 10 baselines recorded, 3 unchanged, nothing read; links synced (+3, 66) |

| # | Title | Chart | Return | Approval recorded |
| --- | --- | --- | --- | --- |
| 99 | Bought Nvidia at the low, twice | Daily | 25.5% | case study movements-nvda-2026 at 3b115abf7842, published by alexarchpublic |
| 100 | Trim Nvidia at highs and step aside | 4-hour | 28.5% | same |
| 101 | Six exits on Nvidia, the last at the top | Hourly | 21.8% | same |

Each has the case study's figures, both benchmarks, a test window of 1 Jan to 11 Nov 2026, three screenshots and an origin link to its scenario; no review check needed letting through. The case study page shows "Strategy #N · title" with both lab links; each strategy page links back. Production parity clean: 79 Pro, 65 public, 66 links. archpublic.com's saved copies show the three after the dev team's next refresh (PB4).

The write-back's full site build re-rendered every study's social image on the Linux runner (visually identical). alexarchpublic/case-studies#6 makes it rebuild only the studies it changes.

## Running it now

The workflow is live on production and unpaused: every case study deploy runs it, and any new scenario with screenshots in `content/<slug>/sources/<key>/` is published. To stop it: `INGEST_PAUSED=true`. To run one study by hand: Actions, "Strategy ingestion", Run workflow, with its slug. The pipeline logins are in the git-ignored `.env.ingest-staging` and `.env.ingest-production` in the Phase 3 worktree; the Claude token expires after a year (November 2027).

Older scenarios have no source screenshots apart from the ten added for Phase 3; their baselines were recorded on 13 Nov 2026, so they are re-ingested only if their figures or screenshots change. Adding screenshots to any other numbered scenario records its baseline on the next run and changes nothing.

Rollback: `INGEST_PAUSED=true`. A strategy the pipeline published is undone with the admin screen's restore, or archived if it was the first version (GR7).

## Tests

- `scripts/db-test.sh`: `tests/db/ingest_phase4.test.sql` (only the pipeline publishes, and only its own drafts; no screenshots holds; on-list checks pass and are recorded, off-list ones hold; the approval names the case study, commit and author; a published scenario without a number is never a second strategy; links sync; baselines fill only empty hashes; screenshots stay on a strategy from another case study; parity holds).
- `npm test` (planning, including baselines).
- The local DB tests run as a direct database session, which every caller check lets through. Staging is where a check against the pipeline's own API session is proven.
