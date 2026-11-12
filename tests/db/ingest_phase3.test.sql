-- Auto-ingestion Phase 3 checks: the pipeline identity saves drafts with their
-- case study source (TR3, TR4, NO1, NO4), attaches screenshots only to
-- strategies it created, records extractions, and can do nothing else (GR8).
-- Any failure raises. Runs after ingest_phase2.test.sql.
\set ON_ERROR_STOP on

insert into public.admin_users (email, role, added_by) values ('pipeline@archpublic.com', 'pipeline', 'test');
insert into auth.users (id, email, email_confirmed_at)
values ('00000000-0000-0000-0000-0000000000b1'::uuid, 'pipeline@archpublic.com', now())
on conflict do nothing;

create temp table ids3 (k text primary key, val uuid, n int);
grant all on ids3 to anon, authenticated;
insert into ids3 values ('pipeline', '00000000-0000-0000-0000-0000000000b1'::uuid, null);
insert into ids3 select 'existing', id, display_number from public.strategies_pro order by display_number desc limit 1;

create or replace function pg_temp.fields(title text) returns jsonb language sql as $$
  select jsonb_build_object(
    'asset', 'MSFT', 'asset_class', 'Equities', 'algorithm', 'Market Wave', 'strategy_type', 'Market Wave',
    'time_horizon', 'LTH', 'focus', 'Balanced', 'time_frame', '1 Week',
    'title', title, 'goal', 'Trades Microsoft on the weekly chart.', 'how_it_trades', 'Buys dips in slices.',
    'listed_public', true, 'as_of', '2026-08-11', 'starting_capital', 100000, 'net_profit_usd', 111500,
    'cash_profit_usd', 61212, 'asset_qty', 415, 'asset_unit', 'MSFT', 'buy_hold_pnl_pct', 49.7, 'dca_pnl_pct', 21.3,
    'benchmark_shown', 'both', 'test_start', '2021-11-01', 'test_end', '2026-08-11', 'test_end_source', 'chart_last_bar',
    'algorithm_inputs', '{"marketWave": {"scope": 3}}'::jsonb)
$$;

-- 1. Nobody else can call the pipeline functions; the pipeline is not an admin.
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', false);  -- an editor
do $$ begin
  begin
    perform public.pipeline_save_draft('msft', 'full-cycle', 'abc123', 'h1', null, pg_temp.fields('Microsoft over a full cycle'));
    raise exception 'an editor saved a pipeline draft';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.pipeline_scenario_state('msft');
    raise exception 'an editor read pipeline state';
  exception when insufficient_privilege then null;
  end;
end $$;

select set_config('request.jwt.claim.sub', (select val::text from ids3 where k = 'pipeline'), false);
do $$ begin
  if public.is_admin() then raise exception 'the pipeline counts as an admin'; end if;
  if public.user_has_valid_domain() then raise exception 'the pipeline passes the old write policies'; end if;
  if (select count(*) from public.admin_strategy_versions) <> 0 then raise exception 'the pipeline reads admin versions'; end if;
  begin
    perform public.admin_publish((select version_id from public.strategies_pro limit 1), '{}');
    raise exception 'the pipeline called admin_publish';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.admin_save_draft(null, pg_temp.fields('Sneaky'));
    raise exception 'the pipeline called admin_save_draft';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.admin_sync_case_study_refs('{"studies": [{"slug": "x", "title": "x", "strategies": []}]}');
    raise exception 'the pipeline synced links';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.pipeline_record_extraction(null, 'openai', 'gpt-4o', 'v', '[]', 'x', null, '[]', '[]', '[]', null);
    raise exception 'a non-Claude extraction was recorded';
  exception when invalid_parameter_value then null;
  end;
end $$;

-- 2. A new scenario: a new strategy with a number, a draft with its source.
create temp table run3 (k text primary key, res jsonb);
grant all on run3 to authenticated;
insert into run3 select 'new1', public.pipeline_save_draft('msft', 'full-cycle', 'abc123', 'hash-1', null,
                                                          pg_temp.fields('Microsoft over a full cycle'));
do $$
declare r jsonb := (select res from run3 where k = 'new1');
begin
  if not (r->>'created')::boolean or (r->>'display_number') is null then raise exception 'new draft: %', r; end if;
end $$;

-- 3. Running again (a run that stopped partway) reuses the draft and number (NO4).
insert into run3 select 'new2', public.pipeline_save_draft('msft', 'full-cycle', 'abc124', 'hash-2', null,
                                                          pg_temp.fields('Microsoft over a full cycle'));
do $$
declare a jsonb := (select res from run3 where k = 'new1'); b jsonb := (select res from run3 where k = 'new2');
begin
  if (b->>'created')::boolean or a->>'display_number' <> b->>'display_number' or a->>'version_id' <> b->>'version_id' then
    raise exception 'rerun made a second strategy or version: % then %', a, b;
  end if;
end $$;

-- 4. State reports the draft and its hash.
do $$
declare s jsonb := public.pipeline_scenario_state('msft');
begin
  if jsonb_array_length(s) <> 1 or s->0->>'scenario_key' <> 'full-cycle' or s->0->>'draft_hash' <> 'hash-2'
     or (s->0->>'display_number') <> (select res->>'display_number' from run3 where k = 'new1') then
    raise exception 'state: %', s;
  end if;
end $$;

-- 5. Screenshots: only case study addresses, only for its own new strategy.
do $$
declare v uuid := (select (res->>'version_id')::uuid from run3 where k = 'new1'); snap jsonb;
begin
  begin
    perform public.pipeline_attach_screenshots(v, '[{"url": "https://x.supabase.co/storage/v1/object/public/recipe-screenshots/other/a.png", "kind": "chart"}]');
    raise exception 'a screenshot outside the case study folder was attached';
  exception when invalid_parameter_value then null;
  end;
  snap := public.pipeline_attach_screenshots(v, '[
    {"url": "https://x.supabase.co/storage/v1/object/public/recipe-screenshots/case-studies/msft/full-cycle/chart.png", "kind": "chart", "order": 0, "sha256": "aa"},
    {"url": "https://x.supabase.co/storage/v1/object/public/recipe-screenshots/case-studies/msft/full-cycle/settings.png", "kind": "settings", "order": 1, "sha256": "bb"}]');
  if jsonb_array_length(snap) <> 2 or snap->0->>'kind' <> 'chart' then
    raise exception 'screenshots not attached: %', snap;
  end if;
end $$;

-- 6. An existing strategy (a numbered scenario): a draft on top of its
--    published version, but its screenshots stay until publish (Phase 4).
insert into run3 select 'upd', public.pipeline_save_draft('msft', 'two-year-grind', 'abc123', 'hash-3',
                                                         (select n from ids3 where k = 'existing'),
                                                         pg_temp.fields('Microsoft through a two-year grind'));
do $$
declare r jsonb := (select res from run3 where k = 'upd');
begin
  if (r->>'created')::boolean or (r->>'display_number')::int <> (select n from ids3 where k = 'existing') then
    raise exception 'update draft: %', r;
  end if;
  begin
    perform public.pipeline_attach_screenshots((r->>'version_id')::uuid,
      '[{"url": "https://x.supabase.co/storage/v1/object/public/recipe-screenshots/case-studies/msft/two-year-grind/chart.png", "kind": "chart"}]');
    raise exception 'screenshots of a published strategy were replaced';
  exception when object_in_use then null;
  end;
  perform public.pipeline_record_extraction((r->>'strategy_id')::uuid, 'anthropic', 'claude-sonnet-4-6', '2026-11-11.1',
    '[]', '{}', '{}', '[]', '[]', '[]', '2026-08-11');
end $$;

-- 7. Nothing was published, and a draft a person opened is never overwritten.
reset role;
do $$ begin
  if exists (select 1 from store.strategy_versions where source_kind = 'case_study' and status not in ('draft', 'in_review')) then
    raise exception 'the pipeline published something';
  end if;
  if (select count(*) from store.strategy_versions where source_kind = 'case_study'
        and case_study_slug = 'msft' and source_commit is not null and source_hash is not null) <> 2 then
    raise exception 'source columns missing';
  end if;
end $$;

-- Someone opens a manual draft on the existing strategy's sibling: take the
-- second-highest number, open a draft as the editor, and try the pipeline.
insert into ids3 select 'manual', id, display_number from public.strategies_pro order by display_number desc offset 1 limit 1;
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', false);
select public.admin_save_draft((select val from ids3 where k = 'manual'), '{"goal": "An editor is working on this."}');
select set_config('request.jwt.claim.sub', (select val::text from ids3 where k = 'pipeline'), false);
do $$ begin
  begin
    perform public.pipeline_save_draft('msft', 'whipsaw-year', 'abc123', 'hash-4', (select n from ids3 where k = 'manual'),
                                       pg_temp.fields('Microsoft through a whipsaw year'));
    raise exception 'the pipeline overwrote a person''s draft';
  exception when object_in_use then null;
  end;
end $$;
reset role;

-- Clean up so later test files see the store as before.
delete from public.recipe_screenshots where image_url like '%/case-studies/msft/%';
select set_config('request.jwt.claim.sub', '', false);
cho ingest phase 3 db checks passed
