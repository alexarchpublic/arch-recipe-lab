-- Auto-ingestion PRD, Phase 1 ("Store and names"): the store changes for
-- case study ingestion and the single title.
--
-- What this adds
--   store.strategy_versions   source columns: where a version came from
--                             (manual, or a case study scenario at a commit)
--                             and the hash change detection compares (TR3, TR4)
--   store.case_study_refs     one row per strategy per case study, with one
--                             origin per strategy; the record both labs read
--                             links from (LK1). Nothing writes it yet: the
--                             backfill (BF1, Phase 2) and the pipeline do.
--   strategies_pro/_public    a case_studies column at the end of each view,
--                             origin first (LK2). On the public allowlist (D7).
--   admin_strategy_versions   recreated so admins see the source columns
--   admin_case_study_refs     admin read of the links
--   one authored name (NM1)   name and short_name are filled from the title on
--                             every open version. Whatever a caller sends for
--                             them is replaced, so the admin screen deployed
--                             today keeps saving until the new one is live.
--   run_parity_check          two more checks: every strategy with case study
--                             links has exactly one origin, and every link
--                             points at a published strategy.
--
-- Not here (later phases of the same PRD): the pipeline role and
-- admin_publish_from_case_study (Phases 3 and 4), loading the 63 existing
-- links (BF1, Phase 2), and comparing the live case study index with the store
-- (the daily link check, LK9, Phase 2).
--
-- Additive for clients: the views gain a column at the end; nothing else they
-- read changes. Apply to staging first, then production, then merge the pull
-- request that carries the R8 allowlist with case_studies (scripts/r8-rules.mjs)
-- straight after, as with 20261114000001.

-- ---------------------------------------------------------------------------
-- 1. Where a version came from (TR3, TR4, NO4).
-- ---------------------------------------------------------------------------
alter table store.strategy_versions
  add column if not exists source_kind     text not null default 'manual',
  add column if not exists case_study_slug text,
  add column if not exists scenario_key    text,
  add column if not exists source_commit   text,
  add column if not exists source_hash     text;

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'strategy_versions_source_kind_check') then
    alter table store.strategy_versions add constraint strategy_versions_source_kind_check
      check (source_kind in ('manual', 'case_study'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'strategy_versions_source_complete') then
    alter table store.strategy_versions add constraint strategy_versions_source_complete
      check (source_kind = 'manual'
             or (case_study_slug is not null and scenario_key is not null
                 and source_commit is not null and source_hash is not null));
  end if;
end $$;

-- The pipeline finds its own draft by case study and scenario before it
-- creates anything (NO4).
create index if not exists strategy_versions_case_study_source
  on store.strategy_versions (case_study_slug, scenario_key)
  where source_kind = 'case_study';

-- ---------------------------------------------------------------------------
-- 2. Case study links (LK1). One row per strategy per case study scenario.
-- ---------------------------------------------------------------------------
create table if not exists store.case_study_refs (
  id               bigserial primary key,
  strategy_id      uuid not null references public.recipes(id) on delete restrict,
  case_study_slug  text not null check (case_study_slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  case_study_title text not null check (length(trim(case_study_title)) > 0),
  scenario_key     text not null check (length(trim(scenario_key)) > 0),
  anchor           text not null check (length(trim(anchor)) > 0),   -- the scenario's id on the case study page
  scenario_title   text,
  published_on     date,                                              -- when the case study went live
  role             text not null check (role in ('origin', 'featured')),
  source_hash      text,       -- the TR4 hash last ingested or recorded as the baseline (BF2)
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (case_study_slug, scenario_key)
);
alter table store.case_study_refs enable row level security;

-- A strategy has at most one origin; the parity check below asks for exactly
-- one wherever a strategy has any link.
create unique index if not exists case_study_refs_one_origin
  on store.case_study_refs (strategy_id) where role = 'origin';
create index if not exists case_study_refs_strategy on store.case_study_refs (strategy_id);

create or replace view public.admin_case_study_refs as
select c.*, r.display_number
from store.case_study_refs c
join public.recipes r on r.id = c.strategy_id
where public.is_admin();

revoke all on public.admin_case_study_refs from public, anon, authenticated;
grant select on public.admin_case_study_refs to authenticated;

-- ---------------------------------------------------------------------------
-- 3. One authored name (NM1). The trigger fills name and short_name from the
--    title on every open version; save_draft gets a slug from the title and
--    resets the source of a draft an admin starts by hand.
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

  -- One authored name (auto-ingestion NM1). The old columns stay, filled from
  -- the title, so anything that still reads them keeps working.
  if new.status in ('draft', 'in_review') then
    new.title := trim(new.title);
    new.name := new.title;
    new.short_name := new.title;
  end if;

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
    -- recipes.name is the legacy name column: the title, as on the version (NM1).
    -- A caller that still sends only the old name keeps it there.
    insert into public.recipes (name, asset, asset_class, time_horizon, strategy_type, focus, goal, algorithm,
                                algorithm_inputs, time_frame, initial_capital)
    values (coalesce(nullif(trim(fields->>'title'), ''), fields->>'name', fields->>'goal'),
            upper(fields->>'asset'), coalesce(fields->>'asset_class', 'Crypto'),
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
    -- A draft started here is a manual edit, whatever the published version
    -- came from. The pipeline sets its own source after saving.
    base.source_kind := 'manual';
    base.case_study_slug := null; base.scenario_key := null;
    base.source_commit := null; base.source_hash := null;
    if not fields ? 'change_note' then base.change_note := null; end if;
    if not fields ? 'extraction_id' then base.extraction_id := null; end if;
    base.title := coalesce(nullif(trim(base.title), ''), base.goal);
    if base.slug is null then
      -- The page address comes from the title and the number, and does not
      -- change once published (NM9).
      base.slug := store.slugify(base.title || '-' ||
                   (select display_number from public.recipes where id = strategy));
    end if;
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

-- ---------------------------------------------------------------------------
-- 4. Views. The client views gain case_studies at the end (create or replace
--    keeps their grants). Origin first, then by publish date (LK2).
--    Inline, not a function: functions in a view run with the querying role's
--    EXECUTE rights, and anon has no access to schema store.
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
   limit 1) as chart_url,
  (select coalesce(jsonb_agg(jsonb_build_object(
            'slug', c.case_study_slug, 'title', c.case_study_title, 'scenario_key', c.scenario_key,
            'anchor', c.anchor, 'scenario_title', c.scenario_title, 'published_on', c.published_on,
            'role', c.role)
          order by (c.role <> 'origin'), c.published_on nulls last, c.case_study_slug, c.scenario_key), '[]'::jsonb)
   from store.case_study_refs c where c.strategy_id = r.id) as case_studies
from public.recipes r
join store.strategy_versions v on v.id = r.current_version_id and v.status = 'published';

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
   limit 1) as chart_url,
  (select coalesce(jsonb_agg(jsonb_build_object(
            'slug', c.case_study_slug, 'title', c.case_study_title, 'scenario_key', c.scenario_key,
            'anchor', c.anchor, 'scenario_title', c.scenario_title, 'published_on', c.published_on,
            'role', c.role)
          order by (c.role <> 'origin'), c.published_on nulls last, c.case_study_slug, c.scenario_key), '[]'::jsonb)
   from store.case_study_refs c where c.strategy_id = r.id) as case_studies
from public.recipes r
join store.strategy_versions v on v.id = r.current_version_id and v.status = 'published'
where r.archived_at is null
  and v.listed_public;

comment on view public.strategies_public is
  'Strategy Lab: allowlisted columns of published, listed strategies. Never settings; the one chart screenshot as chart_url; case study links as case_studies (PRD D6, D7; redesign P1; auto-ingestion LK1).';

-- The admin read lists v.*, which was expanded when the view was made, so it
-- is made again to carry the source columns.
drop view if exists public.admin_strategy_versions;
create view public.admin_strategy_versions as
select v.*, r.display_number, r.archived_at, r.current_version_id = v.id as is_current
from store.strategy_versions v
join public.recipes r on r.id = v.strategy_id
where public.is_admin();
revoke all on public.admin_strategy_versions from public, anon, authenticated;
grant select on public.admin_strategy_versions to authenticated;

-- ---------------------------------------------------------------------------
-- 5. Parity (R5, D8): case_studies is allowed in the public view, and the
--    links are checked. Every earlier check is kept as it was.
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
    'public_chart_url', 'chart_url', 'case_studies']
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
  if has_table_privilege('anon', 'public.admin_case_study_refs', 'select') then
    problems := problems || jsonb_build_object('check', 'anon_admin_view_open', 'view', 'admin_case_study_refs');
  end if;

  -- 6. Case study links (auto-ingestion LK1, LK9): a strategy with links has
  --    exactly one origin, and every link points at a published strategy.
  for rec in
    select r.display_number, count(*) filter (where c.role = 'origin') as origins
    from store.case_study_refs c join public.recipes r on r.id = c.strategy_id
    group by r.id, r.display_number
    having count(*) filter (where c.role = 'origin') <> 1
  loop
    problems := problems || jsonb_build_object('check', 'case_study_origin', 'strategy', rec.display_number, 'origins', rec.origins);
  end loop;
  for rec in
    select r.display_number, c.case_study_slug, c.scenario_key
    from store.case_study_refs c join public.recipes r on r.id = c.strategy_id
    where not exists (select 1 from public.strategies_pro p where p.id = c.strategy_id)
  loop
    problems := problems || jsonb_build_object('check', 'case_study_link_unpublished', 'strategy', rec.display_number,
      'case_study', rec.case_study_slug, 'scenario', rec.scenario_key);
  end loop;

  select jsonb_build_object(
    'strategies', (select count(*) from public.recipes),
    'with_published_version', (select count(*) from public.recipes where current_version_id is not null),
    'pro_rows', (select count(*) from public.strategies_pro),
    'public_rows', (select count(*) from public.strategies_public),
    'case_study_links', (select count(*) from store.case_study_refs),
    'base_tables_open_to_anon', has_table_privilege('anon', 'public.recipes', 'select')
  ) into counts;

  ok := jsonb_array_length(problems) = 0;
  insert into store.parity_runs (trigger, ok, counts, problems) values (p_trigger, ok, counts, problems);
  return jsonb_build_object('ok', ok, 'counts', counts, 'problems', problems);
end;
$$;

revoke all on function public.run_parity_check(text) from public, anon;
grant execute on function public.run_parity_check(text) to authenticated, service_role;
revoke all on all functions in schema store from public, anon, authenticated;

select public.run_parity_check('migration');
