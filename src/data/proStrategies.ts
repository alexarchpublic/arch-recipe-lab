// The only module that reads strategy data for Strategy Lab Pro (PRD P3).
//
// Today it reads public.strategies_pro with the anon key, because Pro is open
// until the login move (D6). At the move the dev team changes this module and
// the database grant, not the screens.
import { type ProStrategy, displayTestEnd, normalizeStrategyRow } from "@core";
import type { PortfolioRecipeSummary } from "@/lib/portfolio";

export async function fetchProStrategies(): Promise<ProStrategy[]> {
  // Loaded on use, so the pure helpers below import without a browser.
  const { supabase } = await import("@/integrations/supabase/client");
  const { data, error } = await supabase
    .from("strategies_pro")
    .select("*")
    .order("strategy_created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((row) => normalizeStrategyRow(row as unknown as ProStrategy));
}

/** What a portfolio keeps about a strategy, pinned to the version added (P12). */
export function toPortfolioSummary(s: ProStrategy): PortfolioRecipeSummary {
  return {
    recipeId: s.id,
    versionId: s.version_id,
    versionNumber: s.version_number,
    title: s.short_name,
    assetSymbol: s.asset,
    time_frame: s.time_frame,
    baseInitialCapital: s.starting_capital,
    baseCashProfit: s.cash_profit_usd,
    baseNetProfit: s.net_profit_usd,
    assetQty: s.asset_qty,
    assetAccumulatedText: s.asset_qty !== null ? `${s.asset_qty} ${s.asset_unit ?? s.asset}` : null,
    algorithm: s.algorithm,
    algorithm_inputs: s.algorithm_inputs,
    testEnd: displayTestEnd(s),
    display_number: s.display_number,
    focus: s.focus,
  };
}
