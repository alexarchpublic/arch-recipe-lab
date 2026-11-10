-- Phase 1, last step (PRD 13 order-of-work rules): close the base tables.
--
-- APPLY ONLY AFTER the app that reads public.strategies_pro is live in
-- production. Before then the live app reads public.recipes directly and
-- would show nothing. docs/PHASE1.md has the order.
--
-- After this, drafts, archived strategies, legacy columns and provenance are
-- readable only by admins. Clients read published versions through the views.
-- The source-screenshot bucket stays public until the login move (D6).

drop policy if exists "Anyone can view recipes" on public.recipes;
drop policy if exists "Admins can view recipes" on public.recipes;
create policy "Admins can view recipes" on public.recipes
  for select to authenticated using (public.is_admin());

drop policy if exists "Anyone can view screenshots" on public.recipe_screenshots;
drop policy if exists "Admins can view screenshots" on public.recipe_screenshots;
create policy "Admins can view screenshots" on public.recipe_screenshots
  for select to authenticated using (public.is_admin());

revoke all on table public.recipes, public.recipe_screenshots from anon;

-- Strategy rows change only through the admin functions: a direct write could
-- point a strategy at another version or hard-delete it (A3, A12). Screenshot
-- rows stay writable by admins; the admin console uploads them.
revoke insert, update, delete on table public.recipes from authenticated;

select public.run_parity_check('migration');
