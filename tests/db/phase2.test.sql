-- Phase 2 checks: disclaimer wording as data (PRD C2). Any failure raises.
-- Runs after phase1.test.sql, which leaves an editor, an approver and a
-- marketing editor in public.admin_users.
\set ON_ERROR_STOP on

create temp table ids (k text primary key, val uuid);
grant all on ids to anon, authenticated;
insert into ids values
  ('editor',    '00000000-0000-0000-0000-00000000000a'),
  ('marketing', '00000000-0000-0000-0000-00000000000d'),
  ('approver',  (select id from auth.users where lower(email) = 'invited@archpublic.com'));

create or replace function pg_temp.as_user(k text) returns void language sql as $$
  select set_config('request.jwt.claim.sub', (select val::text from ids where ids.k = $1), false)
$$;

-- 1. Anyone reads the wording; nobody but admins sees who changed it.
set role anon;
do $$ begin
  if (select body from public.disclosures where key = 'results') is distinct from
     'Past and backtested performance does not guarantee future results.' then
    raise exception 'default results disclaimer missing';
  end if;
  begin
    perform updated_by from public.disclosures;
    raise exception 'public.disclosures exposes who changed it';
  exception when undefined_column then null;
  end;
  begin
    perform 1 from public.admin_disclosure_history;
    raise exception 'anon reads disclosure history';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.admin_set_disclosure('results', 'anon text');
    raise exception 'anon set the disclaimer';
  exception when insufficient_privilege then null;
  end;
  begin
    perform 1 from store.disclosures;
    raise exception 'anon reads the store table';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;

-- 2. An editor cannot set it; a marketing editor and an approver can.
set role authenticated;
select pg_temp.as_user('editor');
do $$ begin
  begin
    perform public.admin_set_disclosure('results', 'editor text');
    raise exception 'an editor set the disclaimer';
  exception when insufficient_privilege then null;
  end;
end $$;
select pg_temp.as_user('marketing');
select public.admin_set_disclosure('results', '  Counsel draft one.  ');
select pg_temp.as_user('approver');
select public.admin_set_disclosure('results', 'Counsel draft two.');
do $$ begin
  begin
    perform public.admin_set_disclosure('results', '   ');
    raise exception 'an empty disclaimer was accepted';
  exception when invalid_parameter_value then null;
  end;
  begin
    perform public.admin_set_disclosure('share_card', 'x');
    raise exception 'an unknown slot was accepted';
  exception when check_violation then null;
  end;
end $$;
reset role;

-- 3. The live wording is the last one set, trimmed; every change is kept.
do $$ begin
  if (select body from public.disclosures where key = 'results') <> 'Counsel draft two.' then
    raise exception 'disclaimer not updated';
  end if;
  if (select string_agg(body || '|' || changed_by, ',' order by id) from store.disclosure_history) <>
     'Past and backtested performance does not guarantee future results.|migration 20261112000001,'
     || 'Counsel draft one.|marketing@archpublic.com,Counsel draft two.|invited@archpublic.com' then
    raise exception 'disclosure history wrong: %', (select string_agg(body || '|' || changed_by, ',' order by id) from store.disclosure_history);
  end if;
end $$;

\echo 'phase2 db checks passed'
