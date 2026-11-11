// Settings as a client reads and enters them (PRD P7, P15, P16).
//
// One list of rows, in the order of the TradingView settings panel, feeds the
// strategy page ("as tested") and the guided apply step ("apply"). Before
// Phase 2 the two screens each had their own copy of these rules.
/* eslint-disable @typescript-eslint/no-explicit-any -- settings are untyped JSON (see ProStrategy) */
import { type DateParts, TRADINGVIEW_END_INSTRUCTION, isoToParts } from "./strategy";

export type SettingsMode = "as_tested" | "apply";

export interface SettingRow {
  /** Stable key, used for copy events and React keys. */
  key: string;
  /** Panel group heading, e.g. "Inputs", "Trade size", "Properties". */
  section: string;
  label: string;
  /** What the screen shows. */
  value: string;
  /** What the copy button puts on the clipboard, or null when there is nothing to type (a checkbox, an instruction). */
  copy: string | null;
  /** A tick box in TradingView rather than a value. */
  checkbox?: boolean;
  /** Filled in for the client rather than read from the strategy (P16). */
  prefilled?: boolean;
}

// ---------------------------------------------------------------------------
// Scaling the dollar inputs to a capital (moved from src/utils/recipeScaling).
// Percentages, dates and absolute price levels never scale.
// ---------------------------------------------------------------------------

export function scaleAlgorithmInputs(algorithm_inputs: any, scaleFactor: number, algorithm?: string | null): any {
  if (!algorithm_inputs || typeof algorithm_inputs !== "object") return algorithm_inputs;
  if (!isFinite(scaleFactor) || scaleFactor <= 0) return algorithm_inputs;

  const scaled = JSON.parse(JSON.stringify(algorithm_inputs));

  if (typeof scaled.tradeSize === "object" && scaled.tradeSize !== null) {
    // Arbitrage Algorithm
    if (typeof scaled.tradeSize.entry === "number") scaled.tradeSize.entry = Math.round(scaled.tradeSize.entry * scaleFactor);
    if (typeof scaled.tradeSize.exit === "number") scaled.tradeSize.exit = Math.round(scaled.tradeSize.exit * scaleFactor);
    // Oracle Protocol and Market Wave fixed sizes
    if (typeof scaled.tradeSize.entryFixed === "number") scaled.tradeSize.entryFixed = Math.round(scaled.tradeSize.entryFixed * scaleFactor);
    if (typeof scaled.tradeSize.exitFixed === "number") scaled.tradeSize.exitFixed = Math.round(scaled.tradeSize.exitFixed * scaleFactor);
    // Market Wave share sizes: whole shares, floored, zero allowed
    if (typeof scaled.tradeSize.entryShares === "number") scaled.tradeSize.entryShares = Math.max(0, Math.floor(scaled.tradeSize.entryShares * scaleFactor));
    if (typeof scaled.tradeSize.exitShares === "number") scaled.tradeSize.exitShares = Math.max(0, Math.floor(scaled.tradeSize.exitShares * scaleFactor));
  }

  // Market Wave starting position. Static price filter levels are market
  // prices and are not scaled.
  if (typeof scaled.userInitialCapital === "object" && scaled.userInitialCapital !== null) {
    const u = scaled.userInitialCapital;
    if (typeof u.startingCash === "number") u.startingCash = Math.round(u.startingCash * scaleFactor);
    if (typeof u.startingCryptoQty === "number") u.startingCryptoQty = u.startingCryptoQty * scaleFactor;
    if (typeof u.startingQty === "number") u.startingQty = Math.max(0, Math.floor(u.startingQty * scaleFactor));
  }

  // Intelligence Algorithm and Oracle Protocol properties
  if (typeof scaled.properties === "object" && scaled.properties !== null) {
    const p = scaled.properties;
    if (typeof p.initialCapital === "number") p.initialCapital = Math.round(p.initialCapital * scaleFactor);
    if (typeof p.orderSize === "object" && p.orderSize !== null && typeof p.orderSize.value === "number") {
      // Intelligence Algorithm order sizes are always dollars; Oracle Protocol
      // scales only a currency order size.
      const type = String(p.orderSize.type || "").trim().toLowerCase();
      const isCurrency = ["currency", "dollars", "usd", "$"].includes(type);
      if (algorithm === "Intelligence Algorithm" || isCurrency) {
        p.orderSize.value = Math.round(p.orderSize.value * scaleFactor);
      }
    }
  }

  return scaled;
}

// ---------------------------------------------------------------------------
// Value formatting for settings. Copy values are plain numbers, because
// TradingView's numeric fields reject "$" and thousands separators.
// ---------------------------------------------------------------------------

const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

function plain(n: number, maxDecimals = 6): string {
  return String(+n.toFixed(maxDecimals));
}

function dollars(n: number): { value: string; copy: string } {
  return { value: `$${Math.round(n).toLocaleString("en-US")}`, copy: String(Math.round(n)) };
}

function percent(n: number): { value: string; copy: string } {
  return { value: `${plain(n, 4)}%`, copy: plain(n, 4) };
}

function qty(n: number, unit?: string | null): { value: string; copy: string } {
  const s = n.toLocaleString("en-US", { maximumFractionDigits: 6 });
  return { value: unit ? `${s} ${unit}` : s, copy: plain(n) };
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

export function formatDateParts(p: DateParts | null | undefined): string {
  if (!p?.year || !p?.month || !p?.day) return "";
  const date = `${p.year}-${pad(p.month)}-${pad(p.day)}`;
  if (p.hour === null || p.hour === undefined) return date;
  return `${date} ${pad(p.hour)}:${pad(p.minute ?? 0)}`;
}

/** Today's date in the client's own time zone, keeping any time of day the strategy used (P16). */
export function todayParts(keepTimeFrom?: DateParts | null, now = new Date()): DateParts {
  return {
    year: now.getFullYear(),
    month: now.getMonth() + 1,
    day: now.getDate(),
    hour: keepTimeFrom?.hour ?? null,
    minute: keepTimeFrom?.hour !== null && keepTimeFrom?.hour !== undefined ? keepTimeFrom?.minute ?? 0 : null,
  };
}

// ---------------------------------------------------------------------------
// The rows.
// ---------------------------------------------------------------------------

export interface SettingsRowsOptions {
  algorithm: string | null | undefined;
  /** Already scaled to the capital in view, and for "as_tested" already passed through settingsForDisplay. */
  inputs: Record<string, any> | null | undefined;
  mode: SettingsMode;
  asset?: string | null;
  assetClass?: string | null;
  timeFrame?: string | null;
  /** Shown first in the apply step: the capital this strategy runs with. */
  capitalAllocated?: number | null;
  now?: Date;
}

const CRYPTO = new Set(["BTC", "ETH", "SOL", "XRP", "SUI"]);

export function settingsRows(opts: SettingsRowsOptions): SettingRow[] {
  const { algorithm, inputs: s, mode } = opts;
  const rows: SettingRow[] = [];
  let section = "Chart";
  const add = (key: string, label: string, v: { value: string; copy: string | null }, extra: Partial<SettingRow> = {}) =>
    rows.push({ key, section, label, value: v.value, copy: v.copy, ...extra });
  const text = (t: string) => ({ value: t, copy: t });
  const tick = (key: string, label: string) => add(key, label, { value: "On", copy: null }, { checkbox: true });

  if (opts.timeFrame) add("time_frame", "Chart time frame", text(opts.timeFrame));
  if (algorithm) add("algorithm", "Algorithm", { value: algorithm, copy: null });

  if (!s || typeof s !== "object") return rows;

  const startRow = (key: string, label: string, start: DateParts | null | undefined) => {
    if (!start) return;
    if (mode === "apply") {
      const today = formatDateParts(todayParts(start, opts.now));
      add(key, label, text(today), { prefilled: true });
    } else {
      const v = formatDateParts(start);
      if (v) add(key, label, text(v));
    }
  };
  const endRow = (key: string, label: string, end: DateParts | null | undefined) => {
    // In apply the stored end is never printed: it is a run setting, often a
    // far-future year (D10, P16). As tested, it is the last bar on the chart,
    // already substituted by settingsForDisplay, or absent.
    if (mode === "apply") {
      add(key, label, { value: `Set ${TRADINGVIEW_END_INSTRUCTION}`, copy: null });
    } else if (end) {
      const v = formatDateParts(end);
      if (v) add(key, label, text(v));
    }
  };
  const properties = () => {
    const p = s.properties;
    if (!p || typeof p !== "object") return;
    section = "Properties";
    if (isNum(p.initialCapital)) add("properties.initialCapital", "Initial capital", dollars(p.initialCapital));
    if (p.orderSize && isNum(p.orderSize.value)) {
      const type = p.orderSize.type ? String(p.orderSize.type) : "";
      const isCurrency = type.toLowerCase() === "currency";
      add(
        "properties.orderSize",
        type && !isCurrency ? `Order size (${type})` : "Order size",
        isCurrency || algorithm === "Intelligence Algorithm" ? dollars(p.orderSize.value) : qty(p.orderSize.value),
      );
    }
    if (isNum(p.pyramiding)) add("properties.pyramiding", "Pyramiding", qty(p.pyramiding));
  };

  if (algorithm === "Intelligence Algorithm") {
    section = "Inputs";
    if (s.repeatPurchaseMethod) add("repeatPurchaseMethod", "Repeat purchase method", text(String(s.repeatPurchaseMethod)));
    startRow("start", "Start date/time", s.start);
    if (s.end) endRow("end", "End date", s.end);
    if (isNum(s.startBarsBack?.bars)) add("startBarsBack.bars", "Start X bars back", qty(s.startBarsBack.bars));
    if (s.backtest?.exitFullOnLastBar) tick("backtest.exitFullOnLastBar", "Exit full on last bar");
    if (s.activate?.enabled) {
      tick("activate.enabled", "Activate Intelligence");
      if (isNum(s.activate.factor)) add("activate.factor", "Intelligence factor", qty(s.activate.factor));
    }
    properties();
    return rows;
  }

  if (algorithm === "Arbitrage Algorithm") {
    section = "Inputs";
    if (isNum(s.longThreshold?.percent)) add("longThreshold.percent", "Long threshold", percent(s.longThreshold.percent));
    if (isNum(s.exitThreshold?.percent)) add("exitThreshold.percent", "Exit threshold", percent(s.exitThreshold.percent));
    if (s.costBasis?.onlySellAbove) tick("costBasis.onlySellAbove", "Only sell above cost basis");
    section = "Trade size";
    if (isNum(s.tradeSize?.entry)) add("tradeSize.entry", "Entry trade size ($)", dollars(s.tradeSize.entry));
    if (isNum(s.tradeSize?.exit)) add("tradeSize.exit", "Exit trade size ($)", dollars(s.tradeSize.exit));
    section = "Dates";
    startRow("dates.start", "Start date", s.dates?.start);
    if (s.dates?.start || s.dates?.end) endRow("dates.end", "End date", s.dates?.end);
    return rows;
  }

  if (algorithm === "Oracle Protocol") {
    section = "Inputs";
    if (isNum(s.longThreshold?.percent)) add("longThreshold.percent", "Long threshold", percent(s.longThreshold.percent));
    if (isNum(s.exitThreshold?.percent)) add("exitThreshold.percent", "Exit threshold", percent(s.exitThreshold.percent));
    section = "Cost basis";
    if (s.costBasis?.onlySellAbove) tick("costBasis.onlySellAbove", "Only sell above cost basis");
    if (isNum(s.costBasis?.sellProfitThreshold)) add("costBasis.sellProfitThreshold", "Sell profit threshold", percent(s.costBasis.sellProfitThreshold));
    if (s.costBasis?.buyBelowOnly) tick("costBasis.buyBelowOnly", "Buy below cost basis only");
    section = "Trade size";
    if (s.tradeSize?.primaryType) add("tradeSize.primaryType", "Primary trade size type", text(String(s.tradeSize.primaryType)));
    if (isNum(s.tradeSize?.entryPercent)) add("tradeSize.entryPercent", "Entry trade size (%)", percent(s.tradeSize.entryPercent));
    if (isNum(s.tradeSize?.exitPercent)) add("tradeSize.exitPercent", "Exit trade size (%)", percent(s.tradeSize.exitPercent));
    if (s.tradeSize?.useFixedAsMin) tick("tradeSize.useFixedAsMin", "Use fixed trade size as minimum");
    if (isNum(s.tradeSize?.entryFixed)) add("tradeSize.entryFixed", "Entry trade size ($)", dollars(s.tradeSize.entryFixed));
    if (isNum(s.tradeSize?.exitFixed)) add("tradeSize.exitFixed", "Exit trade size ($)", dollars(s.tradeSize.exitFixed));
    section = "Dates";
    startRow("dates.start", "Start date", s.dates?.start);
    if (s.dates?.start || s.dates?.end) endRow("dates.end", "End date", s.dates?.end);
    properties();
    return rows;
  }

  if (algorithm === "Market Wave") {
    const unit = opts.asset ?? null;
    const crypto = opts.assetClass === "Crypto" || (unit !== null && CRYPTO.has(unit));
    section = "User initial capital";
    const u = s.userInitialCapital ?? {};
    if (isNum(u.startingCash)) add("userInitialCapital.startingCash", "Starting cash", dollars(u.startingCash));
    if (isNum(u.startingCryptoQty)) add("userInitialCapital.startingCryptoQty", "Starting crypto qty", qty(u.startingCryptoQty, unit));
    if (isNum(u.startingQty)) add("userInitialCapital.startingQty", "Starting share qty", qty(u.startingQty, unit));

    section = "Order entry & exit rules";
    if (s.longThreshold?.enabled && isNum(s.longThreshold.percent)) add("longThreshold.percent", "Long threshold", percent(s.longThreshold.percent));
    if (s.exitThreshold?.enabled && isNum(s.exitThreshold.percent)) add("exitThreshold.percent", "Exit threshold", percent(s.exitThreshold.percent));

    section = "Trade size";
    const t = s.tradeSize ?? {};
    if (t.sharesEnabled) {
      tick("tradeSize.sharesEnabled", "Shares trade size");
      if (isNum(t.entryShares)) add("tradeSize.entryShares", "Entry trade size (shares)", qty(t.entryShares));
      if (isNum(t.exitShares)) add("tradeSize.exitShares", "Exit trade size (shares)", qty(t.exitShares));
    }
    if (t.fixedEnabled) {
      tick("tradeSize.fixedEnabled", "Fixed trade size");
      if (isNum(t.entryFixed)) add("tradeSize.entryFixed", "Entry trade size ($)", dollars(t.entryFixed));
      if (isNum(t.exitFixed)) add("tradeSize.exitFixed", "Exit trade size ($)", dollars(t.exitFixed));
    }
    if (t.percentEnabled) {
      tick("tradeSize.percentEnabled", "Percentage trade size");
      if (isNum(t.entryPercent)) add("tradeSize.entryPercent", "Entry trade size (%)", percent(t.entryPercent));
      if (isNum(t.exitPercent)) add("tradeSize.exitPercent", "Exit trade size (%)", percent(t.exitPercent));
    }
    if (t.roundDownWholeShares) tick("tradeSize.roundDownWholeShares", "Round down to whole shares");

    section = "Market Wave";
    const m = s.marketWave ?? {};
    if (isNum(m.scope)) add("marketWave.scope", `Scope (0.5 = micro, ${crypto ? 10 : 20} = macro)`, qty(m.scope));
    if (m.onlySellAbove) tick("marketWave.onlySellAbove", "Only sell above");
    if (m.onlyBuyBelow) tick("marketWave.onlyBuyBelow", "Only buy below");
    if (isNum(m.sellBuffer)) add("marketWave.sellBuffer", "Sell buffer", percent(m.sellBuffer));
    if (isNum(m.buyBuffer)) add("marketWave.buyBuffer", "Buy buffer", percent(m.buyBuffer));

    section = "Static market price filter";
    const f = s.staticPriceFilter ?? {};
    if (f.sellAboveEnabled && isNum(f.sellAbove)) add("staticPriceFilter.sellAbove", "Only sell above ($)", dollars(f.sellAbove));
    if (f.buyBelowEnabled && isNum(f.buyBelow)) add("staticPriceFilter.buyBelow", "Only buy below ($)", dollars(f.buyBelow));

    section = "Trend filter";
    const tf = s.trendFilter ?? {};
    if (tf.buyInDownTrend) tick("trendFilter.buyInDownTrend", "Buy in down trend");
    if (tf.buyInUpTrend) tick("trendFilter.buyInUpTrend", "Buy in up trend");
    if (tf.sellInDownTrend) tick("trendFilter.sellInDownTrend", "Sell in down trend");
    if (tf.sellInUpTrend) tick("trendFilter.sellInUpTrend", "Sell in up trend");
    if (tf.buyOnUpTrend) tick("trendFilter.buyOnUpTrend", "Buy on up-trend breakout");
    if (tf.sellOnDownTrend) tick("trendFilter.sellOnDownTrend", "Sell on down-trend breakout");

    section = "Dates";
    startRow("dates.start", "Start date", s.dates?.start);
    if (s.dates?.start || s.dates?.end) endRow("dates.end", "End date", s.dates?.end);

    section = "Backtesting";
    if (s.backtest?.exitFullOnLastBar) tick("backtest.exitFullOnLastBar", "Exit full on last bar");
    return rows;
  }

  return rows;
}

/** The whole block as plain text, for the "copy all" button (P15). */
export function settingsBlockText(header: string[], rows: SettingRow[]): string {
  const lines = [...header];
  let section = "";
  for (const r of rows) {
    if (r.section !== section) {
      section = r.section;
      lines.push("", `${section}:`);
    }
    lines.push(`  ${r.label}: ${r.value}`);
  }
  return lines.join("\n").trim();
}

// ---------------------------------------------------------------------------
// The suggested TradingView name. Numbering stays R<n> so existing client
// setups keep matching (PRD 13, rename checklist).
// ---------------------------------------------------------------------------

const ALGO_CODES: Record<string, string> = {
  "Oracle Protocol": "OP",
  "Arbitrage Algorithm": "AA",
  "Intelligence Algorithm": "IA",
  "Market Wave": "MW",
};

export function suggestedTradingViewName(opts: {
  displayNumber: number | null | undefined;
  algorithm: string | null | undefined;
  inputs: Record<string, any> | null | undefined;
  capitalAllocated: number;
  now?: Date;
}): string {
  const { algorithm, inputs: s, capitalAllocated } = opts;
  const now = opts.now ?? new Date();
  const num = typeof opts.displayNumber === "number" ? `R${opts.displayNumber}` : "R?";
  const algo = (algorithm && ALGO_CODES[algorithm]) || "";
  const start = `Start(${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())})`;
  const money = (n: number) => `$${Math.round(n).toLocaleString("en-US")}`;
  const capital = `(${money(capitalAllocated)})`;
  const pctOfCapital = (p: unknown) => (isNum(p) && capitalAllocated > 0 ? money(capitalAllocated * (p / 100)) : "?");
  const base = `${num} ${algo} ${start} ${capital}`;

  if (algorithm === "Arbitrage Algorithm") {
    const e = isNum(s?.tradeSize?.entry) ? money(s.tradeSize.entry) : "?";
    const x = isNum(s?.tradeSize?.exit) ? money(s.tradeSize.exit) : "?";
    return `${base} ${e}/${x}`.trim();
  }
  if (algorithm === "Oracle Protocol") {
    const e = isNum(s?.tradeSize?.entryFixed) ? money(s.tradeSize.entryFixed) : pctOfCapital(s?.tradeSize?.entryPercent);
    const x = isNum(s?.tradeSize?.exitFixed) ? money(s.tradeSize.exitFixed) : pctOfCapital(s?.tradeSize?.exitPercent);
    return `${base} ${e}/${x}`.trim();
  }
  if (algorithm === "Intelligence Algorithm") {
    const factor = isNum(s?.activate?.factor) ? ` IF(${s.activate.factor})` : "";
    const method = s?.repeatPurchaseMethod ? ` (${s.repeatPurchaseMethod})` : "";
    return `${base}${factor}${method}`.trim();
  }
  if (algorithm === "Market Wave") {
    const t = s?.tradeSize ?? {};
    let e = "?";
    let x = "?";
    if (t.sharesEnabled) {
      if (isNum(t.entryShares)) e = `${t.entryShares}sh`;
      if (isNum(t.exitShares)) x = `${t.exitShares}sh`;
    } else {
      if (t.fixedEnabled && isNum(t.entryFixed)) e = money(t.entryFixed);
      else if (t.percentEnabled) e = pctOfCapital(t.entryPercent);
      if (t.fixedEnabled && isNum(t.exitFixed)) x = money(t.exitFixed);
      else if (t.percentEnabled) x = pctOfCapital(t.exitPercent);
    }
    const scope = isNum(s?.marketWave?.scope) ? ` Scope(${s.marketWave.scope})` : "";
    return `${base} ${e}/${x}${scope}`.trim();
  }
  return base.trim();
}

/** Parts of an ISO date, re-exported for screens that build settings by hand. */
export { isoToParts };
/* eslint-enable @typescript-eslint/no-explicit-any */
