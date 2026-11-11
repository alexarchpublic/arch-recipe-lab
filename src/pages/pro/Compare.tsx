// Compare two to four strategies on the same fields (P8).
import { Link } from "react-router-dom";
import { X } from "lucide-react";
import {
  type ProStrategy,
  displayCagr,
  formatMoney,
  formatPercent,
  formatQuantity,
  formatSignedCurrency,
  formatSignedPercent,
  formatTestWindow,
  proStrategyPath,
  scaledResults,
  vsBuyHold,
  vsDca,
} from "@core";
import { ProLayout } from "@/components/pro/ProLayout";
import { AddToPortfolioButton } from "@/components/pro/StrategyCard";
import { CapitalInput, EmptyState, StrategyChips, horizonLabel } from "@/components/pro/primitives";
import { BasisLabel, DisclaimerSlot, basisLabel } from "@core";
import { byId, useProStrategies } from "@/data/proStrategies";
import { useDisclaimer } from "@/data/disclosures";
import { usePreferences } from "@/hooks/usePreferences";

type Field = { label: string; get: (s: ProStrategy, capital: number) => string };

const FIELDS: Field[] = [
  { label: "Algorithm", get: (s) => s.algorithm },
  { label: "Chart time frame", get: (s) => s.time_frame ?? "—" },
  { label: "Horizon", get: (s) => horizonLabel(s.time_horizon) },
  { label: "Test period", get: (s) => formatTestWindow(s) },
  { label: "Starting capital", get: (s) => formatMoney(s.starting_capital) },
  { label: "Net profit", get: (s, c) => formatSignedCurrency(Math.round(scaledResults(s, c).netProfit)) },
  { label: "Cash profit", get: (s, c) => { const v = scaledResults(s, c).cashProfit; return v === null ? "—" : formatSignedCurrency(Math.round(v)); } },
  { label: "Asset accumulated", get: (s, c) => { const v = scaledResults(s, c).assetQty; return v === null ? "—" : `${formatQuantity(v, s.asset_class)} ${s.asset}`; } },
  { label: "Return", get: (s) => formatSignedPercent(s.return_pct) },
  { label: "CAGR", get: (s) => { const v = displayCagr(s); return v === null ? "—" : formatPercent(v); } },
  { label: "vs Buy & Hold", get: (s) => { const v = vsBuyHold(s); return v === null ? "—" : formatSignedPercent(v); } },
  { label: "vs DCA", get: (s) => { const v = vsDca(s); return v === null ? "—" : formatSignedPercent(v); } },
  { label: "Max drawdown", get: (s) => (s.max_drawdown_pct === null ? "—" : formatPercent(s.max_drawdown_pct)) },
  { label: "Basis", get: (s) => basisLabel(s) },
  { label: "Version", get: (s) => String(s.version_number) },
];

export default function Compare() {
  const { data, isLoading } = useProStrategies();
  const { compare, toggleCompare, viewCapital, setViewCapital } = usePreferences();
  const disclaimer = useDisclaimer("results");
  const picked = compare.map((id) => byId(data, id)).filter((s): s is ProStrategy => !!s);

  return (
    <ProLayout title="Compare">
      <div className="mb-6 flex flex-wrap items-end gap-4">
        <div className="flex-1">
          <h1 className="text-2xl font-extrabold tracking-[-0.02em] md:text-3xl">Compare</h1>
          <p className="mt-1 text-sm text-muted-foreground">Pick two to four strategies from the list with their Compare box.</p>
        </div>
        <div>
          <label htmlFor="compare-capital" className="eyebrow mb-1.5 block">
            Show figures at
          </label>
          <CapitalInput id="compare-capital" value={viewCapital} onChange={setViewCapital} className="w-44" />
        </div>
      </div>

      {isLoading ? (
        <div className="h-64 animate-pulse rounded-lg bg-muted" />
      ) : picked.length < 2 ? (
        <EmptyState title="Pick at least two strategies">
          <Link to="/" className="font-semibold text-primary hover:underline">
            Back to strategies
          </Link>
        </EmptyState>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border bg-card shadow-sm" data-results="compare">
          <table className="w-full min-w-[640px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="w-44 p-4 text-left align-bottom">
                  <span className="sr-only">Field</span>
                </th>
                {picked.map((s) => (
                  <th key={s.id} className="p-4 text-left align-top font-normal">
                    <div className="flex items-start gap-2">
                      <div className="min-w-0 flex-1 space-y-1.5">
                        <StrategyChips displayNumber={s.display_number} asset={s.asset} focus={s.focus} />
                        {typeof s.display_number === "number" ? (
                          <Link to={proStrategyPath(s.display_number)} className="block font-extrabold leading-snug hover:text-primary">
                            {s.title}
                          </Link>
                        ) : (
                          <span className="font-extrabold">{s.title}</span>
                        )}
                      </div>
                      <button type="button" onClick={() => toggleCompare(s.id)} className="rounded p-1 text-muted-foreground hover:bg-secondary" aria-label={`Remove ${s.title} from compare`}>
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {FIELDS.map((f) => (
                <tr key={f.label} className="border-b border-tile-border last:border-0">
                  <th scope="row" className="p-3 pl-4 text-left text-xs font-semibold text-muted-foreground">
                    {f.label}
                  </th>
                  {picked.map((s) => (
                    <td key={s.id} className="p-3 font-mono text-sm font-semibold tabular-nums">
                      {f.get(s, viewCapital)}
                    </td>
                  ))}
                </tr>
              ))}
              <tr>
                <td />
                {picked.map((s) => (
                  <td key={s.id} className="p-3">
                    <AddToPortfolioButton strategy={s} className="h-9" />
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
          <div className="space-y-1.5 border-t border-border p-4" data-disclosure="results">
            <div className="flex gap-2">
              {[...new Set(picked.map((s) => s.basis))].map((b) => (
                <BasisLabel key={b} basis={b} />
              ))}
            </div>
            <DisclaimerSlot text={disclaimer} />
          </div>
        </div>
      )}
    </ProLayout>
  );
}
