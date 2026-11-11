-- Phase 4 (public page redesign build PRD, 7.1 and 7.2): the chart goes public,
-- whole.
--
-- Alex, 2026-11-11: "we do not want to crop charts ever" (decision P1). This
-- reverses D9 of the parent PRD. The public view gains chart_url, the url of
-- the strategy's own chart screenshot as uploaded, settings line included.
--
--   chart_url    The first screenshot whose kind is 'chart', else the first by
--                display order (ties: the order the snapshot holds them),
--                else null. The same rule the admin crop tool used to pick its
--                source. Only that one screenshot reaches the public view; the
--                later screenshots of a strategy are its labelled settings
--                panels and stay in strategies_pro only.
--
-- A new column name on purpose: the parity function compares every view
-- column that shares a name with a column of store.strategy_versions, so a
-- computed public_chart_url would be reported as a mismatch. public_chart_url
-- and the strategy-public bucket stay in place, unused.
--
-- Also here:
--   - run_parity_check loses its public_image_uncropped test (the only change
--     to its body; every other test is kept).
--   - store.public_view_allowlist gains chart_url.
--   - store.site_content accepts the key market_tags (7.2): a label per
--     strategy slug, chosen by a person, kept out of the versioned record.
--
-- Additive: the old app keeps working. The old R8 check on main fails once a
-- screenshot address is in the public view, so merge the pull request that
-- carries the new check straight after applying this (PRD step 9).

-- ---------------------------------------------------------------------------
-- Views: one column added at the end of each (create or replace keeps grants).
-- The pick is inline, not a function: functions in a view run with the
-- querying role's EXECUTE rights, and anon has no access to schema store.
-- ---------------------------------------------------------------------------
create or replace view public.strategies_pro as
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
  v.screenshots, v.public_chart_url,
  (select e->>'url'
   from jsonb_array_elements(case when jsonb_typeof(v.screenshots) = 'array' then v.screenshots else '[]'::jsonb end)
        with ordinality as t(e, i)
   where coalesce(e->>'url', '') <> ''
   order by (e->>'kind' is distinct from 'chart'),
            case when (e->>'order') ~ '^-?[0-9]+$' then (e->>'order')::int end nulls last,
            i
   limit 1) as chart_url
from public.recipes r
join store.strategy_versions v on v.id = r.current_version_id and v.status = 'published';

-- Allowlist: a column added to the store never appears here by default (D7).
-- No settings and no source screenshots, except the one chart (P1).
create or replace view public.strategies_public as
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
  v.public_chart_url,
  (select e->>'url'
   from jsonb_array_elements(case when jsonb_typeof(v.screenshots) = 'array' then v.screenshots else '[]'::jsonb end)
        with ordinality as t(e, i)
   where coalesce(e->>'url', '') <> ''
   order by (e->>'kind' is distinct from 'chart'),
            case when (e->>'order') ~ '^-?[0-9]+$' then (e->>'order')::int end nulls last,
            i
   limit 1) as chart_url
from public.recipes r
join store.strategy_versions v on v.id = r.current_version_id and v.status = 'published'
where r.archived_at is null
  and v.listed_public;

comment on view public.strategies_public is
  'Strategy Lab: allowlisted columns of published, listed strategies. Never settings; the one chart screenshot as chart_url (PRD D6, D7; redesign P1).';

-- ---------------------------------------------------------------------------
-- Parity (R5, D8): chart_url is allowed; the uncropped-image test is removed.
-- ---------------------------------------------------------------------------
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
    'public_chart_url', 'chart_url']
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
  -- Inside a definer function current_user is the owner, so ask who called:
  -- an admin, the service role, or a direct database session (pg_cron, SQL
  -- editor). API calls arrive as the authenticator session.
  if not (public.is_admin()
          or coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb->>'role',
                      current_setting('request.jwt.claim.role', true), '') = 'service_role'
          or session_user::text <> 'authenticator') then
    raise exception 'Admin access required.' using errcode = '42501';
  end if;

  -- 1. The public view exposes only allowlisted columns (D7).
  select array_agg(column_name::text order by column_name) into extra
  from information_schema.columns
  where table_schema = 'public' and table_name = 'strategies_public'
    and not (column_name::text = any (store.public_view_allowlist()));
  if extra is not null then
    problems := problems || jsonb_build_object('check', 'public_columns', 'detail', extra);
  end if;

  -- 2. Every current pointer names a published version of that strategy.
  for rec in
    select r.id, r.display_number, v.status, v.strategy_id
    from public.recipes r left join store.strategy_versions v on v.id = r.current_version_id
    where r.current_version_id is not null and (v.status is distinct from 'published' or v.strategy_id <> r.id)
  loop
    problems := problems || jsonb_build_object('check', 'current_not_published', 'strategy', rec.display_number);
  end loop;

  -- 3. Missing, extra or wrong-version rows in each view.
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

  -- 4. Every value in each view equals the store, field by field.
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
  end loop;

  -- 5. Grants: anon cannot read the store, can read the public view (D6, R8).
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

revoke all on function public.run_parity_check(text) from public, anon;
grant execute on function public.run_parity_check(text) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Site content: the market_tags key (7.2).
-- ---------------------------------------------------------------------------
alter table store.site_content drop constraint if exists site_content_key_check;
alter table store.site_content add constraint site_content_key_check
  check (key ~ '^(home|config|booking|market_tags|partner:[a-z0-9][a-z0-9-]{0,62})$');

select public.run_parity_check('migration');
