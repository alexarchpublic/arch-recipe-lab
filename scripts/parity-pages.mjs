#!/usr/bin/env node
// PRD R5, D8: read the public Strategy Lab pages back and compare every
// figure they print (field, version, raw value in the markup) with the store.
// Catches stale pages, missing or extra strategies and wrong versions.
//
//   STRATEGY_LAB_URL=https://archpublic.com/strategy-lab \
//   SUPABASE_URL=https://<ref>.supabase.co SUPABASE_ANON_KEY=<publishable key> \
//   node --experimental-strip-types scripts/parity-pages.mjs
//
// Exits 1 on any problem. Uses only public pages and the public view.
import { comparePageToStore, parsePageFigures } from "../packages/core/src/pageFigures.ts";

const site = process.env.STRATEGY_LAB_URL?.replace(/\/+$/, "");
const url = process.env.SUPABASE_URL?.replace(/\/+$/, "");
const key = process.env.SUPABASE_ANON_KEY;
if (!site || !url || !key) {
  console.error("Set STRATEGY_LAB_URL, SUPABASE_URL and SUPABASE_ANON_KEY.");
  process.exit(2);
}

const res = await fetch(`${url}/rest/v1/strategies_public?select=*`, { headers: { apikey: key, Authorization: `Bearer ${key}` } });
if (!res.ok) {
  console.error(`public view: HTTP ${res.status}`);
  process.exit(2);
}
const rows = await res.json();
const ids = rows.map((r) => r.id);

async function page(path) {
  const r = await fetch(`${site}${path}`, { headers: { "user-agent": "strategy-lab-parity" }, redirect: "manual" });
  return { status: r.status, html: r.ok ? await r.text() : "" };
}

const problems = [];
const report = (path, list) => {
  for (const p of list) problems.push({ page: path, ...p });
};

// The list page carries every published, listed strategy.
const list = await page("/strategies");
if (list.status !== 200) problems.push({ page: "/strategies", check: "page_status", status: list.status });
else report("/strategies", comparePageToStore(parsePageFigures(list.html), rows, ids));

// Each strategy page carries its own strategy at the published version.
const queue = [...rows];
await Promise.all(
  Array.from({ length: 6 }, async () => {
    for (let row = queue.shift(); row; row = queue.shift()) {
      const path = `/${row.slug}`;
      const p = await page(path);
      if (p.status !== 200) {
        problems.push({ page: path, check: "page_status", status: p.status, strategy: row.display_number });
        continue;
      }
      report(path, comparePageToStore(parsePageFigures(p.html), rows, [row.id]));
    }
  }),
);

// The home page shows a selection; whatever it shows must match.
const home = await page("");
if (home.status !== 200) problems.push({ page: "/", check: "page_status", status: home.status });
else report("/", comparePageToStore(parsePageFigures(home.html), rows));

console.log(JSON.stringify({ ok: problems.length === 0, pages: rows.length + 2, strategies: rows.length, problems: problems.slice(0, 50) }, null, 2));
process.exit(problems.length ? 1 : 0);
