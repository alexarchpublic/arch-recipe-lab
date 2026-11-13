# Auto-ingestion, Phase 3: pipeline, dry run

PRD: [Case Study to Strategy Lab Auto-Ingestion and Cross-Linking](https://claude.ai/artifact/7gqahsVHFo2Ey7pHrA3PWm), "Build phases", row 3.

Done when: run on 10 published Market Wave strategies, every setting matches the store, or each difference is explained. Results are under "Acceptance run" below.

Q1, answered by the owner on 12 Nov 2026: Claude runs on the owner's Claude subscription, the one Claude Code is signed in to. Locally the pipeline uses that sign-in. In GitHub Actions it uses `CLAUDE_CODE_OAUTH_TOKEN`, made with `claude setup-token` on the same account. Swapping that secret for `ANTHROPIC_API_KEY` moves it to pay-per-use with no code change.

## What changed

| Area | Change | PRD |
| --- | --- | --- |
| Core | `packages/core/src/pipeline.ts`: what a scenario states (figures, window, chart, ticker), what to do with it (new, update, unchanged, skip), what holds a strategy, the naming prompt and its rules, the draft's fields, and the settings comparison. Pure functions, bundled to `lib/pipeline.bundle.js` by `npm run build:pipeline`; a test fails if the committed bundle is stale. | TR3, TR4, TR5, GR1 to GR3, NM1 to NM11, EX5, EX6 |
| Runner | `scripts/ingest/run.mjs` with four steps: `plan`, `read`, `write`, `report`. Each runs with only the secrets it needs. | EX3, GR4 |
| Claude | `scripts/ingest/claude.mjs` runs Claude Code headless with one tool, Read, in a folder holding only the scenario's screenshots, and passes it a short list of environment variables (no store credentials). Model named in one place, `claude-sonnet-4-6` unless `INGEST_MODEL` says otherwise. Usage-limit and network failures retry three times over about two hours. | EX1, EX3, EX7, EX9 |
| Naming | Claude writes the title, summary and description from the case study's own words; the rules in `naming.ts` and `pipeline.ts` check them (48 characters, no codes, figures, promises, dashes, exclamation marks, unique among live titles). Three tries, then "Asset: scenario title". Naming never holds a strategy. | NM2 to NM10 |
| Store | Migration `20261117000001_ingest_pipeline_drafts.sql`: a `pipeline` role; `is_admin()` now true for the three people roles only, so the pipeline cannot read admin views or use the older write policies; a storage policy for `recipe-screenshots/case-studies/`; and four functions, `pipeline_scenario_state`, `pipeline_save_draft`, `pipeline_attach_screenshots`, `pipeline_record_extraction`. No publish function: that is Phase 4. | A1, GR8, NO1, NO4, EX4 |
| Case studies | (alexarchpublic/case-studies) The page skill keeps every source screenshot in `content/<slug>/sources/<scenario key>/` (`chart.png`, `settings.png`, `data-window.png`, `dca.png`); `check.py` rejects other files there and warns when a scenario has none. `.github/workflows/ingest.yml` runs the pipeline on Vercel's production deploy, on demand for one study, or on a push if `INGEST_ON_PUSH` is set; runs queue; `INGEST_PAUSED` stops it. | TR1, TR2, TR6, TR7, GR6 |

The folder is named by scenario key rather than position (the PRD said `scenario-N`), so reordering scenarios cannot attach screenshots to the wrong one (NO7).

### What holds a strategy

A hold stops that one strategy; the rest of the study carries on (GR2). Holds: a required screenshot missing, Claude unable to read them, a reading that fails the schema, chart header against settings panel (A9), ticker or time frame against the case study, an algorithm other than Market Wave, and a far-future settings end with no readable last bar (EX6). Warnings only: a data window figure that differs from the case study (the case study's figure is stored, EX5), a settings start or chart end more than a week from the case study's window, an unreadable chart parameter list.

A draft a person has open on the same strategy is never overwritten: the pipeline holds that strategy instead.

## Run it

```bash
export STORE_URL=https://xsoixhltejgyuhedhbdu.supabase.co STORE_ANON_KEY=<publishable key>   # public reads
node scripts/ingest/run.mjs plan --case-studies ../case-studies --out runs/x --slug msft --compare
node scripts/ingest/run.mjs read --run runs/x --parallel 3
node scripts/ingest/run.mjs report --run runs/x
```

`write` also needs the pipeline account on staging: `PIPELINE_STORE_URL`, `PIPELINE_STORE_ANON_KEY` (staging), `PIPELINE_EMAIL`, `PIPELINE_PASSWORD`. It refuses a production address in Phase 3. `read --naming-only` redoes the checks and names on an earlier reading without reading the screenshots again.

## Rollout

1. Apply `20261117000001_ingest_pipeline_drafts.sql` to staging. **Done 12 Nov 2026**: the five function bodies are identical to a local build (md5 of `prosrc`); parity ok; anon cannot call the pipeline functions.
2. Create the pipeline account on staging. **Done 12 Nov 2026** with the owner's OK: `pipeline@archpublic.com`, role `pipeline`, confirmed, one email identity. The password was generated on the owner's machine and only its bcrypt hash went to the database; it lives in the git-ignored `.env.ingest-staging` in the Phase 3 worktree, beside the staging address and publishable key. Signed in as it: `is_admin()` is false, `admin_publish` and `admin_save_draft` refuse its role, it sees no admin versions, and an upload outside `case-studies/` is refused. For production (Phase 4), create a separate account with its own password.
3. GitHub settings on alexarchpublic/case-studies (see the header of `.github/workflows/ingest.yml`): `CLAUDE_CODE_OAUTH_TOKEN` (the owner runs `claude setup-token` and adds it), a read-only deploy key for arch-recipe-lab (`RECIPE_LAB_DEPLOY_KEY`), the pipeline account, and the store variables. **Waiting on the owner.**
4. Run the workflow by hand on one study with "compare" ticked, then let a real case study publish trigger it.
5. Production: nothing in Phase 3. The migration goes to production with Phase 4's publish function.

Rollback: set `INGEST_PAUSED=true`. Drafts the pipeline saved on staging can be discarded from the admin screen. The migration can stay; nothing calls its functions without the pipeline account.

## Tests

- `npm test`: `tests/ingestPipeline.test.ts` (figures, windows, planning, holds, naming rules, draft fields, settings comparison, bundle drift).
- `scripts/db-test.sh`: `tests/db/ingest_phase3.test.sql` (only the pipeline can call its functions; the pipeline is not an admin and cannot publish, save admin drafts or sync links; new scenario gets a number; a rerun reuses it; screenshots only from the case study folder and only on its own new strategy; extractions are Claude only; a person's open draft is never overwritten; nothing published).

## Acceptance run

**12 Nov 2026, on the owner's Claude subscription (Claude Sonnet 4.6, headless Claude Code on this machine).** Ten published Market Wave strategies, chosen across six assets and every time frame but 6-hour: #62, #64, #66, #67, #70, #71, #75, #83, #85, #87. Their source screenshots are the ones stored with each strategy, placed in the case-studies TR2 layout. Full report: [ingest-phase3/dry-run-2026-11-12.md](ingest-phase3/dry-run-2026-11-12.md).

**Done-when met: every setting matches the store, or the difference is explained.**

| Check | Result |
| --- | --- |
| The 40 settings a client copies into TradingView | 9 of 10 identical to the store. #85 differs on one checkbox, "Sell on change of trend": the settings screenshot shows it ticked, the store has it off. Claude read it correctly; **the published #85 is wrong** and needs a correction through the admin screen. |
| Strategy return | 10 of 10: case study, data window and store agree (to the case study's one decimal). |
| Test end | 8 of 10 equal the store; #71 is held (below). #66 is a day apart: the case study says 11 Aug 2026, the store 12 Aug; the case study's date is what the pipeline stores (EX5). |
| Holds | #85: its chart header and settings panel show different end dates (28 Jan 2030 against 25 Aug 2026), so its screenshots were not taken together; held, correctly. #71: the case study gives only "Jul 2026" as the end and Claude's reading of the chart's last bar fell in November; held, correctly. |
| Names | 10 of 10 pass the rules (one after a second try). Before-and-after list in the report. |
| Time | About 2 minutes a scenario with three running at once; 10 in under 10 minutes. |

What the run changed in the build:

- **The chart's last bar is not reliable enough to store.** Claude's reading of the last candle's date was off by days to months in 6 of 8 cases, once returning the run date itself. The test end is now the case study's window end whenever the case study states one, and the chart's reading is only a cross-check (a warning past a week). Where the case study gives only a month, a reading outside that month holds the strategy; where it gives nothing and the chart cannot be read, it holds.
- Naming rules gained: no em or en dashes, no exclamation marks, no promises about losses, no time frame words in a title ("on the 4-hour chart"), sentence case, an ETF keeps its fund name, all-capital names (IREN, MARA) stay as they are.
- Windows written with trailing words ("August 6, 2026, ten months") are read.

### Write to staging

Same run, `write` step, as the pipeline account (12 Nov 2026):

| Outcome | Strategies | Why |
| --- | --- | --- |
| Draft saved | #75, #83, #87 | Each reproduces its published version: the same 40 settings, benchmarks shown, return, realized cash and buy and hold. Only the profit's cents differ (the store held whole dollars). #75 and #83 carry no review flags. |
| Draft saved, flagged for review | #87 | TradingView's own data window disagrees with itself: cash plus shares gives a total P&L of $102,326, the portfolio value $102,843 (102.84%, which the case study and the store use). The store's checks flag it (`roi_vs_pnl`, `net_profit_vs_extraction`). In Phase 4 that holds the strategy, which is right. |
| Held: a person's draft is open | #62, #64, #66, #67, #70 | Staging has open drafts from the Phase 1 clean-up script on these strategies. The pipeline refused to overwrite them, as designed. Production does not have these drafts. |
| Held by the checks | #71, #85 | As in the reading above. |

Writing twice changed nothing extra: one pipeline version per strategy, the same version ids (NO4). Nothing published; parity ok (76 Pro, 62 public). Each reading is in `store.extractions` as Anthropic, `claude-sonnet-4-6`, prompt 2026-11-11.1. Readings for strategies that were then held are recorded without a strategy, so provenance is kept for every run (EX4).

The write run changed two more rules: where a data window figure rounds to the case study's figure, the exact figure is stored (the case study prints one decimal and whole dollars); and the benchmarks shown follow the case study's own list, so a study that compares only with DCA hides buy and hold (#75).

Not covered yet: GitHub Actions itself (rollout step 3).
