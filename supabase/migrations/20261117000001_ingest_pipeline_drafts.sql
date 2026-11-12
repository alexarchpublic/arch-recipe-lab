-- Auto-ingestion PRD, Phase 3 ("Pipeline, dry run"): the pipeline's own
-- identity and the four functions it may call. It saves drafts and records
-- what Claude read. It publishes nothing: admin_publish_from_case_study and
-- the number write-back are Phase 4.
--
-- What this adds
--   admin_users.role 'pipeline'   a fourth identity (main PRD A1): the
--                                 pipeline's own service account
--   is_admin()                    true for the three people roles only, so the
--                                 pipeline cannot read admin views or use the
--                                 older write policies (GR8)
--   storage policy                the pipeline may upload screenshots under
--                                 recipe-screenshots/case-studies/ and nowhere
--                                 else
--   pipeline_scenario_state       what the store holds for a case study's
--                                 scenarios: number, last hash, open draft (TR3,
--                                 TR4, NO4)
--   pipeline_save_draft           create or update the open draft of the
--                                 scenario's strategy, with its source set; a
--                                 new scenario gets a new strategy and number
--                                 (NO1). Never touches a draft a person opened.
--   pipeline_attach_screenshots   the source screenshots of a strategy the
--                                 pipeline created (TR2)
--   pipeline_record_extraction    provenance of every reading (EX4)
--
-- Phase 3 applies this to STAGING only. Production gets it with Phase 4.

-- ---------------------------------------------------------------------------
-- 1. The pipeline role.
-- ---------------------------------------------------------------------------
alter table public.admin_users drop constraint if exists admin_users_role_check;
alter table public.admin_users add constraint admin_users_role_check
  check (role in ('editor', 'approver', 'marketing_editor', 'pipeline'));

-- is_admin() gates every admin view and, through user_has_valid_domain(), the
-- older write policies on recipes, recipe_screenshots and storage. The
-- pipeline is not an admin: it writes only through its own functions.
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select coalesce(public.admin_role() in ('editor', 'approver', 'marketing_editor'), false)
$$;

drop policy if exists "Pipeline uploads case study screenshots" on storage.objects;
create policy "Pipeline uploads case study screenshots" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'recipe-screenshots'
              and name like 'case-studies/%'
              and public.admin_role() = 'pipeline');

-- ---------------------------------------------------------------------------
-- 2. What the store holds for a case study's scenarios.
-- ---------------------------------------------------------------------------
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
             'draft_version', d.id,
             'draft_hash', d.source_hash,
             'draft_strategy', d.strategy_id) as x
    from (
      select scenario_key from store.case_study_refs where case_study_slug = p_slug
      union
      select scenario_key from store.strategy_versions
        where source_kind = 'case_study' and case_study_slug = p_slug and status in ('draft', 'in_review')
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
  ) s;
  return out;
end;
$$;

-- ---------------------------------------------------------------------------
-- 3. Save the scenario's draft.
--    p_number is the scenario's strategyNumber, or null for a new scenario.
--    A run that stopped partway finds its own draft by case study and
--    scenario before it creates anything (NO4).
-- ---------------------------------------------------------------------------
create or replace function public.pipeline_save_draft(
  p_slug text, p_scenario_key text, p_commit text, p_hash text, p_number integer, p_fields jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, store, auth
as $$
declare
  who text;
  strategy uuid;
  open_draft store.strategy_versions;
  version uuid;
  created boolean := false;
begin
  perform store.require_role(array['pipeline']);
  who := public.admin_email();
  if coalesce(trim(p_slug), '') = '' or coalesce(trim(p_scenario_key), '') = ''
     or coalesce(trim(p_commit), '') = '' or coalesce(trim(p_hash), '') = '' then
    raise exception 'A case study draft needs its slug, scenario key, commit and hash.' using errcode = '22023';
  end if;

  if p_number is not null then
    select id into strategy from public.recipes where display_number = p_number;
    if strategy is null then
      raise exception 'No strategy #% exists.', p_number using errcode = 'P0002';
    end if;
  else
    select v.strategy_id into strategy from store.strategy_versions v
      where v.source_kind = 'case_study' and v.case_study_slug = p_slug and v.scenario_key = p_scenario_key
        and v.status in ('draft', 'in_review')
      order by v.created_at desc limit 1;
  end if;

  if strategy is not null then
    select * into open_draft from store.strategy_versions
      where strategy_id = strategy and status in ('draft', 'in_review') for update;
    -- A draft a person opened is theirs. The pipeline holds this strategy
    -- rather than overwrite it.
    if open_draft.id is not null and (open_draft.source_kind <> 'case_study' or open_draft.created_by <> who) then
      raise exception 'Strategy #% has an open draft by %; held.',
        (select display_number from public.recipes where id = strategy), open_draft.created_by
        using errcode = '55006';
    end if;
  else
    created := true;
  end if;

  version := store.save_draft(strategy, p_fields, who, 'editor');

  update store.strategy_versions
     set source_kind = 'case_study', case_study_slug = p_slug, scenario_key = p_scenario_key,
         source_commit = p_commit, source_hash = p_hash
   where id = version;

  select strategy_id into strategy from store.strategy_versions where id = version;
  return jsonb_build_object(
    'version_id', version,
    'strategy_id', strategy,
    'display_number', (select display_number from public.recipes where id = strategy),
    'created', created,
    'checks', (select checks from store.strategy_versions where id = version));
end;
$$;

-- ---------------------------------------------------------------------------
-- 4. Screenshots of a strategy the pipeline created. A strategy that already
--    has screenshots keeps them in Phase 3; replacing a published strategy's
--    screenshots comes with Phase 4's publish.
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
  if exists (select 1 from store.strategy_versions where strategy_id = v.strategy_id and status in ('published', 'superseded', 'archived')) then
    raise exception 'Strategy % has published versions; its screenshots change only at publish (Phase 4).', v.strategy_id
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
-- 5. Provenance of a reading (EX4, main PRD A5).
-- ---------------------------------------------------------------------------
create or replace function public.pipeline_record_extraction(
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
  perform store.require_role(array['pipeline']);
  if p_provider <> 'anthropic' then
    raise exception 'The pipeline reads with Claude only (EX8).' using errcode = '22023';
  end if;
  insert into store.extractions (created_by, strategy_id, provider, model, prompt_version, images, raw_output,
                                 parsed, warnings, cross_check, schema_errors, last_bar_date)
  values (public.admin_email(), p_strategy, p_provider, p_model, p_prompt_version, coalesce(p_images, '[]'),
          p_raw_output, p_parsed, coalesce(p_warnings, '[]'), coalesce(p_cross_check, '[]'),
          coalesce(p_schema_errors, '[]'), p_last_bar_date)
  returning id into new_id;
  return new_id;
end;
$$;

revoke all on function public.pipeline_scenario_state(text) from public, anon;
revoke all on function public.pipeline_save_draft(text, text, text, text, integer, jsonb) from public, anon;
revoke all on function public.pipeline_attach_screenshots(uuid, jsonb) from public, anon;
revoke all on function public.pipeline_record_extraction(uuid, text, text, text, jsonb, text, jsonb, jsonb, jsonb, jsonb, date)
  from public, anon;
grant execute on function public.pipeline_scenario_state(text) to authenticated;
grant execute on function public.pipeline_save_draft(text, text, text, text, integer, jsonb) to authenticated;
grant execute on function public.pipeline_attach_screenshots(uuid, jsonb) to authenticated;
grant execute on function public.pipeline_record_extraction(uuid, text, text, text, jsonb, text, jsonb, jsonb, jsonb, jsonb, date)
  to authenticated;
