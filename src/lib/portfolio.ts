// Portfolio types and calculation helpers

export type PortfolioStorageKey = "portfolio:v1";

export interface PortfolioRecipeSummary {
  recipeId: string;
  title: string;
  assetSymbol: string; // e.g., BTC, ETH
  baseInitialCapital?: number | null; // recipe.initial_capital if present
  baseCashProfit?: number | null; // recipe.cash_profit if present
  // Optional string like "$96,170 (0.92 BTC @ $104,000)"; we will try to parse qty
  assetAccumulatedText?: string | null;
}

export interface PortfolioPosition {
  recipeId: string;
  allocationPct: number; // 0-100
}

export interface PortfolioState {
  positions: Record<string, PortfolioPosition>; // keyed by recipeId
  initialCapital: number; // portfolio-level capital
}

export interface ScaledRecipeMetrics {
  recipeId: string;
  allocationPct: number;
  capitalAllocated: number; // dollars
  cashRealized: number | null; // dollars (scaled)
  pnl: number | null; // cashRealized - capitalAllocated (when cashRealized known)
  assetQuantity: number | null; // e.g., BTC units (scaled)
  assetSymbol: string;
  title: string;
}

export interface PortfolioAggregates {
  totalCapitalAllocated: number;
  totalCashRealized: number | null;
  totalPnL: number | null;
  assetAccumulations: Record<string, number>; // symbol -> qty
}

export const PORTFOLIO_STORAGE_KEY: PortfolioStorageKey = "portfolio:v1";
export const DEFAULT_BASE_CAPITAL = 10000; // fallback when recipe base initial capital is unknown

export function clampPct(value: number): number {
  if (!Number.isFinite(value)) return 0;
  if (value < 0) return 0;
  if (value > 100) return 100;
  return value;
}

export function normalizeAllocations(
  positions: Record<string, PortfolioPosition>
): Record<string, PortfolioPosition> {
  const entries = Object.entries(positions);
  const sum = entries.reduce((acc, [, p]) => acc + (Number.isFinite(p.allocationPct) ? p.allocationPct : 0), 0);
  if (sum <= 0) return positions;
  const normalized: Record<string, PortfolioPosition> = {};
  for (const [id, p] of entries) {
    normalized[id] = {
      recipeId: p.recipeId,
      allocationPct: +(p.allocationPct * (100 / sum)).toFixed(4),
    };
  }
  return normalized;
}

export function parseAssetQuantityFromText(text: string | null | undefined, assetSymbol: string): number | null {
  if (!text) return null;
  // Try to find a pattern like "0.92 BTC" anywhere in the string
  const symbol = assetSymbol.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&");
  const re = new RegExp(`([0-9]+(?:\\.[0-9]+)?)\\s*${symbol}`, "i");
  const m = text.match(re);
  if (!m) return null;
  const qty = parseFloat(m[1]);
  return Number.isFinite(qty) ? qty : null;
}

function safeNumber(n: number | null | undefined): number | null {
  return typeof n === "number" && Number.isFinite(n) ? n : null;
}

export function computeScaledMetricsForRecipe(
  portfolioInitialCapital: number,
  position: PortfolioPosition,
  recipe: PortfolioRecipeSummary
): ScaledRecipeMetrics {
  const allocationPct = clampPct(position.allocationPct);
  const capitalAllocated = (allocationPct / 100) * portfolioInitialCapital;

  const baseCapital = safeNumber(recipe.baseInitialCapital) ?? DEFAULT_BASE_CAPITAL;
  const scaleFactor = baseCapital > 0 ? capitalAllocated / baseCapital : 1;

  const baseCash = safeNumber(recipe.baseCashProfit);
  const cashRealized = baseCash !== null ? baseCash * scaleFactor : null;
  const pnl = cashRealized !== null ? cashRealized - capitalAllocated : null;

  const baseQty = parseAssetQuantityFromText(recipe.assetAccumulatedText, recipe.assetSymbol);
  const assetQuantity = baseQty !== null ? baseQty * scaleFactor : null;

  return {
    recipeId: recipe.recipeId,
    allocationPct,
    capitalAllocated,
    cashRealized,
    pnl,
    assetQuantity,
    assetSymbol: recipe.assetSymbol,
    title: recipe.title,
  };
}

export function computePortfolioAggregates(rows: ScaledRecipeMetrics[]): PortfolioAggregates {
  const totalCapitalAllocated = rows.reduce((acc, r) => acc + r.capitalAllocated, 0);

  let totalCashRealized: number | null = 0;
  let totalPnL: number | null = 0;
  const assetAccumulations: Record<string, number> = {};

  for (const r of rows) {
    if (r.cashRealized === null) {
      totalCashRealized = null; // unknown if any is unknown; consumers can handle null
    } else if (totalCashRealized !== null) {
      totalCashRealized += r.cashRealized;
    }

    if (r.pnl === null) {
      totalPnL = null;
    } else if (totalPnL !== null) {
      totalPnL += r.pnl;
    }

    if (r.assetQuantity !== null) {
      assetAccumulations[r.assetSymbol] = (assetAccumulations[r.assetSymbol] || 0) + r.assetQuantity;
    }
  }

  // If we never added any known values, coerce back to null for cleaner UI
  if (totalCashRealized === 0 && rows.every(r => r.cashRealized === null)) totalCashRealized = null;
  if (totalPnL === 0 && rows.every(r => r.pnl === null)) totalPnL = null;

  return { totalCapitalAllocated, totalCashRealized, totalPnL, assetAccumulations };
}

export function remainingAllocationPercent(positions: Record<string, PortfolioPosition>): number {
  const used = Object.values(positions).reduce((acc, p) => acc + clampPct(p.allocationPct), 0);
  return +(100 - used).toFixed(4);
}

export function roundCurrency(value: number | null): number | null {
  if (value === null) return null;
  return Math.round(value * 100) / 100;
}

// Optimization helpers
export type OptimizeObjective = "cash" | "pnl" | "asset";

export function perDollarYield(
  row: ScaledRecipeMetrics,
  objective: OptimizeObjective,
  assetSymbol?: string
): number {
  if (row.capitalAllocated <= 0) return 0;
  switch (objective) {
    case "cash":
      return row.cashRealized !== null ? row.cashRealized / row.capitalAllocated : 0;
    case "pnl":
      return row.pnl !== null ? row.pnl / row.capitalAllocated : 0;
    case "asset":
      if (!assetSymbol || row.assetSymbol !== assetSymbol) return 0;
      return row.assetQuantity !== null ? row.assetQuantity / row.capitalAllocated : 0;
    default:
      return 0;
  }
}


