-- Auto-ingestion PRD, Phase 2 ("Links"): load the existing case study links
-- into the store and give the store one way to keep them in step with the
-- case study index.
--
-- What this adds
--   store.sync_case_study_refs(index)   makes store.case_study_refs match a
--       case study index (site/case-studies.json in alexarchpublic/case-studies:
--       studies[].strategies[] with number, key, anchor, scenario). Adds and
--       updates links, removes links the index no longer has (a strategy is
--       never archived for it, PB6), and reports numbers it cannot link.
--       Origins (BF4): a strategy keeps the origin it has; one with none takes
--       its earliest published case study (then slug, then scenario key). An
--       index with no studies is refused, so a broken fetch cannot wipe links.
--       The Phase 4 pipeline calls this after it publishes.
--   public.admin_sync_case_study_refs   the same, for the approver, so a link
--       typed into a case study by hand can be loaded before the pipeline runs.
--   Backfill (BF1, BF4)   the 63 hand-matched scenarios from the case studies
--       merged on 12 November 2026 (case-studies #1), with the permanent
--       scenario keys added in the Phase 2 case-studies change. Strategies 18,
--       19 and 20 take Oracle Protocol (5 Oct 2025) as their origin, the earlier
--       of their two case studies (PRD Q8 default); Enduring the Drop is
--       "featured".
--
-- Needs 20261115000001 (store.case_study_refs). Nothing a client reads changes
-- shape; the case_studies column fills in.

create or replace function store.sync_case_study_refs(p_index jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, store
as $$
declare
  studies jsonb := case when jsonb_typeof(p_index) = 'array' then p_index else p_index->'studies' end;
  added int := 0;
  changed int := 0;
  removed jsonb;
  unknown jsonb;
  dupes jsonb;
begin
  if studies is null or jsonb_typeof(studies) <> 'array' or jsonb_array_length(studies) = 0 then
    raise exception 'The case study index has no studies; no link was changed.' using errcode = '22023';
  end if;

  drop table if exists pg_temp._incoming;
  create temp table _incoming on commit drop as
  select s.slug, s.title, nullif(s.published, '')::date as published_on,
         x.number, coalesce(nullif(trim(x.key), ''), x.anchor) as scenario_key, x.anchor, x.scenario,
         p.id as strategy_id
  from jsonb_to_recordset(studies) as s(slug text, title text, published text, strategies jsonb)
  cross join lateral jsonb_to_recordset(coalesce(s.strategies, '[]'::jsonb))
       as x(number int, key text, anchor text, scenario text)
  left join public.strategies_pro p on p.display_number = x.number;

  select jsonb_agg(jsonb_build_object('case_study', slug, 'scenario', scenario_key)) into dupes
  from (select slug, scenario_key from _incoming group by 1, 2 having count(*) > 1) d;
  if dupes is not null then
    raise exception 'Two scenarios share a key: %', dupes using errcode = '22023';
  end if;

  -- Numbers with no published strategy are reported, not linked.
  select jsonb_agg(jsonb_build_object('strategy', number, 'case_study', slug, 'scenario', scenario_key) order by slug, scenario_key)
    into unknown
  from _incoming where strategy_id is null;

  -- Links the index no longer has (PB6: the strategy itself stays).
  with gone as (
    delete from store.case_study_refs c
    where not exists (select 1 from _incoming i
                      where i.strategy_id is not null and i.slug = c.case_study_slug and i.scenario_key = c.scenario_key)
    returning c.strategy_id, c.case_study_slug, c.scenario_key
  )
  select jsonb_agg(jsonb_build_object('strategy', r.display_number, 'case_study', g.case_study_slug, 'scenario', g.scenario_key))
    into removed
  from gone g join public.recipes r on r.id = g.strategy_id;

  -- A link whose scenario now names another strategy gives up any origin role.
  update store.case_study_refs c
     set role = 'featured', strategy_id = i.strategy_id, updated_at = now()
    from _incoming i
   where i.strategy_id is not null and i.slug = c.case_study_slug and i.scenario_key = c.scenario_key
     and c.strategy_id <> i.strategy_id;
  get diagnostics changed = row_count;

  with up as (
    insert into store.case_study_refs as c
      (strategy_id, case_study_slug, case_study_title, scenario_key, anchor, scenario_title, published_on, role)
    select strategy_id, slug, title, scenario_key, anchor, scenario, published_on, 'featured'
    from _incoming where strategy_id is not null
    on conflict (case_study_slug, scenario_key) do update
      set case_study_title = excluded.case_study_title,
          anchor = excluded.anchor,
          scenario_title = excluded.scenario_title,
          published_on = excluded.published_on,
          updated_at = now()
      where (c.case_study_title, c.anchor, c.scenario_title, c.published_on)
            is distinct from (excluded.case_study_title, excluded.anchor, excluded.scenario_title, excluded.published_on)
    returning (xmax = 0) as inserted
  )
  select added + count(*) filter (where inserted), changed + count(*) filter (where not inserted)
    into added, changed
  from up;

  -- One origin per strategy (BF4): keep the one it has, else the earliest study.
  update store.case_study_refs c set role = 'origin', updated_at = now()
  from (
    select distinct on (strategy_id) id
    from store.case_study_refs
    where strategy_id not in (select strategy_id from store.case_study_refs where role = 'origin')
    order by strategy_id, published_on nulls last, case_study_slug, scenario_key
  ) pick
  where c.id = pick.id;

  return jsonb_build_object(
    'added', added,
    'changed', changed,
    'removed', coalesce(removed, '[]'::jsonb),
    'not_linked', coalesce(unknown, '[]'::jsonb),
    'links', (select count(*) from store.case_study_refs),
    'strategies', (select count(distinct strategy_id) from store.case_study_refs));
end;
$$;

revoke all on function store.sync_case_study_refs(jsonb) from public, anon, authenticated;

create or replace function public.admin_sync_case_study_refs(p_index jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, store, auth
as $$
begin
  perform store.require_role(array['approver']);
  return store.sync_case_study_refs(p_index);
end;
$$;

revoke all on function public.admin_sync_case_study_refs(jsonb) from public, anon;
grant execute on function public.admin_sync_case_study_refs(jsonb) to authenticated;

-- ---------------------------------------------------------------------------
-- Backfill (BF1, BF4): 20 case studies, 63 scenarios, 60 strategies.
-- Generated from site/case-studies.json of alexarchpublic/case-studies.
-- ---------------------------------------------------------------------------
select store.sync_case_study_refs($backfill$
{"studies": [
  {"slug": "meta", "title": "Volatility Harvesting for Meta", "published": "2026-10-22", "strategies": [{"number": 96, "key": "flat-year-harvest", "anchor": "scenario-1", "scenario": "The flat-year harvest"}, {"number": 95, "key": "capex-whipsaw", "anchor": "scenario-2", "scenario": "The capex whipsaw"}, {"number": 94, "key": "ai-race-accumulator", "anchor": "scenario-3", "scenario": "The AI race accumulator"}]},
  {"slug": "pltr", "title": "Volatility Harvesting for Palantir", "published": "2026-10-01", "strategies": [{"number": 93, "key": "2026-harvest", "anchor": "scenario-1", "scenario": "The 2026 harvest"}, {"number": 92, "key": "gap-buyer", "anchor": "scenario-2", "scenario": "The gap buyer"}, {"number": 91, "key": "gap-buyer-finer-wave", "anchor": "scenario-3", "scenario": "The gap buyer, finer wave"}]},
  {"slug": "mu", "title": "MU: a trillion-dollar run, a 41% drop in five weeks, and three strategies that paid in cash", "published": "2026-09-23", "strategies": [{"number": 89, "key": "weekly-paycheck", "anchor": "scenario-1", "scenario": "The weekly paycheck"}, {"number": 88, "key": "patient-buyer", "anchor": "scenario-2", "scenario": "The patient buyer"}, {"number": 90, "key": "2026-scoreboard", "anchor": "scenario-3", "scenario": "The 2026 scoreboard"}]},
  {"slug": "xle", "title": "XLE: three flat years, an Iran war spike, and a round trip in four months", "published": "2026-08-26", "strategies": [{"number": 85, "key": "trading-the-war", "anchor": "scenario-1", "scenario": "Trading the war"}, {"number": 86, "key": "trading-the-range", "anchor": "scenario-2", "scenario": "Trading the range"}, {"number": 87, "key": "patient-trade", "anchor": "scenario-3", "scenario": "The patient trade"}]},
  {"slug": "ibit", "title": "IBIT: Bitcoin's $126,000 top, the 50% bust, and three strategies that beat holding it", "published": "2026-08-25", "strategies": [{"number": 83, "key": "accumulator", "anchor": "scenario-1", "scenario": "The accumulator"}, {"number": 82, "key": "downtrend-trade", "anchor": "scenario-2", "scenario": "The downtrend trade"}, {"number": 84, "key": "full-cycle", "anchor": "scenario-3", "scenario": "The full cycle"}]},
  {"slug": "mrna", "title": "MRNA: a pandemic boom, a 90% bust, and this month's spike", "published": "2026-08-25", "strategies": [{"number": 81, "key": "fresh-start", "anchor": "scenario-1", "scenario": "The fresh start"}, {"number": 77, "key": "2026-scoreboard", "anchor": "scenario-2", "scenario": "The 2026 scoreboard"}, {"number": 78, "key": "round-trip", "anchor": "scenario-3", "scenario": "The round trip"}]},
  {"slug": "intc", "title": "INTC: the stock that tested every kind of patience", "published": "2026-08-21", "strategies": [{"number": 74, "key": "long-sideways-market", "anchor": "scenario-1", "scenario": "The long sideways market"}, {"number": 75, "key": "run-up", "anchor": "scenario-2", "scenario": "The run up"}, {"number": 76, "key": "round-trip", "anchor": "scenario-3", "scenario": "The round trip"}]},
  {"slug": "msft", "title": "MSFT and the price of feeling safe", "published": "2026-08-11", "strategies": [{"number": 66, "key": "whipsaw-year", "anchor": "scenario-1", "scenario": "The whipsaw year"}, {"number": 65, "key": "two-year-grind", "anchor": "scenario-2", "scenario": "The two year grind"}, {"number": 64, "key": "full-cycle", "anchor": "scenario-3", "scenario": "The full cycle"}]},
  {"slug": "iren", "title": "Riding the AI wave in a stock that got cut in half", "published": "2026-08-07", "strategies": [{"number": 63, "key": "round-trip-to-nowhere", "anchor": "scenario-1", "scenario": "The round trip to nowhere"}, {"number": 62, "key": "full-round-trip", "anchor": "scenario-2", "scenario": "The full round trip"}, {"number": 61, "key": "same-crash-worked-harder", "anchor": "scenario-3", "scenario": "The same crash, worked harder"}]},
  {"slug": "bitcoin-market-wave-stack", "title": "The Bitcoin Accumulation Algorithm", "published": "2026-07-28", "strategies": [{"number": 67, "key": "leg-3-mara-on-the-4-hour-chart", "anchor": "scenario-3", "scenario": "Leg 3: MARA on the 4-hour chart"}]},
  {"slug": "mara", "title": "Trading the chaos", "published": "2026-07-24", "strategies": [{"number": 70, "key": "long-cycle", "anchor": "scenario-1", "scenario": "The long cycle"}, {"number": 69, "key": "down-year", "anchor": "scenario-2", "scenario": "The down year"}, {"number": 68, "key": "long-term-believer", "anchor": "scenario-3", "scenario": "The long-term believer"}]},
  {"slug": "aapl", "title": "The most owned stock in America, finally managed", "published": "2026-07-21", "strategies": [{"number": 73, "key": "trade-the-chop", "anchor": "scenario-1", "scenario": "Trade the chop"}, {"number": 72, "key": "pure-accumulation", "anchor": "scenario-2", "scenario": "Pure accumulation"}, {"number": 71, "key": "capture-the-trend", "anchor": "scenario-3", "scenario": "Capture the trend"}]},
  {"slug": "googl", "title": "Getting paid in a bull market.", "published": "2026-07-16", "strategies": [{"number": 59, "key": "cash-yield-at-all-time-highs", "anchor": "scenario-1", "scenario": "Cash yield at all-time highs"}, {"number": 57, "key": "cash-yield-through-the-bull-run", "anchor": "scenario-2", "scenario": "Cash yield through the bull run"}, {"number": 58, "key": "same-window-the-accumulation-strategy", "anchor": "scenario-3", "scenario": "Same window, the accumulation strategy"}]},
  {"slug": "gld", "title": "Rules for a Gold Rush", "published": "2026-07-15", "strategies": [{"number": 54, "key": "record-bull-run", "anchor": "scenario-1", "scenario": "The record bull run"}, {"number": 55, "key": "mid-trend-entry", "anchor": "scenario-2", "scenario": "The mid-trend entry"}, {"number": 56, "key": "worst-case", "anchor": "scenario-3", "scenario": "The worst case"}]},
  {"slug": "qqq", "title": "Discipline with awareness on QQQ", "published": "2026-06-30", "strategies": [{"number": 46, "key": "full-decade", "anchor": "scenario-1", "scenario": "The full decade"}, {"number": 45, "key": "covid-crash-entry", "anchor": "scenario-2", "scenario": "The COVID crash entry"}, {"number": 43, "key": "2008-great-financial-crisis", "anchor": "scenario-3", "scenario": "The 2008 Great Financial Crisis"}, {"number": 44, "key": "accumulation-strategy", "anchor": "scenario-4", "scenario": "The accumulation strategy"}, {"number": 42, "key": "cash-yield-strategy", "anchor": "scenario-5", "scenario": "The cash yield strategy"}]},
  {"slug": "nvda", "title": "Rules beat hesitation on NVDA", "published": "2026-06-23", "strategies": [{"number": 50, "key": "it-is-already-too-high-to-buy-test", "anchor": "scenario-1", "scenario": "The ‘it is already too high to buy’ test"}, {"number": 51, "key": "cash-yield-on-a-mature-winner-test", "anchor": "scenario-2", "scenario": "The ‘cash yield on a mature winner’ test"}, {"number": 41, "key": "catch-it-early-test", "anchor": "scenario-3", "scenario": "The ‘catch it early’ test"}]},
  {"slug": "mstr", "title": "Discipline over conviction on MSTR", "published": "2026-06-18", "strategies": [{"number": 47, "key": "through-the-entire-boom-and-give-back", "anchor": "scenario-1", "scenario": "Through the entire boom and give-back"}, {"number": 53, "key": "great-stock-that-went-nowhere", "anchor": "scenario-2", "scenario": "The great stock that went nowhere"}, {"number": 52, "key": "a-profit-in-a-falling-market", "anchor": "scenario-3", "scenario": "A profit in a falling market"}]},
  {"slug": "tsla", "title": "Outperforming buy and hold on Tesla", "published": "2026-06-17", "strategies": [{"number": 49, "key": "three-years-same-logic-run-on-the-daily", "anchor": "scenario-1", "scenario": "Three years, same logic, run on the daily"}, {"number": 48, "key": "whipsaw-test-on-the-4-hour", "anchor": "scenario-2", "scenario": "The whipsaw test, on the 4-hour"}]},
  {"slug": "enduring-the-drop", "title": "Enduring The Drop", "published": "2025-11-21", "strategies": [{"number": 18, "key": "ethereum-strategy-18", "anchor": "scenario-5", "scenario": "Ethereum: Strategy #18"}, {"number": 19, "key": "solana-strategy-19", "anchor": "scenario-6", "scenario": "Solana: Strategy #19"}, {"number": 20, "key": "xrp-strategy-20", "anchor": "scenario-7", "scenario": "XRP: Strategy #20"}]},
  {"slug": "oracle-protocol", "title": "Dynamics of The Oracle Protocol", "published": "2025-10-05", "strategies": [{"number": 15, "key": "cycle-swing-arbitrage", "anchor": "scenario-2", "scenario": "Cycle swing arbitrage"}, {"number": 16, "key": "short-target-swing-accumulation", "anchor": "scenario-3", "scenario": "Short target swing accumulation"}, {"number": 17, "key": "short-target-swing-arbitrage", "anchor": "scenario-4", "scenario": "Short target swing arbitrage"}, {"number": 18, "key": "ethereum-volatility-harvesting", "anchor": "scenario-5", "scenario": "Ethereum: volatility harvesting"}, {"number": 19, "key": "solana-volatility-harvesting", "anchor": "scenario-6", "scenario": "Solana: volatility harvesting"}, {"number": 20, "key": "xrp-volatility-harvesting", "anchor": "scenario-7", "scenario": "XRP: volatility harvesting"}, {"number": 21, "key": "sui-volatility-harvesting", "anchor": "scenario-8", "scenario": "SUI: volatility harvesting"}]}
]}
$backfill$::jsonb);
