-- Phase 1: version 1 of every strategy is a copy of what Recipe Lab shows
-- today, published as the baseline.
--
-- Nothing is corrected here. The clean-up in PRD section 13 (real end dates,
-- CAGR from the real window, titles, slugs) arrives as version 2 drafts that
-- the owner reviews and publishes in the admin console. Keeping version 1
-- faithful means switching the app to the view changes nothing a client sees,
-- and the history shows exactly what each clean-up changed.
--
-- Values are read the way Recipe Lab reads them today:
--   dates            from the settings (dates.start/end, or start/end for
--                    Intelligence Algorithm), including far-future run years
--   net profit, qty  first number in the free-text field
--   benchmarks       Market Wave only; shown when the settings flag says so
--                    and a value exists (src/utils/recipeMetrics.ts)
-- The checks on each version record what still needs attention.

with src as (
  select
    r.*,
    store.run_start(r.algorithm, r.algorithm_inputs) as run_start,
    store.run_end(r.algorithm, r.algorithm_inputs)   as run_end,
    case when r.algorithm = 'Market Wave' then coalesce(
      r.buy_hold_pnl_percent,
      case when (r.algorithm_inputs->>'buyHoldPnlPercent') ~ '^-?[0-9]+(\.[0-9]+)?$' then (r.algorithm_inputs->>'buyHoldPnlPercent')::numeric end,
      case when (r.algorithm_inputs->'benchmark'->>'buyHoldPnlPercent') ~ '^-?[0-9]+(\.[0-9]+)?$' then (r.algorithm_inputs->'benchmark'->>'buyHoldPnlPercent')::numeric end
    ) end as bh,
    case when r.algorithm = 'Market Wave' then coalesce(
      r.dca_pnl_percent,
      case when (r.algorithm_inputs->>'dcaPnlPercent') ~ '^-?[0-9]+(\.[0-9]+)?$' then (r.algorithm_inputs->>'dcaPnlPercent')::numeric end,
      case when (r.algorithm_inputs->'benchmark'->>'dcaPnlPercent') ~ '^-?[0-9]+(\.[0-9]+)?$' then (r.algorithm_inputs->'benchmark'->>'dcaPnlPercent')::numeric end
    ) end as dca,
    r.algorithm = 'Market Wave'
      and not (coalesce(r.algorithm_inputs->'benchmark'->>'showBuyHold', '') = 'false'
               or coalesce(r.algorithm_inputs->>'showBuyHoldBenchmark', '') = 'false') as show_bh,
    r.algorithm = 'Market Wave'
      and (coalesce(r.algorithm_inputs->'benchmark'->>'showDca', '') = 'true'
           or coalesce(r.algorithm_inputs->>'showDcaBenchmark', '') = 'true') as show_dca
  from public.recipes r
  where not exists (select 1 from store.strategy_versions v where v.strategy_id = r.id)
),
inserted as (
  insert into store.strategy_versions (
    strategy_id, version_number, status, change_type, change_note,
    slug, title, short_name, name, asset, asset_class, algorithm, strategy_type, time_horizon, focus,
    time_frame, listed_public, goal, best_for,
    basis, starting_capital, test_start, test_end, test_end_source, data_source, as_of,
    net_profit_usd, cash_profit_usd, asset_qty, asset_unit, buy_hold_pnl_pct, dca_pnl_pct, benchmark_shown,
    net_profit_text, asset_accumulated_text, backtesting_period_text, legacy_cagr, annualized_return,
    entry_trade, exit_trade, sell_above_cost_basis, exit_to_entry_proportion,
    algorithm_inputs, screenshots,
    created_by, created_at, approved_by, published_at)
  select
    s.id, 1, 'published', 'baseline',
    'Baseline: what Recipe Lab showed before Phase 1, copied unchanged.',
    store.slugify(regexp_replace(s.name, '^\s*\[([^]]+)\]\s*', '\1 ')) || '-' || s.display_number,
    trim(s.goal),
    trim(regexp_replace(s.name, '^\s*\[([^]]+)\]\s*', '\1 ')),
    s.name, s.asset, s.asset_class, s.algorithm, s.strategy_type, s.time_horizon, s.focus,
    s.time_frame,
    -- Legacy (Oracle Protocol) and older crypto (Arbitrage) strategies stay
    -- off the public list until the owner decides (PRD 14, open question).
    s.algorithm not in ('Oracle Protocol', 'Arbitrage Algorithm'),
    s.goal, s.best_for,
    'backtested', coalesce(s.initial_capital, 100000),
    coalesce(s.run_start, s.created_at::date),
    coalesce(s.run_end, s.updated_at::date),
    'settings', 'TradingView backtest', s.updated_at::date,
    coalesce(store.first_number(s.net_profit), 0), s.cash_profit,
    store.first_number(s.asset_accumulated), s.asset,
    s.bh, s.dca,
    case
      when s.show_bh and s.bh is not null and s.show_dca and s.dca is not null then 'both'
      when s.show_bh and s.bh is not null then 'buy_hold'
      when s.show_dca and s.dca is not null then 'dca'
      else 'none'
    end,
    s.net_profit, s.asset_accumulated, s.backtesting_period, s.cagr, s.annualized_return,
    s.entry_trade, s.exit_trade, s.sell_above_cost_basis, s.exit_to_entry_proportion,
    s.algorithm_inputs, store.screenshot_snapshot(s.id),
    'migration 20261111000002', now(), 'baseline import: copies what was live', now()
  from src s
  returning id, strategy_id, slug
)
update public.recipes r
   set current_version_id = i.id, slug = i.slug
  from inserted i
 where r.id = i.strategy_id;

select public.run_parity_check('migration');
