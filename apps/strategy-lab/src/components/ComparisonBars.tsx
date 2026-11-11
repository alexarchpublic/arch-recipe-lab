// The strategy's return beside the benchmarks it is compared with, drawn from
// the stored figures. Stands in for the chart until a cropped public chart
// image is published for the strategy (D9).
import { type PublicStrategy, formatSignedPercent, showsBuyHold, showsDca } from "@core";

export function ComparisonBars({ strategy: s, animate = true }: { strategy: PublicStrategy; animate?: boolean }) {
  const rows: Array<{ label: string; field: string; value: number; main?: boolean }> = [
    { label: s.short_name, field: "return_pct", value: s.return_pct, main: true },
  ];
  if (showsBuyHold(s) && s.buy_hold_pnl_pct !== null) rows.push({ label: `Buy and hold ${s.asset}`, field: "buy_hold_pnl_pct", value: s.buy_hold_pnl_pct });
  if (showsDca(s) && s.dca_pnl_pct !== null) rows.push({ label: `Buying ${s.asset} monthly`, field: "dca_pnl_pct", value: s.dca_pnl_pct });
  const max = Math.max(...rows.map((r) => Math.abs(r.value)), 1);
  const hasNeg = rows.some((r) => r.value < 0);
  return (
    <figure className="space-y-3" aria-label={`Return of ${s.short_name} against its benchmarks`} data-results={s.id} data-version={`v${s.version_number}`}>
      {rows.map((r) => {
        const w = (Math.abs(r.value) / max) * (hasNeg ? 50 : 100);
        return (
          <div key={r.field} className="space-y-1">
            <div className="flex items-baseline justify-between gap-2 text-xs">
              <span className={r.main ? "font-bold" : "text-muted-foreground"}>{r.label}</span>
              <span className={`font-mono font-semibold tabular-nums ${r.value < 0 ? "text-loss" : r.main ? "text-gain" : ""}`} data-field={r.field} data-raw={r.value}>{formatSignedPercent(r.value)}</span>
            </div>
            <div className="relative h-3 rounded-full bg-muted">
              {hasNeg && <span className="absolute inset-y-0 left-1/2 w-px bg-border-strong" aria-hidden />}
              <span
                className={`absolute inset-y-0 rounded-full ${r.value < 0 ? "bg-loss" : r.main ? "bg-primary" : "bg-border-strong"} ${animate ? "bar-grow" : ""}`}
                style={hasNeg ? (r.value < 0 ? { right: "50%", width: `${w}%` } : { left: "50%", width: `${w}%` }) : { left: 0, width: `${w}%` }}
              />
            </div>
          </div>
        );
      })}
      <figcaption className="text-[11px] text-muted-foreground">Total return over the test period, backtested.</figcaption>
    </figure>
  );
}
