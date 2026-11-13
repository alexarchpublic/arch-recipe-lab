# Auto-ingestion Phase 5: follow-ups

PRD: "Case Study to Strategy Lab Auto-Ingestion and Cross-Linking", Build
phases row 5. Each item ships on its own.

| Item | What | State |
| --- | --- | --- |
| BF3 | One plain title for each older live strategy | This document |
| EX10 | The admin screen's manual upload goes through the same reader and checks | Not started; only if the owner wants it now |
| BF5 | Older scenarios with no strategy | Needs the owner's screenshots in `content/<slug>/sources/<key>/`; the live workflow picks them up |
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

### Known

- #85 has an open draft (the `sellOnDownTrend` settings correction prepared for
  the owner; version 3, source manual). `pipeline_publish_copy` holds it and
  never touches it. Rename it after that draft is published or discarded, with
  `--numbers 85`, or, only with the owner's OK, put the new title into that
  same draft in the admin screen before he publishes it.
- The case study pages read titles from `strategy-lab-pages.json`, which the
  case-studies refresh script rewrites from the views. Until that runs, the
  case study link blocks show the old titles.
- archpublic.com's saved copies change only when they are recaptured (PB4).
