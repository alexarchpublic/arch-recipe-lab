"use client";
// The strategy finder (S3): what you want to trade, what you want from it,
// your exchange and account size. Works without an email; the answers stay in
// the browser and travel with the visitor's first capture.
import { useMemo, useState } from "react";
import Link from "@/components/Link";
import type { PublicStrategy } from "@core";
import { track } from "@/lib/analytics";
import { ASSET_CLASSES, FOCI, assetClassLabel, byReturn, focusHelp, focusLabel } from "@/lib/strategies";
import { writeVisitor } from "@/lib/visitor";
import { StrategyCard } from "./StrategyCard";
import { Field, MoneyInput, Select } from "./ui";
import { useVisitor } from "./useVisitor";

export function Finder({ strategies, exchanges, disclaimer, hidden, scale }: { strategies: PublicStrategy[]; exchanges: string[]; disclaimer: string | null; hidden: string[]; scale: boolean }) {
  const v = useVisitor();
  const saved = v?.finder;
  const [assetClass, setAssetClass] = useState<string | null>(null);
  const [asset, setAsset] = useState<string | null>(null);
  const [goal, setGoal] = useState<string | null>(null);
  const [exchange, setExchange] = useState<string | null>(null);
  const [shown, setShown] = useState(false);

  const cls = assetClass ?? saved?.assetClass ?? "";
  const ast = asset ?? saved?.asset ?? "";
  const gl = goal ?? saved?.goal ?? "";
  const ex = exchange ?? saved?.exchange ?? "";
  const size = v?.accountSize ?? saved?.accountSize ?? null;

  const assets = useMemo(
    () => [...new Set(strategies.filter((s) => !cls || s.asset_class === cls).map((s) => s.asset))].sort(),
    [strategies, cls],
  );
  const matches = useMemo(
    () =>
      strategies
        .filter((s) => (!cls || s.asset_class === cls) && (!ast || s.asset === ast) && (!gl || s.focus === gl))
        .sort(byReturn),
    [strategies, cls, ast, gl],
  );
  const loose = matches.length ? null : strategies.filter((s) => (!cls || s.asset_class === cls) && (!gl || s.focus === gl)).sort(byReturn);

  const save = (patch: Partial<{ assetClass: string; asset: string; goal: string; exchange: string }>) =>
    writeVisitor((st) => ({ finder: { assetClass: cls, asset: ast, goal: gl, exchange: ex, accountSize: size, ...(st.finder ?? {}), ...patch } }));

  const show = () => {
    setShown(true);
    save({ assetClass: cls, asset: ast, goal: gl, exchange: ex });
    track("finder_completed", { asset_class: cls || null, asset: ast || null, goal: gl || null, exchange: ex || null, account_size: size ? Math.round(size) : null, results: matches.length });
  };

  const results = (matches.length ? matches : loose ?? []).slice(0, 6);

  return (
    <div className="space-y-6">
      <div className="grid gap-4 rounded-lg border border-border bg-card p-5 shadow-sm md:grid-cols-2 lg:grid-cols-4">
        <Field label="What do you want to trade?">
          <div className="flex gap-2">
            <Select
              value={cls}
              onChange={(e) => {
                setAssetClass(e.target.value);
                setAsset("");
                save({ assetClass: e.target.value, asset: "" });
              }}
              aria-label="Asset class"
            >
              <option value="">Anything</option>
              {ASSET_CLASSES.map((c) => (
                <option key={c} value={c}>{assetClassLabel(c)}</option>
              ))}
            </Select>
            <Select value={ast} onChange={(e) => { setAsset(e.target.value); save({ asset: e.target.value }); }} aria-label="Asset">
              <option value="">Any asset</option>
              {assets.map((a) => (
                <option key={a} value={a}>{a}</option>
              ))}
            </Select>
          </div>
        </Field>
        <Field label="What do you want from it?" hint={gl ? focusHelp[gl] : "Cash yield, balance or accumulation"}>
          <Select value={gl} onChange={(e) => { setGoal(e.target.value); save({ goal: e.target.value }); }}>
            <option value="">Any of these</option>
            {FOCI.map((f) => (
              <option key={f} value={f}>{focusLabel(f)}</option>
            ))}
          </Select>
        </Field>
        <Field label="Which exchange do you use?">
          <Select value={ex} onChange={(e) => { setExchange(e.target.value); save({ exchange: e.target.value }); }}>
            <option value="">Not sure yet</option>
            {exchanges.map((x) => (
              <option key={x} value={x}>{x}</option>
            ))}
            <option value="Other">Other</option>
          </Select>
        </Field>
        <Field label="Account size">
          <MoneyInput
            label="Account size in dollars"
            value={size}
            onChange={(n) => writeVisitor((st) => ({ accountSize: n, finder: { ...(st.finder ?? { assetClass: cls, asset: ast, goal: gl, exchange: ex, accountSize: null }), accountSize: n } }))}
          />
        </Field>
        <div className="md:col-span-2 lg:col-span-4">
          <button type="button" onClick={show} className="rounded-full bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground hover:brightness-110">
            Show matching strategies
          </button>
        </div>
      </div>
      {shown && (
        <div className="space-y-3" aria-live="polite">
          <p className="text-sm text-muted-foreground">
            {matches.length
              ? `${matches.length} strateg${matches.length === 1 ? "y matches" : "ies match"}. The best by return:`
              : "Nothing matches all of that yet. The closest:"}
          </p>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {results.map((s) => (
              <StrategyCard key={s.id} strategy={s} hidden={hidden} />
            ))}
          </div>
          {matches.length > 6 && (
            <Link href={`/strategies?${new URLSearchParams({ ...(cls && { class: cls }), ...(ast && { asset: ast }), ...(gl && { focus: gl }) }).toString()}`} className="text-sm font-bold text-primary hover:underline">
              See all {matches.length} →
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
