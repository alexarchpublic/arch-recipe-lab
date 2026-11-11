// Strategy Lab core (PRD R3): the only code that formats a figure, scales one,
// or decides which benchmark to show. Both front ends import it as "@core".
//
// Figures are not computed here. The database derives return, CAGR and the
// benchmark deltas once, at save (D3); this module reads them.

/** A row of public.strategies_public: what anyone may see (D6, D7). */
export interface PublicStrategy {
  id: string;
  display_number: number | null;
  version_id: string;
  version_number: number;
  slug: string;
  title: string;
  short_name: string;
  asset: string;
  asset_class: "Equities" | "ETFs" | "Crypto";
  algorithm: string;
  strategy_type: string;
  time_horizon: "STH" | "LTH";
  focus: "Cash Yielding" | "Balanced" | "Accumulation";
  time_frame: string | null;
  goal: string;
  best_for: string | null;
  how_it_trades: string | null;
  up_market_behavior: string | null;
  down_market_behavior: string | null;
  basis: "backtested" | "live";
  starting_capital: number;
  test_start: string; // YYYY-MM-DD
  test_end: string; // YYYY-MM-DD, the last bar on the chart (D10)
  fees_slippage: string | null;
  data_source: string;
  as_of: string;
  net_profit_usd: number;
  cash_profit_usd: number | null;
  asset_qty: number | null;
  asset_unit: string | null;
  buy_hold_pnl_pct: number | null;
  dca_pnl_pct: number | null;
  max_drawdown_pct: number | null;
  benchmark_shown: "buy_hold" | "dca" | "both" | "none";
  ending_value_usd: number;
  return_pct: number;
  test_years: number;
  cagr_pct: number | null; // null when the test window is under a year (D12)
  vs_buy_hold_pct: number | null;
  vs_dca_pct: number | null;
  public_chart_url: string | null;
}

export interface SourceScreenshot {
  id: string;
  url: string;
  kind: string | null;
  order: number;
  sha256: string | null;
}

/** A row of public.strategies_pro: everything a client needs (D6). */
export interface ProStrategy extends PublicStrategy {
  strategy_created_at: string;
  archived_at: string | null;
  change_type: "baseline" | "initial" | "figures" | "settings" | "copy";
  change_note: string | null;
  published_at: string;
  name: string;
  // Settings differ per algorithm and are read field by field by the apply
  // step; a per-algorithm type arrives with the settings schema (D2).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  algorithm_inputs: Record<string, any>;
  entry_trade: string | null;
  exit_trade: string | null;
  sell_above_cost_basis: boolean | null;
  exit_to_entry_proportion: number | null;
  screenshots: SourceScreenshot[];
}

/** Numbers come back from PostgREST as strings for numeric columns. */
const NUMERIC_FIELDS = [
  "starting_capital", "net_profit_usd", "cash_profit_usd", "asset_qty", "buy_hold_pnl_pct", "dca_pnl_pct",
  "max_drawdown_pct", "ending_value_usd", "return_pct", "test_years", "cagr_pct", "vs_buy_hold_pct",
  "vs_dca_pct", "exit_to_entry_proportion",
] as const;

export function normalizeStrategyRow<T extends PublicStrategy>(row: T): T {
  const out: Record<string, unknown> = { ...(row as unknown as Record<string, unknown>) };
  for (const field of NUMERIC_FIELDS) {
    const value = out[field];
    if (value === null || value === undefined || value === "") {
      out[field] = null;
    } else if (typeof value === "string") {
      const n = Number(value);
      out[field] = Number.isFinite(n) ? n : null;
    }
  }
  if (Array.isArray(out.screenshots)) {
    out.screenshots = [...(out.screenshots as SourceScreenshot[])].sort((a, b) => a.order - b.order);
  }
  return out as T;
}

// ---------------------------------------------------------------------------
// Scaling: one rule, the strategy's own starting capital (D3).
// ---------------------------------------------------------------------------

/** Factor that turns the strategy's figures into figures for `capital`. */
export function scaleFor(capital: number | null | undefined, strategy: Pick<PublicStrategy, "starting_capital">): number {
  const base = strategy.starting_capital;
  if (!capital || !Number.isFinite(capital) || capital <= 0 || !base || base <= 0) return 1;
  return capital / base;
}

export function scaleDollars(value: number | null | undefined, factor: number): number | null {
  if (value === null || value === undefined || !Number.isFinite(value)) return null;
  return value * factor;
}

export interface ScaledResults {
  beginning: number;
  ending: number;
  netProfit: number;
  cashProfit: number | null;
  assetQty: number | null;
}

/** Dollar results scaled to `capital`; percentages never change with scale. */
export function scaledResults(strategy: PublicStrategy, capital?: number | null): ScaledResults {
  const factor = scaleFor(capital ?? strategy.starting_capital, strategy);
  return {
    beginning: strategy.starting_capital * factor,
    ending: strategy.ending_value_usd * factor,
    netProfit: strategy.net_profit_usd * factor,
    cashProfit: scaleDollars(strategy.cash_profit_usd, factor),
    assetQty: scaleDollars(strategy.asset_qty, factor),
  };
}

// ---------------------------------------------------------------------------
// Benchmarks: which comparison a strategy shows is stored (PRD 13).
// ---------------------------------------------------------------------------

export function showsBuyHold(s: Pick<PublicStrategy, "benchmark_shown">): boolean {
  return s.benchmark_shown === "buy_hold" || s.benchmark_shown === "both";
}

export function showsDca(s: Pick<PublicStrategy, "benchmark_shown">): boolean {
  return s.benchmark_shown === "dca" || s.benchmark_shown === "both";
}

/** Strategy return minus buy and hold, when this strategy shows it. */
export function vsBuyHold(s: PublicStrategy): number | null {
  return showsBuyHold(s) ? s.vs_buy_hold_pct : null;
}

/** Strategy return minus DCA, when this strategy shows it. */
export function vsDca(s: PublicStrategy): number | null {
  return showsDca(s) ? s.vs_dca_pct : null;
}

// ---------------------------------------------------------------------------
// Dates: the test window, never the TradingView run setting (D10).
// ---------------------------------------------------------------------------

export interface DateParts {
  year?: number | null;
  month?: number | null;
  day?: number | null;
  hour?: number | null;
  minute?: number | null;
}

export function isoToParts(iso: string): DateParts {
  const [y, m, d] = iso.split("-").map((p) => parseInt(p, 10));
  return { year: y, month: m, day: d };
}

export function partsToIso(p: DateParts | null | undefined): string | null {
  if (!p?.year || !p?.month || !p?.day) return null;
  return `${p.year}-${String(p.month).padStart(2, "0")}-${String(p.day).padStart(2, "0")}`;
}

/**
 * True when a settings end date is a run setting rather than a real end:
 * after the strategy's real test end (the far-future year that unlocks
 * symbols in TradingView), or after today when the test end is unknown.
 */
export function isRunSettingEnd(end: DateParts | null | undefined, testEndIso?: string | null, today = new Date()): boolean {
  const iso = partsToIso(end);
  if (!iso) return false;
  if (testEndIso) return iso > testEndIso;
  return iso > today.toISOString().slice(0, 10);
}

/**
 * The test end a client may see, or null. A version whose test end is still
 * the run setting (after its as-of date, as in the baseline of a strategy run
 * to 2030 or 2999) shows no end date at all until its clean-up version is
 * published (D10).
 */
export function displayTestEnd(s: Pick<PublicStrategy, "test_end" | "as_of">): string | null {
  if (!s.test_end) return null;
  if (s.as_of && s.test_end > s.as_of) return null;
  return s.test_end;
}

/**
 * Settings as a client sees them: the end date is the test end, read from the
 * last bar on the chart, never 2030 or 2999 (D10). With no displayable test
 * end, the end date is removed.
 */
/**
 * The CAGR a client may see: none under a year (D12, stored as null), and none
 * while the test end is still the run setting, since it would be computed to
 * 2030 or 2999.
 */
export function displayCagr(s: Pick<PublicStrategy, "cagr_pct" | "test_end" | "as_of">): number | null {
  return displayTestEnd(s) ? s.cagr_pct : null;
}

/* eslint-disable @typescript-eslint/no-explicit-any -- settings are untyped JSON (see ProStrategy) */
export function settingsForDisplay(
  inputs: Record<string, any> | null | undefined,
  algorithm: string | null | undefined,
  testEndIso: string | null,
): Record<string, any> | null {
  if (!inputs || typeof inputs !== "object") return null;
  const copy = JSON.parse(JSON.stringify(inputs));
  const end = testEndIso ? isoToParts(testEndIso) : null;
  if (copy.dates && typeof copy.dates === "object" && copy.dates.end) {
    if (end) copy.dates.end = { ...copy.dates.end, ...end };
    else delete copy.dates.end;
  }
  if (algorithm === "Intelligence Algorithm" && copy.end && typeof copy.end === "object") {
    if (end) copy.end = { ...copy.end, ...end };
    else delete copy.end;
  }
  return copy;
}
/* eslint-enable @typescript-eslint/no-explicit-any */

/** The end-date line of the TradingView apply step (P16). */
export const TRADINGVIEW_END_INSTRUCTION = "a date in the future (we recommend 5+ years ahead)";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "";
  const { year, month, day } = isoToParts(iso);
  if (!year || !month || !day) return "";
  return `${day} ${MONTHS[month - 1]} ${year}`;
}

export function formatTestWindow(s: Pick<PublicStrategy, "test_start" | "test_end" | "as_of">): string {
  const end = displayTestEnd(s);
  return end ? `${formatDate(s.test_start)} – ${formatDate(end)}` : `from ${formatDate(s.test_start)}`;
}

// ---------------------------------------------------------------------------
// Formatting (moved here from src/utils/recipeMetrics.ts).
// ---------------------------------------------------------------------------

export function formatSignedPercent(value: number, decimals = 1): string {
  const abs = Math.abs(value).toFixed(decimals);
  if (value < 0) return `−${abs}%`;
  return `+${abs}%`;
}

export function formatSignedCurrency(value: number): string {
  const abs = `$${Math.abs(Math.round(value)).toLocaleString("en-US")}`;
  return value < 0 ? `−${abs}` : abs;
}

/** Unsigned percent for display (e.g. CAGR). Always includes the % sign. */
export function formatPercent(value: number, decimals = 1): string {
  return `${value.toFixed(decimals)}%`;
}

export function formatMoney(value: number): string {
  return `$${Math.round(value).toLocaleString("en-US")}`;
}

/** Asset quantity: whole shares for equities and ETFs, up to 4 decimals for crypto. */
export function formatQuantity(qty: number, assetClass: string): string {
  if (assetClass === "Crypto") {
    return qty.toLocaleString("en-US", { maximumFractionDigits: 4 });
  }
  return Math.floor(qty).toLocaleString("en-US");
}

/** The basis label every results block carries (C1). */
export function basisLabel(s: Pick<PublicStrategy, "basis">): string {
  return s.basis === "live" ? "Live results" : "Backtested results";
}
