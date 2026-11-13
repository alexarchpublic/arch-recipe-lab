#!/usr/bin/env node
// PRD 13, Redirects: check every old Strategy Lab address on a live deploy.
// Each must answer 307 or 308 with a Location equal to its target on the same
// site, the target must answer 200, campaign tags must carry over, an unknown
// number must go to the list, and the "Older links" page must link every one.
//
//   STRATEGY_LAB_URL=https://arch-strategy-lab.vercel.app node scripts/check-redirects.mjs
//
// The list comes from the deploy's own /redirects.json (paths under
// /strategy-lab, as archpublic.com serves them). Exits 1 on any problem.
const site = process.env.STRATEGY_LAB_URL?.replace(/\/+$/, "");
if (!site) {
  console.error("Set STRATEGY_LAB_URL, e.g. https://arch-strategy-lab.vercel.app");
  process.exit(2);
}
const PUBLIC_PATH = "/strategy-lab";
const local = (p) => (p.startsWith(`${PUBLIC_PATH}/`) ? p.slice(PUBLIC_PATH.length) : p);
const problems = [];

const listRes = await fetch(`${site}/redirects.json`, { cache: "no-store", redirect: "manual" });
if (listRes.status !== 200) {
  const to = listRes.headers.get("location") ?? "";
  console.error(`/redirects.json: HTTP ${listRes.status}${/vercel\.com\/(sso-api|login)/.test(to) ? " (the deploy is behind Vercel's sign-in; check the production address instead)" : ""}`);
  process.exit(2);
}
const list = (await listRes.json()).redirects.map((r) => ({ from: local(r.from), to: local(r.to) }));

async function hop(path) {
  const res = await fetch(`${site}${path}`, { redirect: "manual", cache: "no-store" });
  const location = res.headers.get("location");
  return { status: res.status, location: location ? new URL(location, site) : null };
}

async function expectRedirect(from, to) {
  const { status, location } = await hop(from);
  const want = new URL(to, site);
  if (status !== 307 && status !== 308) return problems.push(`${from}: HTTP ${status}, not a redirect`);
  if (!location) return problems.push(`${from}: ${status} with no Location`);
  if (location.origin !== new URL(site).origin) return problems.push(`${from}: goes to another site, ${location.href}`);
  if (location.pathname + location.search !== want.pathname + want.search) return problems.push(`${from}: goes to ${location.pathname}${location.search}, not ${to}`);
  return status;
}

// Every old address, a few at a time.
const targets = new Set();
const codes = new Map();
for (let i = 0; i < list.length; i += 8) {
  await Promise.all(
    list.slice(i, i + 8).map(async (m) => {
      const s = await expectRedirect(m.from, m.to);
      if (typeof s === "number") codes.set(s, (codes.get(s) ?? 0) + 1);
      targets.add(m.to);
    }),
  );
}
// Every target is a real page, not another redirect.
for (const to of targets) {
  const { status } = await hop(to);
  if (status !== 200) problems.push(`target ${to}: HTTP ${status}`);
}
// Campaign tags carry over, and an unknown number or record id goes to the list.
const sample = list.find((m) => m.from.startsWith("/strategy/"));
if (sample) await expectRedirect(`${sample.from}?utm_source=check&partner=x`, `${sample.to}?utm_source=check&partner=x`);
await expectRedirect("/strategy/99999", "/strategies");
await expectRedirect("/recipes/not-a-record", "/strategies");
// The "Older links" page links every old address with a plain link.
const older = await fetch(`${site}/older-links`, { cache: "no-store" });
const html = older.ok ? await older.text() : "";
if (!older.ok) problems.push(`/older-links: HTTP ${older.status}`);
const linked = new Set([...html.matchAll(/<a [^>]*href="([^"]+)"/g)].map((m) => m[1]));
const unlinked = list.filter((m) => !linked.has(m.from));
if (unlinked.length) problems.push(`/older-links does not link ${unlinked.length}: ${unlinked.slice(0, 5).map((m) => m.from).join(", ")}`);

console.log(`${list.length} old addresses, ${targets.size} targets; answers: ${[...codes].map(([c, n]) => `${n} x ${c}`).join(", ") || "none"}.`);
for (const p of problems) console.error(`  ${p}`);
console.log(problems.length ? `${problems.length} problem(s).` : "All redirects check out.");
process.exit(problems.length ? 1 : 0);
