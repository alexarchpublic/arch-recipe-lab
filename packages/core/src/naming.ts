// One name per strategy (auto-ingestion PRD, "Naming: one title, in plain
// words"). The title is the only authored name. The line under it is built
// here from stored fields, and the old name and short name columns are filled
// from the title by the database (migration 20261115000001).
//
// The admin form and, later, the case study pipeline check titles with the
// same rules, so both read them from this module.

/** NM5: at most 48 characters (open question Q9 may adjust it). */
export const TITLE_MAX_LENGTH = 48;

/** How a chart time frame reads in the line under a title. */
const TIME_FRAME_WORDS: Record<string, string> = {
  "1 Week": "Weekly chart",
  "1 Day": "Daily chart",
  "6 Hours": "6-hour chart",
  "4 Hours": "4-hour chart",
  "1 Hour": "Hourly chart",
};

/** "1 Week" -> "Weekly chart". Unknown values pass through with " chart". */
export function timeFrameLabel(timeFrame: string | null | undefined): string | null {
  const tf = timeFrame?.trim();
  if (!tf) return null;
  return TIME_FRAME_WORDS[tf] ?? `${tf} chart`;
}

/** The adjective alone, for sentences: "1 Week" -> "weekly", "4 Hours" -> "4-hour". */
export function timeFrameAdjective(timeFrame: string | null | undefined): string | null {
  const label = timeFrameLabel(timeFrame);
  return label ? label.replace(/ chart$/, "").replace(/^([A-Z])/, (c) => c.toLowerCase()) : null;
}

export interface StrategyLineFields {
  display_number: number | null;
  asset: string;
  time_frame: string | null;
  algorithm: string;
}

/**
 * The line under a strategy's title, built from stored fields (NM1, NO5):
 * "Strategy #68 · MARA · Weekly chart · Market Wave".
 */
export function strategyLine(s: StrategyLineFields): string {
  return [
    typeof s.display_number === "number" ? `Strategy #${s.display_number}` : null,
    s.asset,
    timeFrameLabel(s.time_frame),
    s.algorithm,
  ]
    .filter((part): part is string => !!part && part.trim() !== "")
    .join(" · ");
}

// NM3: no abbreviations or codes. Time frame and algorithm show as their own
// labels, so they never belong in the title either.
const CODE_PATTERNS: Array<[RegExp, string]> = [
  [/\b(STH|LTH)\b/i, "STH or LTH"],
  [/\bscalp(s|ing|er)?\b/i, "Scalp"],
  [/\barb\b/i, "Arb"],
  [/\bYTD\b/i, "YTD"],
  [/\b\d+\s?(m|min|h|hr|d|w|wk|mo)\b/i, "a time frame code such as 1H or 1W"],
  [/[[\]]/, "brackets"],
  [/\b(market wave|intelligence algorithm|arbitrage algorithm|oracle protocol)\b/i, "the algorithm name"],
];

// NM4: no return figures, promises or superlatives.
const FIGURE_PATTERN = /[$%]|\b\d+(\.\d+)?\s?(x|percent)\b/i;
const PROMISE_PATTERN =
  /\b(best|guaranteed?|risk[- ]free|can'?t lose|never lose|sure[- ]fire|explosive|massive|huge|unbeatable|top[- ]performing|beats? the market)\b/i;

export interface TitleCheckOptions {
  /** Titles of the other live strategies, for NM6. */
  otherTitles?: Iterable<string>;
}

/**
 * What is wrong with a title under NM3 to NM6, one plain sentence per
 * problem. An empty list means the title passes.
 */
export function titleProblems(title: string | null | undefined, opts: TitleCheckOptions = {}): string[] {
  const t = (title ?? "").trim();
  if (!t) return ["The title is empty."];
  const out: string[] = [];
  if (t.length > TITLE_MAX_LENGTH) {
    out.push(`The title is ${t.length} characters; the limit is ${TITLE_MAX_LENGTH}.`);
  }
  for (const [re, label] of CODE_PATTERNS) {
    if (re.test(t)) out.push(`Leave ${label} out of the title.`);
  }
  if (FIGURE_PATTERN.test(t)) out.push("Leave return figures out of the title.");
  if (PROMISE_PATTERN.test(t)) out.push("Leave promises and superlatives out of the title.");
  if (opts.otherTitles) {
    const key = t.toLowerCase().replace(/\s+/g, " ");
    for (const other of opts.otherTitles) {
      if (other && other.trim().toLowerCase().replace(/\s+/g, " ") === key) {
        out.push("Another live strategy has this title.");
        break;
      }
    }
  }
  return out;
}
