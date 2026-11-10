-- Phase 0 (PRD A1): admin access becomes a named allowlist.
--
-- Until now any confirmed @archpublic.com account could write strategy data,
-- and anyone could create such an account from the /auth page. After this
-- migration only emails listed in public.admin_users can write. Every write
-- policy already calls public.user_has_valid_domain(), so redefining that
-- function closes all of them at once (recipes, recipe_screenshots, storage).
--
-- Roles follow the PRD: editor, approver, marketing_editor. Phase 0 enforces
-- membership only; role-specific permissions arrive with publish in Phase 1.

create table if not exists public.admin_users (
  email      text primary key check (email = lower(email)),
  role       text not null check (role in ('editor', 'approver', 'marketing_editor')),
  added_at   timestamptz not null default now(),
  added_by   text,
  note       text
);

alter table public.admin_users enable row level security;
-- No policies on purpose: the list is managed from the SQL editor or with the
-- service role, never from the browser.
revoke all on table public.admin_users from anon, authenticated;

-- Seed with every existing confirmed @archpublic.com account, so nobody who
-- has access today is locked out. Review this list after applying (query at
-- the end of docs/ADMIN_ACCESS.md) and delete anyone who should not be on it.
insert into public.admin_users (email, role, added_by, note)
select lower(u.email), 'editor', 'migration 20261110000001', 'had an account when the allowlist was created'
from auth.users u
where u.email is not null
  and u.email_confirmed_at is not null
  and lower(u.email) ~ '^[a-z0-9._%+-]+@archpublic\.com$'
on conflict (email) do nothing;

-- The signed-in user's admin role, or null.
create or replace function public.admin_role()
returns text
language sql
stable
security definer
set search_path = public, auth
as $$
  select a.role
  from public.admin_users a
  join auth.users u on lower(u.email) = a.email
  where u.id = auth.uid()
    and u.email_confirmed_at is not null
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select public.admin_role() is not null
$$;

-- Every existing write policy calls this. It now means "is on the allowlist".
create or replace function public.user_has_valid_domain()
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select public.is_admin()
$$;

revoke all on function public.admin_role() from public;
revoke all on function public.is_admin() from public;
grant execute on function public.admin_role() to anon, authenticated;
grant execute on function public.is_admin() to anon, authenticated;
