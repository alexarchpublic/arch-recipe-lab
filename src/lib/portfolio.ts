import { clientChangeNote } from "@core";

// Portfolio types and calculation helpers. A portfolio position keeps a
// snapshot of the strategy version it was added at (P12); totals are sums of
// separate backtests, scaled by one rule (D3, P13, P14).

export type PortfolioStorageKey = "portfolio:v1";

export interface PortfolioRecipeSummary {
  recipeId: string;
  // Since Phase 1: the published version this position was added at (P12).
  // Portfolios saved before Phase 1 have none and still open (P11).
  versionId?: string;
  versionNumber?: number;
  // The real test end (D10), so the apply step never prints the run year.
  testEnd?: string | null;
  // Asset accumulated as a number (D1); older portfolios keep only the text.
  assetQty?: number | null;
  title: string;
  assetSymbol: string; // e.g., BTC, ETH
  time_frame?: string | null; // e.g., 1 Day, 4 Hours
  baseInitialCapital?: number | null; // recipe.initial_capital if present
  baseCashProfit?: number | null; // recipe.cash_profit if present
  baseNetProfit?: number | null; // recipe.net_profit parsed as number
  // Optional string like "$96,170 (0.92 BTC @ $104,000)"; we will try to parse qty
  assetAccumulatedText?: string | null;
  algorithm?: string;
  algorithm_inputs?: any;
  display_number?: number | null;
  focus?: string; // Recipe focus (Cash Yielding, Accumulation, Balanced)
  // Since Phase 2: enough of the pinned version to show what changed (P12).
  assetClass?: string | null;
  returnPct?: number | null;
  cagrPct?: number | null;
  publishedAt?: string | null;
  changeType?: string | null;
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
export const DEFAULT_BASE_CAPITAL = 100000; // fallback when recipe base initial capital is unknown

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

  const baseQty =
    safeNumber(recipe.assetQty) ?? parseAssetQuantityFromText(recipe.assetAccumulatedText, recipe.assetSymbol);
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



// ---------------------------------------------------------------------------
// What changed since a position was pinned (P12).
// ---------------------------------------------------------------------------

/** The current published version, as the fields a snapshot keeps. */
export interface CurrentVersionFields {
  id: string;
  version_id: string;
  version_number: number;
  change_type: string;
  change_note: string | null;
  published_at: string;
  starting_capital: number;
  net_profit_usd: number;
  cash_profit_usd: number | null;
  asset_qty: number | null;
  return_pct: number;
  algorithm_inputs: Record<string, unknown> | null;
}

export interface FieldChange {
  field: "starting_capital" | "net_profit" | "cash_profit" | "asset_qty" | "return_pct" | "settings";
  label: string;
  before: number | null;
  after: number | null;
}

export interface VersionChanges {
  /** The current version differs from the pinned one. */
  changed: boolean;
  /** True when the pinned version is known; portfolios from before Phase 1 have none. */
  pinnedKnown: boolean;
  fromVersion: number | null;
  toVersion: number;
  figures: FieldChange[];
  settingsChanged: boolean;
  changeNote: string | null;
}

function sameNumber(a: number | null | undefined, b: number | null | undefined): boolean {
  const x = typeof a === "number" && Number.isFinite(a) ? a : null;
  const y = typeof b === "number" && Number.isFinite(b) ? b : null;
  if (x === null || y === null) return x === y;
  return Math.abs(x - y) < 1e-6 * Math.max(1, Math.abs(x), Math.abs(y));
}

function stable(v: unknown): string {
  if (v === null || v === undefined) return "null";
  if (Array.isArray(v)) return `[${v.map(stable).join(",")}]`;
  if (typeof v === "object") {
    const o = v as Record<string, unknown>;
    return `{${Object.keys(o).sort().filter((k) => o[k] !== undefined).map((k) => `${JSON.stringify(k)}:${stable(o[k])}`).join(",")}}`;
  }
  return JSON.stringify(v);
}

/**
 * Compares a position's snapshot with the strategy's current published
 * version. A new version with the same figures and settings (a copy change)
 * is not a change a client needs to act on (D11).
 */
export function versionChanges(snapshot: PortfolioRecipeSummary, current: CurrentVersionFields): VersionChanges {
  const pinnedKnown = typeof snapshot.versionNumber === "number" && !!snapshot.versionId;
  const figures: FieldChange[] = [];
  const check = (field: FieldChange["field"], label: string, before: number | null | undefined, after: number | null) => {
    if (before === undefined) return; // not kept by older snapshots
    if (!sameNumber(before, after)) figures.push({ field, label, before: before ?? null, after });
  };
  check("starting_capital", "Starting capital", snapshot.baseInitialCapital, current.starting_capital);
  check("net_profit", "Net profit", snapshot.baseNetProfit, current.net_profit_usd);
  check("cash_profit", "Cash profit", snapshot.baseCashProfit, current.cash_profit_usd);
  check("asset_qty", "Asset accumulated", snapshot.assetQty, current.asset_qty);
  check("return_pct", "Return", snapshot.returnPct, current.return_pct);

  const settingsChanged =
    snapshot.algorithm_inputs !== undefined && stable(snapshot.algorithm_inputs) !== stable(current.algorithm_inputs);
  const versionMoved = pinnedKnown && snapshot.versionId !== current.version_id;
  const changed = figures.length > 0 || settingsChanged;

  return {
    changed,
    pinnedKnown,
    fromVersion: pinnedKnown ? (snapshot.versionNumber as number) : null,
    toVersion: current.version_number,
    figures,
    settingsChanged,
    changeNote: versionMoved || changed ? clientChangeNote(current) : null,
  };
}
