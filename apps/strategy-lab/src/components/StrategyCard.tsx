// A strategy in a list (redesign PRD section 6): its chart, chips, title, the
// strategy's return beside one benchmark, and the disclosure line. One card
// serves the home page, the list page, similar strategies and partner pages.
import Link from "@/components/Link";
import { type MarketTag, MARKET_TAG_LABELS, type PublicStrategy, basisLabel, formatTestWindow } from "@core";
import { assetClassLabel, chartFields, focusLabel } from "@/lib/strategies";
import { ArrowRight, CardChart } from "./Chart";
import { ComparisonBars } from "./ComparisonBars";

export function Chip({ children }: { children: React.ReactNode }) {
  return <span className="inline-flex items-center rounded-full bg-tint px-2.5 py-[3px] text-xs font-bold text-navy">{children}</span>;
}

const MARKET_CHIP: Record<MarketTag, string> = {
  falling: "bg-market-falling-bg text-market-falling-fg",
  sideways: "bg-market-sideways-bg text-market-sideways-fg",
  rising: "bg-market-rising-bg text-market-rising-fg",
  volatile: "bg-market-volatile-bg text-market-volatile-fg",
};

export function MarketChip({ tag }: { tag?: MarketTag | null }) {
  if (!tag) return null;
  return <span className={`inline-flex items-center rounded-full px-2.5 py-[3px] text-xs font-extrabold ${MARKET_CHIP[tag]}`}>{MARKET_TAG_LABELS[tag]}</span>;
}

/** "Backtested · 1 Jun 2018 – 1 Apr 2022": basis and test window, from the store. */
export function DisclosureLine({ s, className = "" }: { s: PublicStrategy; className?: string }) {
  return (
    <p className={`text-xs text-ink-muted ${className}`} data-disclosure="results">
      <span data-disclosure="basis" data-basis={s.basis}>{basisLabel(s).replace(/ results$/, "")}</span> ·{" "}
      <span data-field="test_window">{formatTestWindow(s)}</span>
    </p>
  );
}

export function StrategyCard({
  strategy: s,
  hidden = [],
  marketTag,
  eager = false,
  compact = false,
}: {
  strategy: PublicStrategy;
  hidden?: string[];
  marketTag?: MarketTag | null;
  /** First row of a list: load the chart without waiting. */
  eager?: boolean;
  /** Similar strategies: smaller type. */
  compact?: boolean;
}) {
  return (
    // content-visibility: cards off screen skip layout and paint until scrolled to (list page: 60+ cards).
    <article className="group relative flex h-full min-w-0 flex-col overflow-hidden rounded-lg border border-line bg-card shadow-card transition [contain-intrinsic-size:auto_640px] [content-visibility:auto] hover:shadow-card-hover">
      <CardChart s={chartFields(s)} eager={eager} />
      <div className={`flex flex-1 flex-col gap-3.5 ${compact ? "p-[18px]" : "p-6"}`}>
        <div className="flex flex-wrap gap-1.5">
          <MarketChip tag={marketTag} />
          <Chip>{s.asset}</Chip>
          <Chip>{assetClassLabel(s.asset_class)}</Chip>
          <Chip>{focusLabel(s.focus)}</Chip>
        </div>
        <div>
          <h3 className={`${compact ? "text-base" : "text-xl"} font-extrabold leading-tight text-navy`}>
            <Link href={`/${s.slug}`} className="after:absolute after:inset-0 after:rounded-lg hover:text-primary">
              {s.title}
            </Link>
          </h3>
          <p className="mt-1 text-[13px] text-ink-muted">
            Strategy #{s.display_number} · {s.algorithm}
            {s.time_frame ? ` · ${s.time_frame} chart` : ""}
          </p>
        </div>
        <div data-results={s.id} data-version={`v${s.version_number}`} data-slug={s.slug}>
          {!hidden.includes("return_pct") && (
            <ComparisonBars strategy={s} variant="card" oneBenchmark mainLabel="Strategy" showCagrWhenAlone={!hidden.includes("cagr_pct")} animate={false} />
          )}
          <DisclosureLine s={s} className={hidden.includes("return_pct") ? "" : "mt-3.5"} />
        </div>
        <span className="mt-auto inline-flex min-h-[44px] items-center gap-1.5 text-[15px] font-extrabold text-primary" aria-hidden="true">
          View strategy
          <ArrowRight className="h-4 w-4" />
        </span>
      </div>
    </article>
  );
}
