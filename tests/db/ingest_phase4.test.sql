-- Auto-ingestion Phase 4 checks: the pipeline publishes its own case study
-- drafts with no person in between, lets through only the review checks on
-- its fixed list (GR3), records the case study as the approval, replaces
-- screenshots only where the strategy originates in this scenario (PB5),
-- keeps links in step (LK1) and records baselines (BF2). Any failure raises.
-- Runs after ingest_phase3.test.sql (which created the pipeline account).
\set ON_ERROR_STOP on

create temp table ids4 (k text primary key, val uuid, n int);
grant all on ids4 to anon, authenticated;
insert into ids4 values ('pipeline', '00000000-0000-0000-0000-0000000000b1', null);

-- A complete, valid Market Wave draft: the run starts 1 Nov 2021, the settings
-- end in 2030, and the test ends on the case study's date.
create or replace function pg_temp.fields(title text, net numeric default 111500.86) returns jsonb language sql as $$
  select jsonb_build_object(
    'asset', 'MSFT', 'asset_class', 'Equities', 'algorithm', 'Market Wave', 'strategy_type', 'Market Wave',
    'time_horizon', 'LTH', 'focus', 'Balanced', 'time_frame', '1 Week',
    'title', title, 'goal', 'Trades Microsoft on the weekly chart.', 'how_it_trades', 'Buys dips in slices.',
    'listed_public', true, 'as_of', '2026-08-11', 'starting_capital', 100000, 'net_profit_usd', net,
    'cash_profit_usd', 61212.2, 'asset_qty', 415, 'asset_unit', 'MSFT', 'buy_hold_pnl_pct', 49.66, 'dca_pnl_pct', 21.33,
    'benchmark_shown', 'both', 'test_start', '2021-11-01', 'test_end', '2026-08-11', 'test_end_source', 'chart_last_bar',
    'algorithm_inputs', '{
      "userInitialCapital": {"startingCash": 100000, "startingQty": 0},
      "longThreshold": {"enabled": true, "percent": -2}, "exitThreshold": {"enabled": true, "percent": 3.4},
      "tradeSize": {"percentEnabled": true, "entryPercent": 46.5, "exitPercent": 50},
      "marketWave": {"scope": 3, "sellBuffer": 6.8, "buyBuffer": 7.3, "onlySellAbove": true, "onlyBuyBelow": true},
      "dates": {"start": {"year": 2021, "month": 11, "day": 1, "hour": 0, "minute": 30}, "end": {"year": 2030, "month": 1, "day": 28}},
      "benchmark": {"showBuyHold": true, "showDca": true}}'::jsonb)
$$;

create or replace function pg_temp.shots(slug text, key text) returns jsonb language sql as $$
  select jsonb_build_array(
    jsonb_build_object('url', format('https://x.supabase.co/storage/v1/object/public/recipe-screenshots/case-studies/%s/%s/chart.png', slug, key), 'kind', 'chart', 'order', 0, 'sha256', 'aa'),
    jsonb_build_object('url', format('https://x.supabase.co/storage/v1/object/public/recipe-screenshots/case-studies/%s/%s/settings.png', slug, key), 'kind', 'settings', 'order', 1, 'sha256', 'bb'))
$$;

create temp table run4 (k text primary key, res jsonb);
grant all on run4 to authenticated;

-- 1. An editor cannot call the pipeline's publish.
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', false);
do $$ begin
  begin
    perform public.pipeline_publish('00000000-0000-0000-0000-000000000000', 'someone');
    raise exception 'an editor called pipeline_publish';
  exception when insufficient_privilege then null;
  end;
end $$;

select set_config('request.jwt.claim.sub', (select val::text from ids4 where k = 'pipeline'), false);

-- 2. A new strategy with no screenshots is held: no_screenshots is not on the list.
insert into run4 select 'a', public.pipeline_save_draft('aapl', 'new-scenario', 'c0ffee1234567890', 'ha', null, pg_temp.fields('Apple test strategy'));
insert into run4 select 'a_pub', public.pipeline_publish((select (res->>'version_id')::uuid from run4 where k = 'a'), 'Author');
do $$
declare r jsonb := (select res from run4 where k = 'a_pub');
begin
  if (r->>'published')::boolean or not (r->'blocking' @> '[{"code": "no_screenshots"}]') then
    raise exception 'a draft without screenshots: %', r;
  end if;
end $$;

-- 3. With screenshots it publishes, with the case study recorded as the approval.
select public.pipeline_attach_screenshots((select (res->>'version_id')::uuid from run4 where k = 'a'), pg_temp.shots('aapl', 'new-scenario'));
insert into run4 select 'a_pub2', public.pipeline_publish((select (res->>'version_id')::uuid from run4 where k = 'a'), 'Alex Author');
do $$
declare r jsonb := (select res from run4 where k = 'a_pub2');
begin
  if not (r->>'published')::boolean or (r->>'display_number') is null or not (r->>'parity_ok')::boolean then
    raise exception 'publish: %', r;
  end if;
  if not exists (select 1 from public.strategies_pro where display_number = (r->>'display_number')::int and title = 'Apple test strategy') then
    raise exception 'not on the Pro view';
  end if;
end $$;

-- 3b. Published, but the number has not reached the case study yet: the next
--     run saves onto the same strategy, never a second one (NO4).
insert into run4 select 'a_again', public.pipeline_save_draft('aapl', 'new-scenario', 'c0ffee9', 'ha2', null, pg_temp.fields('Apple test strategy'));
do $$
declare r jsonb := (select res from run4 where k = 'a_again');
begin
  if (r->>'created')::boolean or r->>'display_number' <> (select res->>'display_number' from run4 where k = 'a_pub2') then
    raise exception 'a published scenario became a second strategy: %', r;
  end if;
  if not (public.pipeline_scenario_state('aapl') @> jsonb_build_array(jsonb_build_object('scenario_key', 'new-scenario',
          'published_number', (select (res->>'display_number')::int from run4 where k = 'a_pub2')))) then
    raise exception 'state lacks the published number: %', public.pipeline_scenario_state('aapl');
  end if;
end $$;
select public.pipeline_attach_screenshots((select (res->>'version_id')::uuid from run4 where k = 'a_again'), pg_temp.shots('aapl', 'new-scenario'));
select (public.pipeline_publish((select (res->>'version_id')::uuid from run4 where k = 'a_again'), 'Alex Author'))->>'published' as republished;

-- 4. A review check on the list (the data window's P&L differs; the case
--    study's figure stands) is let through and recorded; one off the list holds.
reset role;
insert into store.extractions (id, created_by, provider, model, prompt_version, raw_output, parsed)
values ('00000000-0000-0000-0000-0000000000e1', 'pipeline@archpublic.com', 'anthropic', 'claude-sonnet-4-6', 't', '{}',
        '{"stats": {"totalPnl": 111000, "strategyRoiPercent": 111.0, "initialCashBalance": 100000}}'),
       ('00000000-0000-0000-0000-0000000000e2', 'pipeline@archpublic.com', 'anthropic', 'claude-sonnet-4-6', 't', '{}',
        '{"stats": {"totalPnl": 111500.86, "strategyRoiPercent": 120, "initialCashBalance": 100000, "realizedProfit": 61212.2, "unrealizedProfit": 50288.66}}');
set role authenticated;
select set_config('request.jwt.claim.sub', (select val::text from ids4 where k = 'pipeline'), false);
insert into run4 select 'b', public.pipeline_save_draft('aapl', 'second-scenario', 'c0ffee1234567890', 'hb', null,
  pg_temp.fields('Apple second test strategy') || '{"extraction_id": "00000000-0000-0000-0000-0000000000e1"}');
select public.pipeline_attach_screenshots((select (res->>'version_id')::uuid from run4 where k = 'b'), pg_temp.shots('aapl', 'second-scenario'));
insert into run4 select 'b_pub', public.pipeline_publish((select (res->>'version_id')::uuid from run4 where k = 'b'), 'Alex Author');
insert into run4 select 'c', public.pipeline_save_draft('aapl', 'third-scenario', 'c0ffee1234567890', 'hc', null,
  pg_temp.fields('Apple third test strategy') || '{"extraction_id": "00000000-0000-0000-0000-0000000000e2"}');
select public.pipeline_attach_screenshots((select (res->>'version_id')::uuid from run4 where k = 'c'), pg_temp.shots('aapl', 'third-scenario'));
insert into run4 select 'c_pub', public.pipeline_publish((select (res->>'version_id')::uuid from run4 where k = 'c'), 'Alex Author');
do $$
declare b jsonb := (select res from run4 where k = 'b_pub'); c jsonb := (select res from run4 where k = 'c_pub');
begin
  if not (b->>'published')::boolean or not (b->'acknowledged' ? 'net_profit_vs_extraction') then
    raise exception 'an acknowledgeable check held the strategy: %', b;
  end if;
  if (c->>'published')::boolean or not (c->'blocking' @> '[{"code": "roi_vs_pnl"}]') then
    raise exception 'a check off the list did not hold: %', c;
  end if;
end $$;

-- 5. The pipeline cannot publish a draft a person opened.
reset role;
insert into ids4 select 'manual', id, display_number from public.strategies_pro order by display_number limit 1;
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', false);
insert into run4 select 'm', to_jsonb(public.admin_save_draft((select val from ids4 where k = 'manual'), '{"goal": "Editor at work."}'));
select set_config('request.jwt.claim.sub', (select val::text from ids4 where k = 'pipeline'), false);
do $$ begin
  begin
    perform public.pipeline_publish((select (res #>> '{}')::uuid from run4 where k = 'm'), 'x');
    raise exception 'the pipeline published a person''s draft';
  exception when insufficient_privilege then null;
  end;
end $$;

-- 6. Links and baselines: the pipeline syncs the index; a baseline fills only
--    an empty hash; state shows the published version's hash.
insert into run4 select 'sync', public.pipeline_sync_case_study_refs(jsonb_build_object('studies', jsonb_build_array(
  jsonb_build_object('slug', 'aapl', 'title', 'Apple study', 'published', '2026-07-09', 'strategies', jsonb_build_array(
    jsonb_build_object('number', (select (res->>'display_number')::int from run4 where k = 'a_pub2'), 'key', 'new-scenario', 'anchor', 'scenario-1', 'scenario', 'The new one'),
    jsonb_build_object('number', (select (res->>'display_number')::int from run4 where k = 'b_pub'), 'key', 'second-scenario', 'anchor', 'scenario-2', 'scenario', 'The second'))))));
do $$
declare s jsonb; n int;
begin
  n := public.pipeline_record_baseline('aapl', '{"new-scenario": "base-a", "second-scenario": "base-b"}');
  if n <> 2 then raise exception 'baseline rows: %', n; end if;
  n := public.pipeline_record_baseline('aapl', '{"new-scenario": "other"}');
  if n <> 0 then raise exception 'a baseline overwrote a hash'; end if;
  s := public.pipeline_scenario_state('aapl');
  if not (s @> '[{"scenario_key": "new-scenario", "published_hash": "ha2", "ref_hash": "base-a"}]') then
    raise exception 'state: %', s;
  end if;
end $$;

-- 7. Screenshots of a strategy that originates in another case study stay.
reset role;
update store.case_study_refs set case_study_slug = 'other-study', role = 'origin'
 where case_study_slug = 'aapl' and scenario_key = 'second-scenario';
set role authenticated;
select set_config('request.jwt.claim.sub', (select val::text from ids4 where k = 'pipeline'), false);
insert into run4 select 'b2', public.pipeline_save_draft('aapl', 'second-scenario', 'c0ffee2', 'hb2',
  (select (res->>'display_number')::int from run4 where k = 'b_pub'), pg_temp.fields('Apple second test strategy'));
do $$ begin
  begin
    perform public.pipeline_attach_screenshots((select (res->>'version_id')::uuid from run4 where k = 'b2'), pg_temp.shots('aapl', 'second-scenario'));
    raise exception 'screenshots of a strategy from another case study were replaced';
  exception when object_in_use then null;
  end;
end $$;

-- 8. The approval names the case study, its commit and its author; parity holds.
reset role;
do $$ begin
  if (select approved_by from store.strategy_versions where id = (select (res->>'version_id')::uuid from run4 where k = 'a_pub2'))
     <> 'case study aapl at c0ffee123456, published by Alex Author' then
    raise exception 'approved_by: %', (select approved_by from store.strategy_versions where id = (select (res->>'version_id')::uuid from run4 where k = 'a_pub2'));
  end if;
  if not (public.run_parity_check('test')->>'ok')::boolean then
    raise exception 'parity: %', public.run_parity_check('test');
  end if;
end $$;
select set_config('request.jwt.claim.sub', '', false);
\echo ingest phase 4 db checks passed
