// The R8 rules that judge content (public view rows and public page HTML),
// kept apart from scripts/r8-anon-check.mjs so tests/r8Rules.test.ts can run
// them on fixtures instead of a real store.
//
// Redesign PRD P1 (Alex, 2026-11-11: "we do not want to crop charts ever"):
// the one chart screenshot of a strategy is public, whole, as chart_url. Every
// other source screenshot (the labelled settings panels) and every setting
// stays out of the public view and the public pages.

/** Must match store.public_view_allowlist() (20261111000001, chart_url added in 20261114000001). */
export const PUBLIC_COLUMNS = [
  "id", "display_number", "version_id", "version_number", "slug", "title", "short_name", "asset",
  "asset_class", "algorithm", "strategy_type", "time_horizon", "focus", "time_frame", "goal", "best_for",
  "how_it_trades", "up_market_behavior", "down_market_behavior", "basis", "starting_capital", "test_start",
  "test_end", "fees_slippage", "data_source", "as_of", "net_profit_usd", "cash_profit_usd", "asset_qty",
  "asset_unit", "buy_hold_pnl_pct", "dca_pnl_pct", "max_drawdown_pct", "benchmark_shown",
  "ending_value_usd", "return_pct", "test_years", "cagr_pct", "vs_buy_hold_pct", "vs_dca_pct",
  "public_chart_url", "chart_url",
];

export const SETTINGS_KEYS = /"(algorithm_inputs|tradeSize|longThreshold|exitThreshold|userInitialCapital|marketWave|screenshots)"/;
const SETTINGS_IN_HTML = /algorithm_inputs|strategies_pro|\\"(tradeSize|longThreshold|exitThreshold|userInitialCapital|marketWave)\\"|"(tradeSize|longThreshold|exitThreshold|userInitialCapital|marketWave)"/;
const RUN_YEAR_DATE = /\b(2030|2999)-\d\d-\d\d\b/;

const count = (text, needle) => text.split(needle).length - 1;

/**
 * Problems in the rows of public.strategies_public. Returns a list of
 * { check, detail } (empty when every rule holds).
 */
export function checkPublicRows(rows) {
  const problems = [];
  if (!Array.isArray(rows) || rows.length === 0) return [{ check: "public view has rows", detail: "no rows" }];

  // 1. Columns: only the allowlist.
  const cols = [...new Set(rows.flatMap((r) => Object.keys(r)))].sort();
  const extra = cols.filter((c) => !PUBLIC_COLUMNS.includes(c));
  if (extra.length) problems.push({ check: "public view columns", detail: `not on the allowlist: ${extra.join(", ")}` });

  for (const row of rows) {
    const n = row.display_number ?? row.slug ?? "?";
    const text = JSON.stringify(row);
    // 2. A source screenshot appears only as the row's own chart_url, once.
    const chart = typeof row.chart_url === "string" ? row.chart_url : "";
    const total = count(text, "recipe-screenshots");
    const allowed = chart.includes("recipe-screenshots") ? 1 : 0;
    if (total > allowed) {
      problems.push({ check: "source screenshots only as chart_url", detail: `#${n}: ${total} screenshot address(es), ${allowed} allowed` });
    }
    for (const [k, v] of Object.entries(row)) {
      if (k !== "chart_url" && typeof v === "string" && v.includes("recipe-screenshots")) {
        problems.push({ check: "source screenshots only as chart_url", detail: `#${n}: in ${k}` });
      }
    }
    // Still: no settings anywhere.
    if (SETTINGS_KEYS.test(text)) problems.push({ check: "no settings in the public view", detail: `#${n}: a settings key is present` });
    // 3. public_chart_url stays empty or in the public location.
    if (row.public_chart_url && !String(row.public_chart_url).includes("/storage/v1/object/public/strategy-public/")) {
      problems.push({ check: "public_chart_url in the public location", detail: `#${n}` });
    }
  }
  if (RUN_YEAR_DATE.test(JSON.stringify(rows))) problems.push({ check: "no run-setting end years", detail: "a 2030 or 2999 date is present" });
  return problems;
}

/** The storage path of every screenshot address in a page, raw or URL-encoded (as next/image writes it). */
export function screenshotPathsIn(html) {
  const out = new Set();
  const re = /recipe-screenshots(?:\/|%2F|\\u002F)([A-Za-z0-9._~\-/%]+?)(?=["'\s&)\\<>,]|$)/gi;
  for (const m of html.matchAll(re)) {
    let p = m[1];
    try {
      p = decodeURIComponent(p);
    } catch {
      /* keep as found */
    }
    out.add(p.replace(/\/+$/, ""));
  }
  return [...out];
}

const pathOf = (u) => {
  const i = u.indexOf("recipe-screenshots/");
  return i < 0 ? null : u.slice(i + "recipe-screenshots/".length);
};

/**
 * Problems in one public page's HTML. A screenshot address is allowed only
 * when it is some public row's chart_url (P1); settings and run-setting years
 * never are.
 */
export function checkPageHtml(html, chartUrls) {
  const problems = [];
  const allowed = new Set(chartUrls.filter(Boolean).map(pathOf).filter(Boolean));
  const stray = screenshotPathsIn(html).filter((p) => !allowed.has(p));
  if (stray.length) problems.push(`a source screenshot that is no public chart (${stray.slice(0, 2).join(", ")})`);
  if (SETTINGS_IN_HTML.test(html)) problems.push("a settings key");
  if (RUN_YEAR_DATE.test(html)) problems.push("a 2030 or 2999 date");
  return problems;
}
