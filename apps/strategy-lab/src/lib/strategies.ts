// Choosing and grouping published strategies for the public pages. Nothing
// here computes a figure: ranking and grouping only read stored values.
import type { PublicStrategy } from "@core";

export const ASSET_CLASSES: Array<PublicStrategy["asset_class"]> = ["Equities", "ETFs", "Crypto"];
export const FOCI: Array<PublicStrategy["focus"]> = ["Cash Yielding", "Balanced", "Accumulation"];

export const assetClassLabel = (c: string): string => (c === "Equities" ? "Stocks" : c);
export const horizonLabel = (h: string): string => (h === "LTH" ? "Long term" : h === "STH" ? "Short term" : h);
export const focusLabel = (f: string): string =>
  f === "Cash Yielding" ? "Cash yield" : f === "Balanced" ? "Balance" : f === "Accumulation" ? "Accumulation" : f;
export const focusHelp: Record<string, string> = {
  "Cash Yielding": "Aims for profit taken in cash",
  Balanced: "Aims for a mix of cash profit and more of the asset",
  Accumulation: "Aims to grow how much of the asset you hold",
};

export interface ClassCount {
  value: string; // "" for all
  label: string;
  count: number;
}

/** "All 62", "Stocks 39", "ETFs 14", "Crypto 9": live counts for the asset-class chips. */
export function classCounts(strategies: Pick<PublicStrategy, "asset_class">[]): ClassCount[] {
  return [
    { value: "", label: "All", count: strategies.length },
    ...ASSET_CLASSES.map((c) => ({ value: c, label: assetClassLabel(c), count: strategies.filter((s) => s.asset_class === c).length })).filter((x) => x.count > 0),
  ];
}

/** What the list page's filters and sorts read, and nothing more, for the browser. */
export interface ListRow {
  id: string;
  slug: string;
  display_number: number | null;
  asset: string;
  asset_class: PublicStrategy["asset_class"];
  focus: PublicStrategy["focus"];
  time_horizon: PublicStrategy["time_horizon"];
  algorithm: string;
  return_pct: number;
  as_of: string;
  /** CAGR as a client may see it (displayCagr): null under a year or without a real test end. */
  cagr: number | null;
}

export function listRow(s: PublicStrategy, cagr: number | null): ListRow {
  return {
    id: s.id, slug: s.slug, display_number: s.display_number, asset: s.asset, asset_class: s.asset_class, focus: s.focus,
    time_horizon: s.time_horizon, algorithm: s.algorithm, return_pct: s.return_pct, as_of: s.as_of, cagr,
  };
}

/** Only what a chart needs crosses to the browser (client components), never the whole row. */
export function chartFields(s: PublicStrategy): Pick<PublicStrategy, "slug" | "display_number" | "asset" | "time_frame" | "chart_url" | "title"> {
  return { slug: s.slug, display_number: s.display_number, asset: s.asset, time_frame: s.time_frame, chart_url: s.chart_url, title: s.title };
}

export function byReturn(a: PublicStrategy, b: PublicStrategy): number {
  return b.return_pct - a.return_pct;
}

/** Strategies named by slug, in that order, skipping any no longer published. */
export function pickBySlug(all: PublicStrategy[], slugs: string[]): PublicStrategy[] {
  const map = new Map(all.map((s) => [s.slug, s]));
  return slugs.map((slug) => map.get(slug)).filter((s): s is PublicStrategy => !!s);
}

/**
 * Newest first. Strategy numbers come from a store sequence at first publish
 * and are never reused, so this order never moves when a title or figure is
 * edited (fixes PRD, fixes 2 and 3).
 */
export function byNewest(a: Pick<PublicStrategy, "display_number">, b: Pick<PublicStrategy, "display_number">): number {
  return (b.display_number ?? 0) - (a.display_number ?? 0);
}

/** Marketing's pinned list when set (an override); otherwise the newest published. */
export function topStrategies(all: PublicStrategy[], featured: string[], n = 6): PublicStrategy[] {
  const chosen = pickBySlug(all, featured);
  if (chosen.length) return chosen.slice(0, n);
  return [...all].sort(byNewest).slice(0, n);
}

/**
 * The best-performing public strategy of the newest case study (fixes PRD,
 * fix 1). Newest = the latest published_on among the strategies' case study
 * links; a study whose strategies are all Pro-only never reaches this list, so
 * the next newest study is used. Best = highest total return, then the larger
 * margin over buy and hold, then the lower strategy number.
 */
export function latestStudyBest(all: PublicStrategy[]): PublicStrategy | null {
  const studies = new Map<string, { published: string; members: PublicStrategy[] }>();
  for (const s of all) {
    for (const ref of s.case_studies ?? []) {
      if (!ref.published_on) continue;
      const entry = studies.get(ref.slug) ?? { published: ref.published_on, members: [] };
      if (ref.published_on > entry.published) entry.published = ref.published_on;
      if (!entry.members.includes(s)) entry.members.push(s);
      studies.set(ref.slug, entry);
    }
  }
  const latest = [...studies.entries()].sort(([sa, a], [sb, b]) => b.published.localeCompare(a.published) || sa.localeCompare(sb))[0];
  if (!latest) return null;
  const margin = (s: PublicStrategy) => s.vs_buy_hold_pct ?? Number.NEGATIVE_INFINITY;
  return (
    [...latest[1].members].sort(
      (a, b) =>
        byReturn(a, b) ||
        (margin(b) === margin(a) ? 0 : margin(b) > margin(a) ? 1 : -1) ||
        (a.display_number ?? Number.MAX_SAFE_INTEGER) - (b.display_number ?? Number.MAX_SAFE_INTEGER),
    )[0] ?? null
  );
}

/** A pinned strategy when marketing set one (an override); else the latest case study's best; else the highest return. */
export function heroStrategy(all: PublicStrategy[], slug: string): PublicStrategy | null {
  return pickBySlug(all, slug ? [slug] : [])[0] ?? latestStudyBest(all) ?? [...all].sort(byReturn)[0] ?? null;
}

export interface ClassSummary {
  assetClass: PublicStrategy["asset_class"];
  count: number;
  assets: number;
  leader: PublicStrategy | null;
}

export function librarySummary(all: PublicStrategy[]): ClassSummary[] {
  return ASSET_CLASSES.map((assetClass) => {
    const rows = all.filter((s) => s.asset_class === assetClass);
    return {
      assetClass,
      count: rows.length,
      assets: new Set(rows.map((s) => s.asset)).size,
      leader: [...rows].sort(byReturn)[0] ?? null,
    };
  }).filter((c) => c.count > 0);
}

/** Same asset first, then same class and focus, then same class. */
export function relatedStrategies(all: PublicStrategy[], s: PublicStrategy, n = 3): PublicStrategy[] {
  const others = all.filter((o) => o.id !== s.id);
  const score = (o: PublicStrategy) =>
    (o.asset === s.asset ? 4 : 0) + (o.asset_class === s.asset_class ? 2 : 0) + (o.focus === s.focus ? 1 : 0);
  return others
    .map((o) => ({ o, k: score(o) }))
    .filter((x) => x.k > 0)
    .sort((a, b) => b.k - a.k || byReturn(a.o, b.o))
    .slice(0, n)
    .map((x) => x.o);
}

/** Months, or years and months, of a test window: shown where CAGR is not (D12). */
export function testLength(years: number): string {
  const months = Math.round(years * 12);
  if (months < 12) return `${months} month${months === 1 ? "" : "s"}`;
  const y = Math.floor(months / 12);
  const m = months % 12;
  return m ? `${y} yr ${m} mo` : `${y} year${y === 1 ? "" : "s"}`;
}

export const ACCOUNT_SIZE_RANGES = [
  { id: "under-10k", label: "Under $10,000", max: 10_000 },
  { id: "10k-50k", label: "$10,000 to $50,000", max: 50_000 },
  { id: "50k-250k", label: "$50,000 to $250,000", max: 250_000 },
  { id: "250k-1m", label: "$250,000 to $1 million", max: 1_000_000 },
  { id: "over-1m", label: "Over $1 million", max: Infinity },
] as const;

export function rangeFor(amount: number | null | undefined): string {
  if (!amount || !Number.isFinite(amount) || amount <= 0) return "";
  return ACCOUNT_SIZE_RANGES.find((r) => amount < r.max)?.id ?? "over-1m";
}
