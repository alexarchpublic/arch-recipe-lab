-- Auto-ingestion Phase 5 (BF3) checks: the pipeline renames a live strategy
-- as a copy-type version, keeps every figure, setting and the page address,
-- and refuses anything else. Any failure raises.
-- Runs after ingest_phase4.test.sql (which published strategies as the pipeline).
\set ON_ERROR_STOP on

create temp table ids5 (k text primary key, n int, ver uuid, slug text, snap jsonb);
grant all on ids5 to anon, authenticated;

-- The strategy phase 4 published first, and one with an open draft (phase 4's b2).
insert into ids5
select 'a', r.display_number, r.current_version_id, v.slug,
       to_jsonb(v) - array['id', 'version_number', 'status', 'change_type', 'title', 'name', 'short_name', 'goal',
                           'how_it_trades', 'change_note', 'created_by', 'created_at', 'updated_at', 'submitted_by',
                           'submitted_at', 'approved_by', 'published_at', 'superseded_at', 'checks',
                           'acknowledged_checks', 'restored_from']
from public.recipes r join store.strategy_versions v on v.id = r.current_version_id
where v.title = 'Apple test strategy';
insert into ids5
select 'b', r.display_number, r.current_version_id, null, null
from public.recipes r join store.strategy_versions v on v.id = r.current_version_id
where v.title = 'Apple second test strategy';
do $$ begin
  if (select count(*) from ids5 where n is not null) <> 2 then raise exception 'fixtures missing: %', (select jsonb_agg(ids5) from ids5); end if;
  if not exists (select 1 from store.strategy_versions where strategy_id = (select id from public.recipes where display_number = (select n from ids5 where k = 'b')) and status in ('draft', 'in_review')) then
    raise exception 'strategy b should have an open draft from phase 4';
  end if;
end $$;

-- 1. An editor cannot call it.
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', false);
do $$ begin
  begin
    perform public.pipeline_publish_copy(1, null, '{"title": "x"}', 'n');
    raise exception 'an editor called pipeline_publish_copy';
  exception when insufficient_privilege then null;
  end;
end $$;

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000b1', false);

-- 2. Fields other than title, goal and how_it_trades are refused.
do $$ begin
  begin
    perform public.pipeline_publish_copy((select n from ids5 where k = 'a'), (select ver from ids5 where k = 'a'),
      '{"title": "Apple renamed", "net_profit_usd": 1}', 'BF3 test');
    raise exception 'a figure went through a rename';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.pipeline_publish_copy((select n from ids5 where k = 'a'), (select ver from ids5 where k = 'a'),
      '{"title": "Apple renamed", "slug": "elsewhere"}', 'BF3 test');
    raise exception 'a page address went through a rename';
  exception when insufficient_privilege then null;
  end;
end $$;

-- 3. A list made from an older version is refused.
do $$ begin
  begin
    perform public.pipeline_publish_copy((select n from ids5 where k = 'a'), '00000000-0000-0000-0000-000000000000',
      '{"title": "Apple renamed"}', 'BF3 test');
    raise exception 'a stale list went through';
  exception when serialization_failure then null;
  end;
end $$;

-- 4. A strategy with an open draft is held.
do $$ begin
  begin
    perform public.pipeline_publish_copy((select n from ids5 where k = 'b'), (select ver from ids5 where k = 'b'),
      '{"title": "Apple renamed twice"}', 'BF3 test');
    raise exception 'a rename went over an open draft';
  exception when object_in_use then null;
  end;
end $$;

-- 5. A rename publishes a copy version: same figures, settings, screenshots and address.
create temp table res5 (res jsonb);
grant all on res5 to authenticated;
insert into res5 select public.pipeline_publish_copy((select n from ids5 where k = 'a'), (select ver from ids5 where k = 'a'),
  '{"title": "Apple through a test year", "goal": "A test summary.", "how_it_trades": "A test description."}',
  'BF3 rename: list approved by the owner on 2026-11-13');
reset role;
do $$
declare
  r jsonb := (select res from res5);
  v store.strategy_versions;
  snap jsonb;
begin
  if not (r->>'published')::boolean or r->>'change_type' <> 'copy' or not (r->>'parity_ok')::boolean then
    raise exception 'rename: %', r;
  end if;
  select * into v from store.strategy_versions where id = (r->>'version_id')::uuid;
  if v.slug <> (select slug from ids5 where k = 'a') then raise exception 'slug moved: %', v.slug; end if;
  if v.title <> 'Apple through a test year' or v.short_name <> v.title or v.name <> v.title
     or v.goal <> 'A test summary.' or v.how_it_trades <> 'A test description.' then
    raise exception 'copy fields: % / % / % / % / %', v.title, v.short_name, v.name, v.goal, v.how_it_trades;
  end if;
  snap := to_jsonb(v) - array['id', 'version_number', 'status', 'change_type', 'title', 'name', 'short_name', 'goal',
                              'how_it_trades', 'change_note', 'created_by', 'created_at', 'updated_at', 'submitted_by',
                              'submitted_at', 'approved_by', 'published_at', 'superseded_at', 'checks',
                              'acknowledged_checks', 'restored_from'];
  if snap is distinct from (select ids5.snap from ids5 where k = 'a') then
    raise exception 'something besides the copy changed: %',
      (select jsonb_object_agg(key, value) from jsonb_each(snap) where (select ids5.snap from ids5 where k = 'a')->key is distinct from value);
  end if;
  if v.approved_by not like 'BF3 rename: list approved by the owner on 2026-11-13; published by %' then
    raise exception 'approved_by: %', v.approved_by;
  end if;
  if (select status from store.strategy_versions where id = (select ver from ids5 where k = 'a')) <> 'superseded' then
    raise exception 'the old version was not superseded';
  end if;
  if (select slug from public.recipes where display_number = (select n from ids5 where k = 'a')) <> v.slug then
    raise exception 'recipes.slug moved';
  end if;
  if not exists (select 1 from public.strategies_pro where display_number = (select n from ids5 where k = 'a') and title = 'Apple through a test year') then
    raise exception 'not on the Pro view';
  end if;
  if not (public.run_parity_check('test')->>'ok')::boolean then
    raise exception 'parity: %', public.run_parity_check('test');
  end if;
end $$;

-- 6. anon cannot execute it.
do $$ begin
  if has_function_privilege('anon', 'public.pipeline_publish_copy(integer, uuid, jsonb, text)', 'execute') then
    raise exception 'anon can execute pipeline_publish_copy';
  end if;
end $$;
select set_config('request.jwt.claim.sub', '', false);
\echo ingest phase 5 db checks passed
