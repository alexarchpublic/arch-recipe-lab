#!/usr/bin/env node
// PRD R8: from an anonymous session, confirm that no settings and no source
// screenshot other than a strategy's one public chart can be read through the
// public view, the public image location or the public pages, and that the
// store, the base tables and the admin functions are closed. Uses only the
// public (anon) key, as a visitor would.
//
// Since the redesign (P1, "we do not want to crop charts ever") each public
// row carries its chart screenshot, whole, as chart_url. The content rules
// live in scripts/r8-rules.mjs, tested on fixtures in tests/r8Rules.test.ts.
//
//   SUPABASE_URL=https://<ref>.supabase.co SUPABASE_ANON_KEY=<publishable key> node scripts/r8-anon-check.mjs
//
// With STRATEGY_LAB_URL set (e.g. https://archpublic.com/strategy-lab), it also
// reads the public Strategy Lab pages and confirms none carries a setting, a
// source screenshot or a run-setting year (S9).
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

import { PUBLIC_COLUMNS, checkPageHtml, checkPublicRows } from "./r8-rules.mjs";

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
  const cols = [...new Set(pub.body.flatMap((r) => Object.keys(r)))].sort();
  const missing = PUBLIC_COLUMNS.filter((c) => !cols.includes(c));
  const problems = checkPublicRows(pub.body);
  const by = (name) => problems.filter((p) => p.check === name);

  // 1. Exactly the allowlisted columns (chart_url included).
  if (by("public view columns").length) fail("public view columns", by("public view columns")[0].detail);
  else pass("public view columns", `${cols.length} allowlisted columns, ${pub.body.length} rows`);
  if (missing.length) console.log(`NOTE  public view lacks ${missing.join(", ")}`);

  // 2. A source screenshot only as the row's own chart_url, at most once per
  //    row; never a setting; never a run-setting year.
  const shots = by("source screenshots only as chart_url");
  if (shots.length) fail("source screenshots only as chart_url", shots.slice(0, 3).map((p) => p.detail).join("; "));
  else pass("source screenshots only as chart_url", `${pub.body.filter((r) => r.chart_url).length} charts`);
  if (by("no settings in the public view").length) fail("no settings in the public view", by("no settings in the public view")[0].detail);
  else pass("no settings in the public view");
  if (by("no run-setting end years").length) fail("no run-setting end years", "a 2030 or 2999 date is present");
  else pass("no run-setting end years");

  // 3. public_chart_url (unused since P1) stays empty or in the public
  //    location; every chart_url answers with an image.
  const pcu = by("public_chart_url in the public location");
  if (pcu.length) fail("public_chart_url in the public location", pcu.map((p) => p.detail).join(", "));
  else pass("public_chart_url in the public location", `${pub.body.filter((r) => r.public_chart_url).length} set`);
  const charts = pub.body.map((r) => [r.display_number, r.chart_url]).filter(([, u]) => u);
  const badCharts = [];
  for (let i = 0; i < charts.length; i += 8) {
    await Promise.all(
      charts.slice(i, i + 8).map(async ([n, u]) => {
        try {
          const r = await fetch(u, { method: "GET", headers: { range: "bytes=0-0" } });
          const type = r.headers.get("content-type") ?? "";
          if (!(r.status === 200 || r.status === 206) || !type.startsWith("image/")) badCharts.push(`#${n} HTTP ${r.status} ${type}`);
          await r.body?.cancel();
        } catch (e) {
          badCharts.push(`#${n} ${e instanceof Error ? e.message : e}`);
        }
      }),
    );
  }
  if (badCharts.length) fail("every chart_url is an image", badCharts.slice(0, 5).join(", "));
  else pass("every chart_url is an image", `${charts.length} checked`);
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
for (const view of ["admin_strategy_versions", "admin_extractions", "admin_parity_runs", "admin_disclosure_history", "admin_leads", "admin_site_content_history"]) {
  const r = await rest(`${view}?select=*&limit=1`);
  if (closed(r) || (r.status === 200 && Array.isArray(r.body) && r.body.length === 0 && false)) pass(`${view} closed`, `HTTP ${r.status}`);
  else fail(`${view} closed`, `HTTP ${r.status} ${JSON.stringify(r.body).slice(0, 200)}`);
}
for (const fn of ["admin_save_draft", "admin_publish", "run_parity_check", "admin_set_disclosure", "admin_set_site_content", "admin_record_page_parity"]) {
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

// 10. Site content (S12, migration 20261113000001): copy and switches only,
//     never who changed it.
const sc = await rest("site_content?select=*");
if (sc.status === 404 || (sc.status >= 400 && /does not exist|schema cache/i.test(JSON.stringify(sc.body)))) {
  console.log("INFO  site_content view not present yet (before 20261113000001); Strategy Lab shows its default copy");
} else if (sc.status !== 200 || !Array.isArray(sc.body)) {
  fail("site_content readable", `HTTP ${sc.status}`);
} else {
  const cols = [...new Set(sc.body.flatMap((r) => Object.keys(r)))].sort().join(",");
  if (cols && cols !== "key,updated_at,value") fail("site_content columns", cols);
  else if (/algorithm_inputs|recipe-screenshots/.test(JSON.stringify(sc.body))) fail("site_content carries no settings", "settings or a source screenshot found");
  else pass("site_content readable, copy only", `${sc.body.length} key(s)`);
}

// 11. The public Strategy Lab pages (S9): no settings, no run-setting years,
//     and no source screenshot that is not some public row's chart_url, in
//     the HTML or the data shipped with it (image optimizer URLs included).
const site = process.env.STRATEGY_LAB_URL?.replace(/\/+$/, "");
if (site) {
  const slugs = Array.isArray(pub.body) ? pub.body.map((r) => r.slug).filter(Boolean) : [];
  const pick = [slugs[0], slugs[Math.floor(slugs.length / 2)], slugs[slugs.length - 1]].filter(Boolean);
  const paths = ["", "/strategies", ...pick.map((x) => `/${x}`)];
  const chartUrls = Array.isArray(pub.body) ? pub.body.map((r) => r.chart_url).filter(Boolean) : [];
  let bad = 0;
  for (const path of paths) {
    const r = await fetch(`${site}${path}`, { headers: { "user-agent": "strategy-lab-r8" } });
    const html = r.ok ? await r.text() : "";
    const problems = r.ok ? checkPageHtml(html, chartUrls) : [`HTTP ${r.status}`];
    if (problems.length) {
      bad++;
      fail(`Strategy Lab ${path || "/"}`, problems.join(", "));
    }
  }
  if (!bad) pass("Strategy Lab pages carry no settings and only public charts", `${paths.length} pages`);
} else {
  console.log("INFO  STRATEGY_LAB_URL not set; public pages not checked");
}

// 12. The Pro view: open until the login move, then closed (D6).
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
