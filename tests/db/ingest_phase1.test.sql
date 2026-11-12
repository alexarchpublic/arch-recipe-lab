-- Auto-ingestion Phase 1 checks: source columns, one authored name, case
-- study links in the views, and the parity additions. Any failure raises.
-- Runs after phase4.test.sql.
\set ON_ERROR_STOP on

create temp table ids (k text primary key, val uuid);
grant all on ids to anon, authenticated;
insert into ids values
  ('editor',    '00000000-0000-0000-0000-00000000000a'),
  ('marketing', '00000000-0000-0000-0000-00000000000d'),
  ('approver',  (select id from auth.users where lower(email) = 'invited@archpublic.com')),
  ('public',    (select id from public.strategies_pro order by display_number limit 1)),
  ('public2',   (select id from public.strategies_pro order by display_number offset 1 limit 1));

do $$ begin
  if (select count(*) from ids where val is null) > 0 then
    raise exception 'test setup: missing ids %', (select array_agg(k) from ids where val is null);
  end if;
end $$;

create or replace function pg_temp.as_user(k text) returns void language sql as $$
  select set_config('request.jwt.claim.sub', (select val::text from ids where ids.k = $1), false)
$$;

-- 1. Every existing version is manual; the source constraint holds.
do $$ begin
  if exists (select 1 from store.strategy_versions where source_kind <> 'manual') then
    raise exception 'an existing version is not manual';
  end if;
  if (select count(*) from store.case_study_refs) <> 0 then
    raise exception 'case study links exist before any loader ran';
  end if;
end $$;

begin;
set local session_replication_role = replica;
do $$ begin
  begin
    update store.strategy_versions set source_kind = 'case_study'
     where id = (select version_id from public.strategies_pro where id = (select val from ids where k = 'public'));
    raise exception 'a case study source without slug, scenario, commit and hash was accepted';
  exception when check_violation then null;
  end;
end $$;
rollback;

-- 2. One authored name (NM1): an editor sends the old name fields, and both
--    are replaced by the title. The slug comes from the title and the number.
set role authenticated;
select pg_temp.as_user('editor');
do $$
declare d uuid;
begin
  d := public.admin_save_draft(null, jsonb_build_object(
    'title', '  Microsoft through a whipsaw year ', 'name', '[MSFT] STH 1D Swing', 'short_name', 'MSFT STH 1D Swing',
    'asset', 'msft', 'asset_class', 'Equities', 'algorithm', 'Market Wave', 'strategy_type', 'Market Wave',
    'time_horizon', 'STH', 'focus', 'Balanced', 'time_frame', '1 Day', 'goal', 'Trade the swings',
    'starting_capital', 100000, 'test_start', '2025-01-01', 'test_end', '2025-12-31', 'as_of', '2026-01-02',
    'net_profit_usd', 12000));
  insert into ids values ('named', d);
end $$;
-- The form after Phase 1 sends no name fields at all.
do $$
declare d uuid;
begin
  d := public.admin_save_draft(null, jsonb_build_object(
    'title', 'Gold through its record bull run',
    'asset', 'gld', 'asset_class', 'ETFs', 'algorithm', 'Market Wave', 'strategy_type', 'Market Wave',
    'time_horizon', 'LTH', 'focus', 'Accumulation', 'time_frame', '1 Week', 'goal', 'Ride the trend',
    'starting_capital', 100000, 'test_start', '2024-01-01', 'test_end', '2025-12-31', 'as_of', '2026-01-02',
    'net_profit_usd', 30000));
  insert into ids values ('unnamed', d);
end $$;
reset role;
do $$
declare v store.strategy_versions; n int;
begin
  select * into v from store.strategy_versions where id = (select val from ids where k = 'named');
  select display_number into n from public.recipes where id = v.strategy_id;
  if v.title <> 'Microsoft through a whipsaw year' or v.name <> v.title or v.short_name <> v.title then
    raise exception 'names not filled from the title: % / % / %', v.title, v.name, v.short_name;
  end if;
  if v.slug <> 'microsoft-through-a-whipsaw-year-' || n then
    raise exception 'slug not from the title: %', v.slug;
  end if;
  if (select name from public.recipes where id = v.strategy_id) <> 'Microsoft through a whipsaw year' then
    raise exception 'legacy recipes.name not the title';
  end if;
  if v.source_kind <> 'manual' or v.case_study_slug is not null then
    raise exception 'a console draft has a case study source';
  end if;

  select * into v from store.strategy_versions where id = (select val from ids where k = 'unnamed');
  if v.name <> 'Gold through its record bull run' or v.short_name <> v.name then
    raise exception 'names missing when the form sends none: % / %', v.name, v.short_name;
  end if;
end $$;

-- A title edit moves both old columns with it.
insert into ids select 'named_strategy', strategy_id from store.strategy_versions where id = (select val from ids where k = 'named');
set role authenticated;
select pg_temp.as_user('editor');
select public.admin_save_draft((select val from ids where k = 'named_strategy'),
  '{"title": "Microsoft in a whipsaw year", "short_name": "ignored"}'::jsonb);
reset role;
do $$ begin
  if (select short_name from store.strategy_versions where id = (select val from ids where k = 'named')) <> 'Microsoft in a whipsaw year'
     or (select name from store.strategy_versions where id = (select val from ids where k = 'named')) <> 'Microsoft in a whipsaw year' then
    raise exception 'a title edit did not carry to the old name columns';
  end if;
end $$;

-- 3. Only the pipeline sets a source: the console cannot.
set role authenticated;
select pg_temp.as_user('editor');
do $$ begin
  begin
    perform public.admin_save_draft((select val from ids where k = 'public'),
      '{"source_kind": "case_study", "case_study_slug": "x"}'::jsonb);
    raise exception 'the console set a source';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;

-- 4. A draft an admin starts from a case study version is a manual edit.
begin;
set local session_replication_role = replica;
update store.strategy_versions
   set source_kind = 'case_study', case_study_slug = 'msft-whipsaw', scenario_key = 's1',
       source_commit = 'abc123', source_hash = 'h1'
 where id = (select version_id from public.strategies_pro where id = (select val from ids where k = 'public'));
set local session_replication_role = origin;
set local role authenticated;
select pg_temp.as_user('editor');
select public.admin_save_draft((select val from ids where k = 'public'), '{"goal": "Edited by hand"}'::jsonb);
reset role;
do $$
declare v store.strategy_versions;
begin
  select * into v from store.strategy_versions
   where strategy_id = (select val from ids where k = 'public') and status = 'draft';
  if v.source_kind <> 'manual' or v.case_study_slug is not null or v.source_hash is not null then
    raise exception 'a hand edit kept the case study source: % %', v.source_kind, v.case_study_slug;
  end if;
end $$;
rollback;

-- 5. Links in the views (LK1, LK2): origin first, readable by anon in the
--    public view, admin view closed to anon, parity clean. The fixtures list
--    nothing publicly, so two strategies are listed inside this transaction.
begin;
set local session_replication_role = replica;
update store.strategy_versions set listed_public = true
 where id in (select version_id from public.strategies_pro where id in (select val from ids where k in ('public', 'public2')));
update public.recipes set archived_at = null where id in (select val from ids where k in ('public', 'public2'));
set local session_replication_role = origin;
insert into store.case_study_refs (strategy_id, case_study_slug, case_study_title, scenario_key, anchor,
                                   scenario_title, published_on, role)
values
  ((select val from ids where k = 'public'), 'later-study', 'Later study', 's2', 'scenario-2', 'Second look', '2026-10-01', 'featured'),
  ((select val from ids where k = 'public'), 'first-study', 'First study', 's1', 'scenario-1', 'The whipsaw year', '2026-09-01', 'origin');
do $$
declare cs jsonb;
begin
  select case_studies into cs from public.strategies_public where id = (select val from ids where k = 'public');
  if jsonb_array_length(cs) <> 2 or cs->0->>'role' <> 'origin' or cs->0->>'slug' <> 'first-study'
     or cs->0->>'anchor' <> 'scenario-1' or cs->1->>'slug' <> 'later-study' then
    raise exception 'public case_studies wrong: %', cs;
  end if;
  if (select case_studies from public.strategies_pro where id = (select val from ids where k = 'public')) <> cs then
    raise exception 'pro and public case_studies differ';
  end if;
  if (select case_studies from public.strategies_public where id = (select val from ids where k = 'public2')) <> '[]'::jsonb then
    raise exception 'a strategy with no case study does not get an empty list (LK6)';
  end if;
  if not (public.run_parity_check('test')->>'ok')::boolean then
    raise exception 'parity with links: %', public.run_parity_check('test');
  end if;
  begin
    insert into store.case_study_refs (strategy_id, case_study_slug, case_study_title, scenario_key, anchor, role)
    values ((select val from ids where k = 'public'), 'third-study', 'Third', 's1', 'scenario-1', 'origin');
    raise exception 'a second origin was accepted';
  exception when unique_violation then null;
  end;
end $$;
set local role anon;
do $$ begin
  perform case_studies from public.strategies_public limit 1;
  begin
    perform 1 from public.admin_case_study_refs;
    raise exception 'anon can read admin case study links';
  exception when insufficient_privilege then null;
  end;
  begin
    perform 1 from store.case_study_refs;
    raise exception 'anon can read the links table';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;
rollback;

-- 6. Parity reports a strategy with links but no origin, and a link to a
--    strategy with no published version.
begin;
insert into store.case_study_refs (strategy_id, case_study_slug, case_study_title, scenario_key, anchor, role)
values ((select val from ids where k = 'public2'), 'only-featured', 'Only featured', 's1', 'scenario-1', 'featured'),
       ((select strategy_id from store.strategy_versions where id = (select val from ids where k = 'unnamed')),
        'draft-only', 'Draft only', 's1', 'scenario-1', 'origin');
do $$
declare res jsonb := public.run_parity_check('test');
begin
  if (res->>'ok')::boolean
     or not exists (select 1 from jsonb_array_elements(res->'problems') p where p->>'check' = 'case_study_origin')
     or not exists (select 1 from jsonb_array_elements(res->'problems') p where p->>'check' = 'case_study_link_unpublished') then
    raise exception 'parity missed a link problem: %', res;
  end if;
end $$;
rollback;

-- 7. Parity is clean, case_studies is on the allowlist, and admins still read
--    versions (now with their source).
do $$ begin
  if not (public.run_parity_check('test')->>'ok')::boolean then
    raise exception 'parity after ingest phase 1: %', public.run_parity_check('test');
  end if;
  if not ('case_studies' = any (store.public_view_allowlist())) then
    raise exception 'case_studies not on the allowlist';
  end if;
end $$;
set role authenticated;
select pg_temp.as_user('editor');
do $$ begin
  if not exists (select 1 from public.admin_strategy_versions where source_kind = 'manual') then
    raise exception 'admins cannot read the source of a version';
  end if;
  perform count(*) from public.admin_case_study_refs;
end $$;
reset role;

\echo 'ingest phase 1 db checks passed'
