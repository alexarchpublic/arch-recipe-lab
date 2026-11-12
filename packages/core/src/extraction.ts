// The screenshot reader (PRD A4, A5, A9, A16; auto-ingestion EX1, EX2): the
// prompt, the extraction schema, its shape check and the cross-checks. One
// copy, shared by the admin console in the browser and the serverless reader
// (api/parse-recipe-screenshots.ts runs lib/extraction.bundle.js, built from
// this file by `npm run build:reader`). The case study pipeline uses it too.
//
// No dependencies: both apps type-check every file in packages/core, and the
// public site does not install the admin console's packages.
import { timeFrameAdjective } from "./naming";

const CRYPTO_ASSETS = ["BTC", "ETH", "SOL", "XRP", "SUI"] as const;
const ETF_TICKERS = [
  "SPY", "QQQ", "QQQM", "IWM", "DIA", "VTI", "VOO", "VTV", "VUG", "VEA", "VWO",
  "VGT", "VYM", "SCHD", "SCHX", "IVV", "IWF", "IWD", "IJH", "IJR", "IEFA", "IEMG",
  "EFA", "EEM", "AGG", "BND", "TLT", "IEF", "SHY", "LQD", "HYG", "JNK", "GLD",
  "IAU", "SLV", "USO", "TQQQ", "SQQQ", "SOXL", "SOXS", "SPXL", "SPXS", "UPRO",
  "SPXU", "QLD", "QID", "UVXY", "VXX", "BITO", "IBIT", "FBTC", "ARKK", "ARKW",
  "ARKF", "ARKG", "ARKQ", "XLF", "XLK", "XLE", "XLV", "XLI", "XLY", "XLP", "XLB",
  "XLU", "XLRE", "XLC", "SMH", "SOXX", "XBI", "KWEB", "XHB", "XRT", "XOP", "KRE",
  "VNQ", "VNQI",
] as const;

export const CORE_SCREENSHOT_KINDS = ["chart", "settings", "stats"] as const;
export const RECIPE_SCREENSHOT_KINDS = [...CORE_SCREENSHOT_KINDS, "dca"] as const;
export type CoreScreenshotKind = (typeof CORE_SCREENSHOT_KINDS)[number];
export type RecipeScreenshotKind = (typeof RECIPE_SCREENSHOT_KINDS)[number];

export const RECIPE_SCREENSHOT_LABELS: Record<RecipeScreenshotKind, string> = {
  chart: "Chart",
  settings: "Settings",
  stats: "Stats",
  dca: "DCA",
};

export const MIN_IMPORT_SCREENSHOT_COUNT = CORE_SCREENSHOT_KINDS.length;
export const MAX_IMPORT_SCREENSHOT_COUNT = RECIPE_SCREENSHOT_KINDS.length;
export const REQUIRED_SCREENSHOT_COUNT = MAX_IMPORT_SCREENSHOT_COUNT;

export function isImportableScreenshotCount(count: number): boolean {
  return count >= MIN_IMPORT_SCREENSHOT_COUNT && count <= MAX_IMPORT_SCREENSHOT_COUNT;
}

export type AssetClass = "Equities" | "ETFs" | "Crypto";
export type TimeHorizon = "STH" | "LTH";
export type RecipeFocus = "Cash Yielding" | "Balanced" | "Accumulation";
export type ChartTimeFrame = "1 Week" | "1 Day" | "6 Hours" | "4 Hours" | "1 Hour";

export interface ImportedRecipeDraft {
  /** The one authored name (auto-ingestion NM1). A plain-words default to edit. */
  title: string;
  asset_class: AssetClass;
  asset: string;
  time_horizon: TimeHorizon;
  focus: RecipeFocus;
  goal: string;
  entry_trade: string;
  exit_trade: string;
  sell_above_cost_basis: boolean;
  exit_to_entry_proportion: number;
  time_frame: ChartTimeFrame;
  backtesting_period: string;
  initial_capital?: number;
  cash_profit?: number;
  asset_accumulated?: string;
  net_profit?: string;
  algorithm: "Market Wave";
  algorithm_inputs: Record<string, unknown>;
}

export interface RecipeScreenshotExtraction {
  imageKinds: RecipeScreenshotKind[];
  ticker: string;
  assetName?: string | null;
  assetClass?: AssetClass | null;
  timeFrame?: string | null;
  chartIndicatorParameters?: string | null;
  ribbonColorScheme?: string | null;
  dcaInterval?: string | null;
  lastPrice?: number | null;
  /** Date of the last bar on the chart, when the settings end year is in the future (A16). */
  lastBarDate?: string | null;
  settings: {
    startingCash?: number | null;
    startingQty?: number | null;
    longThresholdEnabled?: boolean | null;
    longThresholdPercent?: number | null;
    exitThresholdEnabled?: boolean | null;
    exitThresholdPercent?: number | null;
    sharesEnabled?: boolean | null;
    entryShares?: number | null;
    exitShares?: number | null;
    fixedEnabled?: boolean | null;
    entryFixed?: number | null;
    exitFixed?: number | null;
    percentEnabled?: boolean | null;
    entryPercent?: number | null;
    exitPercent?: number | null;
    roundDownWholeShares?: boolean | null;
    scope?: number | null;
    onlySellAbove?: boolean | null;
    onlyBuyBelow?: boolean | null;
    sellBuffer?: number | null;
    buyBuffer?: number | null;
    staticSellAboveEnabled?: boolean | null;
    staticSellAbove?: number | null;
    staticBuyBelowEnabled?: boolean | null;
    staticBuyBelow?: number | null;
    buyInDownTrend?: boolean | null;
    buyInUpTrend?: boolean | null;
    sellInDownTrend?: boolean | null;
    sellInUpTrend?: boolean | null;
    buyOnUpTrend?: boolean | null;
    sellOnDownTrend?: boolean | null;
    startYear?: number | null;
    startMonth?: number | null;
    startDay?: number | null;
    startHour?: number | null;
    startMinute?: number | null;
    endYear?: number | null;
    endMonth?: number | null;
    endDay?: number | null;
    exitFullOnLastBar?: boolean | null;
    showDcaBenchmark?: boolean | null;
    dcaInterval?: string | null;
  };
  stats: {
    initialCashBalance?: number | null;
    initialShares?: number | null;
    currentShares?: number | null;
    currentSharesValue?: number | null;
    currentCashBalance?: number | null;
    totalBaseCost?: number | null;
    avgCostBasis?: number | null;
    unrealizedProfit?: number | null;
    realizedProfit?: number | null;
    totalPnl?: number | null;
    buyHoldRoiPercent?: number | null;
    strategyRoiPercent?: number | null;
    strategyPortfolioValue?: number | null;
  };
  dca: {
    dcaBenchmarkRoiPercent?: number | null;
    dcaPortfolioValue?: number | null;
    showDcaBenchmark?: boolean | null;
  };
}

export interface CrossCheckEntry {
  field: string;
  chart: number;
  panel: number;
}

export interface ScreenshotImportResult {
  recipe: ImportedRecipeDraft;
  orderedKinds: RecipeScreenshotKind[];
  warnings: string[];
  /** Chart header and settings panel disagreements (A9). */
  crossCheck?: CrossCheckEntry[];
  /** Last bar on the chart, YYYY-MM-DD, when the run end is in the future (A16). */
  lastBarDate?: string | null;
}

/** Bump whenever RECIPE_SCREENSHOT_EXTRACTION_PROMPT changes (A5, A14). */
export const PROMPT_VERSION = "2026-11-11.1";

type FieldKind = "number" | "boolean" | "string";
const NUMBER_FIELDS = (names: string) => names.split(/\s+/).filter(Boolean).map((n) => [n, "number"] as const);
const BOOLEAN_FIELDS = (names: string) => names.split(/\s+/).filter(Boolean).map((n) => [n, "boolean"] as const);

const SETTINGS_FIELDS: ReadonlyArray<readonly [string, FieldKind]> = [
  ...NUMBER_FIELDS(`startingCash startingQty longThresholdPercent exitThresholdPercent entryShares exitShares
    entryFixed exitFixed entryPercent exitPercent scope sellBuffer buyBuffer staticSellAbove staticBuyBelow
    startYear startMonth startDay startHour startMinute endYear endMonth endDay`),
  ...BOOLEAN_FIELDS(`longThresholdEnabled exitThresholdEnabled sharesEnabled fixedEnabled percentEnabled
    roundDownWholeShares onlySellAbove onlyBuyBelow staticSellAboveEnabled staticBuyBelowEnabled buyInDownTrend
    buyInUpTrend sellInDownTrend sellInUpTrend buyOnUpTrend sellOnDownTrend exitFullOnLastBar showDcaBenchmark`),
  ["dcaInterval", "string"],
];
const STATS_FIELDS = NUMBER_FIELDS(`initialCashBalance initialShares currentShares currentSharesValue
  currentCashBalance totalBaseCost avgCostBasis unrealizedProfit realizedProfit totalPnl buyHoldRoiPercent
  strategyRoiPercent strategyPortfolioValue`);
const DCA_FIELDS: ReadonlyArray<readonly [string, FieldKind]> = [
  ...NUMBER_FIELDS("dcaBenchmarkRoiPercent dcaPortfolioValue"),
  ["showDcaBenchmark", "boolean"],
];
const TOP_OPTIONAL_STRINGS = ["assetName", "timeFrame", "chartIndicatorParameters", "ribbonColorScheme", "dcaInterval"];
const ASSET_CLASSES = ["Equities", "ETFs", "Crypto"];

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

/** A value of the given kind, or null/absent. Numbers must be finite JSON numbers. */
function kindProblem(value: unknown, kind: FieldKind): string | null {
  if (value === null || value === undefined) return null;
  if (kind === "number") return typeof value === "number" && Number.isFinite(value) ? null : `expected a number, got ${JSON.stringify(value)}`;
  if (kind === "boolean") return typeof value === "boolean" ? null : `expected true or false, got ${JSON.stringify(value)}`;
  return typeof value === "string" ? null : `expected text, got ${JSON.stringify(value)}`;
}

function checkGroup(
  out: string[],
  path: string,
  group: unknown,
  fields: ReadonlyArray<readonly [string, FieldKind]>,
  required: boolean,
): void {
  if (group === undefined && !required) return;
  if (!isObject(group)) {
    out.push(`${path}: expected an object`);
    return;
  }
  for (const [name, kind] of fields) {
    const problem = kindProblem(group[name], kind);
    if (problem) out.push(`${path}.${name}: ${problem}`);
  }
}

/**
 * Checks the model's JSON against the expected shape (A4). Returns one line
 * per problem; an empty list means the shape is right. Numbers must be
 * numbers: a string such as "1,234" is a problem, not a value.
 */
export function validateExtractionShape(raw: unknown): string[] {
  if (!isObject(raw)) return ["(root): expected an object"];
  const out: string[] = [];
  const kinds = raw.imageKinds;
  if (!Array.isArray(kinds)) {
    out.push("imageKinds: expected a list");
  } else {
    kinds.forEach((k, i) => {
      if (!(RECIPE_SCREENSHOT_KINDS as readonly unknown[]).includes(k)) {
        out.push(`imageKinds.${i}: expected one of ${RECIPE_SCREENSHOT_KINDS.join(", ")}, got ${JSON.stringify(k)}`);
      }
    });
  }
  if (typeof raw.ticker !== "string" || raw.ticker.trim() === "") out.push("ticker: expected the chart symbol");
  for (const name of TOP_OPTIONAL_STRINGS) {
    const problem = kindProblem(raw[name], "string");
    if (problem) out.push(`${name}: ${problem}`);
  }
  if (raw.assetClass !== null && raw.assetClass !== undefined && !ASSET_CLASSES.includes(raw.assetClass as string)) {
    out.push(`assetClass: expected one of ${ASSET_CLASSES.join(", ")}, got ${JSON.stringify(raw.assetClass)}`);
  }
  const lastPrice = kindProblem(raw.lastPrice, "number");
  if (lastPrice) out.push(`lastPrice: ${lastPrice}`);
  if (raw.lastBarDate !== null && raw.lastBarDate !== undefined
      && !(typeof raw.lastBarDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(raw.lastBarDate))) {
    out.push(`lastBarDate: must be YYYY-MM-DD, got ${JSON.stringify(raw.lastBarDate)}`);
  }
  checkGroup(out, "settings", raw.settings, SETTINGS_FIELDS, true);
  checkGroup(out, "stats", raw.stats, STATS_FIELDS, true);
  checkGroup(out, "dca", raw.dca, DCA_FIELDS, false);
  return out;
}

/**
 * The chart header repeats the numeric settings. Every value both the header
 * and the settings panel carry is compared; each disagreement is returned (A9).
 */
export function crossCheckChartAgainstSettings(extraction: RecipeScreenshotExtraction): CrossCheckEntry[] {
  type Group = Record<string, unknown> | undefined;
  type ChartParams = {
    userInitialCapital?: Group; longThreshold?: Group; exitThreshold?: Group; tradeSize?: Group;
    marketWave?: Group; staticPriceFilter?: Group; dates?: { start?: Group; end?: Group };
  };
  const chart = parseMarketWaveChartParams(extraction.chartIndicatorParameters ?? "") as ChartParams | null;
  if (!chart) return [];
  const settings = extraction.settings ?? {};
  const pairs: Array<[string, unknown, unknown]> = [
    ["startingCash", chart.userInitialCapital?.startingCash, settings.startingCash],
    ["startingQty", chart.userInitialCapital?.startingQty, settings.startingQty],
    ["longThresholdPercent", chart.longThreshold?.percent, settings.longThresholdPercent],
    ["exitThresholdPercent", chart.exitThreshold?.percent, settings.exitThresholdPercent],
    ["entryShares", chart.tradeSize?.entryShares, settings.entryShares],
    ["exitShares", chart.tradeSize?.exitShares, settings.exitShares],
    ["entryFixed", chart.tradeSize?.entryFixed, settings.entryFixed],
    ["exitFixed", chart.tradeSize?.exitFixed, settings.exitFixed],
    ["entryPercent", chart.tradeSize?.entryPercent, settings.entryPercent],
    ["exitPercent", chart.tradeSize?.exitPercent, settings.exitPercent],
    ["scope", chart.marketWave?.scope, settings.scope],
    ["sellBuffer", chart.marketWave?.sellBuffer, settings.sellBuffer],
    ["buyBuffer", chart.marketWave?.buyBuffer, settings.buyBuffer],
    ["staticSellAbove", chart.staticPriceFilter?.sellAbove, settings.staticSellAbove],
    ["staticBuyBelow", chart.staticPriceFilter?.buyBelow, settings.staticBuyBelow],
    ["startYear", chart.dates?.start?.year, settings.startYear],
    ["startMonth", chart.dates?.start?.month, settings.startMonth],
    ["startDay", chart.dates?.start?.day, settings.startDay],
    ["startHour", chart.dates?.start?.hour, settings.startHour],
    ["startMinute", chart.dates?.start?.minute, settings.startMinute],
    ["endYear", chart.dates?.end?.year, settings.endYear],
    ["endMonth", chart.dates?.end?.month, settings.endMonth],
    ["endDay", chart.dates?.end?.day, settings.endDay],
  ];
  const out: CrossCheckEntry[] = [];
  for (const [field, a, b] of pairs) {
    const chartValue = asFinite(a);
    const panelValue = asFinite(b);
    if (chartValue === null || panelValue === null) continue;
    if (Math.abs(chartValue - panelValue) > 1e-9) {
      out.push({ field, chart: chartValue, panel: panelValue });
    }
  }
  return out;
}

const NUMBER_TOKEN_RE = /-?\d{1,3}(?:,\d{3})+(?:\.\d+)?|-?\d+(?:\.\d+)?/g;
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function asFinite(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = parseFloat(value.replace(/,/g, "").replace(/[—–]/g, "-"));
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function asBool(value: unknown, fallback = false): boolean {
  if (typeof value === "boolean") return value;
  return fallback;
}

function pickNumber(...values: unknown[]): number | undefined {
  for (const value of values) {
    const parsed = asFinite(value);
    if (parsed !== null) return parsed;
  }
  return undefined;
}

function formatUsd(value: number, digits = 0): string {
  return `$${value.toLocaleString("en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })}`;
}

function formatMonthYear(year?: number, month?: number): string | null {
  if (!year || !month || month < 1 || month > 12) return null;
  return `${MONTHS[month - 1]} ${year}`;
}

export function inferAssetClass(ticker: string, hinted?: AssetClass | null): AssetClass {
  const symbol = ticker.trim().toUpperCase();
  if (hinted === "Crypto" || CRYPTO_ASSETS.includes(symbol as (typeof CRYPTO_ASSETS)[number])) {
    return "Crypto";
  }
  if (hinted === "ETFs" || ETF_TICKERS.includes(symbol as (typeof ETF_TICKERS)[number])) {
    return "ETFs";
  }
  return "Equities";
}

export function normalizeTimeFrame(raw?: string | null): ChartTimeFrame {
  const text = (raw ?? "").trim().toLowerCase().replace(/\s+/g, " ");
  if (/(1\s*w|weekly|1 week)/.test(text)) return "1 Week";
  if (/(1\s*d|daily|1 day)/.test(text)) return "1 Day";
  if (/(6\s*h|6 hour)/.test(text)) return "6 Hours";
  if (/(4\s*h|4 hour)/.test(text)) return "4 Hours";
  if (/(1\s*h|60m|1 hour)/.test(text)) return "1 Hour";
  return "1 Hour";
}

/** The horizon filter: a weekly chart is long term, anything shorter is short term. */
function inferHorizon(timeFrame: ChartTimeFrame): TimeHorizon {
  return timeFrame === "1 Week" ? "LTH" : "STH";
}

/**
 * A plain-words title to start from, in the naming rules (NM2, NM3): no codes
 * such as STH, 1H or Scalp. The admin edits it; the case study pipeline has
 * Claude write the real one.
 */
export function defaultTitle(ticker: string, timeFrame: ChartTimeFrame): string {
  return `${ticker} on the ${timeFrameAdjective(timeFrame) ?? "daily"} chart`;
}

function inferFocus(stats: RecipeScreenshotExtraction["stats"]): RecipeFocus {
  const portfolio =
    pickNumber(stats.strategyPortfolioValue) ??
    (pickNumber(stats.currentSharesValue, 0)! + pickNumber(stats.currentCashBalance, 0)!);
  const shareValue = pickNumber(stats.currentSharesValue) ?? 0;
  const cash = pickNumber(stats.currentCashBalance) ?? 0;
  if (portfolio > 0 && shareValue / portfolio >= 0.65) return "Accumulation";
  if (portfolio > 0 && cash / portfolio >= 0.65) return "Cash Yielding";
  return "Balanced";
}

export function parseMarketWaveChartParams(text: string): Record<string, unknown> | null {
  if (!text) return null;
  const idx = text.search(/Market Wave/i);
  const slice = idx >= 0 ? text.slice(idx) : text;
  const tokens = slice.match(NUMBER_TOKEN_RE) ?? [];
  const nums = tokens.map((token) => parseFloat(token.replace(/,/g, ""))).filter((n) => Number.isFinite(n));

  for (let i = 0; i <= nums.length - 23; i++) {
    const n = nums.slice(i, i + 23);
    const startYear = n[15];
    const startMonth = n[16];
    const endYear = n[20];
    const endMonth = n[21];
    if (
      n[0] >= 1000 &&
      startYear >= 2000 &&
      startYear <= 2100 &&
      endYear >= 2000 &&
      endYear <= 3000 &&
      startMonth >= 1 &&
      startMonth <= 12 &&
      endMonth >= 1 &&
      endMonth <= 12
    ) {
      return {
        userInitialCapital: {
          startingCash: n[0],
          startingQty: n[1],
        },
        longThreshold: { percent: n[2] },
        exitThreshold: { percent: n[3] },
        tradeSize: {
          entryShares: n[4],
          exitShares: n[5],
          entryFixed: n[6],
          exitFixed: n[7],
          entryPercent: n[8],
          exitPercent: n[9],
        },
        marketWave: {
          scope: n[10],
          sellBuffer: n[11],
          buyBuffer: n[12],
        },
        staticPriceFilter: {
          sellAbove: n[13],
          buyBelow: n[14],
        },
        dates: {
          start: {
            year: n[15],
            month: n[16],
            day: n[17],
            hour: n[18],
            minute: n[19],
          },
          end: {
            year: n[20],
            month: n[21],
            day: n[22],
          },
        },
      };
    }
  }
  return null;
}

export function classifyKindsFromFilenames(filenames: string[]): RecipeScreenshotKind[] | null {
  if (!isImportableScreenshotCount(filenames.length)) return null;
  const kinds: Array<RecipeScreenshotKind | null> = filenames.map((name) => {
    const lower = name.toLowerCase();
    if (lower.includes("dca")) return "dca";
    if (lower.includes("setting") || lower.includes("input")) return "settings";
    if (lower.includes("chart") || lower.includes("graph")) return "chart";
    if (lower.includes("stat")) return "stats";
    return null;
  });
  if (!kinds.every(Boolean)) return null;
  const unique = new Set(kinds);
  if (unique.size !== kinds.length) return null;
  if (CORE_SCREENSHOT_KINDS.some((kind) => !unique.has(kind))) return null;
  if (filenames.length === MIN_IMPORT_SCREENSHOT_COUNT && unique.has("dca")) return null;
  if (filenames.length === MAX_IMPORT_SCREENSHOT_COUNT && !unique.has("dca")) return null;
  return kinds as RecipeScreenshotKind[];
}

function tradeLabels(inputs: Record<string, unknown>): { entry: string; exit: string; proportion: number } {
  const tradeSize = (inputs.tradeSize ?? {}) as Record<string, unknown>;
  if (tradeSize.percentEnabled) {
    const entry = pickNumber(tradeSize.entryPercent) ?? 0;
    const exit = pickNumber(tradeSize.exitPercent) ?? 0;
    return {
      entry: `${entry}% of capital`,
      exit: `${exit}% of capital`,
      proportion: entry > 0 ? exit / entry : 0,
    };
  }
  if (tradeSize.sharesEnabled) {
    const entry = pickNumber(tradeSize.entryShares) ?? 0;
    const exit = pickNumber(tradeSize.exitShares) ?? 0;
    return {
      entry: `${entry} shares`,
      exit: `${exit} shares`,
      proportion: entry > 0 ? exit / entry : 0,
    };
  }
  if (tradeSize.fixedEnabled) {
    const entry = pickNumber(tradeSize.entryFixed) ?? 0;
    const exit = pickNumber(tradeSize.exitFixed) ?? 0;
    return {
      entry: formatUsd(entry),
      exit: formatUsd(exit),
      proportion: entry > 0 ? exit / entry : 0,
    };
  }
  return { entry: "See parameters", exit: "See parameters", proportion: 0 };
}

export const RECIPE_SCREENSHOT_EXTRACTION_PROMPT = `You extract Arch Public Market Wave recipe fields from 3 or 4 screenshots. Chart, settings, and stats are required. DCA is optional. Images may arrive in any order. Classify each image, then read every visible number and checkbox.

Screenshot kinds:
- chart: TradingView candlestick chart. Header has ticker, timeframe (e.g. 1h), and an indicator line like "ARCH: Market Wave Equities" followed by a long numeric parameter list, color scheme, and DCA interval (e.g. Monthly).
- settings: TradingView indicator settings panel (USER INITIAL CAPITAL, ORDER ENTRY & EXIT RULES, TRADE SIZE, MARKET WAVE, STATIC MARKET PRICE FILTER, TREND FILTER, START DATE / TIME, END DATE, BACKTESTING, DCA Benchmark). Checkboxes matter. A green/checked box is true; empty is false. Only one or more of Shares / Fixed / Percentage Trade Size may be checked.
- stats: DATA WINDOW - CORE PORTFOLIO and BENCHMARKS (Initial Cash, Current Shares, Realized/Unrealized/Total P&L, Buy & Hold ROI %, Strategy ROI %, etc.).
- dca (optional): DATA WINDOW with DCA Benchmark ROI %, Strategy vs DCA %, DCA pot/slice metrics. Omit this kind when no DCA screenshot is in the set.

Chart numeric parameter order after the indicator name (ignore commas in thousands):
startingCash, startingQty, longThreshold%, exitThreshold%, entryShares, exitShares, entryFixed$, exitFixed$, entryPercent, exitPercent, scope, sellBuffer%, buyBuffer%, staticSellAbove, staticBuyBelow, startYear, startMonth, startDay, startHour, startMinute, endYear, endMonth, endDay.
Then optional text: ribbon colors and DCA interval.

Return ONLY JSON with this shape:
{
  "imageKinds": ["chart"|"settings"|"stats"|"dca", ... one per input image, in the SAME order as the input images],
  "ticker": "IREN",
  "assetName": "IREN LIMITED",
  "assetClass": "Equities"|"ETFs"|"Crypto",
  "timeFrame": "1h",
  "chartIndicatorParameters": "full numeric parameter string from the chart indicator title if present",
  "ribbonColorScheme": "Neon Pink / Neon Green",
  "dcaInterval": "Monthly"|null,
  "lastPrice": 37.92,
  "lastBarDate": "2026-08-25",
  "settings": {
    "startingCash": 100000,
    "startingQty": 0,
    "longThresholdEnabled": true,
    "longThresholdPercent": -0.9,
    "exitThresholdEnabled": true,
    "exitThresholdPercent": 1.2,
    "sharesEnabled": false,
    "entryShares": 1,
    "exitShares": 1,
    "fixedEnabled": false,
    "entryFixed": 100,
    "exitFixed": 100,
    "percentEnabled": true,
    "entryPercent": 45.3,
    "exitPercent": 29,
    "roundDownWholeShares": false,
    "scope": 20,
    "onlySellAbove": false,
    "onlyBuyBelow": true,
    "sellBuffer": 6.2,
    "buyBuffer": 9.8,
    "staticSellAboveEnabled": false,
    "staticSellAbove": 0,
    "staticBuyBelowEnabled": false,
    "staticBuyBelow": 0,
    "buyInDownTrend": false,
    "buyInUpTrend": false,
    "sellInDownTrend": false,
    "sellInUpTrend": false,
    "buyOnUpTrend": false,
    "sellOnDownTrend": false,
    "startYear": 2026,
    "startMonth": 1,
    "startDay": 1,
    "startHour": 0,
    "startMinute": 30,
    "endYear": 2030,
    "endMonth": 1,
    "endDay": 28,
    "exitFullOnLastBar": false,
    "showDcaBenchmark": true,
    "dcaInterval": "Monthly"
  },
  "stats": {
    "initialCashBalance": 100000,
    "initialShares": 0,
    "currentShares": 3858,
    "currentSharesValue": 146295.36,
    "currentCashBalance": 17094.07,
    "totalBaseCost": 153171.89,
    "avgCostBasis": 39.70,
    "unrealizedProfit": -6876.53,
    "realizedProfit": 70265.96,
    "totalPnl": 63389.43,
    "buyHoldRoiPercent": -4.56,
    "strategyRoiPercent": 63.39,
    "strategyPortfolioValue": 163389.43
  },
  "dca": {
    "dcaBenchmarkRoiPercent": -2.07,
    "dcaPortfolioValue": 97933.15,
    "showDcaBenchmark": true
  }
}

Rules:
- Numbers must be JSON numbers, not strings. Preserve negatives.
- imageKinds MUST have one entry per input image, in that same order. Always include chart, settings, and stats exactly once. Include dca only when a DCA screenshot is present.
- If there is no DCA screenshot, set "dca" to {} and dcaInterval to null.
- Prefer the settings panel for checkbox truth. Prefer the chart parameter string for the numeric series if settings are blurry.
- If a checkbox is not visible, use false.
- Ticker is the chart symbol (IREN, AAPL, SPY), not the company long name.
- assetClass: Crypto only for BTC/ETH/SOL/XRP/SUI; ETFs for funds like SPY/QQQ; otherwise Equities.
- lastBarDate: the end year in the settings is often far in the future (for example 2030 or 2999) so TradingView unlocks the symbol. When the settings end date is later than the last candle on the chart, read the date of the last (right-most) candle from the chart's time axis, using the date gridline labels, and return it as "YYYY-MM-DD". Otherwise return null. Never return the settings end date here.`;

export function buildRecipeFromExtraction(
  extraction: RecipeScreenshotExtraction,
  warnings: string[] = [],
): ScreenshotImportResult {
  const ticker = (extraction.ticker || "").trim().toUpperCase();
  if (!ticker) {
    throw new Error("Could not read a ticker from the chart screenshot");
  }

  const kinds = extraction.imageKinds ?? [];
  const uniqueKinds = new Set(kinds);
  if (
    !isImportableScreenshotCount(kinds.length) ||
    uniqueKinds.size !== kinds.length ||
    CORE_SCREENSHOT_KINDS.some((kind) => !uniqueKinds.has(kind))
  ) {
    throw new Error("Could not classify the screenshots as chart, settings, and stats");
  }
  const hasDcaScreenshot = uniqueKinds.has("dca");

  const settings = extraction.settings ?? {};
  const stats = extraction.stats ?? {};
  const dca = extraction.dca ?? {};
  const chartParams = parseMarketWaveChartParams(extraction.chartIndicatorParameters ?? "");
  if (!chartParams) {
    warnings.push("Chart indicator parameter string was missing or incomplete; using settings panel numbers.");
  }

  const timeFrame = normalizeTimeFrame(extraction.timeFrame);
  const horizon = inferHorizon(timeFrame);
  const assetClass = inferAssetClass(ticker, extraction.assetClass);
  const focus = inferFocus(stats);

  const startingCash =
    pickNumber(
      (chartParams?.userInitialCapital as Record<string, unknown> | undefined)?.startingCash,
      settings.startingCash,
      stats.initialCashBalance,
    ) ?? 100000;
  const startingQty =
    pickNumber(
      (chartParams?.userInitialCapital as Record<string, unknown> | undefined)?.startingQty,
      settings.startingQty,
      stats.initialShares,
    ) ?? 0;

  const longPercent = pickNumber(
    (chartParams?.longThreshold as Record<string, unknown> | undefined)?.percent,
    settings.longThresholdPercent,
  );
  const exitPercent = pickNumber(
    (chartParams?.exitThreshold as Record<string, unknown> | undefined)?.percent,
    settings.exitThresholdPercent,
  );
  const chartTrade = (chartParams?.tradeSize ?? {}) as Record<string, unknown>;
  const chartWave = (chartParams?.marketWave ?? {}) as Record<string, unknown>;
  const chartStatic = (chartParams?.staticPriceFilter ?? {}) as Record<string, unknown>;
  const chartDates = (chartParams?.dates ?? {}) as {
    start?: Record<string, number>;
    end?: Record<string, number>;
  };

  const percentEnabled = asBool(settings.percentEnabled, false);
  const sharesEnabled = asBool(settings.sharesEnabled, false);
  const fixedEnabled = asBool(settings.fixedEnabled, false);
  const showDca =
    hasDcaScreenshot &&
    (asBool(settings.showDcaBenchmark, false) ||
      asBool(dca.showDcaBenchmark, false) ||
      dca.dcaBenchmarkRoiPercent != null);
  if (!hasDcaScreenshot) {
    warnings.push("No DCA screenshot; DCA benchmark left blank.");
  }

  const algorithm_inputs: Record<string, unknown> = {
    userInitialCapital: {
      startingCash,
      startingQty,
      ...(assetClass === "Crypto" ? { startingCryptoQty: startingQty } : {}),
    },
    longThreshold: {
      enabled: asBool(settings.longThresholdEnabled, longPercent != null),
      percent: longPercent,
    },
    exitThreshold: {
      enabled: asBool(settings.exitThresholdEnabled, exitPercent != null),
      percent: exitPercent,
    },
    tradeSize: {
      sharesEnabled,
      entryShares: pickNumber(chartTrade.entryShares, settings.entryShares),
      exitShares: pickNumber(chartTrade.exitShares, settings.exitShares),
      fixedEnabled,
      entryFixed: pickNumber(chartTrade.entryFixed, settings.entryFixed),
      exitFixed: pickNumber(chartTrade.exitFixed, settings.exitFixed),
      percentEnabled,
      entryPercent: pickNumber(chartTrade.entryPercent, settings.entryPercent),
      exitPercent: pickNumber(chartTrade.exitPercent, settings.exitPercent),
      roundDownWholeShares: asBool(settings.roundDownWholeShares, false),
    },
    marketWave: {
      scope: pickNumber(chartWave.scope, settings.scope),
      onlySellAbove: asBool(settings.onlySellAbove, false),
      onlyBuyBelow: asBool(settings.onlyBuyBelow, false),
      sellBuffer: pickNumber(chartWave.sellBuffer, settings.sellBuffer),
      buyBuffer: pickNumber(chartWave.buyBuffer, settings.buyBuffer),
    },
    staticPriceFilter: {
      sellAboveEnabled: asBool(settings.staticSellAboveEnabled, false),
      sellAbove: pickNumber(chartStatic.sellAbove, settings.staticSellAbove) ?? 0,
      buyBelowEnabled: asBool(settings.staticBuyBelowEnabled, false),
      buyBelow: pickNumber(chartStatic.buyBelow, settings.staticBuyBelow) ?? 0,
    },
    trendFilter: {
      buyInDownTrend: asBool(settings.buyInDownTrend, false),
      buyInUpTrend: asBool(settings.buyInUpTrend, false),
      sellInDownTrend: asBool(settings.sellInDownTrend, false),
      sellInUpTrend: asBool(settings.sellInUpTrend, false),
      buyOnUpTrend: asBool(settings.buyOnUpTrend, false),
      sellOnDownTrend: asBool(settings.sellOnDownTrend, false),
    },
    dates: {
      start: {
        year: pickNumber(chartDates.start?.year, settings.startYear),
        month: pickNumber(chartDates.start?.month, settings.startMonth),
        day: pickNumber(chartDates.start?.day, settings.startDay),
        hour: pickNumber(chartDates.start?.hour, settings.startHour) ?? 0,
        minute: pickNumber(chartDates.start?.minute, settings.startMinute) ?? 0,
      },
      end: {
        year: pickNumber(chartDates.end?.year, settings.endYear),
        month: pickNumber(chartDates.end?.month, settings.endMonth),
        day: pickNumber(chartDates.end?.day, settings.endDay),
      },
    },
    backtest: {
      exitFullOnLastBar: asBool(settings.exitFullOnLastBar, false),
    },
    buyHoldPnlPercent: pickNumber(stats.buyHoldRoiPercent),
    dcaPnlPercent: pickNumber(dca.dcaBenchmarkRoiPercent),
    benchmark: {
      showBuyHold: true,
      showDca,
      dcaInterval: extraction.dcaInterval || settings.dcaInterval || null,
    },
    showDcaBenchmark: showDca,
  };

  const dates = algorithm_inputs.dates as {
    start: { year?: number; month?: number; day?: number };
    end: { year?: number; month?: number; day?: number };
  };
  const periodStart = formatMonthYear(dates.start.year, dates.start.month);
  const periodEnd = formatMonthYear(dates.end.year, dates.end.month);
  const backtesting_period =
    periodStart && periodEnd ? `${periodStart} – ${periodEnd}` : periodStart || periodEnd || "N/A";

  const trades = tradeLabels(algorithm_inputs);
  const currentShares = pickNumber(stats.currentShares);
  const totalPnl = pickNumber(stats.totalPnl);
  const realized = pickNumber(stats.realizedProfit);

  const asset_accumulated =
    currentShares != null ? `${currentShares} ${ticker}` : undefined;

  const recipe: ImportedRecipeDraft = {
    title: defaultTitle(ticker, timeFrame),
    asset_class: assetClass,
    asset: ticker,
    time_horizon: horizon,
    focus,
    goal: `Trade ${ticker} on the ${timeFrameAdjective(timeFrame) ?? "daily"} chart.`,
    entry_trade: trades.entry,
    exit_trade: trades.exit,
    sell_above_cost_basis: true,
    exit_to_entry_proportion: Number.isFinite(trades.proportion) ? trades.proportion : 0,
    time_frame: timeFrame,
    backtesting_period,
    initial_capital: startingCash,
    cash_profit: realized,
    asset_accumulated,
    net_profit: totalPnl != null ? formatUsd(totalPnl, Math.abs(totalPnl) < 100 ? 2 : 0) : undefined,
    algorithm: "Market Wave",
    algorithm_inputs,
  };

  const crossCheck = crossCheckChartAgainstSettings(extraction);
  for (const entry of crossCheck) {
    warnings.push(`Chart header and settings panel disagree on ${entry.field}: chart ${entry.chart}, panel ${entry.panel}.`);
  }
  const lastBarDate =
    typeof extraction.lastBarDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(extraction.lastBarDate)
      ? extraction.lastBarDate
      : null;

  return { recipe, orderedKinds: kinds, warnings, crossCheck, lastBarDate };
}

export function orderFilesByKinds<T>(items: T[], kinds: RecipeScreenshotKind[]): T[] {
  return RECIPE_SCREENSHOT_KINDS.filter((kind) => kinds.includes(kind)).map((kind) => {
    const index = kinds.indexOf(kind);
    if (index < 0) throw new Error(`Missing ${kind} screenshot`);
    return items[index];
  });
}
