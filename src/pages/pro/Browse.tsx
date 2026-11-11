// Strategies: browse, filter, sort, compare (P6, P8). Filters persist in the browser.
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { GitCompare, Search, SlidersHorizontal, X } from "lucide-react";
import { type ProStrategy, displayCagr, scaledResults } from "@core";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { FilterSidebar } from "@/components/FilterSidebar";
import { ProLayout } from "@/components/pro/ProLayout";
import { StrategyCard } from "@/components/pro/StrategyCard";
import { CapitalInput, EmptyState } from "@/components/pro/primitives";
import { browsable, useProStrategies } from "@/data/proStrategies";
import type { SortOption } from "@/data/preferences";
import { usePreferences } from "@/hooks/usePreferences";
import { ASSET_CLASS_ORDER, LEGACY_ALGORITHMS } from "@/lib/algorithms";
import { isNewSince } from "@/hooks/useWhatsNew";

const SORTS: Array<{ value: SortOption; label: string }> = [
  { value: "latest", label: "Latest" },
  { value: "cagr-desc", label: "CAGR, high to low" },
  { value: "cagr-asc", label: "CAGR, low to high" },
  { value: "pnl-desc", label: "Return, high to low" },
  { value: "pnl-asc", label: "Return, low to high" },
  { value: "net-profit-desc", label: "Net profit, high to low" },
  { value: "net-profit-asc", label: "Net profit, low to high" },
  { value: "cash-profit-desc", label: "Cash profit, high to low" },
  { value: "cash-profit-asc", label: "Cash profit, low to high" },
  { value: "asset-accumulated-desc", label: "Asset accumulated, high to low" },
  { value: "asset-accumulated-asc", label: "Asset accumulated, low to high" },
];

const KNOWN_ALGORITHMS = ["Intelligence Algorithm", "Arbitrage Algorithm", "Market Wave"];

export function sortValue(s: ProStrategy, field: string, capital: number, ascending: boolean): number {
  const scaled = scaledResults(s, capital);
  let v: number | null;
  switch (field) {
    case "cagr":
      // No CAGR (under a year, D12) sorts below every CAGR in either direction.
      v = displayCagr(s);
      if (v === null) return ascending ? Number.POSITIVE_INFINITY : Number.NEGATIVE_INFINITY;
      break;
    case "cash-profit":
      v = scaled.cashProfit;
      break;
    case "asset-accumulated":
      v = scaled.assetQty;
      break;
    case "net-profit":
      v = scaled.netProfit;
      break;
    case "pnl":
      v = s.return_pct;
      break;
    default:
      return 0;
  }
  return v !== null && Number.isFinite(v) ? v : 0;
}

export function sortStrategies(list: ProStrategy[], sort: SortOption, capital: number): ProStrategy[] {
  const out = [...list];
  out.sort((a, b) => {
    let c = 0;
    if (sort === "latest") {
      c = (ASSET_CLASS_ORDER[a.asset_class] ?? 99) - (ASSET_CLASS_ORDER[b.asset_class] ?? 99);
      if (c === 0) c = new Date(b.strategy_created_at).getTime() - new Date(a.strategy_created_at).getTime();
    } else {
      const asc = sort.endsWith("-asc");
      const field = sort.replace(/-(asc|desc)$/, "");
      const av = sortValue(a, field, capital, asc);
      const bv = sortValue(b, field, capital, asc);
      c = asc ? av - bv : bv - av;
      if (Number.isNaN(c)) c = 0;
    }
    return c !== 0 ? c : a.name.localeCompare(b.name);
  });
  return out;
}

export default function Browse() {
  const { data, isLoading, error } = useProStrategies();
  const prefs = usePreferences();
  const { filters, setFilters, sort, setSort, viewCapital, setViewCapital, compare, clearCompare, previousVisitAt } = prefs;
  const [query, setQuery] = useState("");
  const strategies = useMemo(() => browsable(data), [data]);

  const availableAssets = useMemo(() => {
    const pool = filters.assetClasses.length ? strategies.filter((s) => filters.assetClasses.includes(s.asset_class)) : strategies;
    return [...new Set(pool.map((s) => s.asset))].sort();
  }, [strategies, filters.assetClasses]);
  const availableFocuses = useMemo(() => [...new Set(strategies.map((s) => s.focus))].sort(), [strategies]);
  const availableAlgorithms = useMemo(() => {
    const all = strategies.map((s) => s.algorithm).filter(Boolean);
    const nonLegacy = [...new Set([...KNOWN_ALGORITHMS, ...all])].filter((a) => !LEGACY_ALGORITHMS.includes(a));
    const legacy = [...new Set([...LEGACY_ALGORITHMS, ...all])].filter((a) => LEGACY_ALGORITHMS.includes(a));
    return [...nonLegacy, ...legacy];
  }, [strategies]);

  const pool = useMemo(
    () =>
      strategies.filter(
        (s) =>
          (filters.assetClasses.length === 0 || filters.assetClasses.includes(s.asset_class)) &&
          (!LEGACY_ALGORITHMS.includes(s.algorithm) || filters.algorithms.includes(s.algorithm)),
      ),
    [strategies, filters.assetClasses, filters.algorithms],
  );

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    const assets = filters.assets.filter((a) => availableAssets.includes(a));
    const filtered = pool.filter((s) => {
      if (q && ![s.short_name, s.title, s.goal, s.asset, s.strategy_type, String(s.display_number ?? "")].some((t) => t?.toLowerCase().includes(q))) return false;
      if (assets.length && !assets.includes(s.asset)) return false;
      if (filters.focuses.length && !filters.focuses.includes(s.focus)) return false;
      if (filters.timeHorizons.length && !filters.timeHorizons.includes(s.time_horizon)) return false;
      if (filters.algorithms.length && !filters.algorithms.includes(s.algorithm)) return false;
      const cagr = displayCagr(s);
      if (filters.minCAGR > 0 && (cagr === null || cagr < filters.minCAGR)) return false;
      return true;
    });
    return sortStrategies(filtered, sort, viewCapital);
  }, [pool, query, filters, availableAssets, sort, viewCapital]);

  const capitalBox = (
    <div className="mb-4 rounded-lg border border-border bg-card p-4 shadow-sm">
      <label htmlFor="view-capital" className="eyebrow mb-2 block">
        Show figures at
      </label>
      <CapitalInput id="view-capital" value={viewCapital} onChange={setViewCapital} />
      <p className="mt-2 text-xs text-muted-foreground">Dollar figures scale from each strategy's own starting capital.</p>
    </div>
  );
  const sidebar = (
    <FilterSidebar
      filters={filters}
      onFiltersChange={setFilters}
      availableAssets={availableAssets}
      availableFocuses={availableFocuses}
      availableTimeFrames={[]}
      availableAlgorithms={availableAlgorithms}
    />
  );

  return (
    <ProLayout title="Strategies">
      <div className="mb-6 flex flex-col gap-1">
        <h1 className="text-2xl font-extrabold tracking-[-0.02em] md:text-3xl">Strategies</h1>
        <p className="text-sm text-muted-foreground">
          Pick strategies, add them to a portfolio, size it for your capital, then apply each one with guided steps.
        </p>
      </div>

      <div className="mb-6 flex flex-col gap-3 md:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Search by name, asset or number" value={query} onChange={(e) => setQuery(e.target.value)} className="pl-10" aria-label="Search strategies" />
        </div>
        <div className="flex gap-2">
          <Select value={sort} onValueChange={(v) => setSort(v as SortOption)}>
            <SelectTrigger className="w-[230px] bg-card" aria-label="Sort">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SORTS.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="outline" className="gap-2 lg:hidden">
                <SlidersHorizontal className="h-4 w-4" /> Filters
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-[320px] overflow-y-auto">
              <SheetTitle className="sr-only">Filters</SheetTitle>
              <div className="mt-6">{capitalBox}</div>
              {sidebar}
            </SheetContent>
          </Sheet>
        </div>
      </div>

      <div className="flex gap-6">
        <aside className="hidden w-80 shrink-0 lg:block">
          <div className="sticky top-24 max-h-[calc(100vh-7rem)] overflow-y-auto pr-1">
            {capitalBox}
            {sidebar}
          </div>
        </aside>

        <section className="min-w-0 flex-1" aria-label="Strategy list">
          {error ? (
            <EmptyState title="Strategies could not be loaded">Check your connection and reload the page.</EmptyState>
          ) : isLoading ? (
            <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-96 animate-pulse rounded-lg bg-muted" />
              ))}
            </div>
          ) : shown.length === 0 ? (
            <EmptyState title="No strategies match">
              Try fewer filters.{" "}
              <button type="button" className="font-semibold text-primary hover:underline" onClick={prefs.resetFilters}>
                Reset filters
              </button>
            </EmptyState>
          ) : (
            <>
              <p className="mb-4 text-sm text-muted-foreground" aria-live="polite">
                Showing {shown.length} of {pool.length} strategies
              </p>
              <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
                {shown.map((s) => (
                  <StrategyCard key={s.id} strategy={s} capital={viewCapital} isNew={isNewSince(s, previousVisitAt)} />
                ))}
              </div>
            </>
          )}
        </section>
      </div>

      {compare.length > 0 && (
        <div className="fixed inset-x-0 bottom-4 z-40 flex justify-center px-4">
          <div className="flex items-center gap-3 rounded-full border border-border bg-card px-4 py-2 shadow-lg">
            <GitCompare className="h-4 w-4 text-primary" />
            <span className="text-sm font-semibold">{compare.length} of 4 picked</span>
            <Button asChild size="sm" className="rounded-full" disabled={compare.length < 2}>
              <Link to={`/compare`} aria-disabled={compare.length < 2} onClick={(e) => compare.length < 2 && e.preventDefault()}>
                Compare
              </Link>
            </Button>
            <button type="button" onClick={clearCompare} className="rounded-full p-1 text-muted-foreground hover:bg-secondary" aria-label="Clear compare">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </ProLayout>
  );
}
