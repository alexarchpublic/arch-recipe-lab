-- Phase 0 (PRD A1): close admin self-registration in the database.
--
-- The only accounts in this project's auth are admin accounts. Removing the
-- sign-up form does not stop someone calling the sign-up API with the public
-- key, so new auth users are refused unless their email is already on
-- public.admin_users. To add an admin: insert the email into
-- public.admin_users first, then invite them from the Supabase dashboard.
--
-- Kept in its own migration so the allowlist (20261110000001) still applies
-- if a platform rule on the auth schema refuses this trigger. In that case,
-- turn off "Allow new users to sign up" under Authentication > Sign In /
-- Providers instead; the allowlist already blocks writes either way.

create or replace function public.refuse_unlisted_signup()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if new.email is null
     or not exists (select 1 from public.admin_users a where a.email = lower(new.email)) then
    raise exception 'Sign-up is closed. Ask the Strategy Lab owner to add you to the admin list.'
      using errcode = 'P0001';
  end if;
  return new;
end;
$$;

drop trigger if exists refuse_unlisted_signup on auth.users;
create trigger refuse_unlisted_signup
  before insert on auth.users
  for each row execute function public.refuse_unlisted_signup();
