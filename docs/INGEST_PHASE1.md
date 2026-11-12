# Auto-ingestion, Phase 1: store and names

PRD: [Case Study to Strategy Lab Auto-Ingestion and Cross-Linking](https://claude.ai/artifact/7gqahsVHFo2Ey7pHrA3PWm), "Build phases", row 1.

Done when: staging, then production, migrated; a manual upload works with one title; parity and access checks pass.

## What changed

| Area | Change | PRD |
| --- | --- | --- |
| Store | `store.strategy_versions` gains `source_kind`, `case_study_slug`, `scenario_key`, `source_commit`, `source_hash`. Every existing version is `manual`. A draft an admin starts is always `manual`. | TR3, TR4, NO4 |
| Store | New `store.case_study_refs` (one row per strategy per case study scenario, one origin per strategy) and `public.admin_case_study_refs`. Empty until the Phase 2 backfill. | LK1, BF1 |
| Views | `strategies_pro` and `strategies_public` gain `case_studies` (origin first; `[]` when none). On the public allowlist. | LK1, LK2, LK6 |
| Names | The database fills `name` and `short_name` from the title on every open version, and ignores what a caller sends for them. A new strategy's slug comes from its title. Published versions and existing page addresses do not change. | NM1, NM9 |
| Parity | Two new checks: a strategy with case study links has exactly one origin; every link points at a published strategy. | LK9 (store side) |
| Admin form | One required **Title**. Recipe Name and Short name are gone. The form shows the line clients see under the title and flags titles that break the naming rules (codes, figures, promises, over 48 characters, duplicates). The flags guide; they do not block a save. | NM1, NM3 to NM6 |
| Both labs | The line under a title is built from stored fields by `strategyLine()` in `packages/core`: "Strategy #68 · MARA · Weekly chart · Market Wave". Nothing a client reads shows `short_name` any more. | NM1, NO5 |
| Reader | The prompt, extraction schema, shape check and cross-checks live in `packages/core/src/extraction.ts` (no dependencies). `lib/extraction.bundle.js` is built from it by `npm run build:reader`, and a test fails if the committed bundle differs from a fresh build. The draft title is plain words ("IREN on the hourly chart"); no STH/LTH/Scalp. | EX2, NM3 |
| Reader | The OpenAI path is removed. The reader calls Claude only; `ANTHROPIC_API_KEY` is the one key. Vercel had no `OPENAI_API_KEY` set (checked 12 Nov 2026), so production behaviour does not change. | EX8 |

Not in this phase: the pipeline role and `admin_publish_from_case_study` (Phases 3 and 4), loading the 63 existing links (Phase 2), comparing the live case study index with the store (Phase 2's daily link check), renaming the 76 existing titles (Phase 5).

## Rollout

The migration is backward compatible with the app deployed today: the old admin form still sends Recipe Name and Short name, and the database replaces them with the title. The new app needs the migration (it sends no name), so the order is:

1. Apply `supabase/migrations/20261115000001_ingest_store_names.sql` to staging. **Done 12 Nov 2026**: function bodies and view columns identical to a local build; parity clean (76 strategies, 62 public, 0 links).
2. Apply it to production (comment-stripped copy through the Supabase connector, as before). Check: `select ok, problems from store.parity_runs order by id desc limit 1` is ok with no problems.
3. Merge the pull request straight after: it carries the R8 allowlist with `case_studies` (`scripts/r8-rules.mjs`). Until it merges, the R8 workflow on `main` reports `case_studies` as an unknown public column.
4. After both Vercel deploys: page parity (`node --experimental-strip-types scripts/parity-pages.mjs`), R8 (`node scripts/r8-anon-check.mjs`), and open one Pro and one public strategy page to see the new line.
5. Remove `OPENAI_API_KEY` from any local `.env` (nothing reads it now).

Rollback: the app change reverts with the pull request. The migration needs no rollback for the old app; to undo it, restore the 20261114000001 bodies of `store.save_draft`, `store.strategy_versions_before_write`, `run_parity_check`, `store.public_view_allowlist` and both views, then drop `store.case_study_refs` and the five source columns.

## Tests

- `scripts/db-test.sh`: `tests/db/ingest_phase1.test.sql` (source columns, names from the title, links in the views, parity additions, access).
- `npm test`: `tests/naming.test.ts`, `tests/recipeFormTitle.test.tsx`, and the bundle check in `tests/screenshotImport.test.ts`.
