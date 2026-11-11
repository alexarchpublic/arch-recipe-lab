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

export function byReturn(a: PublicStrategy, b: PublicStrategy): number {
  return b.return_pct - a.return_pct;
}

/** Strategies named by slug, in that order, skipping any no longer published. */
export function pickBySlug(all: PublicStrategy[], slugs: string[]): PublicStrategy[] {
  const map = new Map(all.map((s) => [s.slug, s]));
  return slugs.map((slug) => map.get(slug)).filter((s): s is PublicStrategy => !!s);
}

export function topStrategies(all: PublicStrategy[], featured: string[], n = 6): PublicStrategy[] {
  const chosen = pickBySlug(all, featured);
  if (chosen.length) return chosen.slice(0, n);
  return [...all].sort(byReturn).slice(0, n);
}

export function heroStrategy(all: PublicStrategy[], slug: string): PublicStrategy | null {
  return pickBySlug(all, slug ? [slug] : [])[0] ?? [...all].sort(byReturn)[0] ?? null;
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
