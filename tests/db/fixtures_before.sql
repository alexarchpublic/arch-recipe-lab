-- Accounts that exist before the Phase 0 allowlist migration.
insert into auth.users (id, email, email_confirmed_at) values
  ('00000000-0000-0000-0000-00000000000a', 'Staff.Member@archpublic.com', now()), -- confirmed staff: keeps access
  ('00000000-0000-0000-0000-00000000000b', 'unconfirmed@archpublic.com', null),   -- never confirmed: no access
  ('00000000-0000-0000-0000-00000000000c', 'outsider@gmail.com', now());          -- other domain: no access
