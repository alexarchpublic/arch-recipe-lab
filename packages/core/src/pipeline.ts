// The case study pipeline's logic (auto-ingestion PRD, Phase 3): what a
// scenario says, what holds a strategy, how its draft is built, how Claude's
// names are checked, and how a reading compares with the store.
//
// Pure functions only. scripts/ingest/ runs them from lib/pipeline.bundle.js
// (built by `npm run build:pipeline`), and the tests run this source. Reading
// files, calling Claude and writing to the store live in scripts/ingest/.
import {
  type ChartTimeFrame,
  type RecipeScreenshotExtraction,
  type RecipeScreenshotKind,
  type ScreenshotImportResult,
} from "./extraction";
import { TITLE_MAX_LENGTH, timeFrameLabel, titleProblems } from "./naming";

export * from "./extraction";
export * from "./naming";

/** Bump when the pipeline's checks or draft mapping change (recorded per run). */
export const PIPELINE_VERSION = "2026-11-12.1";
/** Bump whenever NAMING_INSTRUCTIONS changes. */
export const NAMING_PROMPT_VERSION = "2026-11-12.2";

export const SUMMARY_MAX_LENGTH = 110;
export const DESCRIPTION_MAX_LENGTH = 320;

// ---------------------------------------------------------------------------
// Source screenshots (TR2): content/<slug>/sources/<scenario key>/<file>.
// ---------------------------------------------------------------------------
export const SOURCE_FILES: Record<RecipeScreenshotKind, string> = {
  chart: "chart.png",
  settings: "settings.png",
  stats: "data-window.png",
  dca: "dca.png",
};
export const REQUIRED_SOURCE_KINDS: RecipeScreenshotKind[] = ["chart", "settings", "stats"];

/** Which kind a source file is, from its name; null for anything else. */
export function sourceKind(filename: string): RecipeScreenshotKind | null {
  const base = filename.toLowerCase().replace(/\.(png|jpe?g|webp)$/, "");
  for (const [kind, file] of Object.entries(SOURCE_FILES)) {
    if (file.replace(/\.png$/, "") === base) return kind as RecipeScreenshotKind;
  }
  return null;
}

// ---------------------------------------------------------------------------
// What a case study scenario states. The case study's figures are the stored
// results (EX5); everything here is read from case-study.json.
// ---------------------------------------------------------------------------
export interface CaseStudyScenario {
  key?: string;
  title?: string;
  label?: string;
  window?: string;
  chart?: string;
  recipe?: string;
  strategyNumber?: number;
  public?: boolean;
  ticker?: string;
  algorithm?: string;
  strategyReturn?: string;
  benchmarks?: Array<{ name?: string; value?: string }>;
  stats?: Array<{ label?: string; value?: string }>;
  context?: string[];
  numberToRead?: string;
  [key: string]: unknown;
}

export interface CaseStudy {
  slug: string;
  status?: string;
  ticker?: string | null;
  /** Movements studies: [{ ticker, company }]. One entry means every scenario is on that ticker. */
  tickers?: Array<{ ticker?: string; company?: string }> | null;
  company?: string | null;
  title?: string;
  product?: string;
  published?: string;
  scenarios?: CaseStudyScenario[];
  [key: string]: unknown;
}

export interface ScenarioFigures {
  returnPct: number | null;
  buyHoldPct: number | null;
  dcaPct: number | null;
  endingValue: number | null;
  initialCapital: number | null;
  realizedProfit: number | null;
  unrealizedProfit: number | null;
  totalProfit: number | null;
  sharesHeld: number | null;
  avgCost: number | null;
  cash: number | null;
  windowStart: string | null;
  windowEnd: string | null;
  /** "2026-07" when the window names only the end month. */
  windowEndMonth: string | null;
  timeFrame: ChartTimeFrame | null;
}

/** "+33.2%", "−50%" (with a typographic minus), "$133,204" → numbers. */
export function parseFigure(text: string | null | undefined): number | null {
  if (text === null || text === undefined) return null;
  const t = String(text).replace(/[−–—]/g, "-").replace(/\s+/g, " ");
  const m = t.match(/(-)?\s*\+?\$?\s*(-)?\s*([0-9][0-9,]*(?:\.[0-9]+)?)/);
  if (!m) return null;
  const n = Number(m[3].replace(/,/g, ""));
  if (!Number.isFinite(n)) return null;
  return m[1] || m[2] ? -n : n;
}

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];

function isoDate(y: number, m: number, d: number): string {
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

/**
 * A scenario's window: "January 1, 2026 to August 11, 2026", "Jan 1 to Jul 22, 2026",
 * "Jul 2017 to Jul 2026" (first of the month). Null when it cannot be read.
 */
export function parseWindow(text: string | null | undefined): { start: string | null; end: string | null; endMonth?: string } {
  if (!text) return { start: null, end: null };
  const parts = String(text).split(/\s+(?:to|through|until|–|-)\s+/i);
  if (parts.length !== 2) return { start: null, end: null };
  const read = (s: string) => {
    const m = s.trim().match(/^([A-Za-z]+)\.?\s*(\d{1,2})?(?:,)?\s*(\d{4})?$/);
    if (!m) return null;
    const month = MONTHS.indexOf(m[1].slice(0, 3).toLowerCase()) + 1;
    if (month < 1) return null;
    return { month, day: m[2] ? Number(m[2]) : null, year: m[3] ? Number(m[3]) : null };
  };
  const a = read(parts[0]);
  const b = read(parts[1].replace(/^(.*?\b\d{4})\b.*$/, "$1")); // "August 6, 2026, ten months"
  if (!a || !b || !b.year) return { start: null, end: null };
  const startYear = a.year ?? b.year;
  return {
    start: isoDate(startYear, a.month, a.day ?? 1),
    end: b.day ? isoDate(b.year, b.month, b.day) : null,
    ...(b.day ? {} : { endMonth: isoDate(b.year, b.month, 1).slice(0, 7) }),
  };
}

/** "Daily chart", "Four hour chart", "6-hour bars", "1 hour chart" → the store's time frame. */
export function chartLabelTimeFrame(text: string | null | undefined): ChartTimeFrame | null {
  const t = (text ?? "").toLowerCase();
  if (/\bweekly\b|\b1[- ]?week\b/.test(t)) return "1 Week";
  if (/\bdaily\b|\b1[- ]?day\b/.test(t)) return "1 Day";
  if (/\b(6|six)[- ]?hour/.test(t)) return "6 Hours";
  if (/\b(4|four)[- ]?hour/.test(t)) return "4 Hours";
  if (/\bhourly\b|\b(1|one)[- ]?hour/.test(t)) return "1 Hour";
  return null;
}

function statValue(stats: CaseStudyScenario["stats"], test: (label: string) => boolean): string | null {
  for (const s of stats ?? []) {
    const label = (s?.label ?? "").toLowerCase();
    if (label && test(label)) return s?.value ?? null;
  }
  return null;
}

export function scenarioFigures(scenario: CaseStudyScenario): ScenarioFigures {
  const bench = (test: (name: string) => boolean) => {
    const b = (scenario.benchmarks ?? []).find((x) => test((x?.name ?? "").toLowerCase()));
    return b ? parseFigure(b.value) : null;
  };
  const shares = statValue(scenario.stats, (l) => /^(shares|coins|units)( held| at)/.test(l) || l === "shares held");
  const avg = shares?.match(/at\s+\$\s*([0-9][0-9,]*(?:\.[0-9]+)?)\s*avg/i);
  const window = parseWindow(scenario.window);
  return {
    returnPct: parseFigure(scenario.strategyReturn),
    buyHoldPct: bench((n) => n === "buy and hold"),
    dcaPct: bench((n) => n === "dca" || n === "monthly dollar-cost averaging"),
    endingValue: parseFigure(statValue(scenario.stats, (l) => /^(strategy )?(ending|final|portfolio) value$/.test(l))),
    initialCapital: parseFigure(statValue(scenario.stats, (l) => l === "initial capital")),
    realizedProfit: parseFigure(statValue(scenario.stats, (l) => /^realized( profit)?/.test(l) && !/loss/.test(l))),
    unrealizedProfit: parseFigure(statValue(scenario.stats, (l) => /^unrealized/.test(l))),
    totalProfit: parseFigure(statValue(scenario.stats, (l) => l === "profit and loss" || l === "total profit and loss")),
    sharesHeld: shares ? parseFigure(shares) : null,
    avgCost: avg ? Number(avg[1].replace(/,/g, "")) : parseFigure(statValue(scenario.stats, (l) => /^(avg|average) cost/.test(l))),
    cash: parseFigure(statValue(scenario.stats, (l) => /^(cash|cash on hand|current cash)$/.test(l))),
    windowStart: window.start,
    windowEnd: window.end,
    windowEndMonth: window.endMonth ?? null,
    timeFrame: chartLabelTimeFrame(scenario.chart),
  };
}

/** The ticker the case study gives a scenario: its own, else the study's. */
export function scenarioTicker(study: CaseStudy, scenario: CaseStudyScenario): string | null {
  const only = Array.isArray(study.tickers) && study.tickers.length === 1 ? study.tickers[0]?.ticker : null;
  const t = (scenario.ticker ?? study.ticker ?? only ?? "").trim().toUpperCase();
  return t || null;
}

/** The company the case study names for a scenario's ticker, for plain titles. */
export function scenarioCompany(study: CaseStudy, scenario: CaseStudyScenario): string | null {
  const t = scenarioTicker(study, scenario);
  const listed = (study.tickers ?? []).find((x) => (x?.ticker ?? "").toUpperCase() === t)?.company;
  return (listed ?? study.company ?? null) || null;
}

/** Market Wave is the only algorithm the reader covers (A13). */
export function scenarioIsMarketWave(study: CaseStudy, scenario: CaseStudyScenario): boolean {
  const named = (scenario.algorithm ?? study.product ?? "").toLowerCase();
  if (!named.includes("market wave")) return false;
  // A study naming several algorithms must say which one a scenario ran.
  const others = /intelligence algorithm|oracle protocol|arbitrage algorithm|tax-loss/.test(named);
  return !others || /market wave/i.test(String(scenario.algorithm ?? ""));
}

// ---------------------------------------------------------------------------
// TR3, TR4: what to do with each scenario, and the hash change detection uses.
// ---------------------------------------------------------------------------

/** The scenario fields whose change means a new version (figures and settings sources). */
export function fingerprintInput(scenario: CaseStudyScenario, fileHashes: Record<string, string>): string {
  const figures = {
    title: scenario.title ?? null,
    window: scenario.window ?? null,
    chart: scenario.chart ?? null,
    strategyReturn: scenario.strategyReturn ?? null,
    benchmarks: scenario.benchmarks ?? [],
    stats: scenario.stats ?? [],
    public: scenario.public ?? true,
  };
  const files = Object.keys(fileHashes).sort().map((k) => [k, fileHashes[k]]);
  return JSON.stringify({ figures, files });
}

export type ScenarioAction = "new" | "update" | "skip" | "unchanged" | "draft-study" | "baseline";

export interface ScenarioPlan {
  slug: string;
  key: string;
  title: string;
  strategyNumber: number | null;
  action: ScenarioAction;
  reason: string;
}

/**
 * TR3/TR5: a draft study is never ingested; no number means new; a number with
 * a different hash than the store recorded means update; the same hash, skip.
 * A scenario without its source screenshots is skipped and reported (Q5).
 */
export function planScenario(opts: {
  study: CaseStudy;
  scenario: CaseStudyScenario;
  hash: string;
  storedHash: string | null;
  hasSources: boolean;
  /**
   * BF2: a numbered scenario with no recorded hash is recorded as the baseline
   * instead of read (a live run). A dry run reads it, to compare with the store.
   */
  baselineUnrecorded?: boolean;
}): ScenarioPlan {
  const { study, scenario } = opts;
  const base = {
    slug: study.slug,
    key: String(scenario.key ?? ""),
    title: String(scenario.title ?? ""),
    strategyNumber: typeof scenario.strategyNumber === "number" ? scenario.strategyNumber : null,
  };
  if (study.status === "draft") return { ...base, action: "draft-study", reason: "The case study is a draft (TR5)." };
  if (!base.key) return { ...base, action: "skip", reason: "The scenario has no permanent key (NO7)." };
  if (!opts.hasSources) {
    return { ...base, action: "skip", reason: "No source screenshots in sources/" + base.key + " (TR2, Q5)." };
  }
  if (base.strategyNumber === null) return { ...base, action: "new", reason: "No strategy number yet." };
  if (!opts.storedHash && opts.baselineUnrecorded) {
    return { ...base, action: "baseline", reason: "Already a strategy; its hash is recorded as the baseline, nothing is written (BF2)." };
  }
  if (opts.storedHash && opts.storedHash === opts.hash) {
    return { ...base, action: "unchanged", reason: "Figures and screenshots match the last run (TR4)." };
  }
  return {
    ...base,
    action: "update",
    reason: opts.storedHash ? "Figures or screenshots changed since the last run." : "No baseline recorded yet (BF2).",
  };
}

// ---------------------------------------------------------------------------
// What holds a strategy and what does not ("Running without sign-off").
// ---------------------------------------------------------------------------
export type FindingLevel = "hold" | "warning" | "note";
export interface Finding {
  level: FindingLevel;
  code: string;
  message: string;
}

const REL_TOLERANCE = 0.005; // half a percent of the figure
const PCT_TOLERANCE = 0.11; // rounding of a one-decimal percentage

function differs(a: number | null | undefined, b: number | null | undefined, kind: "pct" | "money" | "count"): boolean {
  if (a === null || a === undefined || b === null || b === undefined) return false;
  if (kind === "pct") return Math.abs(a - b) > PCT_TOLERANCE;
  if (kind === "count") return Math.abs(a - b) >= 1;
  return Math.abs(a - b) > Math.max(1.01, Math.abs(b) * REL_TOLERANCE);
}

export function checkScenario(opts: {
  study: CaseStudy;
  scenario: CaseStudyScenario;
  sourceKinds: RecipeScreenshotKind[];
  extraction: RecipeScreenshotExtraction | null;
  result: ScreenshotImportResult | null;
  schemaErrors: string[];
  readError?: string | null;
  today?: string;
}): Finding[] {
  const { study, scenario, extraction, result } = opts;
  const out: Finding[] = [];
  const hold = (code: string, message: string) => out.push({ level: "hold", code, message });
  const warn = (code: string, message: string) => out.push({ level: "warning", code, message });
  const note = (code: string, message: string) => out.push({ level: "note", code, message });

  for (const kind of REQUIRED_SOURCE_KINDS) {
    if (!opts.sourceKinds.includes(kind)) hold("missing_screenshot", `The ${SOURCE_FILES[kind]} screenshot is missing.`);
  }
  if (!scenarioIsMarketWave(study, scenario)) {
    hold("algorithm", "The scenario is not on Market Wave, which is the only algorithm the reader covers (A13).");
  }
  if (opts.readError) hold("unreadable", `Claude could not read the screenshots: ${opts.readError}`);
  if (!extraction || !result) return out;

  if (opts.schemaErrors.length) {
    hold("schema", `The reading does not match the extraction schema: ${opts.schemaErrors.slice(0, 3).join("; ")}.`);
  }
  for (const c of result.crossCheck ?? []) {
    hold("chart_vs_panel", `Chart header and settings panel disagree on ${c.field}: chart ${c.chart}, panel ${c.panel} (A9).`);
  }
  if (!(extraction.chartIndicatorParameters ?? "").trim()) {
    warn("no_chart_parameters", "The chart header's parameter list could not be read; the settings panel alone gave the settings.");
  }

  const ticker = scenarioTicker(study, scenario);
  const read = (extraction.ticker ?? "").trim().toUpperCase();
  if (ticker && read && ticker !== read) {
    hold("ticker", `The screenshots show ${read}; the case study says ${ticker}.`);
  }
  const figures = scenarioFigures(scenario);
  if (figures.timeFrame && result.recipe.time_frame !== figures.timeFrame) {
    hold("time_frame", `The chart is on ${result.recipe.time_frame}; the case study says ${figures.timeFrame}.`);
  }
  if (!figures.timeFrame) note("time_frame_unstated", `The case study's chart label "${scenario.chart ?? ""}" names no time frame; the chart's is used.`);

  // The data window is the cross-check; the case study's figure stands (EX5).
  const stats = extraction.stats ?? {};
  const dca = extraction.dca ?? {};
  const pairs: Array<[string, number | null | undefined, number | null, "pct" | "money" | "count"]> = [
    ["strategy return", stats.strategyRoiPercent, figures.returnPct, "pct"],
    ["buy and hold", stats.buyHoldRoiPercent, figures.buyHoldPct, "pct"],
    ["DCA", dca.dcaBenchmarkRoiPercent, figures.dcaPct, "pct"],
    ["ending value", stats.strategyPortfolioValue, figures.endingValue, "money"],
    ["realized profit", stats.realizedProfit, figures.realizedProfit, "money"],
    ["unrealized profit", stats.unrealizedProfit, figures.unrealizedProfit, "money"],
    ["shares held", stats.currentShares, figures.sharesHeld, "count"],
    ["cash", stats.currentCashBalance, figures.cash, "money"],
  ];
  for (const [label, screen, published, kind] of pairs) {
    if (differs(screen, published, kind)) {
      warn("figure_differs", `The data window shows ${label} ${screen}; the case study publishes ${published}. The case study's figure is stored.`);
    }
  }
  if (figures.returnPct === null) warn("no_return", "The case study states no strategy return for this scenario; the data window's is stored.");

  const run = runEnd(result.recipe.algorithm_inputs);
  const today = opts.today ?? new Date().toISOString().slice(0, 10);
  if (run && run > today) {
    // EX6: the test end is the case study's window end, which the case study
    // states; the chart's last bar, as Claude reads it, is the cross-check.
    // On 12 Nov 2026 that reading was off by days to months in 6 of 8 runs.
    const bar = result.lastBarDate;
    if (figures.windowEnd) {
      note("future_end", `The settings run to ${run}; the test end stored is the case study's window end, ${figures.windowEnd}.`);
      if (bar && Math.abs(daysBetween(bar, figures.windowEnd)) > 7) {
        warn("end_vs_window", `Claude read the chart's last bar as ${bar}, more than a week from the case study's window end (${figures.windowEnd}); the case study's date is stored.`);
      }
    } else if (bar) {
      note("future_end", `The settings run to ${run}; the case study gives no end day, so the test end is the chart's last bar as read, ${bar} (A16).`);
      if (figures.windowEndMonth && bar.slice(0, 7) !== figures.windowEndMonth) {
        hold("end_vs_window", `Claude read the chart's last bar as ${bar}, outside the case study's end month (${figures.windowEndMonth}), and the case study states no end day (EX6).`);
      }
    } else {
      hold("no_end_date", `The settings run to ${run}, the case study states no end date and the chart's last bar could not be read, so the test end is unknown (EX6).`);
    }
  }
  const start = runStart(result.recipe.algorithm_inputs);
  if (start && figures.windowStart && Math.abs(daysBetween(start, figures.windowStart)) > 7) {
    warn("start_vs_window", `The settings start on ${start}; the case study's window starts on ${figures.windowStart}.`);
  }
  return out;
}

export function holds(findings: Finding[]): Finding[] {
  return findings.filter((f) => f.level === "hold");
}

function daysBetween(a: string, b: string): number {
  return (Date.parse(a) - Date.parse(b)) / 86_400_000;
}

type DateParts = { year?: number; month?: number; day?: number } | undefined;
function partsIso(p: DateParts): string | null {
  if (!p?.year || !p?.month || !p?.day) return null;
  return isoDate(p.year, p.month, p.day);
}
export function runStart(inputs: Record<string, unknown>): string | null {
  return partsIso((inputs?.dates as { start?: DateParts } | undefined)?.start);
}
export function runEnd(inputs: Record<string, unknown>): string | null {
  return partsIso((inputs?.dates as { end?: DateParts } | undefined)?.end);
}

// ---------------------------------------------------------------------------
// Naming (NM1-NM11): Claude writes, these rules check.
// ---------------------------------------------------------------------------
export interface NamingReply {
  title: string;
  summary: string;
  description: string;
  marketTag?: "falling" | "sideways" | "rising" | "volatile" | null;
}

export const NAMING_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["title", "summary", "description", "marketTag"],
  properties: {
    title: { type: "string" },
    summary: { type: "string" },
    description: { type: "string" },
    marketTag: { type: "string", enum: ["falling", "sideways", "rising", "volatile"] },
  },
} as const;

export const NAMING_INSTRUCTIONS = `You name one Arch Public trading strategy for its card in Strategy Lab. Write in plain English for an investor, not a trader.

Return JSON with:
- title: at most ${TITLE_MAX_LENGTH} characters, in sentence case (capital on the first word and on names only). Name the asset the way people say it (Microsoft, Gold, Bitcoin, Alphabet; not MSFT, GLD, BTC, GOOGL), and say what the strategy does or the market it was tested in. Carry the same idea as the case study scenario's title, so the two read as one thing. No codes or abbreviations: no STH, LTH, Scalp, Arb, YTD, 1H, 4H, 1W, no brackets, no algorithm names (Market Wave, Intelligence Algorithm, Oracle Protocol). No return figures, percentages, dollar amounts, promises or superlatives (best, guaranteed, massive). It must differ from every title in the list of live titles.
- summary: one sentence, at most ${SUMMARY_MAX_LENGTH} characters, saying what the strategy is for. No figures.
- description: at most ${DESCRIPTION_MAX_LENGTH} characters on how it trades: when it buys, when it sells, what it does with cash. Use only what the case study and the settings state. No figures and no promises.
- marketTag: the market in the test window, from the case study's account of it: falling, sideways, rising or volatile.

Everywhere: no em or en dashes (use a comma, colon or full stop), no exclamation marks, no promises such as "never sells at a loss". Say "only sells above its average cost" instead. An ETF that tracks something keeps its fund's name or ticker (IBIT is "Bitcoin ETF" or "IBIT", not "Bitcoin").

Reply with the JSON object only.`;

export interface NamingInput {
  asset: string;
  assetName: string | null;
  timeFrame: string;
  studyTitle: string;
  scenarioTitle: string;
  window: string | null;
  context: string[];
  numberToRead: string | null;
  settingsSummary: string;
  otherTitles: string[];
  previousProblems?: string[];
}

export function namingPrompt(input: NamingInput): string {
  const lines = [
    NAMING_INSTRUCTIONS,
    "",
    `Asset: ${input.assetName ? `${input.assetName} (${input.asset})` : input.asset}`,
    `Chart: ${timeFrameLabel(input.timeFrame) ?? input.timeFrame}`,
    `Case study: ${input.studyTitle}`,
    `Scenario title: ${input.scenarioTitle}`,
    input.window ? `Test window: ${input.window}` : null,
    `How the settings trade: ${input.settingsSummary}`,
    "",
    "What the case study says about this scenario:",
    ...input.context.map((c) => `- ${c}`),
    input.numberToRead ? `- ${input.numberToRead}` : null,
    "",
    "Live titles (yours must differ from all of them):",
    ...input.otherTitles.map((t) => `- ${t}`),
  ];
  if (input.previousProblems?.length) {
    lines.push("", "Your last answer broke these rules; fix them:", ...input.previousProblems.map((p) => `- ${p}`));
  }
  return lines.filter((l): l is string => l !== null).join("\n");
}

/** NM2-NM8: one plain sentence per broken rule. Empty means the reply passes. */
export function namingProblems(reply: Partial<NamingReply> | null, otherTitles: string[]): string[] {
  if (!reply) return ["No answer."];
  const out = [...titleProblems(reply.title, { otherTitles })];
  const summary = (reply.summary ?? "").trim();
  const description = (reply.description ?? "").trim();
  if (!summary) out.push("The summary is empty.");
  if (summary.length > SUMMARY_MAX_LENGTH) out.push(`The summary is ${summary.length} characters; the limit is ${SUMMARY_MAX_LENGTH}.`);
  if (!description) out.push("The description is empty.");
  if (description.length > DESCRIPTION_MAX_LENGTH) {
    out.push(`The description is ${description.length} characters; the limit is ${DESCRIPTION_MAX_LENGTH}.`);
  }
  if (/[%$]/.test(summary) || /[%$]/.test(description)) out.push("Leave figures out of the summary and description.");
  // House style for everything a client reads (case study rules, 2026).
  if ([reply.title, summary, description].some((t) => /[–—]/.test(t ?? ""))) {
    out.push("Use no em or en dashes; use a comma, colon or full stop.");
  }
  if ([summary, description].some((t) => COPY_PROMISE.test(t))) {
    out.push("Leave promises out of the summary and description: no guarantees, nothing it never or always does with a loss.");
  }
  if (/[!]/.test(`${reply.title} ${summary} ${description}`)) out.push("Use no exclamation marks.");
  return out;
}

const COPY_PROMISE =
  /\b(guarantee[sd]?|risk[- ]free|can'?t lose|never (lose|loses|locks? in a loss|sells? at a loss|takes? a loss)|always (wins?|profits?)|sure[- ]fire)\b/i;

/** NM10: when no title passes after three tries, "Asset: scenario title", cut to fit. */
export function fallbackTitle(assetName: string, scenarioTitle: string): string {
  const t = `${assetName}: ${scenarioTitle.replace(/^the\s+/i, "")}`.trim();
  if (t.length <= TITLE_MAX_LENGTH) return t;
  const cut = t.slice(0, TITLE_MAX_LENGTH + 1);
  return cut.slice(0, Math.max(cut.lastIndexOf(" "), TITLE_MAX_LENGTH - 10)).replace(/[\s,:;-]+$/, "");
}

/** How a company is said, for titles: "Microsoft Corp." → "Microsoft". */
export function plainAssetName(name: string | null | undefined, ticker: string): string {
  const n = (name ?? "").trim();
  if (!n) return ticker;
  return n
    .replace(/\b(corp(oration)?|inc|incorporated|ltd|limited|plc|co|company|holdings?|class [a-z]|common stock|trust|etf|shares?)\b\.?/gi, "")
    .replace(/[,.]+\s*$/, "")
    .replace(/\s{2,}/g, " ")
    .trim() || ticker;
}

/** One line on how the settings trade, for the naming prompt. */
export function settingsSummary(inputs: Record<string, unknown>): string {
  const ts = (inputs.tradeSize ?? {}) as Record<string, unknown>;
  const mw = (inputs.marketWave ?? {}) as Record<string, unknown>;
  const parts: string[] = [];
  if (ts.percentEnabled) parts.push(`buys with ${ts.entryPercent}% of cash and sells ${ts.exitPercent}% of the position per signal`);
  else if (ts.fixedEnabled) parts.push(`buys $${ts.entryFixed} and sells $${ts.exitFixed} per signal`);
  else if (ts.sharesEnabled) parts.push(`buys ${ts.entryShares} and sells ${ts.exitShares} shares per signal`);
  if (mw.onlyBuyBelow) parts.push("only buys below its cost basis");
  if (mw.onlySellAbove) parts.push("only sells above its cost basis");
  return parts.join("; ") || "Market Wave bands";
}

// ---------------------------------------------------------------------------
// The draft written to the store. Case study figures stand (EX5).
// ---------------------------------------------------------------------------
export interface DraftOptions {
  study: CaseStudy;
  scenario: CaseStudyScenario;
  result: ScreenshotImportResult;
  naming: NamingReply;
  /** Claude's reading: its data window figures are stored where they agree with the case study. */
  extraction?: RecipeScreenshotExtraction | null;
  extractionId?: string | null;
  asOf?: string;
}

/**
 * EX5 with full precision: the case study prints rounded figures (one decimal,
 * whole dollars). Where a data window figure agrees with the case study within
 * that rounding, the exact figure is stored; otherwise the case study's.
 */
function preferScreen(published: number | null, screen: Array<number | null | undefined>, kind: "pct" | "money" | "count"): number | null {
  if (published === null) return null;
  for (const v of screen) {
    if (typeof v === "number" && Number.isFinite(v) && !differs(v, published, kind)) return v;
  }
  return published;
}

export function draftFields(opts: DraftOptions): Record<string, unknown> {
  const { study, scenario, result, naming } = opts;
  const r = result.recipe;
  const figures = scenarioFigures(scenario);
  const ai = r.algorithm_inputs as Record<string, unknown>;
  const startingCash = Number((ai.userInitialCapital as Record<string, unknown> | undefined)?.startingCash ?? r.initial_capital ?? 100000);
  const st = opts.extraction?.stats ?? {};
  const dw = opts.extraction?.dca ?? {};
  // Return: the data window's exact profit (portfolio value first, then total
  // P&L, which TradingView sometimes disagrees with) where it rounds to the
  // case study's return; otherwise the case study's return on the capital.
  const screenProfits = [
    typeof st.strategyPortfolioValue === "number" ? round2(st.strategyPortfolioValue - startingCash) : null,
    st.totalPnl,
  ];
  const returnMatch = figures.returnPct === null ? null
    : screenProfits.find((v) => typeof v === "number" && !differs((v / startingCash) * 100, figures.returnPct, "pct"));
  const net = figures.returnPct !== null
    ? (typeof returnMatch === "number" ? returnMatch : round2((figures.returnPct / 100) * startingCash))
    : figures.totalProfit ?? st.totalPnl ?? firstNum(r.net_profit);
  const buyHold = figures.buyHoldPct !== null ? preferScreen(figures.buyHoldPct, [st.buyHoldRoiPercent], "pct") : numOrNull(ai.buyHoldPnlPercent);
  const dca = figures.dcaPct !== null ? preferScreen(figures.dcaPct, [dw.dcaBenchmarkRoiPercent], "pct") : numOrNull(ai.dcaPnlPercent);
  // The benchmarks shown are the ones the case study shows (a study that
  // compares only with DCA hides buy and hold); without a list, the settings'.
  const listed = (scenario.benchmarks ?? []).length > 0;
  const settingsDca = (ai.benchmark as Record<string, unknown> | undefined)?.showDca === true || ai.showDcaBenchmark === true;
  const showBuyHold = (listed ? figures.buyHoldPct !== null : true) && buyHold !== null;
  const showDca = (listed ? figures.dcaPct !== null : settingsDca) && dca !== null;
  const benchmark = showBuyHold && showDca ? "both" : showBuyHold ? "buy_hold" : showDca ? "dca" : "none";
  const start = runStart(ai);
  const end = runEnd(ai);
  const today = opts.asOf ?? new Date().toISOString().slice(0, 10);
  const futureEnd = !!end && end > today;
  const fields: Record<string, unknown> = {
    asset: r.asset,
    asset_class: r.asset_class,
    algorithm: "Market Wave",
    strategy_type: "Market Wave",
    time_horizon: r.time_horizon,
    focus: r.focus,
    time_frame: r.time_frame,
    title: naming.title.trim(),
    goal: naming.summary.trim(),
    how_it_trades: naming.description.trim(),
    listed_public: scenario.public !== false,
    as_of: study.published ?? today,
    starting_capital: startingCash,
    net_profit_usd: net,
    cash_profit_usd: figures.realizedProfit !== null ? preferScreen(figures.realizedProfit, [st.realizedProfit], "money") : r.cash_profit ?? null,
    asset_qty: figures.sharesHeld !== null ? preferScreen(figures.sharesHeld, [st.currentShares], "count") : firstNum(r.asset_accumulated),
    asset_unit: r.asset,
    buy_hold_pnl_pct: buyHold,
    dca_pnl_pct: dca,
    benchmark_shown: benchmark,
    entry_trade: r.entry_trade,
    exit_trade: r.exit_trade,
    sell_above_cost_basis: r.sell_above_cost_basis,
    exit_to_entry_proportion: r.exit_to_entry_proportion,
    algorithm_inputs: {
      ...ai,
      buyHoldPnlPercent: buyHold,
      dcaPnlPercent: dca,
      benchmark: { ...((ai.benchmark as Record<string, unknown> | undefined) ?? {}), showBuyHold, showDca },
      showDcaBenchmark: showDca,
    },
    change_note: `From the case study "${study.title ?? study.slug}", scenario "${scenario.title ?? scenario.key}".`,
  };
  if (start) fields.test_start = start;
  const chartEnd = figures.windowEnd ?? result.lastBarDate ?? null;
  if (futureEnd && chartEnd) {
    fields.test_end = chartEnd;
    fields.test_end_source = "chart_last_bar";
  } else if (end && !futureEnd) {
    fields.test_end = end;
    fields.test_end_source = "settings";
  }
  if (opts.extractionId) fields.extraction_id = opts.extractionId;
  return fields;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
function numOrNull(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}
function firstNum(t: string | number | null | undefined): number | null {
  if (typeof t === "number") return t;
  return parseFigure(t ?? null);
}

// ---------------------------------------------------------------------------
// Phase 3's acceptance test: the reading against the published settings.
// ---------------------------------------------------------------------------
export interface SettingDifference {
  path: string;
  read: unknown;
  stored: unknown;
}

/** The settings a client copies into TradingView, compared leaf by leaf. */
export const COMPARED_SETTINGS = [
  "userInitialCapital.startingCash",
  "userInitialCapital.startingQty",
  "longThreshold.enabled",
  "longThreshold.percent",
  "exitThreshold.enabled",
  "exitThreshold.percent",
  "tradeSize.sharesEnabled",
  "tradeSize.entryShares",
  "tradeSize.exitShares",
  "tradeSize.fixedEnabled",
  "tradeSize.entryFixed",
  "tradeSize.exitFixed",
  "tradeSize.percentEnabled",
  "tradeSize.entryPercent",
  "tradeSize.exitPercent",
  "tradeSize.roundDownWholeShares",
  "marketWave.scope",
  "marketWave.onlySellAbove",
  "marketWave.onlyBuyBelow",
  "marketWave.sellBuffer",
  "marketWave.buyBuffer",
  "staticPriceFilter.sellAboveEnabled",
  "staticPriceFilter.sellAbove",
  "staticPriceFilter.buyBelowEnabled",
  "staticPriceFilter.buyBelow",
  "trendFilter.buyInDownTrend",
  "trendFilter.buyInUpTrend",
  "trendFilter.sellInDownTrend",
  "trendFilter.sellInUpTrend",
  "trendFilter.buyOnUpTrend",
  "trendFilter.sellOnDownTrend",
  "dates.start.year",
  "dates.start.month",
  "dates.start.day",
  "dates.start.hour",
  "dates.start.minute",
  "dates.end.year",
  "dates.end.month",
  "dates.end.day",
  "backtest.exitFullOnLastBar",
] as const;

function at(obj: unknown, path: string): unknown {
  return path.split(".").reduce<unknown>((o, k) => (o && typeof o === "object" ? (o as Record<string, unknown>)[k] : undefined), obj);
}

function same(a: unknown, b: unknown): boolean {
  if (typeof a === "number" && typeof b === "number") return Math.abs(a - b) < 1e-9;
  // A missing boolean in an older stored row means false (the reader's default).
  if ((a === undefined || a === null) && b === false) return true;
  if ((b === undefined || b === null) && a === false) return true;
  return JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
}

export function compareSettings(read: Record<string, unknown>, stored: Record<string, unknown>): SettingDifference[] {
  const out: SettingDifference[] = [];
  for (const path of COMPARED_SETTINGS) {
    const a = at(read, path);
    const b = at(stored, path);
    if (!same(a, b)) out.push({ path, read: a ?? null, stored: b ?? null });
  }
  return out;
}
