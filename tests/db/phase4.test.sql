-- Phase 4 checks: the public chart (redesign PRD 7.1) and the market_tags
-- site content key (7.2). Any failure raises. Runs after phase3.test.sql.
\set ON_ERROR_STOP on

-- 1. The chart rule, on a published public version: kind 'chart' first, else
--    the first by display order (ties: snapshot order), else null. Version
--    triggers are bypassed inside a rolled-back transaction to try shapes.
begin;
set local session_replication_role = replica;
create temp table pick (version_id uuid);
insert into pick select version_id from public.strategies_public order by display_number limit 1;

update store.strategy_versions set screenshots = '[
  {"id": "a", "url": "https://x/recipe-screenshots/settings-1.png", "kind": null, "order": 1},
  {"id": "b", "url": "https://x/recipe-screenshots/chart.png", "kind": null, "order": 0},
  {"id": "c", "url": "https://x/recipe-screenshots/settings-2.png", "kind": null, "order": 2}]'
where id = (select version_id from pick);
do $$ begin
  if (select chart_url from public.strategies_public where version_id = (select version_id from pick)) <> 'https://x/recipe-screenshots/chart.png' then
    raise exception 'first by order not picked';
  end if;
end $$;

update store.strategy_versions set screenshots = '[
  {"id": "a", "url": "https://x/recipe-screenshots/first.png", "kind": "settings", "order": 0},
  {"id": "b", "url": "https://x/recipe-screenshots/tagged.png", "kind": "chart", "order": 3}]'
where id = (select version_id from pick);
do $$ begin
  if (select chart_url from public.strategies_public where version_id = (select version_id from pick)) <> 'https://x/recipe-screenshots/tagged.png' then
    raise exception 'kind chart not preferred';
  end if;
end $$;

update store.strategy_versions set screenshots = '[
  {"id": "a", "url": "https://x/recipe-screenshots/tie-first.png", "kind": null, "order": 1},
  {"id": "b", "url": "https://x/recipe-screenshots/tie-second.png", "kind": null, "order": 1}]'
where id = (select version_id from pick);
do $$ begin
  if (select chart_url from public.strategies_public where version_id = (select version_id from pick)) <> 'https://x/recipe-screenshots/tie-first.png' then
    raise exception 'order tie not broken by snapshot order';
  end if;
end $$;

update store.strategy_versions set screenshots = '[]' where id = (select version_id from pick);
do $$ begin
  if (select chart_url from public.strategies_public where version_id = (select version_id from pick)) is not null then
    raise exception 'chart_url not null without screenshots';
  end if;
  if (select chart_url from public.strategies_pro where version_id = (select version_id from pick)) is not null then
    raise exception 'pro chart_url not null without screenshots';
  end if;
end $$;
rollback;

-- 2. Parity is clean with the new column, and has no uncropped-image test.
do $$
declare res jsonb := public.run_parity_check('test');
begin
  if not (res->>'ok')::boolean then
    raise exception 'parity after phase 4: %', res;
  end if;
  if position('public_image_uncropped' in (select prosrc from pg_proc where proname = 'run_parity_check')) > 0 then
    raise exception 'public_image_uncropped test still present';
  end if;
  if not ('chart_url' = any (store.public_view_allowlist())) then
    raise exception 'chart_url not in the allowlist';
  end if;
end $$;

-- 3. Anonymous visitors read chart_url, and still no settings or screenshots list.
set role anon;
do $$ begin
  perform chart_url from public.strategies_public limit 1;
  begin
    perform screenshots from public.strategies_public limit 1;
    raise exception 'screenshots readable in the public view';
  exception when undefined_column then null;
  end;
end $$;
reset role;

-- 4. market_tags is a site content key; other unknown keys still are not.
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000d', false);
select public.admin_set_site_content('market_tags', '{"nvda-accumulation-41": "rising"}');
do $$ begin
  begin
    perform public.admin_set_site_content('market_tag', '{}');
    raise exception 'an unknown key was accepted';
  exception when check_violation then null;
  end;
end $$;
reset role;
do $$ begin
  if (select value->>'nvda-accumulation-41' from public.site_content where key = 'market_tags') <> 'rising' then
    raise exception 'market_tags not readable';
  end if;
end $$;

\echo 'phase4 db checks passed'
