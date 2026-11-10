-- Phase 1 clean-up (PRD 13): version 2 drafts for the strategies whose end
-- date in the settings is a run setting, not the real end of the test.
--
-- Run in the SQL editor of the target project AFTER migrations
-- 20261111000001-3. It creates drafts in review only; nothing is visible to
-- clients until the owner publishes each one in the admin console.
-- Safe to re-run: a strategy that already has an open draft is updated.
--
-- Each end date is the last bar read from the strategy's chart screenshot
-- (PRD D10, A16). The 18 from the audit are in audit/end_dates_from_charts.csv
-- (read 10 Nov 2026). The other 6 were read on 11 Nov 2026:
--   #96 META 6H   run end 2030-01-28; live bar 15 trading days past the Oct
--                 gridline, timer running: 22 Oct 2026, the upload day
--   #94, #95 META run end 2026-10-23, a day after upload; same upload batch
--                 as #96 (22 Oct)
--   #88-90 MU     run end 2026-09-24, a day after upload; #90's live bar is 15
--                 trading days past the Sep gridline: 23 Sep 2026, the
--                 upload day, and the batch shares it
-- All dates are approximate (about two trading days for daily and intraday
-- charts, a week for weekly) and need the owner's confirmation at review.

with chart_end (display_number, test_end, how_read) as (
  values
    (58, date '2026-07-08', 'audit: daily bars past the Jul gridline; bar timer; same-day upload'),
    (60, date '2026-08-04', 'audit: days past the Aug gridline; same-day upload'),
    (62, date '2026-08-06', 'audit: trading days past the Aug gridline; IREN 1d strategy ends 2026-08-06'),
    (63, date '2026-08-06', 'audit: trading days past the Aug gridline; IREN 1d strategy ends 2026-08-06'),
    (64, date '2026-08-11', 'audit: weekly bars past the Jul gridline; bar timer shows a Tuesday'),
    (65, date '2026-08-11', 'audit: daily bars past the Jul gridline'),
    (66, date '2026-08-12', 'audit: daily bars past the Aug label'),
    (67, date '2026-07-28', 'audit: position between the Jul and Aug gridlines'),
    (68, date '2026-07-23', 'audit: weekly bars past the Jul gridline; sibling start dates fall on 23 Jul'),
    (69, date '2026-07-24', 'audit: position between the Jul and Aug gridlines'),
    (70, date '2026-07-23', 'audit: daily bars past the Jul gridline'),
    (71, date '2026-07-14', 'audit: one weekly bar past the Jul gridline'),
    (72, date '2026-07-02', 'audit: last bar at the Jul gridline'),
    (73, date '2026-07-09', 'audit: daily bars past the Jul gridline'),
    (77, date '2026-08-25', 'audit: trading days past the Aug gridline; same-batch strategies end 2026-08-25'),
    (78, date '2026-08-25', 'audit: weekly bars past the Jul gridline; bar timer shows a Tuesday'),
    (81, date '2026-08-25', 'audit: last bar at the 25 Aug day gridline'),
    (85, date '2026-08-25', 'audit: trading days past the Aug gridline'),
    (88, date '2026-09-23', '11 Nov: same upload batch as #90 (live bar on 23 Sep)'),
    (89, date '2026-09-23', '11 Nov: same upload batch as #90 (live bar on 23 Sep)'),
    (90, date '2026-09-23', '11 Nov: live 4h bar 15 trading days past the Sep gridline, the upload day'),
    (94, date '2026-10-22', '11 Nov: same upload batch as #96 (live bar on 22 Oct)'),
    (95, date '2026-10-22', '11 Nov: same upload batch as #96 (live bar on 22 Oct)'),
    (96, date '2026-10-22', '11 Nov: live 6h bar 15 trading days past the Oct gridline, the upload day')
),
drafts as (
  select r.display_number,
         store.save_draft(
           r.id,
           jsonb_build_object(
             'test_end', c.test_end,
             'test_end_source', 'chart_last_bar',
             'change_note', format(
               'Phase 1 clean-up: test end %s read from the last bar on the chart (%s). The %s in the settings is the TradingView run setting and is never shown. CAGR recomputed over the real window.',
               to_char(c.test_end, 'FMDD Mon YYYY'), c.how_read,
               to_char(store.run_end(v.algorithm, v.algorithm_inputs), 'YYYY-MM-DD'))),
           'phase 1 clean-up script (prepared for alex@archpublic.com)',
           'editor') as version_id
  from chart_end c
  join public.recipes r on r.display_number = c.display_number
  join store.strategy_versions v on v.id = r.current_version_id
)
select count(*) as drafts_saved from drafts;

-- Submit them for review. A separate statement: drafts created by a function
-- in the statement above are not visible to that statement's own update.
update store.strategy_versions
   set status = 'in_review',
       submitted_by = 'phase 1 clean-up script (prepared for alex@archpublic.com)',
       submitted_at = now()
 where status = 'draft'
   and created_by = 'phase 1 clean-up script (prepared for alex@archpublic.com)';

-- What is now waiting for review, with the figure each draft changes.
select r.display_number as n, d.short_name, p.test_end as v1_end, d.test_end as v2_end,
       round(p.cagr_pct, 1) as v1_cagr, round(d.cagr_pct, 1) as v2_cagr, round(d.return_pct, 1) as return_pct,
       d.change_type, (select count(*) from jsonb_array_elements(d.checks) c where c->>'level' = 'error') as errors
from store.strategy_versions d
join public.recipes r on r.id = d.strategy_id
join store.strategy_versions p on p.id = r.current_version_id
where d.status = 'in_review'
order by r.display_number;
