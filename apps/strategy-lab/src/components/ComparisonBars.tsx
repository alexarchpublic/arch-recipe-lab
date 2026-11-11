// The strategy's return beside the benchmarks it is compared with, drawn from
// the stored figures (nothing computed here). Bar widths are relative to the
// largest value shown; a negative value is a red bar, a positive benchmark a
// grey one. Every printed figure carries its store field for the parity check.
import { type PublicStrategy, displayCagr, formatPercent, formatSignedPercent, showsBuyHold, showsDca } from "@core";

type Row = { label: string; field: string; value: number; main?: boolean };

/** The strategy, then each benchmark the store shows for it. */
export function comparisonRows(s: PublicStrategy, { oneBenchmark = false, mainLabel }: { oneBenchmark?: boolean; mainLabel?: string } = {}): Row[] {
  const rows: Row[] = [{ label: mainLabel ?? s.short_name, field: "return_pct", value: s.return_pct, main: true }];
  if (showsBuyHold(s) && s.buy_hold_pnl_pct !== null) rows.push({ label: `Buy and hold ${s.asset}`, field: "buy_hold_pnl_pct", value: s.buy_hold_pnl_pct });
  if (showsDca(s) && s.dca_pnl_pct !== null) rows.push({ label: `Buying ${s.asset} monthly`, field: "dca_pnl_pct", value: s.dca_pnl_pct });
  return oneBenchmark ? rows.slice(0, 2) : rows;
}

const SIZES = {
  card: { label: "text-[13px]", value: "text-lg", bar: "h-2", gap: "gap-2.5", mt: "mt-1" },
  hero: { label: "text-sm", value: "text-[26px]", bar: "h-3", gap: "gap-3.5", mt: "mt-1.5" },
  page: { label: "text-[15px]", value: "text-lg", bar: "h-3", gap: "gap-4", mt: "mt-1.5" },
} as const;

export function ComparisonBars({
  strategy: s,
  variant = "page",
  oneBenchmark = false,
  mainLabel,
  showCagrWhenAlone = false,
  animate = true,
}: {
  strategy: PublicStrategy;
  variant?: keyof typeof SIZES;
  /** Cards and the hero: the strategy and one benchmark, buy and hold first. */
  oneBenchmark?: boolean;
  mainLabel?: string;
  /** With no benchmark shown, print CAGR as a plain figure under the bar (cards). */
  showCagrWhenAlone?: boolean;
  animate?: boolean;
}) {
  const rows = comparisonRows(s, { oneBenchmark, mainLabel });
  const sz = SIZES[variant];
  const max = Math.max(...rows.map((r) => Math.abs(r.value)), 1e-9);
  const cagr = displayCagr(s);
  return (
    <div className={`flex flex-col ${sz.gap}`} aria-label={`Return of ${s.short_name} against its benchmarks`} role="group">
      {rows.map((r) => {
        const width = Math.max((Math.abs(r.value) / max) * 100, r.value === 0 ? 0 : 1.5);
        const tone = r.value < 0 ? "text-loss" : r.main && r.value > 0 ? "text-gain" : "text-navy";
        const bar = r.value < 0 ? "bg-bar-loss" : r.main ? "bg-bar-gain" : "bg-bar-bench";
        return (
          <div key={r.field}>
            <div className="flex items-baseline justify-between gap-3">
              <span className={`${sz.label} ${r.main ? "font-bold text-navy" : "font-semibold text-ink-muted"}`}>{r.label}</span>
              <span className={`font-mono ${sz.value} font-semibold tabular-nums ${tone}`} data-field={r.field} data-raw={r.value}>
                {formatSignedPercent(r.value)}
              </span>
            </div>
            <div className={`${sz.mt} ${sz.bar} rounded-full bg-surface`}>
              <div className={`${sz.bar} rounded-full ${bar} ${animate ? "bar-grow" : ""}`} style={{ width: `${width}%` }} />
            </div>
          </div>
        );
      })}
      {showCagrWhenAlone && rows.length === 1 && cagr !== null && (
        <p className="flex items-baseline justify-between gap-3 text-[13px] font-semibold text-ink-muted">
          <span>CAGR</span>
          <span className="font-mono text-lg font-semibold tabular-nums text-navy" data-field="cagr_pct" data-raw={cagr}>
            {formatPercent(cagr)}
          </span>
        </p>
      )}
    </div>
  );
}
