-- Auto-ingestion PRD, Phase 4 ("Pipeline, live"): the pipeline publishes.
--
-- What this adds
--   pipeline_publish             publishes a case study draft the pipeline
--                                saved, with no person in between. Errors block;
--                                a review check blocks unless it is on a fixed
--                                list (GR3). The approval recorded is the case
--                                study commit and its author ("publishing the
--                                case study is the approval").
--   pipeline_attach_screenshots  may now replace the screenshots of a strategy
--                                that is already published (PB5), unless the
--                                strategy originates in another case study
--   pipeline_sync_case_study_refs the pipeline keeps the links in step with the
--                                live case study index (LK1), as the approver
--                                could since Phase 2
--   pipeline_record_baseline     BF2: the hash of an already numbered scenario,
--                                recorded once without writing a version
--   pipeline_scenario_state      also returns the hash of the published version
--                                when that version came from this scenario
--   run_parity_check             the pipeline may run it (it runs after every
--                                publish); otherwise unchanged from 20261115000001
--
-- Production gets 20261117000001 and this file together.

-- ---------------------------------------------------------------------------
-- 1. The checks the pipeline may let through (GR3). Each is a difference the
--    case study settles: its figure is stored where the data window differs
--    (EX5), and its window end where the chart's last bar was read differently
--    (EX6). Every other review check holds the strategy.
-- ---------------------------------------------------------------------------
create or replace function store.pipeline_acknowledgeable()
returns text[] language sql immutable as $$
  select array['roi_vs_extraction', 'net_profit_vs_extraction', 'cash_profit_vs_extraction', 'end_date_vs_chart']
$$;

create or replace function public.pipeline_publish(p_version uuid, p_author text)
returns jsonb
language plpgsql
security definer
set search_path = public, store, auth
as $$
declare
  who text;
  v store.strategy_versions;
  blocking jsonb;
  acked text[];
  parity jsonb;
begin
  perform store.require_role(array['pipeline']);
  who := public.admin_email();

  select * into v from store.strategy_versions where id = p_version for update;
  if v.id is null or v.status not in ('draft', 'in_review') then
    raise exception 'Version % is not an open draft.', p_version using errcode = 'P0001';
  end if;
  if v.source_kind <> 'case_study' or v.created_by <> who then
    raise exception 'The pipeline publishes only the case study drafts it saved.' using errcode = '42501';
  end if;

  v.checks := store.version_checks(v);
  select coalesce(jsonb_agg(c), '[]'::jsonb) into blocking
  from jsonb_array_elements(v.checks) c
  where c->>'level' = 'error'
     or (c->>'level' = 'review' and not (c->>'code' = any (store.pipeline_acknowledgeable())));
  if jsonb_array_length(blocking) > 0 then
    update store.strategy_versions set checks = v.checks where id = v.id;
    return jsonb_build_object('published', false, 'blocking', blocking);
  end if;
  select coalesce(array_agg(distinct c->>'code'), '{}') into acked
  from jsonb_array_elements(v.checks) c where c->>'level' = 'review';

  update store.strategy_versions set status = 'superseded', superseded_at = now()
   where strategy_id = v.strategy_id and status = 'published';

  update store.strategy_versions
     set status = 'published',
         submitted_by = who, submitted_at = now(),
         approved_by = format('case study %s at %s, published by %s',
                              v.case_study_slug, left(v.source_commit, 12),
                              coalesce(nullif(trim(p_author), ''), 'unknown')),
         published_at = now(), acknowledged_checks = acked, checks = v.checks
   where id = v.id;

  update public.recipes set current_version_id = v.id, slug = v.slug where id = v.strategy_id;

  parity := public.run_parity_check('publish');
  return jsonb_build_object(
    'published', true, 'version_id', v.id, 'strategy_id', v.strategy_id,
    'display_number', (select display_number from public.recipes where id = v.strategy_id),
    'slug', v.slug, 'title', v.title, 'listed_public', v.listed_public,
    'acknowledged', to_jsonb(acked), 'parity_ok', parity->'ok');
end;
$$;

-- ---------------------------------------------------------------------------
-- 2. Screenshots: a changed scenario brings new ones (PB5). A strategy that
--    originates in another case study keeps its own.
-- ---------------------------------------------------------------------------
create or replace function public.pipeline_attach_screenshots(p_version uuid, p_images jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, store, auth
as $$
declare
  who text;
  v store.strategy_versions;
  img jsonb;
begin
  perform store.require_role(array['pipeline']);
  who := public.admin_email();
  select * into v from store.strategy_versions where id = p_version for update;
  if v.id is null or v.status not in ('draft', 'in_review') or v.source_kind <> 'case_study' or v.created_by <> who then
    raise exception 'Version % is not an open pipeline draft.', p_version using errcode = '42501';
  end if;
  if exists (select 1 from store.case_study_refs c
             where c.strategy_id = v.strategy_id and c.role = 'origin'
               and (c.case_study_slug, c.scenario_key) is distinct from (v.case_study_slug, v.scenario_key)) then
    raise exception 'Strategy % originates in another case study; its screenshots stay.', v.strategy_id
      using errcode = '55006';
  end if;
  if jsonb_typeof(p_images) <> 'array' or jsonb_array_length(p_images) = 0 then
    raise exception 'No screenshots given.' using errcode = '22023';
  end if;

  delete from public.recipe_screenshots where recipe_id = v.strategy_id;
  for img in select * from jsonb_array_elements(p_images) loop
    if coalesce(img->>'url', '') !~ '/storage/v1/object/public/recipe-screenshots/case-studies/' then
      raise exception 'Screenshot address % is outside the case study folder.', img->>'url' using errcode = '22023';
    end if;
    if coalesce(img->>'kind', '') not in ('chart', 'settings', 'stats', 'dca') then
      raise exception 'Unknown screenshot kind %.', img->>'kind' using errcode = '22023';
    end if;
    insert into public.recipe_screenshots (recipe_id, image_url, display_order, kind, sha256)
    values (v.strategy_id, img->>'url', coalesce((img->>'order')::int, 0), img->>'kind', img->>'sha256');
  end loop;

  update store.strategy_versions set screenshots = store.screenshot_snapshot(v.strategy_id) where id = p_version;
  return store.screenshot_snapshot(v.strategy_id);
end;
$$;

-- ---------------------------------------------------------------------------
-- 3. Links (LK1) and the baseline (BF2).
-- ---------------------------------------------------------------------------
create or replace function public.pipeline_sync_case_study_refs(p_index jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, store, auth
as $$
begin
  perform store.require_role(array['pipeline']);
  return store.sync_case_study_refs(p_index);
end;
$$;

-- {"<scenario key>": "<hash>", ...}: recorded where the link has none yet.
create or replace function public.pipeline_record_baseline(p_slug text, p_hashes jsonb)
returns integer
language plpgsql
security definer
set search_path = public, store, auth
as $$
declare n integer;
begin
  perform store.require_role(array['pipeline']);
  update store.case_study_refs c
     set source_hash = p_hashes->>c.scenario_key, updated_at = now()
   where c.case_study_slug = p_slug and c.source_hash is null
     and coalesce(p_hashes->>c.scenario_key, '') <> '';
  get diagnostics n = row_count;
  return n;
end;
$$;

create or replace function public.pipeline_scenario_state(p_slug text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, store, auth
as $$
declare out jsonb;
begin
  perform store.require_role(array['pipeline']);
  select coalesce(jsonb_agg(x order by x->>'scenario_key'), '[]'::jsonb) into out
  from (
    select jsonb_build_object(
             'scenario_key', k.scenario_key,
             'display_number', coalesce(ref_r.display_number, draft_r.display_number),
             'ref_hash', ref.source_hash,
             'published_hash', pub.source_hash,
             'draft_version', d.id,
             'draft_hash', d.source_hash,
             'draft_strategy', d.strategy_id) as x
    from (
      select scenario_key from store.case_study_refs where case_study_slug = p_slug
      union
      select scenario_key from store.strategy_versions
        where source_kind = 'case_study' and case_study_slug = p_slug and status in ('draft', 'in_review', 'published')
    ) k
    left join store.case_study_refs ref on ref.case_study_slug = p_slug and ref.scenario_key = k.scenario_key
    left join public.recipes ref_r on ref_r.id = ref.strategy_id
    left join lateral (
      select v.* from store.strategy_versions v
      where v.source_kind = 'case_study' and v.case_study_slug = p_slug and v.scenario_key = k.scenario_key
        and v.status in ('draft', 'in_review')
      order by v.created_at desc limit 1
    ) d on true
    left join public.recipes draft_r on draft_r.id = d.strategy_id
    left join lateral (
      select v.source_hash from store.strategy_versions v
      where v.source_kind = 'case_study' and v.case_study_slug = p_slug and v.scenario_key = k.scenario_key
        and v.status = 'published'
      limit 1
    ) pub on true
  ) s;
  return out;
end;
$$;

revoke all on function public.pipeline_publish(uuid, text) from public, anon;
revoke all on function public.pipeline_sync_case_study_refs(jsonb) from public, anon;
revoke all on function public.pipeline_record_baseline(text, jsonb) from public, anon;
grant execute on function public.pipeline_publish(uuid, text) to authenticated;
grant execute on function public.pipeline_sync_case_study_refs(jsonb) to authenticated;
grant execute on function public.pipeline_record_baseline(text, jsonb) to authenticated;

-- ---------------------------------------------------------------------------
-- 4. The parity check runs after every publish (R5). Copied from
--    20261115000001 with one change: the pipeline may run it.
-- ---------------------------------------------------------------------------
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
          or public.admin_role() = 'pipeline'   -- after its own publishes (auto-ingestion Phase 4)
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
