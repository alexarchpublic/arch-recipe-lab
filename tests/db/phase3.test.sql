-- Phase 3 checks: site content (S12, C5), leads (S2 to S5) and page parity
-- records (R5). Any failure raises. Runs after phase2.test.sql.
\set ON_ERROR_STOP on

create temp table ids3 (k text primary key, val uuid);
grant all on ids3 to anon, authenticated;
insert into ids3 values
  ('editor',    '00000000-0000-0000-0000-00000000000a'),
  ('marketing', '00000000-0000-0000-0000-00000000000d'),
  ('approver',  (select id from auth.users where lower(email) = 'invited@archpublic.com'));

create or replace function pg_temp.as_user3(k text) returns void language sql as $$
  select set_config('request.jwt.claim.sub', (select val::text from ids3 where ids3.k = $1), false)
$$;

-- 1. Marketing and approvers set content; editors and anon cannot.
set role authenticated;
select pg_temp.as_user3('marketing');
select public.admin_set_site_content('home', '{"hero": {"headline": "Rules, not emotions."}, "featured": ["nvda-accumulation-41"]}');
select public.admin_set_site_content('partner:acme-capital', '{"name": "Acme Capital", "partner_id": "acme"}');
select pg_temp.as_user3('approver');
select public.admin_set_site_content('config', '{"finder": false}');
do $$ begin
  begin
    perform public.admin_set_site_content('home', '{"hero": {"stats": {"return_pct": 1192}}}');
    raise exception 'a figure was accepted in site content';
  exception when invalid_parameter_value then null;
  end;
  begin
    perform public.admin_set_site_content('pricing', '{}');
    raise exception 'an unknown key was accepted';
  exception when check_violation then null;
  end;
  begin
    perform public.admin_set_site_content('home', '[1, 2]');
    raise exception 'a non-object value was accepted';
  exception when check_violation then null;
  end;
end $$;
select pg_temp.as_user3('editor');
do $$ begin
  begin
    perform public.admin_set_site_content('home', '{}');
    raise exception 'an editor set site content';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;

set role anon;
do $$ begin
  if (select value->'hero'->>'headline' from public.site_content where key = 'home') <> 'Rules, not emotions.' then
    raise exception 'home content not readable';
  end if;
  if (select count(*) from public.site_content) <> 3 then
    raise exception 'expected 3 content rows, found %', (select count(*) from public.site_content);
  end if;
  begin
    perform updated_by from public.site_content;
    raise exception 'public.site_content exposes who changed it';
  exception when undefined_column then null;
  end;
  begin
    perform public.admin_set_site_content('home', '{}');
    raise exception 'anon set site content';
  exception when insufficient_privilege then null;
  end;
  begin
    perform 1 from public.admin_site_content_history;
    raise exception 'anon reads content history';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;

-- Removing a key keeps the history.
set role authenticated;
select pg_temp.as_user3('marketing');
select public.admin_set_site_content('partner:acme-capital', null);
reset role;
do $$ begin
  if exists (select 1 from store.site_content where key = 'partner:acme-capital') then
    raise exception 'partner page not removed';
  end if;
  if (select count(*) from store.site_content_history) <> 4 then
    raise exception 'content history has % rows, expected 4', (select count(*) from store.site_content_history);
  end if;
end $$;

-- 2. Anyone can submit a lead; nobody but admins can read them.
set role anon;
select public.submit_lead('booking_started', ' Prospect@Example.com ', '{"strategy_in_view": "nvda-accumulation-41", "account_size": "50k-250k"}', 'ok');
select public.submit_lead('alert', 'prospect@example.com', '{"asset_classes": ["Crypto"]}');
do $$ begin
  begin
    perform 1 from public.admin_leads;
    raise exception 'anon reads leads';
  exception when insufficient_privilege then null;
  end;
  begin
    perform 1 from store.leads;
    raise exception 'anon reads the leads table';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.submit_lead('newsletter', 'a@b.co');
    raise exception 'an unknown lead kind was accepted';
  exception when check_violation then null;
  end;
  begin
    perform public.submit_lead('alert', 'not-an-email');
    raise exception 'a bad email was accepted';
  exception when check_violation then null;
  end;
  begin
    perform public.admin_record_page_parity('publish', true, '{}', '[]');
    raise exception 'anon recorded page parity';
  exception when insufficient_privilege then null;
  end;
end $$;
-- The flood guard: 20 an hour per address.
do $$ begin
  for i in 1..18 loop
    perform public.submit_lead('email_me_this', 'prospect@example.com');
  end loop;
  begin
    perform public.submit_lead('email_me_this', 'PROSPECT@example.com');
    raise exception 'the flood guard did not stop the 21st lead';
  exception when program_limit_exceeded then null;
  end;
end $$;
reset role;

do $$ begin
  if (select email from store.leads order by id limit 1) <> 'prospect@example.com' then
    raise exception 'lead email not normalised';
  end if;
  if (select count(*) from store.leads) <> 20 then
    raise exception 'expected 20 leads, found %', (select count(*) from store.leads);
  end if;
end $$;

set role authenticated;
select pg_temp.as_user3('editor');
do $$ begin
  if (select count(*) from public.admin_leads) <> 20 then
    raise exception 'an admin cannot read leads';
  end if;
end $$;

-- 3. Admins record the public page check next to the view checks.
select public.admin_record_page_parity('publish', false, '{"pages": 1}', '[{"check": "page_version", "strategy": 41}]');
reset role;
do $$ begin
  if (select trigger || ':' || ok::text from store.parity_runs order by id desc limit 1) <> 'pages:publish:false' then
    raise exception 'page parity not recorded';
  end if;
end $$;

\echo 'phase3 db checks passed'
