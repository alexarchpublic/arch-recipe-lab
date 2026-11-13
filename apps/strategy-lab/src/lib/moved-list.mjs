// The old Strategy Lab addresses and where each one goes now (PRD 13,
// Redirects): the old site's /recipes and /recipes/<record-id>, and the short
// /strategy/<number> that case studies link to.
//
// Plain JavaScript because next.config.mjs reads it too: the list is made once
// per build and becomes the site's server redirects, the "Older links" page
// and /redirects.json (lib/moved.ts). archpublic.com's page engine keeps an
// old address as a redirect only when the server answers with one, so these
// are entries in next.config's redirects(), not pages.

/** Where an old address goes when its strategy is not on the public list. */
export const LIST_PATH = "/strategies";

/** The page engine keeps at most this many redirects. */
export const MAX_MOVED = 500;
export const WARN_MOVED = 400;

const QUERY = "strategies_public?select=id,slug,display_number,title,asset&order=display_number.asc";

/** First path parts the site itself uses. A strategy page at one of them would be hidden by a route or a redirect. */
const RESERVED = new Set(["recipes", "strategy", "strategies", "strategy-lab", "older-links", "redirects.json", "p", "api", "sitemap.xml", "robots.txt", "opengraph-image", "_next"]);

/**
 * Every old address with its target, from the public strategies. Throws on a
 * row that would make a wrong redirect, so a build stops instead of shipping it.
 */
export function movedList(rows) {
  const list = [{ from: "/recipes", to: LIST_PATH, label: "All Strategy Lab strategies" }];
  for (const s of rows) {
    if (!/^[a-z0-9][a-z0-9-]*$/.test(s.slug ?? "")) throw new Error(`strategy ${s.id} has a page address that cannot be a redirect target: "${s.slug}"`);
    if (RESERVED.has(s.slug)) throw new Error(`strategy ${s.id} has the page address "/${s.slug}", which the site already uses`);
    if (!/^[0-9a-f-]{8,40}$/i.test(s.id ?? "")) throw new Error(`strategy "${s.slug}" has an unexpected record id: "${s.id}"`);
    const label = `#${s.display_number} ${s.title} (${s.asset})`;
    list.push({ from: `/recipes/${s.id}`, to: `/${s.slug}`, label });
    if (s.display_number != null) {
      if (!/^\d{1,5}$/.test(String(s.display_number))) throw new Error(`strategy "${s.slug}" has an unexpected number: "${s.display_number}"`);
      list.push({ from: `/strategy/${s.display_number}`, to: `/${s.slug}`, label });
    }
  }
  // One hop each: no address is listed twice, and no target is itself an old address.
  const froms = new Set();
  for (const m of list) {
    if (froms.has(m.from)) throw new Error(`old address ${m.from} is listed twice`);
    froms.add(m.from);
  }
  const chained = list.find((m) => froms.has(m.to));
  if (chained) throw new Error(`${chained.from} points at ${chained.to}, which is itself an old address`);
  return list;
}

/** Reads the list from the store as it is now, past any cache. */
export async function readMoved(storeUrl, key) {
  if (!storeUrl || !key) throw new Error("SUPABASE_URL and SUPABASE_ANON_KEY are not set");
  const res = await fetch(`${storeUrl}/rest/v1/${QUERY}`, { headers: { apikey: key, Authorization: `Bearer ${key}` }, cache: "no-store" });
  if (!res.ok) throw new Error(`store read strategies_public: HTTP ${res.status}`);
  return movedList(await res.json());
}

/** The same list in one line, to tell whether two lists redirect alike. */
export const movedKey = (list) =>
  list
    .map((m) => `${m.from}>${m.to}`)
    .sort()
    .join("\n");
