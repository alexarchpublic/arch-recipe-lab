import { parseCurrencyFromString } from "@/lib/portfolio";

export interface RecipeMetricsInput {
  algorithm?: string | null;
  algorithm_inputs?: unknown;
  buy_hold_pnl_percent?: number | null;
  initial_capital?: number | null;
  net_profit?: string | null;
  cagr?: number | null;
  annualized_return?: number | null;
}

export function normalizeAlgorithmInputs(
  raw: unknown,
): Record<string, unknown> | null {
  if (!raw) return null;
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw);
      return typeof parsed === "object" && parsed !== null
        ? (parsed as Record<string, unknown>)
        : null;
    } catch {
      return null;
    }
  }
  if (typeof raw === "object") return raw as Record<string, unknown>;
  return null;
}

function parsePercentValue(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = parseFloat(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

type DateParts = {
  year?: number;
  month?: number;
  day?: number;
  hour?: number;
  minute?: number;
};

function dateFromParts(parts?: DateParts | null): Date | undefined {
  if (!parts?.year || !parts?.month || !parts?.day) return undefined;
  return new Date(
    parts.year,
    (parts.month - 1) || 0,
    parts.day,
    parts.hour || 0,
    parts.minute || 0,
  );
}

export function getStartEndDates(recipe: RecipeMetricsInput): { start?: Date; end?: Date } {
  const ai = normalizeAlgorithmInputs(recipe.algorithm_inputs);
  if (!ai) return {};

  if (recipe.algorithm === "Intelligence Algorithm") {
    return {
      start: dateFromParts(ai.start as DateParts),
      end: dateFromParts(ai.end as DateParts),
    };
  }

  const dates = ai.dates as { start?: DateParts; end?: DateParts } | undefined;
  return {
    start: dateFromParts(dates?.start),
    end: dateFromParts(dates?.end),
  };
}

/** CAGR in percent: ((ending/beginning)^(1/years) - 1) * 100 */
export function computeCagr(
  recipe: RecipeMetricsInput,
  options?: { initialCapital?: number | null },
): number | null {
  const { start, end } = getStartEndDates(recipe);
  const begin = options?.initialCapital ?? recipe.initial_capital ?? null;
  const netProfit = parseCurrencyFromString(recipe.net_profit);
  if (!begin || netProfit === null || !start || !end) return null;

  const years = (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24 * 365.25);
  if (years <= 0) return null;

  const endingValue = begin + netProfit;
  if (begin <= 0 || endingValue <= 0) return null;

  const cagr = Math.pow(endingValue / begin, 1 / years) - 1;
  return Number.isFinite(cagr) ? cagr * 100 : null;
}

export function getDisplayCagr(
  recipe: RecipeMetricsInput,
  options?: { initialCapital?: number | null },
): number | null {
  return computeCagr(recipe, options);
}

export function isMarketWaveAlgorithm(recipe: RecipeMetricsInput): boolean {
  return recipe.algorithm?.trim() === "Market Wave";
}

/** Strategy PnL % from base initial capital and net profit (invariant to display scale). */
export function getStrategyPnlPercent(recipe: RecipeMetricsInput): number | null {
  const initial = recipe.initial_capital ?? null;
  const netProfit = parseCurrencyFromString(recipe.net_profit);
  if (initial === null || initial <= 0 || netProfit === null) return null;
  return (netProfit / initial) * 100;
}

/** Market Wave: admin-entered buy & hold PnL (%). */
export function getBuyHoldPnlPercent(recipe: RecipeMetricsInput): number | null {
  if (!isMarketWaveAlgorithm(recipe)) return null;

  const fromColumn = parsePercentValue(recipe.buy_hold_pnl_percent);
  if (fromColumn !== null) return fromColumn;

  const ai = normalizeAlgorithmInputs(recipe.algorithm_inputs);
  if (!ai) return null;

  return (
    parsePercentValue(ai.buyHoldPnlPercent) ??
    parsePercentValue(ai.buy_hold_pnl_percent) ??
    parsePercentValue((ai.benchmark as Record<string, unknown> | undefined)?.buyHoldPnlPercent)
  );
}

/** Persisted value for Market Wave recipes (column + algorithm_inputs). */
export function resolveBuyHoldPnlPercentForSave(
  algorithm: string | undefined,
  algorithm_inputs: unknown,
): number | null {
  if (algorithm?.trim() !== "Market Wave") return null;
  return getBuyHoldPnlPercent({ algorithm, algorithm_inputs });
}

/** Strategy PnL % minus buy & hold PnL % (positive = strategy outperformed). */
export function getPnlVsBuyHoldDelta(recipe: RecipeMetricsInput): number | null {
  const strategy = getStrategyPnlPercent(recipe);
  const buyHold = getBuyHoldPnlPercent(recipe);
  if (strategy === null || buyHold === null) return null;
  return strategy - buyHold;
}

export function getPortfolioValues(
  recipe: RecipeMetricsInput,
  scale = 1,
  initialCapitalOverride?: number | null,
): { beginning: number | null; ending: number | null } {
  const scaleFactor = Number.isFinite(scale) ? scale : 1;
  const baseBegin =
    initialCapitalOverride ?? recipe.initial_capital ?? null;
  const netProfit = parseCurrencyFromString(recipe.net_profit);
  if (baseBegin === null || baseBegin === undefined || netProfit === null) {
    return { beginning: null, ending: null };
  }
  const beginning = Math.round(baseBegin * scaleFactor);
  const ending = Math.round((baseBegin + netProfit) * scaleFactor);
  return { beginning, ending };
}

export function formatSignedPercent(value: number, decimals = 1): string {
  const sign = value >= 0 ? "+" : "";
  return `${sign}${value.toFixed(decimals)}%`;
}
