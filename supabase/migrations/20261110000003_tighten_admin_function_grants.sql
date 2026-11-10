-- Phase 0 follow-up: narrow who can call the admin functions over the API,
-- from Supabase's security advisor after 20261110000001/2 ran.
--
-- Kept callable on purpose:
--   user_has_valid_domain()  every write policy runs it as the signed-in user
--   is_admin()               /admin and the screenshot API ask it, signed in
--
-- Tightened:
--   is_admin(), admin_role()     nobody needs them signed out
--   refuse_unlisted_signup()     a trigger; never called directly
--   validate_email_domain(text)  no longer used by any policy or function

revoke execute on function public.is_admin() from anon;
revoke execute on function public.admin_role() from anon;

revoke execute on function public.refuse_unlisted_signup() from public, anon, authenticated;

revoke execute on function public.validate_email_domain(text) from public, anon, authenticated;
alter function public.validate_email_domain(text) set search_path = public;
