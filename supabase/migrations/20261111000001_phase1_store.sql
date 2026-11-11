-- Phase 1 (PRD sections 6 to 8): one store, versions, two views.
--
-- Additive only. Nothing the live app reads changes here: public.recipes and
-- public.recipe_screenshots keep their columns, policies and grants until the
-- app reads through public.strategies_pro (20261111000004 closes them).
--
-- What this adds
--   store schema            not exposed by the API; anon and authenticated
--                           have no privileges on it
--   store.strategy_versions immutable snapshot of every field (PRD 7 Entities)
--   store.extractions       provenance per screenshot ingestion (A5)
--   store.parity_runs       results of the parity check (R5, D8)
--   public.strategies_pro   everything a client needs, published only (D6)
--   public.strategies_public allowlisted columns, never settings (D6, D7)
--   public.admin_*          admin-only reads, filtered by public.is_admin()
--   public.admin_* RPCs     the only way to write a version (A2, A3)
--
-- The boundary is the view definitions and the grants (PRD 6, "Read access"):
-- the views run with their owner's rights, so they can read store tables that
-- anon cannot. tests/db/phase1.test.sql and scripts/r8-anon-check.mjs test it
-- from outside.

create schema if not exists store;
revoke all on schema store from public;
grant usage on schema store to service_role;

-- ---------------------------------------------------------------------------
-- Strategy identity: the existing recipes row gains a slug and a pointer to
-- its current published version (PRD 7 Entities, "Strategy").
-- ---------------------------------------------------------------------------
alter table public.recipes
  add column if not exists slug text,
  add column if not exists current_version_id uuid;

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'recipes_slug_key') then
    alter table public.recipes add constraint recipes_slug_key unique (slug);
  end if;
end $$;

-- Source assets (PRD 7): screenshots by kind with a content hash.
alter table public.recipe_screenshots
  add column if not exists kind text check (kind in ('chart', 'settings', 'stats', 'dca', 'other')),
  add column if not exists sha256 text;

-- ---------------------------------------------------------------------------
-- Extractions (A5): one row per screenshot ingestion.
-- ---------------------------------------------------------------------------
create table if not exists store.extractions (
  id             uuid primary key default gen_random_uuid(),
  created_at     timestamptz not null default now(),
  created_by     text not null,
  strategy_id    uuid references public.recipes(id) on delete set null,
  provider       text not null,
  model          text not null,
  prompt_version text not null,
  images         jsonb not null default '[]'::jsonb,  -- [{filename, kind, sha256, bytes}]
  raw_output     text not null,
  parsed         jsonb,                                -- the model's JSON, as returned
  warnings       jsonb not null default '[]'::jsonb,   -- strings
  cross_check    jsonb not null default '[]'::jsonb,   -- chart header vs settings panel (A9)
  schema_errors  jsonb not null default '[]'::jsonb,   -- model output vs schema (A4)
  last_bar_date  date                                  -- read from the chart when the run end is in the future (A16)
);
alter table store.extractions enable row level security;

-- ---------------------------------------------------------------------------
-- Strategy versions.
-- ---------------------------------------------------------------------------
create table if not exists store.strategy_versions (
  id                     uuid primary key default gen_random_uuid(),
  strategy_id            uuid not null references public.recipes(id) on delete restrict,
  version_number         integer not null,
  status                 text not null default 'draft'
                           check (status in ('draft', 'in_review', 'published', 'superseded', 'archived')),
  change_type            text not null default 'initial'
                           check (change_type in ('baseline', 'initial', 'figures', 'settings', 'copy')),
  change_note            text,
  restored_from          uuid references store.strategy_versions(id),
  extraction_id          uuid references store.extractions(id),

  -- Identity
  slug                   text not null check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  title                  text not null check (length(trim(title)) > 0),
  short_name             text not null check (length(trim(short_name)) > 0),
  name                   text not null,
  asset                  text not null,
  asset_class            text not null check (asset_class in ('Equities', 'ETFs', 'Crypto')),
  algorithm              text not null
                           check (algorithm in ('Intelligence Algorithm', 'Arbitrage Algorithm', 'Oracle Protocol', 'Market Wave')),
  strategy_type          text not null,
  time_horizon           text not null check (time_horizon in ('STH', 'LTH')),
  focus                  text not null check (focus in ('Cash Yielding', 'Balanced', 'Accumulation')),
  time_frame             text,
  listed_public          boolean not null default true,

  -- Narrative
  goal                   text not null,
  best_for               text,
  how_it_trades          text,
  up_market_behavior     text,
  down_market_behavior   text,

  -- Assumptions (C3, D5, D10)
  basis                  text not null default 'backtested' check (basis in ('backtested', 'live')),
  starting_capital       numeric not null check (starting_capital > 0),
  test_start             date not null,
  test_end               date not null,
  test_end_source        text not null default 'settings' check (test_end_source in ('settings', 'chart_last_bar')),
  fees_slippage          text,
  data_source            text not null default 'TradingView backtest',
  as_of                  date not null default current_date,

  -- Results as numbers (D1)
  net_profit_usd         numeric not null,
  cash_profit_usd        numeric,
  asset_qty              numeric,
  asset_unit             text,
  buy_hold_pnl_pct       numeric,
  dca_pnl_pct            numeric,
  max_drawdown_pct       numeric,                                  -- D4, optional
  benchmark_shown        text not null default 'none'
                           check (benchmark_shown in ('buy_hold', 'dca', 'both', 'none')),

  -- Derived once, here, at save (D3, D12). Written by the trigger only.
  ending_value_usd       numeric,
  return_pct             numeric,
  test_years             numeric,
  cagr_pct               numeric,
  vs_buy_hold_pct        numeric,
  vs_dca_pct             numeric,

  -- Free text kept beside the numbers until both front ends have moved (D1)
  net_profit_text        text,
  asset_accumulated_text text,
  backtesting_period_text text,
  legacy_cagr            numeric,
  annualized_return      numeric,
  entry_trade            text,
  exit_trade             text,
  sell_above_cost_basis  boolean,
  exit_to_entry_proportion numeric,

  -- Settings (client-only, never in the public view)
  algorithm_inputs       jsonb not null default '{}'::jsonb,

  -- Sources
  screenshots            jsonb not null default '[]'::jsonb,       -- [{id, url, kind, order, sha256}]
  public_chart_url       text,                                     -- cropped, no settings header (D9)

  -- Checks (A4, A9, A16) and their acknowledgement at publish
  checks                 jsonb not null default '[]'::jsonb,
  acknowledged_checks    text[] not null default '{}',

  -- Who and when (A3)
  created_by             text not null,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now(),
  submitted_by           text,
  submitted_at           timestamptz,
  approved_by            text,
  published_at           timestamptz,
  superseded_at          timestamptz,

  unique (strategy_id, version_number)
);
alter table store.strategy_versions enable row level security;

create unique index if not exists strategy_versions_one_published
  on store.strategy_versions (strategy_id) where status = 'published';
create unique index if not exists strategy_versions_one_open
  on store.strategy_versions (strategy_id) where status in ('draft', 'in_review');
create index if not exists strategy_versions_strategy on store.strategy_versions (strategy_id, version_number desc);

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'recipes_current_version_fkey') then
    alter table public.recipes
      add constraint recipes_current_version_fkey
      foreign key (current_version_id) references store.strategy_versions(id);
  end if;
end $$;

create table if not exists store.parity_runs (
  id        bigserial primary key,
  ran_at    timestamptz not null default now(),
  trigger   text not null,
  ok        boolean not null,
  counts    jsonb not null,
  problems  jsonb not null
);
alter table store.parity_runs enable row level security;

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

-- The signed-in admin's email, or null.
create or replace function public.admin_email()
returns text
language sql
stable
security definer
set search_path = public, auth
as $$
  select a.email
  from public.admin_users a
  join auth.users u on lower(u.email) = a.email
  where u.id = auth.uid()
    and u.email_confirmed_at is not null
$$;
revoke all on function public.admin_email() from public, anon;
grant execute on function public.admin_email() to authenticated;

-- A {year, month, day} object from the settings as a date, or null.
create or replace function store.date_from_parts(p jsonb)
returns date
language plpgsql
immutable
as $$
begin
  if p is null or jsonb_typeof(p) <> 'object'
     or coalesce(p->>'year', '') !~ '^\d{4}$'
     or coalesce(p->>'month', '') !~ '^\d{1,2}$'
     or coalesce(p->>'day', '') !~ '^\d{1,2}$' then
    return null;
  end if;
  return make_date((p->>'year')::int, (p->>'month')::int, (p->>'day')::int);
exception when others then
  return null;
end;
$$;

-- The run window as typed into TradingView. The end may be a far-future year
-- that unlocks symbols (PRD D10); it is a run setting, not the test end.
create or replace function store.run_start(algorithm text, ai jsonb)
returns date language sql immutable as $$
  select case when algorithm = 'Intelligence Algorithm'
              then coalesce(store.date_from_parts(ai->'start'), store.date_from_parts(ai->'dates'->'start'))
              else coalesce(store.date_from_parts(ai->'dates'->'start'), store.date_from_parts(ai->'start')) end
$$;

create or replace function store.run_end(algorithm text, ai jsonb)
returns date language sql immutable as $$
  select case when algorithm = 'Intelligence Algorithm'
              then coalesce(store.date_from_parts(ai->'end'), store.date_from_parts(ai->'dates'->'end'))
              else coalesce(store.date_from_parts(ai->'dates'->'end'), store.date_from_parts(ai->'end')) end
$$;

-- First number in a free-text money or quantity field: "$20,455 (87% ...)" -> 20455.
-- Only the first token counts, so a bracketed note cannot join the digits.
create or replace function store.first_number(t text)
returns numeric language sql immutable as $$
  -- A minus before or after the dollar sign counts: "-$656" and "$-656".
  select nullif(replace(coalesce(m[1], '') || m[2], ',', ''), '')::numeric
  from (select regexp_match(coalesce(t, ''), '(-)?\$?\s*(-?[0-9][0-9,]*(?:\.[0-9]+)?)') as m) x
$$;

-- Slug from free text: lower case, words joined by hyphens.
create or replace function store.slugify(t text)
returns text language sql immutable as $$
  select trim(both '-' from regexp_replace(lower(coalesce(t, '')), '[^a-z0-9]+', '-', 'g'))
$$;

-- Fields grouped by what a change to them means (D11).
create or replace function store.figure_fields()
returns text[] language sql immutable as $$
  select array['basis', 'starting_capital', 'test_start', 'test_end', 'test_end_source', 'fees_slippage',
               'data_source', 'as_of', 'net_profit_usd', 'cash_profit_usd', 'asset_qty', 'asset_unit',
               'buy_hold_pnl_pct', 'dca_pnl_pct', 'max_drawdown_pct', 'benchmark_shown']
$$;

create or replace function store.settings_fields()
returns text[] language sql immutable as $$
  select array['algorithm_inputs', 'algorithm', 'time_frame', 'entry_trade', 'exit_trade',
               'sell_above_cost_basis', 'exit_to_entry_proportion', 'asset']
$$;

-- Copy fields a marketing editor may change (A10).
create or replace function store.copy_fields()
returns text[] language sql immutable as $$
  select array['title', 'short_name', 'goal', 'best_for', 'how_it_trades',
               'up_market_behavior', 'down_market_behavior']
$$;

-- Fields an editor may set on a draft. Everything else is identity, workflow
-- or derived, and is written by the functions below.
create or replace function store.editable_fields()
returns text[] language sql immutable as $$
  select store.figure_fields() || store.settings_fields() || store.copy_fields() || array[
    'slug', 'name', 'asset_class', 'strategy_type', 'time_horizon', 'focus', 'listed_public',
    'net_profit_text', 'asset_accumulated_text', 'backtesting_period_text', 'annualized_return',
    'change_note', 'extraction_id', 'public_chart_url']
$$;

-- ---------------------------------------------------------------------------
-- Checks (A4, A9, A16, D2, D10). Level: error blocks publish; review blocks
-- until the approver acknowledges it; warning is shown only.
-- ---------------------------------------------------------------------------
create or replace function store.version_checks(v store.strategy_versions)
returns jsonb
language plpgsql
stable
set search_path = store, public
as $$
declare
  out jsonb := '[]'::jsonb;
  ai jsonb := coalesce(v.algorithm_inputs, '{}'::jsonb);
  run_end date := store.run_end(v.algorithm, ai);
  run_start date := store.run_start(v.algorithm, ai);
  x store.extractions;
  st jsonb;
  n numeric;
begin
  if v.test_start >= v.test_end then
    out := out || jsonb_build_object('code', 'test_window', 'level', 'error',
      'message', format('Test start %s is not before test end %s.', v.test_start, v.test_end));
  end if;
  if v.test_end > least(v.as_of, current_date) then
    out := out || jsonb_build_object('code', 'test_end_future', 'level', 'error',
      'message', format('Test end %s is after the as-of date %s. Read the last bar on the chart instead (D10).', v.test_end, v.as_of));
  end if;
  if v.as_of > current_date then
    out := out || jsonb_build_object('code', 'as_of_future', 'level', 'error',
      'message', format('As-of date %s is in the future.', v.as_of));
  end if;
  if run_end is not null and run_end > v.as_of and v.test_end_source <> 'chart_last_bar' then
    out := out || jsonb_build_object('code', 'run_end_unresolved', 'level', 'error',
      'message', format('The run end %s is a far-future setting. Set the test end from the last bar on the chart (A16).', run_end));
  end if;
  if run_start is not null and run_start <> v.test_start then
    out := out || jsonb_build_object('code', 'test_start_vs_settings', 'level', 'error',
      'message', format('Test start %s differs from the start date in the settings, %s.', v.test_start, run_start));
  end if;
  if run_end is not null and run_end <= v.as_of and v.test_end_source = 'settings' and run_end <> v.test_end then
    out := out || jsonb_build_object('code', 'test_end_vs_settings', 'level', 'error',
      'message', format('Test end %s differs from the end date in the settings, %s.', v.test_end, run_end));
  end if;
  if v.benchmark_shown in ('buy_hold', 'both') and v.buy_hold_pnl_pct is null then
    out := out || jsonb_build_object('code', 'benchmark_missing', 'level', 'error',
      'message', 'Buy and hold is shown but has no value.');
  end if;
  if v.benchmark_shown in ('dca', 'both') and v.dca_pnl_pct is null then
    out := out || jsonb_build_object('code', 'benchmark_missing', 'level', 'error',
      'message', 'DCA is shown but has no value.');
  end if;
  if v.starting_capital + v.net_profit_usd <= 0 then
    out := out || jsonb_build_object('code', 'ending_value', 'level', 'error',
      'message', 'Ending value is zero or negative.');
  end if;
  if v.asset_qty is not null and v.asset_qty < 0 then
    out := out || jsonb_build_object('code', 'asset_qty', 'level', 'error',
      'message', 'Asset accumulated is negative.');
  end if;

  -- Settings schema for Market Wave, new versions only (D2).
  if v.algorithm = 'Market Wave' and v.change_type <> 'baseline' then
    if jsonb_typeof(ai->'userInitialCapital'->'startingCash') <> 'number'
       or jsonb_typeof(ai->'longThreshold') <> 'object'
       or jsonb_typeof(ai->'exitThreshold') <> 'object'
       or jsonb_typeof(ai->'tradeSize') <> 'object'
       or jsonb_typeof(ai->'marketWave') <> 'object'
       or run_start is null or run_end is null then
      out := out || jsonb_build_object('code', 'settings_schema', 'level', 'error',
        'message', 'Market Wave settings are missing starting cash, thresholds, trade size, Market Wave inputs or run dates.');
    elsif (ai->'userInitialCapital'->>'startingCash')::numeric <> v.starting_capital then
      out := out || jsonb_build_object('code', 'settings_capital', 'level', 'error',
        'message', format('Starting cash in the settings (%s) differs from starting capital (%s).',
          ai->'userInitialCapital'->>'startingCash', v.starting_capital));
    end if;
  end if;

  if jsonb_array_length(v.screenshots) = 0 then
    out := out || jsonb_build_object('code', 'no_screenshots', 'level', 'review',
      'message', 'No source screenshots are attached.');
  end if;

  -- Cross-checks against the extraction the figures came from (A4, A9, A16).
  if v.extraction_id is not null then
    select * into x from store.extractions where id = v.extraction_id;
    st := coalesce(x.parsed->'stats', '{}'::jsonb);

    if jsonb_typeof(st->'strategyRoiPercent') = 'number'
       and abs(round(v.net_profit_usd / v.starting_capital * 100, 4) - (st->>'strategyRoiPercent')::numeric) > 0.05 then
      out := out || jsonb_build_object('code', 'roi_vs_extraction', 'level', 'review',
        'message', format('Return %s%% differs from the Strategy ROI %s%% on the stats screenshot.',
          round(v.net_profit_usd / v.starting_capital * 100, 2), st->>'strategyRoiPercent'));
    end if;
    if jsonb_typeof(st->'totalPnl') = 'number' and abs(v.net_profit_usd - (st->>'totalPnl')::numeric) > 1 then
      out := out || jsonb_build_object('code', 'net_profit_vs_extraction', 'level', 'review',
        'message', format('Net profit %s differs from Total P&L %s on the stats screenshot.', v.net_profit_usd, st->>'totalPnl'));
    end if;
    if jsonb_typeof(st->'totalPnl') = 'number' and jsonb_typeof(st->'realizedProfit') = 'number'
       and jsonb_typeof(st->'unrealizedProfit') = 'number' then
      n := (st->>'totalPnl')::numeric - (st->>'realizedProfit')::numeric - (st->>'unrealizedProfit')::numeric;
      if abs(n) > 1 then
        out := out || jsonb_build_object('code', 'pnl_components', 'level', 'review',
          'message', format('On the stats screenshot, realised plus unrealised does not equal total P&L (off by %s). A digit may be misread.', round(n, 2)));
      end if;
    end if;
    if jsonb_typeof(st->'totalPnl') = 'number' and jsonb_typeof(st->'strategyRoiPercent') = 'number'
       and jsonb_typeof(st->'initialCashBalance') = 'number' and (st->>'initialCashBalance')::numeric > 0
       and abs((st->>'totalPnl')::numeric / (st->>'initialCashBalance')::numeric * 100 - (st->>'strategyRoiPercent')::numeric) > 0.05 then
      out := out || jsonb_build_object('code', 'roi_vs_pnl', 'level', 'review',
        'message', 'On the stats screenshot, Strategy ROI does not equal total P&L over initial cash. A digit may be misread.');
    end if;
    if jsonb_typeof(st->'realizedProfit') = 'number' and v.cash_profit_usd is not null
       and abs(v.cash_profit_usd - (st->>'realizedProfit')::numeric) > 1 then
      out := out || jsonb_build_object('code', 'cash_profit_vs_extraction', 'level', 'review',
        'message', format('Cash profit %s differs from realised profit %s on the stats screenshot.', v.cash_profit_usd, st->>'realizedProfit'));
    end if;
    if jsonb_array_length(coalesce(x.cross_check, '[]'::jsonb)) > 0 then
      out := out || jsonb_build_object('code', 'chart_header_mismatch', 'level', 'review',
        'message', format('Chart header and settings panel disagree on %s value(s): %s.',
          jsonb_array_length(x.cross_check),
          (select string_agg(e->>'field', ', ') from jsonb_array_elements(x.cross_check) e)));
    end if;
    if jsonb_array_length(coalesce(x.schema_errors, '[]'::jsonb)) > 0 then
      out := out || jsonb_build_object('code', 'extraction_schema', 'level', 'review',
        'message', format('The model output did not match the expected shape: %s.',
          (select string_agg(e #>> '{}', '; ') from jsonb_array_elements(x.schema_errors) e)));
    end if;
    if x.last_bar_date is not null and x.last_bar_date <> v.test_end then
      out := out || jsonb_build_object('code', 'end_date_vs_chart', 'level', 'review',
        'message', format('Test end %s differs from the last bar read from the chart, %s.', v.test_end, x.last_bar_date));
    end if;
  elsif v.change_type in ('initial', 'figures') then
    out := out || jsonb_build_object('code', 'no_extraction', 'level', 'warning',
      'message', 'These figures were not read from screenshots in the console. Check them against the screenshots.');
  end if;

  return out;
end;
$$;

-- ---------------------------------------------------------------------------
-- Trigger: derived metrics, checks, change type, immutability.
-- ---------------------------------------------------------------------------
create or replace function store.strategy_versions_before_write()
returns trigger
language plpgsql
set search_path = store, public
as $$
declare
  published store.strategy_versions;
  f text;
  new_j jsonb;
  old_j jsonb;
  figures_changed boolean := false;
  settings_changed boolean := false;
begin
  if tg_op = 'UPDATE' and old.status not in ('draft', 'in_review') then
    -- Published history is append-only (A3). Only the status moves on.
    if not (old.status = 'published' and new.status = 'superseded') then
      raise exception 'Version % is % and cannot change.', old.id, old.status using errcode = 'P0001';
    end if;
    if (to_jsonb(new) - array['status', 'superseded_at']) is distinct from (to_jsonb(old) - array['status', 'superseded_at']) then
      raise exception 'Only the status of a published version can change.' using errcode = 'P0001';
    end if;
    return new;
  end if;

  if tg_op = 'UPDATE' and new.status not in ('draft', 'in_review', 'published', 'archived') then
    raise exception 'A % version cannot become %.', old.status, new.status using errcode = 'P0001';
  end if;

  new.updated_at := now();
  new.slug := store.slugify(new.slug);

  -- Derived once, here (D3). One scaling base: the strategy's own capital.
  new.ending_value_usd := new.starting_capital + new.net_profit_usd;
  new.return_pct := round(new.net_profit_usd / new.starting_capital * 100, 6);
  new.test_years := round(((new.test_end - new.test_start)::numeric / 365.25), 6);
  new.cagr_pct := case
    when new.test_years >= 1 and new.ending_value_usd > 0
      then round(((power(new.ending_value_usd / new.starting_capital, 1 / new.test_years) - 1) * 100)::numeric, 6)
    else null  -- D12: no CAGR for a test window under a year
  end;
  new.vs_buy_hold_pct := case when new.buy_hold_pnl_pct is null then null else new.return_pct - new.buy_hold_pnl_pct end;
  new.vs_dca_pct := case when new.dca_pnl_pct is null then null else new.return_pct - new.dca_pnl_pct end;

  -- Change type against the published version (D11), while the version is
  -- open. At publish the previous version is already superseded, so the type
  -- worked out in review stands.
  if new.change_type <> 'baseline' and new.status in ('draft', 'in_review') then
    select * into published from store.strategy_versions
      where strategy_id = new.strategy_id and status = 'published' and id <> new.id;
    if published.id is null then
      new.change_type := 'initial';
    else
      new_j := to_jsonb(new);
      old_j := to_jsonb(published);
      foreach f in array store.figure_fields() loop
        if new_j->f is distinct from old_j->f then figures_changed := true; end if;
      end loop;
      foreach f in array store.settings_fields() loop
        if new_j->f is distinct from old_j->f then settings_changed := true; end if;
      end loop;
      new.change_type := case when figures_changed then 'figures'
                              when settings_changed then 'settings'
                              else 'copy' end;
    end if;
  end if;

  new.checks := store.version_checks(new);
  return new;
end;
$$;

drop trigger if exists strategy_versions_before_write on store.strategy_versions;
create trigger strategy_versions_before_write
  before insert or update on store.strategy_versions
  for each row execute function store.strategy_versions_before_write();

create or replace function store.forbid_version_delete()
returns trigger language plpgsql as $$
begin
  raise exception 'Versions are never deleted. Discard a draft instead.' using errcode = 'P0001';
end;
$$;
drop trigger if exists strategy_versions_no_delete on store.strategy_versions;
create trigger strategy_versions_no_delete
  before delete on store.strategy_versions
  for each row execute function store.forbid_version_delete();

-- Screenshots of a strategy as a version snapshot.
create or replace function store.screenshot_snapshot(p_strategy uuid)
returns jsonb language sql stable as $$
  select coalesce(jsonb_agg(jsonb_build_object(
           'id', s.id, 'url', s.image_url, 'kind', s.kind, 'order', s.display_order, 'sha256', s.sha256)
         order by s.display_order, s.created_at), '[]'::jsonb)
  from public.recipe_screenshots s
  where s.recipe_id = p_strategy
$$;

-- ---------------------------------------------------------------------------
-- Client views (D6, D7). Published versions only.
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
  v.screenshots, v.public_chart_url
from public.recipes r
join store.strategy_versions v on v.id = r.current_version_id and v.status = 'published';

comment on view public.strategies_pro is
  'Strategy Lab Pro: the published version of every strategy, settings included. Readable without sign-in until the login move (PRD D6).';

-- Allowlist: a column added to the store never appears here by default (D7).
-- No settings, no source screenshots, no change history beyond the as-of date.
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
  v.public_chart_url
from public.recipes r
join store.strategy_versions v on v.id = r.current_version_id and v.status = 'published'
where r.archived_at is null
  and v.listed_public;

comment on view public.strategies_public is
  'Strategy Lab: allowlisted columns of published, listed strategies. Never settings (PRD D6, D7).';

-- Admin reads: every version, filtered to signed-in admins.
create or replace view public.admin_strategy_versions as
select v.*, r.display_number, r.archived_at, r.current_version_id = v.id as is_current
from store.strategy_versions v
join public.recipes r on r.id = v.strategy_id
where public.is_admin();

create or replace view public.admin_extractions as
select x.* from store.extractions x where public.is_admin();

create or replace view public.admin_parity_runs as
select p.* from store.parity_runs p where public.is_admin();

revoke all on public.strategies_pro, public.strategies_public, public.admin_strategy_versions,
  public.admin_extractions, public.admin_parity_runs from public, anon, authenticated;
grant select on public.strategies_public to anon, authenticated, service_role;
-- Open until the login move; the dev team revokes anon here (PRD 10 hand-off).
grant select on public.strategies_pro to anon, authenticated, service_role;
grant select on public.admin_strategy_versions, public.admin_extractions, public.admin_parity_runs to authenticated;

-- ---------------------------------------------------------------------------
-- Admin RPCs. The only writers of versions (R2, A2, A3).
-- ---------------------------------------------------------------------------
create or replace function store.require_role(allowed text[])
returns text
language plpgsql
stable
security definer
set search_path = public, auth
as $$
declare r text := public.admin_role();
begin
  if r is null then
    raise exception 'Admin access required.' using errcode = '42501';
  end if;
  if not (r = any (allowed)) then
    raise exception 'Your role (%) cannot do this.', r using errcode = '42501';
  end if;
  return r;
end;
$$;

-- Create or update the open draft of a strategy. p_strategy null creates a
-- new strategy. A draft starts as a copy of the published version, so an
-- update only needs the fields that change.
-- store.save_draft does the work; admin_save_draft checks the caller. Scripts
-- run by the owner from the SQL editor (the Phase 1 clean-up) call
-- store.save_draft directly with a named author.
create or replace function public.admin_save_draft(p_strategy uuid, p_fields jsonb)
returns uuid
language plpgsql
security definer
set search_path = public, store, auth
as $$
declare
  role text := store.require_role(array['editor', 'approver', 'marketing_editor']);
begin
  return store.save_draft(p_strategy, p_fields, public.admin_email(), role);
end;
$$;

create or replace function store.save_draft(p_strategy uuid, p_fields jsonb, who text, role text)
returns uuid
language plpgsql
security definer
set search_path = public, store, auth
as $$
declare
  base store.strategy_versions;
  draft store.strategy_versions;
  fields jsonb := coalesce(p_fields, '{}'::jsonb);
  bad text[];
  strategy uuid := p_strategy;
begin
  select array_agg(k) into bad from jsonb_object_keys(fields) k
    where not (k = any (case when role = 'marketing_editor'
                             then store.copy_fields() || array['change_note']
                             else store.editable_fields() end));
  if bad is not null then
    raise exception 'These fields cannot be set here: %', array_to_string(bad, ', ') using errcode = '42501';
  end if;

  if strategy is null then
    if role = 'marketing_editor' then
      raise exception 'A marketing editor cannot create strategies.' using errcode = '42501';
    end if;
    insert into public.recipes (name, asset, asset_class, time_horizon, strategy_type, focus, goal, algorithm,
                                algorithm_inputs, time_frame, initial_capital)
    values (fields->>'name', upper(fields->>'asset'), coalesce(fields->>'asset_class', 'Crypto'),
            fields->>'time_horizon', coalesce(fields->>'strategy_type', fields->>'algorithm'),
            fields->>'focus', fields->>'goal', fields->>'algorithm',
            coalesce(fields->'algorithm_inputs', '{}'::jsonb), fields->>'time_frame',
            (fields->>'starting_capital')::numeric)
    returning id into strategy;
  end if;

  select * into draft from store.strategy_versions
    where strategy_id = strategy and status in ('draft', 'in_review') for update;

  if draft.id is null then
    select * into base from store.strategy_versions where strategy_id = strategy and status = 'published';
    if base.id is null then
      -- A first version: column defaults, then the fields given.
      base := jsonb_populate_record(null::store.strategy_versions, jsonb_build_object(
        'listed_public', true, 'basis', 'backtested', 'test_end_source', 'settings',
        'data_source', 'TradingView backtest', 'as_of', current_date, 'benchmark_shown', 'none',
        'algorithm_inputs', '{}'::jsonb, 'screenshots', '[]'::jsonb, 'checks', '[]'::jsonb) || fields);
    else
      base := jsonb_populate_record(base, fields);
    end if;
    base.id := gen_random_uuid();
    base.strategy_id := strategy;
    base.version_number := coalesce((select max(version_number) from store.strategy_versions where strategy_id = strategy), 0) + 1;
    base.status := 'draft';
    base.change_type := 'initial';
    base.restored_from := null;
    base.created_by := who;
    base.created_at := now();
    base.submitted_by := null; base.submitted_at := null;
    base.approved_by := null; base.published_at := null; base.superseded_at := null;
    base.acknowledged_checks := '{}';
    if not fields ? 'change_note' then base.change_note := null; end if;
    if not fields ? 'extraction_id' then base.extraction_id := null; end if;
    if base.slug is null then
      base.slug := store.slugify(coalesce(base.short_name, base.name) || '-' ||
                   (select display_number from public.recipes where id = strategy));
    end if;
    base.title := coalesce(base.title, base.goal);
    base.short_name := coalesce(base.short_name, base.name);
    base.asset := upper(base.asset);
    base.asset_unit := coalesce(base.asset_unit, base.asset);
    base.screenshots := store.screenshot_snapshot(strategy);
    insert into store.strategy_versions select base.*;
    return base.id;
  end if;

  draft := jsonb_populate_record(draft, fields);
  draft.status := 'draft';           -- an edit returns a draft in review to draft
  draft.acknowledged_checks := '{}';
  draft.screenshots := store.screenshot_snapshot(strategy);
  if fields ? 'asset' then draft.asset := upper(draft.asset); end if;
  update store.strategy_versions v set
    (slug, title, short_name, name, asset, asset_class, algorithm, strategy_type, time_horizon, focus,
     time_frame, listed_public, goal, best_for, how_it_trades, up_market_behavior, down_market_behavior,
     basis, starting_capital, test_start, test_end, test_end_source, fees_slippage, data_source, as_of,
     net_profit_usd, cash_profit_usd, asset_qty, asset_unit, buy_hold_pnl_pct, dca_pnl_pct,
     max_drawdown_pct, benchmark_shown, net_profit_text, asset_accumulated_text, backtesting_period_text,
     annualized_return, entry_trade, exit_trade, sell_above_cost_basis, exit_to_entry_proportion,
     algorithm_inputs, screenshots, public_chart_url, change_note, extraction_id, status,
     acknowledged_checks, submitted_by, submitted_at)
  = (draft.slug, draft.title, draft.short_name, draft.name, draft.asset, draft.asset_class, draft.algorithm,
     draft.strategy_type, draft.time_horizon, draft.focus, draft.time_frame, draft.listed_public, draft.goal,
     draft.best_for, draft.how_it_trades, draft.up_market_behavior, draft.down_market_behavior, draft.basis,
     draft.starting_capital, draft.test_start, draft.test_end, draft.test_end_source, draft.fees_slippage,
     draft.data_source, draft.as_of, draft.net_profit_usd, draft.cash_profit_usd, draft.asset_qty,
     draft.asset_unit, draft.buy_hold_pnl_pct, draft.dca_pnl_pct, draft.max_drawdown_pct,
     draft.benchmark_shown, draft.net_profit_text, draft.asset_accumulated_text,
     draft.backtesting_period_text, draft.annualized_return, draft.entry_trade, draft.exit_trade,
     draft.sell_above_cost_basis, draft.exit_to_entry_proportion, draft.algorithm_inputs, draft.screenshots,
     draft.public_chart_url, draft.change_note, draft.extraction_id, 'draft', '{}', null, null)
  where v.id = draft.id;
  return draft.id;
end;
$$;

-- Re-read the strategy's screenshots into its open draft (after uploads).
create or replace function public.admin_refresh_draft_screenshots(p_version uuid)
returns void
language plpgsql
security definer
set search_path = public, store, auth
as $$
begin
  perform store.require_role(array['editor', 'approver']);
  update store.strategy_versions
     set screenshots = store.screenshot_snapshot(strategy_id), status = 'draft', acknowledged_checks = '{}'
   where id = p_version and status in ('draft', 'in_review');
  if not found then
    raise exception 'No open draft %.', p_version using errcode = 'P0002';
  end if;
end;
$$;

create or replace function public.admin_submit_for_review(p_version uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, store, auth
as $$
declare v store.strategy_versions;
begin
  perform store.require_role(array['editor', 'approver', 'marketing_editor']);
  update store.strategy_versions
     set status = 'in_review', submitted_by = public.admin_email(), submitted_at = now()
   where id = p_version and status = 'draft'
  returning * into v;
  if v.id is null then
    raise exception 'Version % is not a draft.', p_version using errcode = 'P0002';
  end if;
  return v.checks;
end;
$$;

create or replace function public.admin_discard_draft(p_version uuid)
returns void
language plpgsql
security definer
set search_path = public, store, auth
as $$
begin
  perform store.require_role(array['editor', 'approver', 'marketing_editor']);
  update store.strategy_versions set status = 'archived'
   where id = p_version and status in ('draft', 'in_review');
  if not found then
    raise exception 'No open draft %.', p_version using errcode = 'P0002';
  end if;
end;
$$;

-- Publish: a named approver, every error clear and every review item
-- acknowledged. The previous version is superseded, never changed (A3, A8).
create or replace function public.admin_publish(p_version uuid, p_acknowledged text[] default '{}')
returns jsonb
language plpgsql
security definer
set search_path = public, store, auth
as $$
declare
  who text;
  v store.strategy_versions;
  blocking jsonb;
  parity jsonb;
begin
  perform store.require_role(array['approver']);
  who := public.admin_email();

  select * into v from store.strategy_versions where id = p_version for update;
  if v.id is null or v.status <> 'in_review' then
    raise exception 'Only a version in review can be published.' using errcode = 'P0001';
  end if;

  v.checks := store.version_checks(v);
  select coalesce(jsonb_agg(c), '[]'::jsonb) into blocking
  from jsonb_array_elements(v.checks) c
  where c->>'level' = 'error'
     or (c->>'level' = 'review' and not (c->>'code' = any (coalesce(p_acknowledged, '{}'))));
  if jsonb_array_length(blocking) > 0 then
    return jsonb_build_object('published', false, 'blocking', blocking);
  end if;

  update store.strategy_versions set status = 'superseded', superseded_at = now()
   where strategy_id = v.strategy_id and status = 'published';

  update store.strategy_versions
     set status = 'published', approved_by = who, published_at = now(),
         acknowledged_checks = coalesce(p_acknowledged, '{}'), checks = v.checks
   where id = v.id;

  update public.recipes set current_version_id = v.id, slug = v.slug where id = v.strategy_id;

  parity := public.run_parity_check('publish');
  return jsonb_build_object('published', true, 'version_id', v.id, 'parity_ok', parity->'ok');
end;
$$;

-- Restore (R6): a new version copied from an earlier one, in review, which
-- then publishes like any other.
create or replace function public.admin_restore(p_version uuid)
returns uuid
language plpgsql
security definer
set search_path = public, store, auth
as $$
declare
  src store.strategy_versions;
  nv store.strategy_versions;
begin
  perform store.require_role(array['editor', 'approver']);
  select * into src from store.strategy_versions where id = p_version;
  if src.id is null or src.status not in ('published', 'superseded') then
    raise exception 'Only a version that was published can be restored.' using errcode = 'P0001';
  end if;
  if exists (select 1 from store.strategy_versions where strategy_id = src.strategy_id and status in ('draft', 'in_review')) then
    raise exception 'Discard or publish the open draft first.' using errcode = 'P0001';
  end if;
  nv := src;
  nv.id := gen_random_uuid();
  nv.version_number := (select max(version_number) from store.strategy_versions where strategy_id = src.strategy_id) + 1;
  nv.status := 'in_review';
  nv.change_type := 'initial';
  nv.change_note := format('Restored from version %s', src.version_number);
  nv.restored_from := src.id;
  nv.created_by := public.admin_email();
  nv.created_at := now();
  nv.submitted_by := nv.created_by; nv.submitted_at := now();
  nv.approved_by := null; nv.published_at := null; nv.superseded_at := null;
  nv.acknowledged_checks := '{}';
  insert into store.strategy_versions select nv.*;
  return nv.id;
end;
$$;

-- Archive replaces delete (A12). Clients who hold the strategy keep reading it
-- through the Pro view; it leaves browse and the public view.
create or replace function public.admin_set_archived(p_strategy uuid, p_archived boolean)
returns void
language plpgsql
security definer
set search_path = public, store, auth
as $$
begin
  perform store.require_role(array['editor', 'approver']);
  update public.recipes set archived_at = case when p_archived then coalesce(archived_at, now()) else null end
   where id = p_strategy;
  perform public.run_parity_check('archive');
end;
$$;

create or replace function public.admin_record_extraction(
  p_strategy uuid, p_provider text, p_model text, p_prompt_version text, p_images jsonb,
  p_raw_output text, p_parsed jsonb, p_warnings jsonb, p_cross_check jsonb, p_schema_errors jsonb,
  p_last_bar_date date)
returns uuid
language plpgsql
security definer
set search_path = public, store, auth
as $$
declare new_id uuid;
begin
  perform store.require_role(array['editor', 'approver']);
  insert into store.extractions (created_by, strategy_id, provider, model, prompt_version, images, raw_output,
                                 parsed, warnings, cross_check, schema_errors, last_bar_date)
  values (public.admin_email(), p_strategy, p_provider, p_model, p_prompt_version, coalesce(p_images, '[]'),
          p_raw_output, p_parsed, coalesce(p_warnings, '[]'), coalesce(p_cross_check, '[]'),
          coalesce(p_schema_errors, '[]'), p_last_bar_date)
  returning id into new_id;
  return new_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Parity check (R5, D8): the views against the store. Runs after every
-- publish and archive, and daily (20261111000003 schedules it).
-- ---------------------------------------------------------------------------
create or replace function store.public_view_allowlist()
returns text[] language sql immutable as $$
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
    -- No uncropped source image may reach the public view (R8, D9).
    if coalesce(rec.public_chart_url, '') like '%/recipe-screenshots/%' then
      problems := problems || jsonb_build_object('check', 'public_image_uncropped', 'strategy', rec.display_number);
    end if;
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

-- Execute rights: admins call these signed in; everything checks the role inside.
revoke all on function
  public.admin_save_draft(uuid, jsonb),
  public.admin_refresh_draft_screenshots(uuid),
  public.admin_submit_for_review(uuid),
  public.admin_discard_draft(uuid),
  public.admin_publish(uuid, text[]),
  public.admin_restore(uuid),
  public.admin_set_archived(uuid, boolean),
  public.admin_record_extraction(uuid, text, text, text, jsonb, text, jsonb, jsonb, jsonb, jsonb, date),
  public.run_parity_check(text)
from public, anon;
grant execute on function
  public.admin_save_draft(uuid, jsonb),
  public.admin_refresh_draft_screenshots(uuid),
  public.admin_submit_for_review(uuid),
  public.admin_discard_draft(uuid),
  public.admin_publish(uuid, text[]),
  public.admin_restore(uuid),
  public.admin_set_archived(uuid, boolean),
  public.admin_record_extraction(uuid, text, text, text, jsonb, text, jsonb, jsonb, jsonb, jsonb, date),
  public.run_parity_check(text)
to authenticated, service_role;

revoke all on all functions in schema store from public, anon, authenticated;

-- The public chart images (D9): a separate, public location for cropped
-- charts. Admins write; nobody lists. Files are reached only by their URL.
insert into storage.buckets (id, name, public)
values ('strategy-public', 'strategy-public', true)
on conflict (id) do nothing;

drop policy if exists "Admins upload public charts" on storage.objects;
create policy "Admins upload public charts" on storage.objects
  for insert to authenticated with check (bucket_id = 'strategy-public' and public.is_admin());
drop policy if exists "Admins replace public charts" on storage.objects;
create policy "Admins replace public charts" on storage.objects
  for update to authenticated using (bucket_id = 'strategy-public' and public.is_admin());

-- The owner approves every publish (PRD 14). Phase 0 listed both admins as
-- editors; the owner becomes the approver.
update public.admin_users set role = 'approver', note = coalesce(note || '; ', '') || 'approver from Phase 1 (PRD 14)'
 where email = 'alex@archpublic.com';

-- Pin the search path of the helper functions (Supabase security advisor).
alter function store.date_from_parts(jsonb) set search_path = pg_catalog;
alter function store.run_start(text, jsonb) set search_path = store, pg_catalog;
alter function store.run_end(text, jsonb) set search_path = store, pg_catalog;
alter function store.first_number(text) set search_path = pg_catalog;
alter function store.slugify(text) set search_path = pg_catalog;
alter function store.figure_fields() set search_path = pg_catalog;
alter function store.settings_fields() set search_path = pg_catalog;
alter function store.copy_fields() set search_path = pg_catalog;
alter function store.editable_fields() set search_path = store, pg_catalog;
alter function store.forbid_version_delete() set search_path = pg_catalog;
alter function store.screenshot_snapshot(uuid) set search_path = public, pg_catalog;
alter function store.public_view_allowlist() set search_path = pg_catalog;
