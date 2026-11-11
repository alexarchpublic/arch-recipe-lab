// The only module that reads strategy data for Strategy Lab Pro (PRD P3).
//
// Today it reads public.strategies_pro with the anon key, because Pro is open
// until the login move (D6). At the move the dev team changes this module and
// the database grant, not the screens.
import { useQuery } from "@tanstack/react-query";
import { type ProStrategy, displayCagr, displayTestEnd, normalizeStrategyRow } from "@core";
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

const QUERY_KEY = ["strategies_pro"] as const;

/**
 * Every published strategy, archived ones included: clients who hold an
 * archived strategy keep reading it (A12). Screens that browse filter them out.
 */
export function useProStrategies() {
  return useQuery({ queryKey: QUERY_KEY, queryFn: fetchProStrategies, staleTime: 5 * 60 * 1000 });
}

/** Strategies a client can browse: not archived. */
export function browsable(strategies: ProStrategy[] | undefined): ProStrategy[] {
  return (strategies ?? []).filter((s) => !s.archived_at);
}

export function byDisplayNumber(strategies: ProStrategy[] | undefined, n: number | null | undefined): ProStrategy | null {
  if (n === null || n === undefined || !strategies) return null;
  return strategies.find((s) => s.display_number === n) ?? null;
}

export function byId(strategies: ProStrategy[] | undefined, id: string | null | undefined): ProStrategy | null {
  if (!id || !strategies) return null;
  return strategies.find((s) => s.id === id) ?? null;
}

/** What a portfolio keeps about a strategy, pinned to the version added (P12). */
export function toPortfolioSummary(s: ProStrategy): PortfolioRecipeSummary {
  return {
    recipeId: s.id,
    versionId: s.version_id,
    versionNumber: s.version_number,
    title: s.title,
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
    assetClass: s.asset_class,
    returnPct: s.return_pct,
    cagrPct: displayCagr(s),
    publishedAt: s.published_at,
    changeType: s.change_type,
  };
}
