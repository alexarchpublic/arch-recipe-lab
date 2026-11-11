-- Phase 3 (PRD sections 9, 11 and 12): what the public Strategy Lab needs
-- from the store besides strategies.
--
--   store.site_content      Marketing's copy, layout, featured strategies,
--                           partner pages and switches (S12, A10, C5).
--                           Read by anyone through public.site_content;
--                           written by approvers and marketing editors through
--                           public.admin_set_site_content. Never figures.
--   store.leads             Every capture from the public site (booking,
--                           alerts, "email me this"), kept whether or not
--                           HubSpot accepted it, so nothing is lost while the
--                           HubSpot form is being set up. Written only through
--                           public.submit_lead; read only by admins.
--   admin_record_page_parity  Records the check of a public page against the
--                           store that the admin console runs after a publish
--                           (R4, R5), beside the view checks in parity_runs.
--
-- Additive: nothing existing changes. Until this runs, Strategy Lab uses its
-- built-in default copy and still forwards captures to HubSpot.

-- ---------------------------------------------------------------------------
-- Site content (S12).
-- ---------------------------------------------------------------------------
create table if not exists store.site_content (
  key         text primary key check (key ~ '^(home|config|booking|partner:[a-z0-9][a-z0-9-]{0,62})$'),
  value       jsonb not null check (jsonb_typeof(value) = 'object' and length(value::text) <= 65536),
  updated_by  text not null,
  updated_at  timestamptz not null default now()
);
alter table store.site_content enable row level security;

create table if not exists store.site_content_history (
  id          bigint generated always as identity primary key,
  key         text not null,
  value       jsonb,               -- null when the key was removed
  changed_by  text not null,
  changed_at  timestamptz not null default now()
);
alter table store.site_content_history enable row level security;

create or replace view public.site_content as
select c.key, c.value, c.updated_at
from store.site_content c;

comment on view public.site_content is
  'Strategy Lab copy, layout, featured strategies, partner pages and switches (PRD S12, C5). Never figures.';

revoke all on public.site_content from public, anon, authenticated;
grant select on public.site_content to anon, authenticated, service_role;

create or replace view public.admin_site_content_history as
select h.* from store.site_content_history h where public.is_admin();
revoke all on public.admin_site_content_history from public, anon, authenticated;
grant select on public.admin_site_content_history to authenticated;

-- Figures never live here: a value that names a store figure field is refused,
-- so marketing copy cannot carry a second copy of a number (R1, A10).
create or replace function store.site_content_figure_keys(v jsonb)
returns text[]
language sql
immutable
as $$
  select coalesce(array_agg(distinct k), '{}')
  from jsonb_path_query(v, 'strict $.**') as node,
       lateral (select jsonb_object_keys(node) as k where jsonb_typeof(node) = 'object') keys
  where k in ('net_profit_usd', 'cash_profit_usd', 'asset_qty', 'return_pct', 'cagr_pct', 'vs_buy_hold_pct',
              'vs_dca_pct', 'buy_hold_pnl_pct', 'dca_pnl_pct', 'ending_value_usd', 'max_drawdown_pct',
              'starting_capital', 'algorithm_inputs')
$$;

create or replace function public.admin_set_site_content(p_key text, p_value jsonb)
returns void
language plpgsql
security definer
set search_path = public, store, auth
as $$
declare
  who text;
  bad text[];
begin
  perform store.require_role(array['approver', 'marketing_editor']);
  who := public.admin_email();
  if p_value is null then
    delete from store.site_content where key = p_key;
    insert into store.site_content_history (key, value, changed_by) values (p_key, null, who);
    return;
  end if;
  bad := store.site_content_figure_keys(p_value);
  if array_length(bad, 1) > 0 then
    raise exception 'Site content cannot hold figures (%). Figures come from the published strategy.', array_to_string(bad, ', ')
      using errcode = '22023';
  end if;
  insert into store.site_content (key, value, updated_by, updated_at)
  values (p_key, p_value, who, now())
  on conflict (key) do update set value = excluded.value, updated_by = excluded.updated_by, updated_at = excluded.updated_at;
  insert into store.site_content_history (key, value, changed_by) values (p_key, p_value, who);
end;
$$;

revoke all on function public.admin_set_site_content(text, jsonb) from public, anon;
grant execute on function public.admin_set_site_content(text, jsonb) to authenticated;

-- ---------------------------------------------------------------------------
-- Leads (S2 to S5, S14). The public site forwards each capture to HubSpot and
-- records it here with the outcome.
-- ---------------------------------------------------------------------------
create table if not exists store.leads (
  id              bigint generated always as identity primary key,
  created_at      timestamptz not null default now(),
  kind            text not null check (kind in ('booking_started', 'booking_completed', 'alert', 'email_me_this')),
  email           text not null check (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' and length(email) <= 254),
  payload         jsonb not null default '{}'::jsonb check (jsonb_typeof(payload) = 'object' and length(payload::text) <= 16384),
  hubspot_status  text check (hubspot_status is null or length(hubspot_status) <= 500)
);
alter table store.leads enable row level security;
create index if not exists leads_email_created on store.leads (lower(email), created_at desc);

create or replace function public.submit_lead(p_kind text, p_email text, p_payload jsonb default '{}'::jsonb, p_hubspot_status text default null)
returns bigint
language plpgsql
security definer
set search_path = public, store
as $$
declare
  new_id bigint;
  e text := lower(btrim(coalesce(p_email, '')));
begin
  -- A flood guard, not a security boundary: a visitor books, subscribes and
  -- asks for a few emails, not dozens an hour.
  if (select count(*) from store.leads where lower(email) = e and created_at > now() - interval '1 hour') >= 20 then
    raise exception 'Too many requests for this address. Try again later.' using errcode = '54000';
  end if;
  insert into store.leads (kind, email, payload, hubspot_status)
  values (p_kind, e, coalesce(p_payload, '{}'::jsonb), left(p_hubspot_status, 500))
  returning id into new_id;
  return new_id;
end;
$$;

revoke all on function public.submit_lead(text, text, jsonb, text) from public;
grant execute on function public.submit_lead(text, text, jsonb, text) to anon, authenticated, service_role;

create or replace view public.admin_leads as
select l.* from store.leads l where public.is_admin();
revoke all on public.admin_leads from public, anon, authenticated;
grant select on public.admin_leads to authenticated;

-- ---------------------------------------------------------------------------
-- Page parity (R4, R5): the admin console checks the public page after a
-- publish and records what it found next to the view checks.
-- ---------------------------------------------------------------------------
create or replace function public.admin_record_page_parity(p_trigger text, p_ok boolean, p_counts jsonb, p_problems jsonb)
returns bigint
language plpgsql
security definer
set search_path = public, store, auth
as $$
declare new_id bigint;
begin
  perform store.require_role(array['editor', 'approver', 'marketing_editor']);
  insert into store.parity_runs (trigger, ok, counts, problems)
  values ('pages:' || left(coalesce(nullif(btrim(p_trigger), ''), 'manual'), 40), coalesce(p_ok, false),
          coalesce(p_counts, '{}'::jsonb), coalesce(p_problems, '[]'::jsonb))
  returning id into new_id;
  return new_id;
end;
$$;

revoke all on function public.admin_record_page_parity(text, boolean, jsonb, jsonb) from public, anon;
grant execute on function public.admin_record_page_parity(text, boolean, jsonb, jsonb) to authenticated;
