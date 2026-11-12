-- Auto-ingestion Phase 2 checks: store.sync_case_study_refs keeps the case
-- study links in step with a case study index (BF1, BF4, PB6, LK1), and only
-- the approver can call it. Any failure raises. Runs after
-- ingest_phase1.test.sql.
\set ON_ERROR_STOP on

delete from store.case_study_refs;

create temp table ids2 (k text primary key, val uuid, n int);
grant all on ids2 to anon, authenticated;
insert into ids2
select 'a', id, display_number from public.strategies_pro order by display_number limit 1;
insert into ids2
select 'b', id, display_number from public.strategies_pro order by display_number offset 1 limit 1;
insert into ids2 values
  ('editor',   '00000000-0000-0000-0000-00000000000a', null),
  ('approver', (select id from auth.users where lower(email) = 'invited@archpublic.com'), null);

do $$ begin
  if (select count(*) from ids2 where val is null) > 0 or (select count(*) from ids2 where k in ('a', 'b')) <> 2 then
    raise exception 'test setup: missing ids';
  end if;
end $$;

-- An index: strategy a in an older and a newer study, b in the newer one, and
-- a number no strategy has.
create or replace function pg_temp.idx(with_old boolean default true, b_key_names text default 'b', extra jsonb default '[]')
returns jsonb language sql as $$
  select jsonb_build_object('studies',
    (case when with_old then jsonb_build_array(jsonb_build_object(
        'slug', 'old-study', 'title', 'The old study', 'published', '2025-01-10',
        'strategies', jsonb_build_array(jsonb_build_object('number', (select n from ids2 where k = 'a'), 'key', 'first-window', 'anchor', 'scenario-1', 'scenario', 'The first window'))))
      else '[]'::jsonb end)
    || jsonb_build_array(jsonb_build_object(
        'slug', 'new-study', 'title', 'The new study', 'published', '2026-02-01',
        'strategies', jsonb_build_array(
          jsonb_build_object('number', (select n from ids2 where k = 'a'), 'key', 'trend', 'anchor', 'scenario-1', 'scenario', 'The trend'),
          jsonb_build_object('number', (select n from ids2 where k = b_key_names), 'key', 'chop', 'anchor', 'scenario-2', 'scenario', 'The chop'),
          jsonb_build_object('number', 999999, 'key', 'unknown', 'anchor', 'scenario-3', 'scenario', 'Not a strategy')),
        'url', 'ignored', 'chart', 'ignored'))
    || extra)
$$;

create or replace function pg_temp.origin(k text) returns text language sql as $$
  select case_study_slug || '/' || scenario_key from store.case_study_refs
  where strategy_id = (select val from ids2 where ids2.k = $1) and role = 'origin'
$$;

-- 1. An empty index is refused and changes nothing.
do $$ begin
  begin
    perform store.sync_case_study_refs('{"studies": []}');
    raise exception 'an empty index was accepted';
  exception when invalid_parameter_value then null;
  end;
  begin
    perform store.sync_case_study_refs('{}');
    raise exception 'an index with no studies was accepted';
  exception when invalid_parameter_value then null;
  end;
end $$;

-- 2. First load: three links, the unknown number reported, origins by date.
do $$
declare res jsonb := store.sync_case_study_refs(pg_temp.idx());
begin
  if (res->>'added')::int <> 3 or (res->>'links')::int <> 3 or jsonb_array_length(res->'not_linked') <> 1
     or (res->'not_linked'->0->>'strategy')::int <> 999999 then
    raise exception 'first load: %', res;
  end if;
  if pg_temp.origin('a') <> 'old-study/first-window' or pg_temp.origin('b') <> 'new-study/chop' then
    raise exception 'origins: a %, b %', pg_temp.origin('a'), pg_temp.origin('b');
  end if;
  if (select case_studies->0->>'slug' from public.strategies_pro where id = (select val from ids2 where k = 'a')) <> 'old-study'
     or (select jsonb_array_length(case_studies) from public.strategies_pro where id = (select val from ids2 where k = 'a')) <> 2 then
    raise exception 'Pro view links for a: %', (select case_studies from public.strategies_pro where id = (select val from ids2 where k = 'a'));
  end if;
  if not (public.run_parity_check('test')->>'ok')::boolean then
    raise exception 'parity after first load: %', public.run_parity_check('test');
  end if;
end $$;

-- 3. The same index again changes nothing.
do $$
declare
  before timestamptz := (select max(updated_at) from store.case_study_refs);
  res jsonb := store.sync_case_study_refs(pg_temp.idx());
begin
  if (res->>'added')::int <> 0 or (res->>'changed')::int <> 0 or jsonb_array_length(res->'removed') <> 0
     or (select max(updated_at) from store.case_study_refs) <> before then
    raise exception 'second load was not a no-op: %', res;
  end if;
end $$;

-- 4. An even older study for a does not take the origin from it.
do $$
declare res jsonb := store.sync_case_study_refs(pg_temp.idx(true, 'b', jsonb_build_array(jsonb_build_object(
  'slug', 'oldest-study', 'title', 'The oldest study', 'published', '2024-06-01',
  'strategies', jsonb_build_array(jsonb_build_object('number', (select n from ids2 where k = 'a'), 'key', 'k', 'anchor', 'scenario-1', 'scenario', 'S'))))));
begin
  if (res->>'added')::int <> 1 or pg_temp.origin('a') <> 'old-study/first-window' then
    raise exception 'origin moved when a study was added: % %', res, pg_temp.origin('a');
  end if;
end $$;

-- 5. Withdrawing the origin study removes its link, names the strategy, keeps
--    the strategy published, and moves the origin to the earliest remaining.
do $$
declare res jsonb := store.sync_case_study_refs(pg_temp.idx(false, 'b', jsonb_build_array(jsonb_build_object(
  'slug', 'oldest-study', 'title', 'The oldest study', 'published', '2024-06-01',
  'strategies', jsonb_build_array(jsonb_build_object('number', (select n from ids2 where k = 'a'), 'key', 'k', 'anchor', 'scenario-1', 'scenario', 'S'))))));
begin
  if jsonb_array_length(res->'removed') <> 1 or (res->'removed'->0->>'case_study') <> 'old-study'
     or (res->'removed'->0->>'strategy')::int <> (select n from ids2 where k = 'a') then
    raise exception 'removal report: %', res;
  end if;
  if not exists (select 1 from public.strategies_pro where id = (select val from ids2 where k = 'a')) then
    raise exception 'a withdrawn link archived its strategy';
  end if;
  if pg_temp.origin('a') <> 'oldest-study/k' then
    raise exception 'origin after withdrawal: %', pg_temp.origin('a');
  end if;
end $$;

-- 6. A scenario re-pointed at another strategy moves, gives up its origin
--    role, and leaves exactly one origin per strategy.
do $$
declare res jsonb;
begin
  perform store.sync_case_study_refs(pg_temp.idx(true));
  res := store.sync_case_study_refs(pg_temp.idx(true, 'a'));
  if (res->>'changed')::int < 1 then
    raise exception 're-pointed scenario not reported: %', res;
  end if;
  if exists (select 1 from store.case_study_refs where strategy_id = (select val from ids2 where k = 'b')) then
    raise exception 'b kept a link it no longer has';
  end if;
  if (select count(*) from store.case_study_refs where role = 'origin'
      and strategy_id = (select val from ids2 where k = 'a')) <> 1 then
    raise exception 'a has % origins', (select count(*) from store.case_study_refs where role = 'origin' and strategy_id = (select val from ids2 where k = 'a'));
  end if;
  if not (public.run_parity_check('test')->>'ok')::boolean then
    raise exception 'parity after re-point: %', public.run_parity_check('test');
  end if;
end $$;

-- 7. Two scenarios with one key are refused.
do $$ begin
  perform store.sync_case_study_refs(jsonb_build_object('studies', jsonb_build_array(jsonb_build_object(
    'slug', 'dup', 'title', 'Dup', 'published', '2026-01-01', 'strategies', jsonb_build_array(
      jsonb_build_object('number', (select n from ids2 where k = 'a'), 'key', 'same', 'anchor', 'scenario-1', 'scenario', 'One'),
      jsonb_build_object('number', (select n from ids2 where k = 'b'), 'key', 'same', 'anchor', 'scenario-2', 'scenario', 'Two'))))));
  raise exception 'duplicate scenario keys were accepted';
exception when invalid_parameter_value then null;
end $$;

-- 8. Access: only the approver may sync; nobody calls the store function.
set role anon;
do $$ begin
  begin
    perform public.admin_sync_case_study_refs(pg_temp.idx());
    raise exception 'anon synced links';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;
set role authenticated;
select set_config('request.jwt.claim.sub', (select val::text from ids2 where k = 'editor'), false);
do $$ begin
  begin
    perform public.admin_sync_case_study_refs(pg_temp.idx());
    raise exception 'an editor synced links';
  exception when insufficient_privilege then null;
  end;
  begin
    perform store.sync_case_study_refs(pg_temp.idx());
    raise exception 'an editor called the store function';
  exception when insufficient_privilege then null;
  end;
end $$;
select set_config('request.jwt.claim.sub', (select val::text from ids2 where k = 'approver'), false);
do $$
declare res jsonb := public.admin_sync_case_study_refs(pg_temp.idx());
begin
  if (res->>'links')::int <> 3 then
    raise exception 'approver sync: %', res;
  end if;
end $$;
reset role;

-- 9. The public view carries the links of a public strategy; parity is clean.
do $$ begin
  if exists (select 1 from public.strategies_public p
             join public.strategies_pro r using (id)
             where p.case_studies is distinct from r.case_studies) then
    raise exception 'public and Pro views disagree on links';
  end if;
  if not (public.run_parity_check('test')->>'ok')::boolean then
    raise exception 'parity after ingest phase 2: %', public.run_parity_check('test');
  end if;
end $$;

delete from store.case_study_refs;

\echo 'ingest phase 2 db checks passed'
