-- Phase 0 checks on a database built from the migrations. Any failure raises.
\set ON_ERROR_STOP on

-- 1. The seed keeps confirmed staff and nobody else.
do $$
begin
  if (select array_agg(email order by email) from public.admin_users) is distinct from array['staff.member@archpublic.com'] then
    raise exception 'seed wrong: %', (select array_agg(email) from public.admin_users);
  end if;
end $$;

-- 2. A listed admin can write a strategy.
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', false);
do $$ begin
  if not public.is_admin() then raise exception 'listed admin not recognised'; end if;
  if public.admin_role() <> 'editor' then raise exception 'role wrong: %', public.admin_role(); end if;
end $$;
insert into public.recipes (name, asset, time_horizon, strategy_type, focus, goal, time_frame, algorithm, algorithm_inputs)
values ('Phase 0 test strategy', 'BTC', 'LTH', 'Test', 'Balanced', 'Test', '1 Day', 'Market Wave', '{}');

-- 3. Unlisted accounts cannot write, whatever their domain.
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000b', false);
do $$ begin
  begin
    insert into public.recipes (name, asset, time_horizon, strategy_type, focus, goal, time_frame, algorithm, algorithm_inputs)
    values ('should fail', 'BTC', 'LTH', 'Test', 'Balanced', 'Test', '1 Day', 'Market Wave', '{}');
    raise exception 'unlisted @archpublic.com account could write';
  exception when insufficient_privilege then null;
  end;
  if (select count(*) from public.recipes where name = 'Phase 0 test strategy') <> 1 then
    raise exception 'public read broken';
  end if;
  update public.recipes set goal = 'tampered' where name = 'Phase 0 test strategy';
  if exists (select 1 from public.recipes where goal = 'tampered') then
    raise exception 'unlisted account could update';
  end if;
end $$;

-- 4. Anonymous visitors cannot read the admin list.
reset role;
set role anon;
do $$ begin
  begin
    perform 1 from public.admin_users;
    raise exception 'anon can read admin_users';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;

-- 5. Sign-up is refused unless the email is listed first.
do $$ begin
  begin
    insert into auth.users (email, email_confirmed_at) values ('new.hire@archpublic.com', now());
    raise exception 'unlisted sign-up was accepted';
  exception when raise_exception then
    if sqlerrm not like 'Sign-up is closed%' then raise; end if;
  end;
end $$;
insert into public.admin_users (email, role, added_by) values ('invited@archpublic.com', 'approver', 'test');
insert into auth.users (email, email_confirmed_at) values ('Invited@ArchPublic.com', now());

select 'allowlist checks passed' as result;
