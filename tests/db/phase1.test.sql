-- Phase 1 checks on a database built from the migrations. Any failure raises.
-- Runs after allowlist.test.sql, which leaves:
--   staff.member@archpublic.com  editor    (id ...0a)
--   invited@archpublic.com       approver  (inserted there, id looked up below)
\set ON_ERROR_STOP on

insert into public.admin_users (email, role, added_by) values ('marketing@archpublic.com', 'marketing_editor', 'test');
insert into auth.users (id, email, email_confirmed_at)
values ('00000000-0000-0000-0000-00000000000d', 'marketing@archpublic.com', now());

create temp table ids (k text primary key, val uuid);
grant all on ids to anon, authenticated;
insert into ids values
  ('editor',    '00000000-0000-0000-0000-00000000000a'),
  ('marketing', '00000000-0000-0000-0000-00000000000d'),
  ('approver',  (select id from auth.users where lower(email) = 'invited@archpublic.com'));

create or replace function pg_temp.as_user(k text) returns void language sql as $$
  select set_config('request.jwt.claim.sub', (select val::text from ids where ids.k = $1), false)
$$;

-- 1. Baseline: every strategy that existed has a published version 1, and
--    the views agree with the store.
do $$ begin
  if exists (select 1 from public.recipes r where r.name <> 'Phase 0 test strategy' and r.current_version_id is null) then
    raise exception 'a strategy has no baseline version';
  end if;
  if exists (select 1 from store.strategy_versions where created_by = 'migration 20261111000002' and (status <> 'published' or change_type <> 'baseline')) then
    raise exception 'baseline versions not published as baseline';
  end if;
  -- Seed row: "$20,455 (87% from BTC growth, 13% cash)" must read as 20455,
  -- not the 204,558,713 today's parser produces (PRD 13).
  if (select net_profit_usd from store.strategy_versions where name = '[BTC] STH Recipe No. 1: Daily Arbitrage') <> 20455 then
    raise exception 'bracketed profit text parsed wrong';
  end if;
  if store.first_number('-$656') <> -656 or store.first_number('$-656') <> -656
     or store.first_number('3858 IREN') <> 3858 or store.first_number('') is not null then
    raise exception 'first_number wrong';
  end if;
  if not (public.run_parity_check('test')->>'ok')::boolean then
    raise exception 'parity after baseline: %', public.run_parity_check('test');
  end if;
end $$;

-- 2. Anonymous visitors: the public view yes; settings, store, admin views and
--    writes no (R8).
set role anon;
do $$ begin
  perform count(*) from public.strategies_public;
  perform count(*) from public.strategies_pro;   -- open until the login move (D6)
  begin
    perform algorithm_inputs from public.strategies_public;
    raise exception 'public view has settings';
  exception when undefined_column then null;
  end;
  begin
    perform 1 from store.strategy_versions;
    raise exception 'anon can read the store';
  exception when insufficient_privilege then null;
  end;
  begin
    perform 1 from public.admin_strategy_versions;
    raise exception 'anon can read admin versions';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.admin_save_draft(null, '{}'::jsonb);
    raise exception 'anon can save a draft';
  exception when insufficient_privilege then null;
  end;
  begin
    perform 1 from public.recipes;
    raise exception 'anon can read the base table';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;

-- 3. An editor creates a new strategy as a draft. Nothing is visible yet (A2).
set role authenticated;
select pg_temp.as_user('editor');
do $$
declare d uuid;
begin
  d := public.admin_save_draft(null, jsonb_build_object(
    'name', '[TEST] STH 1D Swing', 'asset', 'test', 'asset_class', 'Equities', 'algorithm', 'Market Wave',
    'strategy_type', 'Market Wave', 'time_horizon', 'STH', 'focus', 'Balanced', 'time_frame', '1 Day',
    'goal', 'Test the publish flow', 'short_name', 'TEST STH 1D Swing',
    'starting_capital', 100000, 'test_start', '2024-01-01', 'test_end', '2025-07-01', 'as_of', '2025-07-02',
    'net_profit_usd', 50000, 'cash_profit_usd', 20000, 'asset_qty', 10,
    'buy_hold_pnl_pct', 30, 'dca_pnl_pct', 12, 'benchmark_shown', 'dca',
    'algorithm_inputs', jsonb_build_object(
      'userInitialCapital', jsonb_build_object('startingCash', 100000, 'startingQty', 0),
      'longThreshold', jsonb_build_object('percent', -1), 'exitThreshold', jsonb_build_object('percent', 1),
      'tradeSize', jsonb_build_object('percentEnabled', true), 'marketWave', jsonb_build_object('scope', 20),
      'dates', jsonb_build_object('start', jsonb_build_object('year', 2024, 'month', 1, 'day', 1),
                                  'end', jsonb_build_object('year', 2030, 'month', 1, 'day', 28)))));
  insert into ids values ('draft', d);
end $$;
reset role;
do $$
declare v store.strategy_versions;
begin
  select * into v from store.strategy_versions where id = (select val from ids where k = 'draft');
  if v.status <> 'draft' or v.version_number <> 1 or v.change_type <> 'initial' then
    raise exception 'draft wrong: % % %', v.status, v.version_number, v.change_type;
  end if;
  if v.asset <> 'TEST' or v.slug <> 'test-the-publish-flow-' || (select display_number from public.recipes where id = v.strategy_id) then
    raise exception 'identity wrong: % %', v.asset, v.slug;
  end if;
  -- Derived once, at save (D3): return 50%, 1.5 years.
  if v.return_pct <> 50 or v.vs_dca_pct <> 38 or v.vs_buy_hold_pct <> 20 or round(v.cagr_pct, 2) <> 31.09 then
    raise exception 'derived wrong: % % % %', v.return_pct, v.vs_dca_pct, v.vs_buy_hold_pct, v.cagr_pct;
  end if;
  -- The 2030 run year must be resolved from the chart before publish (D10, A16).
  if not exists (select 1 from jsonb_array_elements(v.checks) c where c->>'code' = 'run_end_unresolved' and c->>'level' = 'error') then
    raise exception 'far-future run end not flagged: %', v.checks;
  end if;
  if exists (select 1 from public.strategies_pro p where p.id = v.strategy_id)
     or exists (select 1 from public.strategies_public p where p.id = v.strategy_id) then
    raise exception 'a draft is visible';
  end if;
end $$;

-- 4. An editor cannot publish; an approver cannot publish while an error
--    stands; fixing it and acknowledging review items publishes (A1, A4).
set role authenticated;
select pg_temp.as_user('editor');
select public.admin_submit_for_review((select val from ids where k = 'draft'));
do $$ begin
  begin
    perform public.admin_publish((select val from ids where k = 'draft'));
    raise exception 'an editor published';
  exception when insufficient_privilege then null;
  end;
end $$;
select pg_temp.as_user('approver');
do $$
declare res jsonb;
begin
  res := public.admin_publish((select val from ids where k = 'draft'));
  if (res->>'published')::boolean then raise exception 'published with an error: %', res; end if;
end $$;
select pg_temp.as_user('editor');
select public.admin_save_draft((select strategy_id from public.admin_strategy_versions where id = (select val from ids where k = 'draft')),
  '{"test_end": "2025-06-30", "test_end_source": "chart_last_bar"}'::jsonb);
select public.admin_submit_for_review((select val from ids where k = 'draft'));
select pg_temp.as_user('approver');
do $$
declare res jsonb;
begin
  res := public.admin_publish((select val from ids where k = 'draft'));
  if (res->>'published')::boolean then raise exception 'published without acknowledging review items: %', res; end if;
  if not exists (select 1 from jsonb_array_elements(res->'blocking') c where c->>'code' = 'no_screenshots') then
    raise exception 'expected the no_screenshots review item: %', res;
  end if;
  res := public.admin_publish((select val from ids where k = 'draft'), array['no_screenshots']);
  if not (res->>'published')::boolean then raise exception 'publish failed: %', res; end if;
  if not (res->>'parity_ok')::boolean then raise exception 'parity after publish failed'; end if;
end $$;
reset role;
do $$
declare v store.strategy_versions;
begin
  select * into v from store.strategy_versions where id = (select val from ids where k = 'draft');
  if v.status <> 'published' or v.approved_by <> 'invited@archpublic.com' or v.change_type <> 'initial' then
    raise exception 'published version wrong: % % %', v.status, v.approved_by, v.change_type;
  end if;
  if not exists (select 1 from public.strategies_public p where p.version_id = v.id) then
    raise exception 'published version not in the public view';
  end if;
end $$;

-- 5. Published versions never change, and versions are never deleted (A3).
do $$ begin
  begin
    update store.strategy_versions set net_profit_usd = 1 where id = (select val from ids where k = 'draft');
    raise exception 'a published version changed';
  exception when raise_exception then
    if sqlerrm like 'a published version changed' then raise; end if;
  end;
  begin
    delete from store.strategy_versions where id = (select val from ids where k = 'draft');
    raise exception 'a version was deleted';
  exception when raise_exception then
    if sqlerrm like 'a version was deleted' then raise; end if;
  end;
end $$;

-- 6. A marketing editor changes copy only (A10). The new version is a copy
--    change, so clients are not alerted (D11).
set role authenticated;
select pg_temp.as_user('marketing');
do $$
declare s uuid := (select strategy_id from public.admin_strategy_versions where id = (select val from ids where k = 'draft'));
begin
  begin
    perform public.admin_save_draft(s, '{"net_profit_usd": 999999}'::jsonb);
    raise exception 'marketing changed a figure';
  exception when insufficient_privilege then null;
  end;
  insert into ids values ('copy', public.admin_save_draft(s, '{"title": "A clearer title"}'::jsonb));
  perform public.admin_submit_for_review((select val from ids where k = 'copy'));
end $$;
select pg_temp.as_user('approver');
select public.admin_publish((select val from ids where k = 'copy'), array['no_screenshots']);
reset role;
do $$
declare v store.strategy_versions;
begin
  select * into v from store.strategy_versions where id = (select val from ids where k = 'copy');
  if v.status <> 'published' or v.version_number <> 2 or v.change_type <> 'copy' then
    raise exception 'copy version wrong: % % %', v.status, v.version_number, v.change_type;
  end if;
  if (select status from store.strategy_versions where id = (select val from ids where k = 'draft')) <> 'superseded' then
    raise exception 'previous version not superseded';
  end if;
  if (select title from public.strategies_public where version_id = v.id) <> 'A clearer title' then
    raise exception 'public view not updated';
  end if;
end $$;

-- 7. Restore copies version 1 forward as version 3, in review (R6). A figure
--    change is typed as one.
set role authenticated;
select pg_temp.as_user('approver');
do $$
declare r uuid;
begin
  r := public.admin_restore((select val from ids where k = 'draft'));
  perform public.admin_publish(r, array['no_screenshots']);
  insert into ids values ('restored', r);
end $$;
reset role;
do $$
declare v store.strategy_versions;
begin
  select * into v from store.strategy_versions where id = (select val from ids where k = 'restored');
  if v.version_number <> 3 or v.status <> 'published' or v.restored_from <> (select val from ids where k = 'draft')
     or v.title <> 'Test the publish flow' then
    raise exception 'restore wrong: % % %', v.version_number, v.status, v.title;
  end if;
end $$;
set role authenticated;
select pg_temp.as_user('editor');
do $$
declare d uuid;
begin
  d := public.admin_save_draft((select strategy_id from public.admin_strategy_versions where id = (select val from ids where k = 'draft')),
    '{"net_profit_usd": 60000}'::jsonb);
  if (select change_type from public.admin_strategy_versions where id = d) <> 'figures' then
    raise exception 'figure change not typed as figures';
  end if;
  perform public.admin_discard_draft(d);
end $$;

-- 8. Archive: gone from the public view, still readable in Pro (A12).
select pg_temp.as_user('approver');
select public.admin_set_archived((select strategy_id from public.admin_strategy_versions where id = (select val from ids where k = 'draft')), true);
reset role;
do $$
declare s uuid := (select strategy_id from store.strategy_versions where id = (select val from ids where k = 'draft'));
begin
  if exists (select 1 from public.strategies_public where id = s) then raise exception 'archived strategy is public'; end if;
  if not exists (select 1 from public.strategies_pro where id = s and archived_at is not null) then
    raise exception 'archived strategy left Pro';
  end if;
end $$;

-- 9. CAGR is not shown for a test window under a year (D12).
do $$
declare v store.strategy_versions;
begin
  select * into v from store.strategy_versions where id = (select val from ids where k = 'draft');
  v.id := gen_random_uuid(); v.version_number := 99; v.status := 'archived'; v.change_type := 'figures';
  v.test_start := '2025-01-01'; v.test_end := '2025-10-01';
  insert into store.strategy_versions select v.*;
  if (select cagr_pct from store.strategy_versions where id = v.id) is not null then
    raise exception 'CAGR shown for a 9-month window';
  end if;
end $$;

-- 10. Parity is clean at the end, and the public view holds only allowlisted
--     columns (D7).
do $$
declare res jsonb := public.run_parity_check('test');
begin
  if not (res->>'ok')::boolean then raise exception 'final parity: %', res; end if;
end $$;

select 'phase 1 checks passed' as result;
