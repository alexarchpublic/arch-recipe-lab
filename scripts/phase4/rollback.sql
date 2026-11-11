-- Roll back migration 20261114000001_public_charts (redesign PRD section 10).
-- Use together with reverting the Phase 4 merge, so the app that reads
-- chart_url is gone before the column is. Restores the Phase 1 definitions of
-- both views, the allowlist, run_parity_check (with its public_image_uncropped
-- test) and the site_content key check. Removes any market_tags row first,
-- since the old key check refuses it.
begin;

delete from store.site_content where key = 'market_tags';
alter table store.site_content drop constraint if exists site_content_key_check;
alter table store.site_content add constraint site_content_key_check
  check (key ~ '^(home|config|booking|partner:[a-z0-9][a-z0-9-]{0,62})$');

-- A column cannot be dropped by create or replace, so the views are rebuilt.
drop view public.strategies_public;
drop view public.strategies_pro;

create view public.strategies_pro as
select
  r.id,
  r.display_number,
  r.created_at                as strategy_created_at,
  r.archived_at,
  v.id                        as version_id,
  v.version_number,
  v.change_type,
  v.change_note,
  v.published_at,
  v.slug, v.title, v.short_name, v.name, v.asset, v.asset_class, v.algorithm, v.strategy_type,
  v.time_horizon, v.focus, v.time_frame,
  v.goal, v.best_for, v.how_it_trades, v.up_market_behavior, v.down_market_behavior,
  v.basis, v.starting_capital, v.test_start, v.test_end, v.fees_slippage, v.data_source, v.as_of,
  v.net_profit_usd, v.cash_profit_usd, v.asset_qty, v.asset_unit,
  v.buy_hold_pnl_pct, v.dca_pnl_pct, v.max_drawdown_pct, v.benchmark_shown,
  v.ending_value_usd, v.return_pct, v.test_years, v.cagr_pct, v.vs_buy_hold_pct, v.vs_dca_pct,
  v.algorithm_inputs, v.entry_trade, v.exit_trade, v.sell_above_cost_basis, v.exit_to_entry_proportion,
  v.screenshots, v.public_chart_url
from public.recipes r
join store.strategy_versions v on v.id = r.current_version_id and v.status = 'published';

comment on view public.strategies_pro is
  'Strategy Lab Pro: the published version of every strategy, settings included. Readable without sign-in until the login move (PRD D6).';

create view public.strategies_public as
select
  r.id,
  r.display_number,
  v.id                        as version_id,
  v.version_number,
  v.slug, v.title, v.short_name, v.asset, v.asset_class, v.algorithm, v.strategy_type,
  v.time_horizon, v.focus, v.time_frame,
  v.goal, v.best_for, v.how_it_trades, v.up_market_behavior, v.down_market_behavior,
  v.basis, v.starting_capital, v.test_start, v.test_end, v.fees_slippage, v.data_source, v.as_of,
  v.net_profit_usd, v.cash_profit_usd, v.asset_qty, v.asset_unit,
  v.buy_hold_pnl_pct, v.dca_pnl_pct, v.max_drawdown_pct, v.benchmark_shown,
  v.ending_value_usd, v.return_pct, v.test_years, v.cagr_pct, v.vs_buy_hold_pct, v.vs_dca_pct,
  v.public_chart_url
from public.recipes r
join store.strategy_versions v on v.id = r.current_version_id and v.status = 'published'
where r.archived_at is null
  and v.listed_public;

comment on view public.strategies_public is
  'Strategy Lab: allowlisted columns of published, listed strategies. Never settings (PRD D6, D7).';

revoke all on public.strategies_pro, public.strategies_public from public, anon, authenticated;
grant select on public.strategies_public to anon, authenticated, service_role;
grant select on public.strategies_pro to anon, authenticated, service_role;

create or replace function store.public_view_allowlist()
returns text[] language sql immutable
set search_path = pg_catalog
as $$
  select array['id', 'display_number', 'version_id', 'version_number', 'slug', 'title', 'short_name', 'asset',
    'asset_class', 'algorithm', 'strategy_type', 'time_horizon', 'focus', 'time_frame', 'goal', 'best_for',
    'how_it_trades', 'up_market_behavior', 'down_market_behavior', 'basis', 'starting_capital', 'test_start',
    'test_end', 'fees_slippage', 'data_source', 'as_of', 'net_profit_usd', 'cash_profit_usd', 'asset_qty',
    'asset_unit', 'buy_hold_pnl_pct', 'dca_pnl_pct', 'max_drawdown_pct', 'benchmark_shown',
    'ending_value_usd', 'return_pct', 'test_years', 'cagr_pct', 'vs_buy_hold_pct', 'vs_dca_pct',
    'public_chart_url']
$$;

create or replace function public.run_parity_check(p_trigger text default 'manual')
returns jsonb
language plpgsql
security definer
set search_path = public, store, auth
as $$
declare
  problems jsonb := '[]'::jsonb;
  counts jsonb;
  extra text[];
  rec record;
  ok boolean;
  vj jsonb;
  pj jsonb;
  k text;
begin
  if not (public.is_admin()
          or coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb->>'role',
                      current_setting('request.jwt.claim.role', true), '') = 'service_role'
          or session_user::text <> 'authenticator') then
    raise exception 'Admin access required.' using errcode = '42501';
  end if;
  select array_agg(column_name::text order by column_name) into extra
  from information_schema.columns
  where table_schema = 'public' and table_name = 'strategies_public'
    and not (column_name::text = any (store.public_view_allowlist()));
  if extra is not null then
    problems := problems || jsonb_build_object('check', 'public_columns', 'detail', extra);
  end if;
  for rec in
    select r.id, r.display_number, v.status, v.strategy_id
    from public.recipes r left join store.strategy_versions v on v.id = r.current_version_id
    where r.current_version_id is not null and (v.status is distinct from 'published' or v.strategy_id <> r.id)
  loop
    problems := problems || jsonb_build_object('check', 'current_not_published', 'strategy', rec.display_number);
  end loop;
  for rec in
    select v.strategy_id, r.display_number, v.id as version_id, r.archived_at, v.listed_public,
           (select count(*) from public.strategies_pro p where p.id = v.strategy_id) as in_pro,
           (select count(*) from public.strategies_pro p where p.id = v.strategy_id and p.version_id = v.id) as pro_version_ok,
           (select count(*) from public.strategies_public p where p.id = v.strategy_id) as in_public,
           (select count(*) from public.strategies_public p where p.id = v.strategy_id and p.version_id = v.id) as public_version_ok
    from store.strategy_versions v join public.recipes r on r.id = v.strategy_id
    where v.status = 'published'
  loop
    if rec.in_pro <> 1 or rec.pro_version_ok <> 1 then
      problems := problems || jsonb_build_object('check', 'pro_row', 'strategy', rec.display_number, 'rows', rec.in_pro);
    end if;
    if rec.archived_at is null and rec.listed_public and (rec.in_public <> 1 or rec.public_version_ok <> 1) then
      problems := problems || jsonb_build_object('check', 'public_row', 'strategy', rec.display_number, 'rows', rec.in_public);
    end if;
    if (rec.archived_at is not null or not rec.listed_public) and rec.in_public > 0 then
      problems := problems || jsonb_build_object('check', 'public_row_should_be_hidden', 'strategy', rec.display_number);
    end if;
  end loop;
  for rec in
    select p.display_number from public.strategies_pro p
    where not exists (select 1 from store.strategy_versions v where v.id = p.version_id and v.status = 'published')
  loop
    problems := problems || jsonb_build_object('check', 'pro_row_not_published', 'strategy', rec.display_number);
  end loop;
  for rec in select p.*, to_jsonb(p) as j from public.strategies_pro p loop
    select to_jsonb(v) into vj from store.strategy_versions v where v.id = rec.version_id;
    for k in select jsonb_object_keys(rec.j) loop
      if vj ? k and k not in ('id') and rec.j->k is distinct from vj->k then
        problems := problems || jsonb_build_object('check', 'pro_value', 'strategy', rec.display_number, 'field', k);
      end if;
    end loop;
  end loop;
  for rec in select p.*, to_jsonb(p) as j from public.strategies_public p loop
    select to_jsonb(v) into vj from store.strategy_versions v where v.id = rec.version_id;
    for k in select jsonb_object_keys(rec.j) loop
      if vj ? k and k not in ('id') and rec.j->k is distinct from vj->k then
        problems := problems || jsonb_build_object('check', 'public_value', 'strategy', rec.display_number, 'field', k);
      end if;
    end loop;
    if coalesce(rec.public_chart_url, '') like '%/recipe-screenshots/%' then
      problems := problems || jsonb_build_object('check', 'public_image_uncropped', 'strategy', rec.display_number);
    end if;
  end loop;
  if has_schema_privilege('anon', 'store', 'usage') then
    problems := problems || jsonb_build_object('check', 'anon_store_usage');
  end if;
  if not has_table_privilege('anon', 'public.strategies_public', 'select') then
    problems := problems || jsonb_build_object('check', 'anon_public_view_closed');
  end if;
  if has_table_privilege('anon', 'public.admin_strategy_versions', 'select') then
    problems := problems || jsonb_build_object('check', 'anon_admin_view_open');
  end if;
  select jsonb_build_object(
    'strategies', (select count(*) from public.recipes),
    'with_published_version', (select count(*) from public.recipes where current_version_id is not null),
    'pro_rows', (select count(*) from public.strategies_pro),
    'public_rows', (select count(*) from public.strategies_public),
    'base_tables_open_to_anon', has_table_privilege('anon', 'public.recipes', 'select')
  ) into counts;
  ok := jsonb_array_length(problems) = 0;
  insert into store.parity_runs (trigger, ok, counts, problems) values (p_trigger, ok, counts, problems);
  return jsonb_build_object('ok', ok, 'counts', counts, 'problems', problems);
end;
$$;

select public.run_parity_check('rollback');
commit;
