-- Auto-ingestion PRD, Phase 5, BF3: rename the older live strategies to one
-- plain title each, as copy-type versions (NM9), once the owner has approved
-- the before-and-after list (Q3).
--
-- What this adds
--   pipeline_publish_copy(number, expected version, fields, note)
--       The pipeline account publishes a new version of one live strategy
--       that differs from the published one only in its title, summary (goal)
--       and description (how_it_trades). Everything else is copied from the
--       published version: figures, settings, screenshots, the page address
--       and the extraction it came from. It refuses
--         - any field other than those three (store.save_draft's copy-only
--           role does the refusing),
--         - an archived strategy,
--         - a strategy whose published version is not the one the list was
--           made from (it moved since the owner looked),
--         - a strategy with an open draft (a person's work is theirs),
--         - a result that is not change type copy, or that moves the page
--           address,
--         - a check that blocks: an error, or a review check the published
--           version had not already acknowledged.
--       Any refusal raises, so nothing is left behind: no stray draft.
--       The approval recorded is the note, which names who approved the list
--       and when. The parity check runs after each publish.
--
-- Nothing else changes. Additive: one function, callable by the pipeline role
-- only (anon cannot execute it).

create or replace function public.pipeline_publish_copy(
  p_number integer, p_expected_version uuid, p_fields jsonb, p_note text)
returns jsonb
language plpgsql
security definer
set search_path = public, store, auth
as $$
declare
  who text;
  strategy uuid;
  archived timestamptz;
  published store.strategy_versions;
  open_draft uuid;
  version uuid;
  v store.strategy_versions;
  bad text[];
  blocking jsonb;
  acked text[];
  parity jsonb;
begin
  perform store.require_role(array['pipeline']);
  who := public.admin_email();

  if coalesce(trim(p_note), '') = '' then
    raise exception 'A rename needs a note naming who approved it.' using errcode = '22023';
  end if;
  select array_agg(k) into bad from jsonb_object_keys(coalesce(p_fields, '{}'::jsonb)) k
    where k not in ('title', 'goal', 'how_it_trades');
  if bad is not null then
    raise exception 'A rename sets only title, goal and how_it_trades, not %.', array_to_string(bad, ', ')
      using errcode = '42501';
  end if;
  if coalesce(trim(p_fields->>'title'), '') = '' then
    raise exception 'A rename needs a title.' using errcode = '22023';
  end if;

  select id, archived_at into strategy, archived from public.recipes where display_number = p_number;
  if strategy is null then
    raise exception 'No strategy #% exists.', p_number using errcode = 'P0002';
  end if;
  if archived is not null then
    raise exception 'Strategy #% is archived.', p_number using errcode = 'P0001';
  end if;

  select * into published from store.strategy_versions
    where strategy_id = strategy and status = 'published' for update;
  if published.id is distinct from p_expected_version then
    raise exception 'Strategy #% has changed since the list was made (published version % , expected %); held.',
      p_number, published.id, p_expected_version using errcode = '40001';
  end if;
  select id into open_draft from store.strategy_versions
    where strategy_id = strategy and status in ('draft', 'in_review');
  if open_draft is not null then
    raise exception 'Strategy #% has an open draft; held.', p_number using errcode = '55006';
  end if;

  -- The copy-only role: store.save_draft refuses every field outside
  -- store.copy_fields() and change_note.
  version := store.save_draft(strategy, p_fields || jsonb_build_object('change_note', p_note), who, 'marketing_editor');
  -- Keep where the published version came from.
  update store.strategy_versions
     set extraction_id = published.extraction_id,
         source_kind = published.source_kind, case_study_slug = published.case_study_slug,
         scenario_key = published.scenario_key, source_commit = published.source_commit,
         source_hash = published.source_hash
   where id = version;

  select * into v from store.strategy_versions where id = version for update;
  if v.change_type <> 'copy' then
    raise exception 'The rename of #% came out as a % change, not copy; nothing published.', p_number, v.change_type
      using errcode = 'P0001';
  end if;
  if v.slug is distinct from published.slug then
    raise exception 'The rename of #% would move its page from % to %; nothing published.', p_number, published.slug, v.slug
      using errcode = 'P0001';
  end if;

  v.checks := store.version_checks(v);
  select coalesce(jsonb_agg(c), '[]'::jsonb) into blocking
  from jsonb_array_elements(v.checks) c
  where c->>'level' = 'error'
     or (c->>'level' = 'review' and not (c->>'code' = any (published.acknowledged_checks)));
  if jsonb_array_length(blocking) > 0 then
    raise exception 'The rename of #% is held by checks: %', p_number, blocking using errcode = 'P0001';
  end if;
  select coalesce(array_agg(distinct c->>'code'), '{}') into acked
  from jsonb_array_elements(v.checks) c where c->>'level' = 'review';

  update store.strategy_versions set status = 'superseded', superseded_at = now() where id = published.id;
  update store.strategy_versions
     set status = 'published',
         submitted_by = who, submitted_at = now(),
         approved_by = format('%s; published by %s', p_note, who),
         published_at = now(), acknowledged_checks = acked, checks = v.checks
   where id = v.id;
  update public.recipes set current_version_id = v.id, slug = v.slug where id = strategy;

  parity := public.run_parity_check('publish');
  return jsonb_build_object(
    'published', true, 'display_number', p_number, 'version_id', v.id,
    'previous_version_id', published.id, 'change_type', v.change_type,
    'slug', v.slug, 'title', v.title, 'parity_ok', parity->'ok');
end;
$$;
revoke all on function public.pipeline_publish_copy(integer, uuid, jsonb, text) from public, anon;
grant execute on function public.pipeline_publish_copy(integer, uuid, jsonb, text) to authenticated;
