// Portfolio types and calculation helpers

export type PortfolioStorageKey = "portfolio:v1";

export interface PortfolioRecipeSummary {
  recipeId: string;
  title: string;
  assetSymbol: string; // e.g., BTC, ETH
  baseInitialCapital?: number | null; // recipe.initial_capital if present
  baseCashProfit?: number | null; // recipe.cash_profit if present
  baseNetProfit?: number | null; // recipe.net_profit parsed as number
  // Optional string like "$96,170 (0.92 BTC @ $104,000)"; we will try to parse qty
  assetAccumulatedText?: string | null;
  algorithm?: string;
  algorithm_inputs?: any;
  display_number?: number | null;
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
  netProfit: number | null; // dollars (scaled from baseNetProfit)
  assetQuantity: number | null; // e.g., BTC units (scaled)
  assetSymbol: string;
  title: string;
}

export interface PortfolioAggregates {
  totalCapitalAllocated: number;
  totalCashRealized: number | null;
  totalNetProfit: number | null;
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
  const str = String(text);
  
  // First try: look for pattern like "0.92 BTC" anywhere in the string (case-insensitive)
  const symbol = assetSymbol.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&");
  const patterns = [
    // Pattern 1: "0.92 BTC" or "0.92BTC" (with symbol)
    new RegExp(`([0-9]+(?:\\.[0-9]+)?)\\s*${symbol}`, "i"),
    // Pattern 2: Number in parentheses like "(0.92 BTC @ $104,000)"
    new RegExp(`\\(([0-9]+(?:\\.[0-9]+)?)\\s*${symbol}`, "i"),
    // Pattern 3: Just a number followed by optional space and any asset ticker (fallback)
    new RegExp(`\\b([0-9]+(?:\\.[0-9]+)?)\\s*(?:[A-Z]{2,6})?\\b`, "i"),
  ];
  
  for (const pattern of patterns) {
    const m = str.match(pattern);
    if (m) {
      const qty = parseFloat(m[1]);
      if (Number.isFinite(qty) && qty > 0) {
        return qty;
      }
    }
  }
  
  return null;
}

function safeNumber(n: number | null | undefined): number | null {
  return typeof n === "number" && Number.isFinite(n) ? n : null;
}

export function parseCurrencyFromString(text: string | null | undefined): number | null {
  if (!text) return null;
  const match = String(text).replace(/[^0-9.,-]/g, "").replace(/,/g, "");
  const num = parseFloat(match);
  return Number.isFinite(num) ? num : null;
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
  
  const baseNetProfit = safeNumber(recipe.baseNetProfit);
  const netProfit = baseNetProfit !== null ? baseNetProfit * scaleFactor : null;

  const baseQty = parseAssetQuantityFromText(recipe.assetAccumulatedText, recipe.assetSymbol);
  const assetQuantity = baseQty !== null ? baseQty * scaleFactor : null;

  return {
    recipeId: recipe.recipeId,
    allocationPct,
    capitalAllocated,
    cashRealized,
    netProfit,
    assetQuantity,
    assetSymbol: recipe.assetSymbol,
    title: recipe.title,
  };
}

export function computePortfolioAggregates(rows: ScaledRecipeMetrics[]): PortfolioAggregates {
  const totalCapitalAllocated = rows.reduce((acc, r) => acc + r.capitalAllocated, 0);

  let totalCashRealized: number | null = 0;
  let totalNetProfit: number | null = 0;
  const assetAccumulations: Record<string, number> = {};

  for (const r of rows) {
    if (r.cashRealized === null) {
      totalCashRealized = null; // unknown if any is unknown; consumers can handle null
    } else if (totalCashRealized !== null) {
      totalCashRealized += r.cashRealized;
    }

    if (r.netProfit === null) {
      totalNetProfit = null;
    } else if (totalNetProfit !== null) {
      totalNetProfit += r.netProfit;
    }

    if (r.assetQuantity !== null) {
      assetAccumulations[r.assetSymbol] = (assetAccumulations[r.assetSymbol] || 0) + r.assetQuantity;
    }
  }

  // If we never added any known values, coerce back to null for cleaner UI
  if (totalCashRealized === 0 && rows.every(r => r.cashRealized === null)) totalCashRealized = null;
  if (totalNetProfit === 0 && rows.every(r => r.netProfit === null)) totalNetProfit = null;

  return { totalCapitalAllocated, totalCashRealized, totalNetProfit, assetAccumulations };
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
export type OptimizeObjective = "cash" | "netProfit" | "asset";

export function perDollarYield(
  row: ScaledRecipeMetrics,
  objective: OptimizeObjective,
  assetSymbol?: string
): number {
  if (row.capitalAllocated <= 0) return 0;
  switch (objective) {
    case "cash":
      return row.cashRealized !== null ? row.cashRealized / row.capitalAllocated : 0;
    case "netProfit":
      return row.netProfit !== null ? row.netProfit / row.capitalAllocated : 0;
    case "asset":
      if (!assetSymbol || row.assetSymbol !== assetSymbol) return 0;
      return row.assetQuantity !== null ? row.assetQuantity / row.capitalAllocated : 0;
    default:
      return 0;
  }
}


