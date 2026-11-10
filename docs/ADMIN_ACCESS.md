# Admin access

Admin access is a named list (PRD A1). Only emails in `public.admin_users` can
write strategy data or use `/admin`. There is no sign-up: the sign-in page has
no sign-up form, and the database refuses new accounts that are not on the list.

Roles are `editor`, `approver` and `marketing_editor`. Phase 0 enforces
membership only; what each role may do arrives with the publish flow in Phase 1.

## Applying the Phase 0 migrations

Run these two files, in order, in the Supabase SQL editor of the production
project (`xsoixhltejgyuhedhbdu`), then on staging:

1. `supabase/migrations/20261110000001_admin_allowlist.sql`
2. `supabase/migrations/20261110000002_block_admin_self_signup.sql`

The first seeds the list with every existing confirmed `@archpublic.com`
account, as `editor`, so nobody who works today is locked out. The app code
works before and after the migrations: until `public.is_admin()` exists it
falls back to the old domain rule.

If the second file is refused because of a platform rule on the `auth`
schema, the first still stands and still blocks every write. In that case turn
off **Allow new users to sign up** under Authentication, Sign In / Providers.

## Review the list after applying

```sql
select a.email, a.role, u.created_at, u.last_sign_in_at
from public.admin_users a
left join auth.users u on lower(u.email) = a.email
order by u.last_sign_in_at desc nulls last;
```

Remove anyone who should not be there:

```sql
delete from public.admin_users where email = 'someone@archpublic.com';
```

## Add an admin

```sql
insert into public.admin_users (email, role, added_by)
values ('new.person@archpublic.com', 'editor', 'your name');
```

Then invite them from Authentication, Users, Invite user. The order matters:
an invite for an email not on the list is refused.

## Also check in the dashboard

Authentication, Sign In / Providers, Email: **Confirm email** should be on.
The PRD's open question is whether it was ever enforced. The allowlist now
covers either case, because only listed emails can write.
