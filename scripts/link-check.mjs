#!/usr/bin/env node
// Auto-ingestion LK9: the daily link check. Every case study link is opened in
// both directions, and the links themselves are compared with their record.
//
//   1. Record: every numbered scenario in the live case study index has its
//      row in the store (strategies_pro.case_studies) and the reverse.
//   2. Case study -> labs: each numbered scenario on its study page shows
//      "Strategy #N", a Strategy Lab link when the strategy is public (and
//      only then), and a Strategy Lab Pro link to /strategy/N. The Strategy
//      Lab link opens a page that shows Strategy #N; N is published in Pro.
//   3. Labs -> case study: each public strategy's page links to its origin
//      scenario, and every linked scenario exists on its study page. Pro draws
//      the same links from the same view (tests/caseStudyLinks.test.tsx).
//
// Pages are opened on the apps' own hosts. archpublic.com shows saved copies
// of both sites in a frame; whether those copies are current is the refresh
// hook's job (PRD PB4), not this check's.
//
//   SUPABASE_URL=https://<ref>.supabase.co SUPABASE_ANON_KEY=<publishable key> \
//   node scripts/link-check.mjs
//
// Optional: CASE_STUDIES_SITE (default https://arch-case-studies.vercel.app),
// STRATEGY_LAB_APP (default https://arch-strategy-lab.vercel.app, which
// serves Strategy Lab at its root). Exits 1 on any problem, 2 if it cannot run.

const env = (k, d) => (process.env[k]?.trim() || d || "").replace(/\/+$/, "");
const url = env("SUPABASE_URL");
const key = process.env.SUPABASE_ANON_KEY?.trim();
const studiesSite = env("CASE_STUDIES_SITE", "https://arch-case-studies.vercel.app");
const labApp = env("STRATEGY_LAB_APP", "https://arch-strategy-lab.vercel.app");
if (!url || !key) {
  console.error("Set SUPABASE_URL and SUPABASE_ANON_KEY.");
  process.exit(2);
}

const UA = { "user-agent": "strategy-lab-link-check" };
async function json(u, headers = {}) {
  const r = await fetch(u, { headers: { ...UA, ...headers } });
  if (!r.ok) throw new Error(`${u}: HTTP ${r.status}`);
  return r.json();
}
const pages = new Map();
async function page(u) {
  if (!pages.has(u)) {
    pages.set(u, fetch(u, { headers: UA }).then(async (r) => ({ status: r.status, html: r.ok ? await r.text() : "" }), (e) => ({ status: 0, html: "", error: String(e) })));
  }
  return pages.get(u);
}
const decode = (s) => s.replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#x27;|&#39;/g, "'");
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

let index, pro, pub;
try {
  const h = { apikey: key, Authorization: `Bearer ${key}` };
  [index, pro, pub] = await Promise.all([
    json(`${studiesSite}/case-studies.json`),
    json(`${url}/rest/v1/strategies_pro?select=display_number,title,case_studies`, h),
    json(`${url}/rest/v1/strategies_public?select=display_number,slug,case_studies`, h),
  ]);
} catch (e) {
  console.error(`cannot read the inputs: ${e.message}`);
  process.exit(2);
}

const problems = [];
const fail = (where, what) => problems.push(`${where}: ${what}`);
const proNumbers = new Set(pro.map((r) => r.display_number));
const publicByNumber = new Map(pub.map((r) => [r.display_number, r]));

// 1. Record: index and store hold the same links.
const fromIndex = new Map();
for (const s of index.studies ?? []) {
  for (const x of s.strategies ?? []) fromIndex.set(`${s.slug}/${x.key ?? x.anchor}`, { n: x.number, anchor: x.anchor, slug: s.slug });
}
const fromStore = new Map();
for (const r of pro) {
  for (const c of r.case_studies ?? []) fromStore.set(`${c.slug}/${c.scenario_key}`, { n: r.display_number, anchor: c.anchor, slug: c.slug, role: c.role });
}
for (const [k, v] of fromIndex) {
  const s = fromStore.get(k);
  if (!s) fail(k, `Strategy #${v.n} is in the case study index but not in the store (run the sync)`);
  else if (s.n !== v.n) fail(k, `the case study names Strategy #${v.n}, the store links Strategy #${s.n}`);
  else if (s.anchor !== v.anchor) fail(k, `anchor ${v.anchor} in the case study, ${s.anchor} in the store`);
}
for (const [k, v] of fromStore) if (!fromIndex.has(k)) fail(k, `the store links Strategy #${v.n}, the case study index does not`);

// 2. Case study -> labs.
let scenarioLinks = 0;
for (const s of index.studies ?? []) {
  if (!s.strategies?.length) continue;
  const where = `${studiesSite}/${s.slug}/`;
  const p = await page(where);
  if (p.status !== 200) {
    fail(where, `study page HTTP ${p.status}`);
    continue;
  }
  for (const x of s.strategies) {
    const sec = p.html.match(new RegExp(`<section[^>]*id="${esc(x.anchor)}"[\\s\\S]*?</section>`));
    const block = sec?.[0].match(new RegExp(`<div class="strategy-link" data-strategy-number="${x.number}">([\\s\\S]*?)</div>`));
    const at = `${s.slug}#${x.anchor}`;
    if (!block) {
      fail(at, `does not show Strategy #${x.number}`);
      continue;
    }
    scenarioLinks++;
    const lab = block[1].match(/<a class="lab" href="([^"]*)"/);
    const proLink = block[1].match(/<a class="pro" href="([^"]*)"/);
    const isPublic = publicByNumber.has(x.number);
    if (isPublic && !lab) fail(at, `Strategy #${x.number} is public but has no Strategy Lab link`);
    if (!isPublic && lab) fail(at, `Strategy #${x.number} has no public page but links to Strategy Lab`);
    if (lab) {
      const path = new URL(decode(lab[1])).pathname.replace(/^\/strategy-lab(?=\/)/, "");
      const target = await page(`${labApp}${path}`);
      if (target.status !== 200) fail(at, `Strategy Lab link ${path} gives HTTP ${target.status}`);
      else if (!target.html.includes(`Strategy #${x.number}`)) fail(at, `Strategy Lab link ${path} does not open Strategy #${x.number}`);
    }
    if (!proLink) fail(at, `no Strategy Lab Pro link`);
    else if (new URL(decode(proLink[1])).pathname !== `/strategy/${x.number}`) fail(at, `Pro link ${proLink[1]} is not /strategy/${x.number}`);
    if (!proNumbers.has(x.number)) fail(at, `Strategy #${x.number} is not published in Pro`);
  }
}

// 3. Labs -> case study.
let labLinks = 0;
for (const r of pub) {
  const refs = r.case_studies ?? [];
  if (!refs.length) continue;
  const where = `${labApp}/${r.slug}`;
  const p = await page(where);
  if (p.status !== 200) {
    fail(where, `strategy page HTTP ${p.status}`);
    continue;
  }
  const hrefs = [...p.html.matchAll(/<a [^>]*href="([^"]*\/case-studies\/[^"]*)"/g)].map((m) => decode(m[1]));
  for (const c of refs) {
    const hit = hrefs.find((h) => h.includes(`/case-studies/${c.slug}/`) && h.endsWith(`#${c.anchor}`));
    if (!hit) {
      fail(where, `Strategy #${r.display_number} does not link to ${c.slug}#${c.anchor}`);
      continue;
    }
    labLinks++;
  }
}
for (const [, v] of fromStore) {
  const p = await page(`${studiesSite}/${v.slug}/`);
  if (p.status !== 200) fail(`${v.slug}#${v.anchor}`, `linked study page HTTP ${p.status}`);
  else if (!p.html.includes(`id="${v.anchor}"`)) fail(`${v.slug}#${v.anchor}`, `linked scenario is not on the study page`);
}

console.log(`case study index: ${fromIndex.size} numbered scenarios; store: ${fromStore.size} links`);
console.log(`case study -> labs: ${scenarioLinks} scenarios checked; labs -> case study: ${labLinks} public links checked`);
if (problems.length) {
  console.log(`\n${problems.length} problem(s):`);
  for (const p of problems) console.log(`- ${p}`);
  process.exit(1);
}
console.log("All links resolve in both directions.");
