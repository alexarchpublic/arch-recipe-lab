#!/usr/bin/env node
// PRD R8: from an anonymous session, confirm that no settings and no
// uncropped screenshot can be read through the public view or the public
// image location, and that the store, the base tables and the admin
// functions are closed. Uses only the public (anon) key, as a visitor would.
//
//   SUPABASE_URL=https://<ref>.supabase.co SUPABASE_ANON_KEY=<publishable key> node scripts/r8-anon-check.mjs
//
// Flags
//   --allow-open-base   base tables may still be readable (before migration
//                       20261111000004 is applied)
//   --pro-closed        the login move is done: the Pro view must be closed too
//
// Exits 1 on any failure. Prints one line per check.

const url = process.env.SUPABASE_URL?.replace(/\/$/, "");
const key = process.env.SUPABASE_ANON_KEY;
if (!url || !key) {
  console.error("Set SUPABASE_URL and SUPABASE_ANON_KEY.");
  process.exit(2);
}
const allowOpenBase = process.argv.includes("--allow-open-base");
const proClosed = process.argv.includes("--pro-closed");

// Must match store.public_view_allowlist() in 20261111000001.
const PUBLIC_COLUMNS = [
  "id", "display_number", "version_id", "version_number", "slug", "title", "short_name", "asset",
  "asset_class", "algorithm", "strategy_type", "time_horizon", "focus", "time_frame", "goal", "best_for",
  "how_it_trades", "up_market_behavior", "down_market_behavior", "basis", "starting_capital", "test_start",
  "test_end", "fees_slippage", "data_source", "as_of", "net_profit_usd", "cash_profit_usd", "asset_qty",
  "asset_unit", "buy_hold_pnl_pct", "dca_pnl_pct", "max_drawdown_pct", "benchmark_shown",
  "ending_value_usd", "return_pct", "test_years", "cagr_pct", "vs_buy_hold_pct", "vs_dca_pct",
  "public_chart_url",
];

const headers = { apikey: key, Authorization: `Bearer ${key}` };
let failed = 0;
const pass = (name, detail = "") => console.log(`PASS  ${name}${detail ? ` (${detail})` : ""}`);
const fail = (name, detail) => {
  failed++;
  console.log(`FAIL  ${name}: ${detail}`);
};

async function rest(path, init = {}) {
  const res = await fetch(`${url}/rest/v1/${path}`, { ...init, headers: { ...headers, ...(init.headers ?? {}) } });
  let body = null;
  try {
    body = await res.json();
  } catch {
    /* empty body */
  }
  return { status: res.status, body };
}

const closed = (r) => r.status === 401 || r.status === 403 || r.status === 404 || r.status === 406 ||
  (r.status >= 400 && /permission denied|not found|does not exist|schema must be one of/i.test(JSON.stringify(r.body)));

// 1. The public view: exactly the allowlisted columns, and rows to check.
const pub = await rest("strategies_public?select=*");
if (pub.status !== 200 || !Array.isArray(pub.body)) {
  fail("public view readable", `HTTP ${pub.status} ${JSON.stringify(pub.body)}`);
} else if (pub.body.length === 0) {
  fail("public view has rows", "no rows");
} else {
  const cols = Object.keys(pub.body[0]).sort();
  const extra = cols.filter((c) => !PUBLIC_COLUMNS.includes(c));
  const missing = PUBLIC_COLUMNS.filter((c) => !cols.includes(c));
  if (extra.length) fail("public view columns", `not on the allowlist: ${extra.join(", ")}`);
  else pass("public view columns", `${cols.length} allowlisted columns, ${pub.body.length} rows`);
  if (missing.length) console.log(`NOTE  public view lacks ${missing.join(", ")}`);

  // 2. No settings or source screenshots anywhere in the values.
  const text = JSON.stringify(pub.body);
  if (/recipe-screenshots/.test(text)) fail("no source screenshots in the public view", "a recipe-screenshots URL is present");
  else pass("no source screenshots in the public view");
  if (/"(algorithm_inputs|tradeSize|longThreshold|exitThreshold|userInitialCapital|marketWave)"/.test(text)) {
    fail("no settings in the public view", "a settings key is present");
  } else pass("no settings in the public view");
  if (/\b(2030|2999)-\d\d-\d\d\b/.test(text)) fail("no run-setting end years", "a 2030 or 2999 date is present");
  else pass("no run-setting end years");

  // 3. Every public chart image is reachable and lives in the public location.
  const charts = pub.body.map((r) => r.public_chart_url).filter(Boolean);
  const outside = charts.filter((u) => !u.includes("/storage/v1/object/public/strategy-public/"));
  if (outside.length) fail("public charts in the public location", outside.slice(0, 3).join(", "));
  else pass("public charts in the public location", `${charts.length} charts`);
}

// 4. Settings columns cannot be selected through the public view.
const settings = await rest("strategies_public?select=algorithm_inputs&limit=1");
if (settings.status === 200) fail("settings column refused", "algorithm_inputs was returned");
else pass("settings column refused", `HTTP ${settings.status}`);

// 5. The store schema is not exposed.
const store = await rest("strategy_versions?select=id&limit=1", { headers: { "Accept-Profile": "store" } });
if (closed(store)) pass("store schema closed", `HTTP ${store.status}`);
else fail("store schema closed", `HTTP ${store.status} ${JSON.stringify(store.body).slice(0, 200)}`);

// 6. Admin views and functions are closed.
for (const view of ["admin_strategy_versions", "admin_extractions", "admin_parity_runs", "admin_disclosure_history"]) {
  const r = await rest(`${view}?select=*&limit=1`);
  if (closed(r) || (r.status === 200 && Array.isArray(r.body) && r.body.length === 0 && false)) pass(`${view} closed`, `HTTP ${r.status}`);
  else fail(`${view} closed`, `HTTP ${r.status} ${JSON.stringify(r.body).slice(0, 200)}`);
}
for (const fn of ["admin_save_draft", "admin_publish", "run_parity_check", "admin_set_disclosure"]) {
  const r = await rest(`rpc/${fn}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
  if (r.status >= 400) pass(`rpc ${fn} refused`, `HTTP ${r.status}`);
  else fail(`rpc ${fn} refused`, `HTTP ${r.status}`);
}

// 7. Base tables: closed after 20261111000004.
for (const table of ["recipes", "recipe_screenshots"]) {
  const r = await rest(`${table}?select=id&limit=1`);
  const open = r.status === 200 && Array.isArray(r.body) && r.body.length > 0;
  if (!open) pass(`${table} closed`, `HTTP ${r.status}`);
  else if (allowOpenBase) console.log(`WARN  ${table} still readable (allowed until 20261111000004 is applied)`);
  else fail(`${table} closed`, "rows returned to an anonymous visitor");
}

// 8. Nobody can list the public chart location.
const list = await fetch(`${url}/storage/v1/object/list/strategy-public`, {
  method: "POST",
  headers: { ...headers, "Content-Type": "application/json" },
  body: JSON.stringify({ prefix: "", limit: 10 }),
});
const listed = list.ok ? await list.json() : [];
if (Array.isArray(listed) && listed.length > 0) fail("public chart location not listable", `${listed.length} entries listed`);
else pass("public chart location not listable", `HTTP ${list.status}`);

// 9. Disclaimer wording (C2, migration 20261112000001): readable, and only
//    the wording, never who changed it.
const disc = await rest("disclosures?select=*");
if (disc.status === 404 || (disc.status >= 400 && /does not exist|schema cache/i.test(JSON.stringify(disc.body)))) {
  console.log("INFO  disclosures view not present yet (before 20261112000001); the app shows the default wording");
} else if (disc.status !== 200 || !Array.isArray(disc.body)) {
  fail("disclosures readable", `HTTP ${disc.status}`);
} else {
  const cols = [...new Set(disc.body.flatMap((r) => Object.keys(r)))].sort().join(",");
  if (cols && cols !== "body,key,updated_at") fail("disclosures columns", cols);
  else pass("disclosures readable, wording only", `${disc.body.length} slot(s)`);
}

// 10. The Pro view: open until the login move, then closed (D6).
const pro = await rest("strategies_pro?select=id&limit=1");
const proOpen = pro.status === 200 && Array.isArray(pro.body) && pro.body.length > 0;
if (proClosed) {
  if (proOpen) fail("Pro view closed", "rows returned to an anonymous visitor");
  else pass("Pro view closed", `HTTP ${pro.status}`);
} else {
  console.log(`INFO  Pro view ${proOpen ? "open" : "closed"} to anonymous visitors (open until the login move)`);
}

console.log(failed ? `\n${failed} check(s) failed` : "\nAll R8 checks passed");
process.exit(failed ? 1 : 0);
