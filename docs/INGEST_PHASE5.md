# Auto-ingestion Phase 5: follow-ups

PRD: "Case Study to Strategy Lab Auto-Ingestion and Cross-Linking", Build
phases row 5. Each item ships on its own.

| Item | What | State |
| --- | --- | --- |
| BF3 | One plain title for each older live strategy | Live in production 2026-11-13 (below) |
| EX10 | The admin screen's manual upload goes through the same reader and checks | Not started; only if the owner wants it now |
| BF5 | Older scenarios with no strategy | 9 ready scenarios staged (below); the rest need screenshots or another reader |
| PB4 | archpublic.com refresh hook | Needs Arch Public's dev team (Q4); request drafted only |

## BF3: rename the older strategies

The 76 strategies published before the pipeline (everything except #99 to
#101, which the pipeline named) still carry titles such as "MSFT 2026 YTD" and
short names such as "MSFT STH 1D Swing". BF3 replaces each with one title under
the naming rules (NM2 to NM8), plus a summary and a description.

### How it works

`scripts/ingest/rename.mjs` has two commands.

`name` reads the live strategies from the Pro view (publishable key only) and,
for each one not kept, runs the pipeline's own naming step: the same prompt
(`namingPrompt`, `NAMING_INSTRUCTIONS`), the same checks (`namingProblems`,
`titleProblems`), three tries, then the NM10 fallback. Claude runs headless on
this machine's sign-in, as the pipeline's `read` step does.

- A strategy with case study links is named from its origin scenario: the
  study and scenario titles, the window, the scenario's context lines and the
  stored settings.
- A strategy with no case study is named from its stored fields: its title and
  short name today (for the idea), summary and description if any, test window
  and settings. No figures go into the prompt.
- Titles must differ from every other new title and from the kept ones. Names
  run four at a time; any clash is reported for a re-run of those numbers.

It writes `items/<number>.json` (prompt input, every attempt, the reply) and
`list.json` (before and after, the published version each was made from). It
writes nothing to any store.

`publish` sends the approved list through `pipeline_publish_copy` (migration
`20261119000001_ingest_copy_rename.sql`) as the pipeline account. The function:

- takes only `title`, `goal` (summary) and `how_it_trades` (description);
  `store.save_draft`'s copy-only role refuses anything else;
- refuses a strategy whose published version is not the one in the list (it
  moved since the owner looked), an archived one, or one with an open draft;
- copies everything else from the published version, including screenshots,
  the extraction and the source, so figures and settings cannot change;
- raises unless the result is change type `copy` with the same page address;
- raises on a blocking check (an error, or a review check the published version
  had not acknowledged);
- records the note (who approved the list, and when) as the approval, then runs
  the parity check.

Any refusal raises, so nothing is left behind. The database tests are in
`tests/db/ingest_phase5.test.sql`.

### Rollout (each step needs the owner's OK)

1. Name: `node scripts/ingest/rename.mjs name --case-studies <case-studies checkout> --out runs/bf3`
   with `STORE_URL`/`STORE_ANON_KEY` set to production (reads only).
2. The owner looks at the before-and-after list once (Q3) and approves it or
   names changes. Changes are made in `list.json` and re-checked with
   `titleProblems`.
3. Migration `20261119000001` on staging, then the publish on staging with the
   staging pipeline login. Staging's versions differ from production's, so the
   list's version ids are swapped for staging's before that run.
4. Migration on production, then
   `node scripts/ingest/rename.mjs publish --run runs/bf3 --approved "<who, date>" --production`
   with the production pipeline login.
5. Check: parity clean, both labs show the new titles, every page address
   unchanged (old slug still resolves), R8 and the link check pass, and each
   case study's link block shows the new titles after its next refresh.

### Done, 13 November 2026

- Named: 76 strategies in about 15 minutes (four at a time, claude-sonnet-4-6 on
  the subscription, naming prompt 2026-11-12.2). All passed the rules on the
  first try: no fallbacks, no clashes. 60 from their case study, 16 from stored
  fields. Seven titles edited by hand after the naming step (#22, #29, #47, #53,
  #60, #68, #69), each marked on the review page with the reason.
- Approved: the owner's one look (Q3), "Approve the list", 2026-11-13. The list
  as approved is `docs/ingest-phase5/bf3-approved-list.json`.
- Staging: migration applied (function md5 741b745f1536b1570eab1d77da5bd26a);
  50 renamed, 26 held by staging's leftover drafts, as designed.
- Production: migration applied on the owner's OK (same md5; anon cannot
  execute). 76 published, 0 held. Every new version is change type copy, keeps
  its page address, and is identical to the one before in every other column
  (figures, settings, screenshots, extraction, source). Parity ok; 79 distinct
  titles; no STH, LTH, YTD, hour codes or "scalp" left in any live title.
  Strategy Lab refreshed through /api/revalidate as the pipeline: all 76 show
  the new title on the Pro view, all 62 public ones on their page at the same
  address.

### Known

- #85 had an open settings draft while the list was made; it was gone by the
  production run, so #85 was renamed with the rest. The function holds any
  strategy with an open draft and never touches the draft.
- The case study pages read titles from `strategy-lab-pages.json`, which the
  case-studies refresh script rewrites from the views. Until that runs, the
  case study link blocks show the old titles.
- archpublic.com's saved copies change only when they are recaptured (PB4).

## BF5: older scenarios with no strategy

On 13 Nov 2026, 56 of the 122 case study scenarios had no strategy number. None matches one of the 16 live strategies without a case study (#22 to #31, #36 to #40, #60), so each would be a new strategy.

| Group | Scenarios | What it needs |
| --- | --- | --- |
| Market Wave, screenshots on hand | 10: AMD (3), BRR (3), Bitcoin Market Wave stack legs 1 and 2, Movements IREN and INTC | Sources added in case-studies (branch `bf5-ready-sources`); the owner's screenshot sets match the case study charts pixel for pixel |
| Market Wave, no screenshots | 7: Movements TSLA (daily), Ride the Market Wave (6) | The owner's chart, settings and data window screenshots |
| Other algorithms | 39: the 2025 Intelligence, Arbitrage and Oracle studies and the Bitcoin treasury essays | The reader covers Market Wave only (A13); about 10 of these are not backtests at all |

Two pipeline fixes came out of the staging dry run:

- **Ticker from the company name.** TradingView's header names the company, not the symbol, and Claude read ProCap Financial's logo initials ("PC") as BRR's ticker, which held all three BRR scenarios. When the header's company is the case study's (`sameCompany`), the case study's ticker is stored and the finding is a note (`ticker_from_name`); any other mismatch still holds.
- **Time frames the store does not have.** The reader filed any time frame it did not know as 1 Hour, so BRR's 15 minute scenario would have been stored as hourly. Such a reading now holds (`time_frame_unsupported`). BRR's 15 minute sources stay out of the case-studies branch until the store has a 15 minute time frame.

Staging dry run (production reads, staging drafts): 9 new drafts (#102 to #110 on staging), every return equal to its case study's, no holds; warnings only for Claude's last-bar date and DCA rounding (the case study's figure is stored). Production order: merge this, then the case-studies branch; its deploy runs the live workflow, which publishes the 9.
