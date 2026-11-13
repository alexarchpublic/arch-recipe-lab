"use client";
// The strategy list (S15): filters and sort, kept in the address so a
// filtered list can be shared. Rendered on the server with every published
// strategy, so search and the parity check see the whole list.
//
// The cards themselves are rendered on the server and passed in by id; this
// component only orders and filters them, from the few fields it needs
// (ListRow). Card, chart and bar code never ships to the browser.
import { type ReactNode, useEffect, useMemo, useState } from "react";
import type { MarketTag } from "@core";
import { DisclaimerSlot, MARKET_TAGS, MARKET_TAG_LABELS } from "@core";
import { track } from "@/lib/analytics";
import { type ListRow, FOCI, byNewest, classCounts, focusLabel, horizonLabel } from "@/lib/strategies";
import { AccountSize } from "./AccountSize";
import { ClassChips } from "./ClassChips";
import { Select } from "./ui";

const byReturn = (a: ListRow, b: ListRow) => b.return_pct - a.return_pct;

type Sort = "return" | "cagr" | "newest" | "number";

interface Filters {
  class: string;
  market: string;
  asset: string;
  focus: string;
  horizon: string;
  algorithm: string;
  sort: Sort;
}

// Newest first by default (fixes PRD, fix 3); `?sort=return` and older links keep working.
const DEFAULT_SORT: Sort = "newest";
const EMPTY: Filters = { class: "", market: "", asset: "", focus: "", horizon: "", algorithm: "", sort: DEFAULT_SORT };

export function StrategyList({
  strategies,
  cards,
  disclaimer,
  scale,
  marketTags = {},
}: {
  strategies: ListRow[];
  /** Each strategy's card, rendered on the server, by strategy id. */
  cards: Record<string, ReactNode>;
  disclaimer: string | null;
  scale: boolean;
  marketTags?: Record<string, MarketTag>;
}) {
  const [f, setF] = useState<Filters>(EMPTY);

  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    setF({
      class: p.get("class") ?? "",
      market: p.get("market") ?? "",
      asset: p.get("asset") ?? "",
      focus: p.get("focus") ?? "",
      horizon: p.get("horizon") ?? "",
      algorithm: p.get("algorithm") ?? "",
      sort: (["return", "cagr", "newest", "number"].includes(p.get("sort") ?? "") ? p.get("sort") : DEFAULT_SORT) as Sort,
    });
  }, []);

  const update = (patch: Partial<Filters>) => {
    const next = { ...f, ...patch };
    if (patch.class !== undefined) next.asset = "";
    setF(next);
    const p = new URLSearchParams();
    Object.entries(next).forEach(([k, v]) => v && !(k === "sort" && v === DEFAULT_SORT) && p.set(k, v));
    window.history.replaceState(null, "", `${window.location.pathname}${p.toString() ? `?${p}` : ""}`);
  };

  const assets = useMemo(() => [...new Set(strategies.filter((s) => !f.class || s.asset_class === f.class).map((s) => s.asset))].sort(), [strategies, f.class]);
  const algorithms = useMemo(() => [...new Set(strategies.map((s) => s.algorithm))].sort(), [strategies]);
  // The market filter appears once at least one published strategy has a tag (redesign PRD 6).
  const markets = useMemo(() => MARKET_TAGS.filter((t) => strategies.some((s) => marketTags[s.slug] === t)), [strategies, marketTags]);
  const counts = useMemo(() => classCounts(strategies), [strategies]);

  const rows = useMemo(() => {
    const out = strategies.filter(
      (s) =>
        (!f.class || s.asset_class === f.class) &&
        (!f.market || marketTags[s.slug] === f.market) &&
        (!f.asset || s.asset === f.asset) &&
        (!f.focus || s.focus === f.focus) &&
        (!f.horizon || s.time_horizon === f.horizon) &&
        (!f.algorithm || s.algorithm === f.algorithm),
    );
    const cagr = (s: ListRow) => s.cagr ?? -Infinity; // none under a year (D12)
    switch (f.sort) {
      case "cagr":
        return out.sort((a, b) => cagr(b) - cagr(a) || byReturn(a, b));
      case "return":
        return out.sort(byReturn);
      case "number":
        return out.sort((a, b) => (a.display_number ?? 0) - (b.display_number ?? 0));
      default:
        // Newest: strategy numbers are given at first publish and never reused.
        return out.sort(byNewest);
    }
  }, [strategies, f, marketTags]);

  const active = Object.entries(f).some(([k, v]) => k !== "sort" && v);

  const selectCls = "!min-h-[44px]";
  return (
    <div className="space-y-6">
      <ClassChips counts={counts} page="strategies" active={f.class} onSelect={(value) => update({ class: value })} />
      <div className={`grid gap-3 rounded-lg border border-line bg-card p-4 shadow-card sm:grid-cols-2 md:grid-cols-3 ${markets.length ? "lg:grid-cols-6" : "lg:grid-cols-5"}`}>
        {markets.length > 0 && (
          <Select
            aria-label="Market"
            className={selectCls}
            value={f.market}
            onChange={(e) => {
              track("market_filter_used", { value: e.target.value || "any", page: "strategies" });
              update({ market: e.target.value });
            }}
          >
            <option value="">Any market</option>
            {markets.map((m) => <option key={m} value={m}>{MARKET_TAG_LABELS[m]}</option>)}
          </Select>
        )}
        <Select aria-label="Asset" className={selectCls} value={f.asset} onChange={(e) => update({ asset: e.target.value })}>
          <option value="">All assets</option>
          {assets.map((a) => <option key={a} value={a}>{a}</option>)}
        </Select>
        <Select aria-label="Aim" className={selectCls} value={f.focus} onChange={(e) => update({ focus: e.target.value })}>
          <option value="">Any aim</option>
          {FOCI.map((x) => <option key={x} value={x}>{focusLabel(x)}</option>)}
        </Select>
        <Select aria-label="Horizon" className={selectCls} value={f.horizon} onChange={(e) => update({ horizon: e.target.value })}>
          <option value="">Any horizon</option>
          {["STH", "LTH"].map((h) => <option key={h} value={h}>{horizonLabel(h)}</option>)}
        </Select>
        <Select aria-label="Algorithm" className={selectCls} value={f.algorithm} onChange={(e) => update({ algorithm: e.target.value })}>
          <option value="">Any algorithm</option>
          {algorithms.map((a) => <option key={a} value={a}>{a}</option>)}
        </Select>
        <Select aria-label="Sort" className={selectCls} value={f.sort} onChange={(e) => update({ sort: e.target.value as Sort })}>
          <option value="newest">Newest</option>
          <option value="return">Highest return</option>
          <option value="cagr">Highest CAGR</option>
          <option value="number">Strategy number</option>
        </Select>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-ink-muted" role="status">
          {rows.length} of {strategies.length} strategies
          {active && (
            <button type="button" className="ml-2 inline-flex min-h-[44px] items-center font-bold text-primary hover:underline" onClick={() => update({ ...EMPTY, sort: f.sort })}>
              Clear filters
            </button>
          )}
        </p>
        {scale && <AccountSize compact />}
      </div>
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {rows.map((s) => (
          <div key={s.id} className="min-w-0">{cards[s.id]}</div>
        ))}
      </div>
      <DisclaimerSlot text={disclaimer} className="!text-[13px] !text-ink-muted" />
    </div>
  );
}
