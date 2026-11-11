-- Phase 2 (PRD C2): disclaimer wording as data.
--
-- A disclaimer slot sits beside every results block. Its wording is set in the
-- admin console, so counsel's text goes live without a deploy. Both front ends
-- read public.disclosures; only approvers and marketing editors write it,
-- through public.admin_set_disclosure. Every change is kept in
-- store.disclosure_history.
--
-- Additive: nothing existing changes. Until this runs, the app shows the
-- default wording in packages/core/src/disclosure.tsx.

create table if not exists store.disclosures (
  key         text primary key check (key in ('results')),
  body        text not null check (length(btrim(body)) between 1 and 2000),
  updated_by  text not null,
  updated_at  timestamptz not null default now()
);
alter table store.disclosures enable row level security;

create table if not exists store.disclosure_history (
  id          bigint generated always as identity primary key,
  key         text not null,
  body        text not null,
  changed_by  text not null,
  changed_at  timestamptz not null default now()
);
alter table store.disclosure_history enable row level security;

-- The wording live in November 2026 (the Recipe Lab footer), until counsel's arrives.
insert into store.disclosures (key, body, updated_by)
values ('results', 'Past and backtested performance does not guarantee future results.', 'migration 20261112000001')
on conflict (key) do nothing;

insert into store.disclosure_history (key, body, changed_by)
select key, body, updated_by from store.disclosures d
where not exists (select 1 from store.disclosure_history h where h.key = d.key);

-- Explicit columns: who changed the wording is not public.
create or replace view public.disclosures as
select d.key, d.body, d.updated_at
from store.disclosures d;

comment on view public.disclosures is
  'Disclaimer wording shown beside every results block in both front ends (PRD C2). Set in the admin console.';

revoke all on public.disclosures from public, anon, authenticated;
grant select on public.disclosures to anon, authenticated, service_role;

-- Admins see who changed it and when.
create or replace view public.admin_disclosure_history as
select h.* from store.disclosure_history h where public.is_admin();
revoke all on public.admin_disclosure_history from public, anon, authenticated;
grant select on public.admin_disclosure_history to authenticated;

create or replace function public.admin_set_disclosure(p_key text, p_body text)
returns void
language plpgsql
security definer
set search_path = public, store, auth
as $$
declare
  who text;
  body text := btrim(coalesce(p_body, ''));
begin
  perform store.require_role(array['approver', 'marketing_editor']);
  who := public.admin_email();
  if body = '' then
    raise exception 'The disclaimer cannot be empty.' using errcode = '22023';
  end if;
  insert into store.disclosures (key, body, updated_by, updated_at)
  values (p_key, body, who, now())
  on conflict (key) do update set body = excluded.body, updated_by = excluded.updated_by, updated_at = excluded.updated_at;
  insert into store.disclosure_history (key, body, changed_by) values (p_key, body, who);
end;
$$;

revoke all on function public.admin_set_disclosure(text, text) from public, anon;
grant execute on function public.admin_set_disclosure(text, text) to authenticated;
