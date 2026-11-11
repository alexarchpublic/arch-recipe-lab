"use client";
// The strategy list (S15): filters and sort, kept in the address so a
// filtered list can be shared. Rendered on the server with every published
// strategy, so search and the parity check see the whole list.
import { useEffect, useMemo, useState } from "react";
import type { PublicStrategy } from "@core";
import { displayCagr } from "@core";
import { ASSET_CLASSES, FOCI, assetClassLabel, byReturn, focusLabel, horizonLabel } from "@/lib/strategies";
import { AccountSize } from "./AccountSize";
import { StrategyCard } from "./StrategyCard";
import { Select } from "./ui";

type Sort = "return" | "cagr" | "newest" | "number";

interface Filters {
  class: string;
  asset: string;
  focus: string;
  horizon: string;
  algorithm: string;
  sort: Sort;
}

const EMPTY: Filters = { class: "", asset: "", focus: "", horizon: "", algorithm: "", sort: "return" };

export function StrategyList({ strategies, disclaimer, hidden, scale }: { strategies: PublicStrategy[]; disclaimer: string | null; hidden: string[]; scale: boolean }) {
  const [f, setF] = useState<Filters>(EMPTY);

  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    setF({
      class: p.get("class") ?? "",
      asset: p.get("asset") ?? "",
      focus: p.get("focus") ?? "",
      horizon: p.get("horizon") ?? "",
      algorithm: p.get("algorithm") ?? "",
      sort: (["return", "cagr", "newest", "number"].includes(p.get("sort") ?? "") ? p.get("sort") : "return") as Sort,
    });
  }, []);

  const update = (patch: Partial<Filters>) => {
    const next = { ...f, ...patch };
    if (patch.class !== undefined) next.asset = "";
    setF(next);
    const p = new URLSearchParams();
    Object.entries(next).forEach(([k, v]) => v && !(k === "sort" && v === "return") && p.set(k, v));
    window.history.replaceState(null, "", `${window.location.pathname}${p.toString() ? `?${p}` : ""}`);
  };

  const assets = useMemo(() => [...new Set(strategies.filter((s) => !f.class || s.asset_class === f.class).map((s) => s.asset))].sort(), [strategies, f.class]);
  const algorithms = useMemo(() => [...new Set(strategies.map((s) => s.algorithm))].sort(), [strategies]);

  const rows = useMemo(() => {
    const out = strategies.filter(
      (s) =>
        (!f.class || s.asset_class === f.class) &&
        (!f.asset || s.asset === f.asset) &&
        (!f.focus || s.focus === f.focus) &&
        (!f.horizon || s.time_horizon === f.horizon) &&
        (!f.algorithm || s.algorithm === f.algorithm),
    );
    const cagr = (s: PublicStrategy) => displayCagr(s) ?? -Infinity; // none under a year (D12)
    switch (f.sort) {
      case "cagr":
        return out.sort((a, b) => cagr(b) - cagr(a) || byReturn(a, b));
      case "newest":
        return out.sort((a, b) => b.as_of.localeCompare(a.as_of) || byReturn(a, b));
      case "number":
        return out.sort((a, b) => (a.display_number ?? 0) - (b.display_number ?? 0));
      default:
        return out.sort(byReturn);
    }
  }, [strategies, f]);

  const active = Object.entries(f).some(([k, v]) => k !== "sort" && v);

  return (
    <div className="space-y-5">
      <div className="grid gap-3 rounded-lg border border-border bg-card p-4 shadow-sm sm:grid-cols-3 lg:grid-cols-6">
        <Select aria-label="Asset class" value={f.class} onChange={(e) => update({ class: e.target.value })}>
          <option value="">All asset classes</option>
          {ASSET_CLASSES.map((c) => <option key={c} value={c}>{assetClassLabel(c)}</option>)}
        </Select>
        <Select aria-label="Asset" value={f.asset} onChange={(e) => update({ asset: e.target.value })}>
          <option value="">All assets</option>
          {assets.map((a) => <option key={a} value={a}>{a}</option>)}
        </Select>
        <Select aria-label="Focus" value={f.focus} onChange={(e) => update({ focus: e.target.value })}>
          <option value="">Any focus</option>
          {FOCI.map((x) => <option key={x} value={x}>{focusLabel(x)}</option>)}
        </Select>
        <Select aria-label="Horizon" value={f.horizon} onChange={(e) => update({ horizon: e.target.value })}>
          <option value="">Any horizon</option>
          {["STH", "LTH"].map((h) => <option key={h} value={h}>{horizonLabel(h)}</option>)}
        </Select>
        <Select aria-label="Algorithm" value={f.algorithm} onChange={(e) => update({ algorithm: e.target.value })}>
          <option value="">Any algorithm</option>
          {algorithms.map((a) => <option key={a} value={a}>{a}</option>)}
        </Select>
        <Select aria-label="Sort" value={f.sort} onChange={(e) => update({ sort: e.target.value as Sort })}>
          <option value="return">Highest return</option>
          <option value="cagr">Highest CAGR</option>
          <option value="newest">Newest</option>
          <option value="number">Strategy number</option>
        </Select>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {rows.length} of {strategies.length} strategies
          {active && (
            <button type="button" className="ml-2 font-semibold text-primary hover:underline" onClick={() => update({ ...EMPTY, sort: f.sort })}>
              Clear filters
            </button>
          )}
        </p>
        {scale && <AccountSize compact />}
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {rows.map((s) => (
          <StrategyCard key={s.id} strategy={s} disclaimer={disclaimer} hidden={hidden} scale={scale} />
        ))}
      </div>
    </div>
  );
}
