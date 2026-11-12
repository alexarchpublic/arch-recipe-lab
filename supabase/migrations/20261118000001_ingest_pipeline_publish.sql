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
