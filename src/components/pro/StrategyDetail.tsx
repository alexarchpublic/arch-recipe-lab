// Everything a client needs about one strategy (P7): results, assumptions,
// settings, source screenshots, version and change note. Used by the strategy
// page and by the admin console's Pro preview (A7).
import { useState, type ReactNode } from "react";
import { ExternalLink } from "lucide-react";
import {
  type ProStrategy,
  clientChangeNote,
  displayTestEnd,
  formatDate,
  formatMoney,
  formatTestWindow,
  scaleAlgorithmInputs,
  scaleFor,
  settingsForDisplay,
  settingsRows,
} from "@core";
import { Badge } from "@/components/ui/badge";
import { isLegacyAlgorithm } from "@/lib/algorithms";
import { StrategyResults } from "./StrategyResults";
import { SettingsList } from "./SettingsList";
import { SectionHeading, StrategyChips } from "./primitives";

const CHANGE_LABELS: Record<string, string> = {
  baseline: "First recorded version",
  initial: "First published version",
  figures: "Figures changed",
  settings: "Settings changed",
  copy: "Wording changed",
};

export function changeLabel(type: string | null | undefined): string {
  return (type && CHANGE_LABELS[type]) || "Updated";
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex gap-3 px-3 py-2 text-sm">
      <dt className="w-40 shrink-0 text-muted-foreground">{label}</dt>
      <dd className="min-w-0 flex-1 font-medium">{children}</dd>
    </div>
  );
}

export function StrategyDetail({
  strategy: s,
  capital,
  capitalControl,
  actions,
  disclaimer,
}: {
  strategy: ProStrategy;
  /** The capital figures and settings are shown at. */
  capital: number;
  /** The input that sets `capital`, placed above the results. */
  capitalControl?: ReactNode;
  /** Add to portfolio, copy link: absent in the admin preview. */
  actions?: ReactNode;
  disclaimer?: string;
}) {
  const factor = scaleFor(capital, s);
  const testEnd = displayTestEnd(s);
  const rows = settingsRows({
    algorithm: s.algorithm,
    inputs: scaleAlgorithmInputs(settingsForDisplay(s.algorithm_inputs, s.algorithm, testEnd), factor, s.algorithm),
    mode: "as_tested",
    asset: s.asset,
    assetClass: s.asset_class,
    timeFrame: s.time_frame,
  });
  const narrative = [
    { label: "How it trades", text: s.how_it_trades },
    { label: "In rising markets", text: s.up_market_behavior },
    { label: "In falling markets", text: s.down_market_behavior },
  ].filter((n) => n.text && n.text.trim());

  return (
    <article className="space-y-8" data-strategy={s.id} data-version={`v${s.version_number}`}>
      <header className="space-y-3">
        <StrategyChips displayNumber={s.display_number} asset={s.asset} assetClass={s.asset_class} focus={s.focus} horizon={s.time_horizon} />
        <h1 className="text-balance text-2xl font-extrabold leading-tight tracking-[-0.02em] md:text-3xl">{s.title}</h1>
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
          <span>{s.algorithm}</span>
          {isLegacyAlgorithm(s.algorithm) && <Badge variant="outline" className="text-[10px]">Legacy</Badge>}
          {s.time_frame && (
            <>
              <span aria-hidden>·</span>
              <span>{s.time_frame} chart</span>
            </>
          )}
          <span aria-hidden>·</span>
          <span>
            Version {s.version_number}, published {formatDate(s.published_at?.slice(0, 10))}
          </span>
          {s.archived_at && <Badge variant="outline">Archived</Badge>}
        </p>
        {actions && <div className="flex flex-wrap items-center gap-2 pt-1">{actions}</div>}
      </header>

      <section aria-labelledby="results-h">
        <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
          <SectionHeading id="results-h" className="mb-0">Results</SectionHeading>
          {capitalControl}
        </div>
        <StrategyResults strategy={s} capital={capital} disclaimer={disclaimer} />
      </section>

      {narrative.length > 0 && (
        <section aria-labelledby="how-h">
          <SectionHeading id="how-h">How it trades</SectionHeading>
          <div className="space-y-3">
            {narrative.map((n) => (
              <div key={n.label}>
                <h3 className="text-sm font-bold">{n.label}</h3>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{n.text}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      <section aria-labelledby="assumptions-h">
        <SectionHeading id="assumptions-h">Assumptions</SectionHeading>
        <dl className="divide-y divide-tile-border rounded-md border border-tile-border bg-card">
          <Row label="Test period">{formatTestWindow(s)}</Row>
          <Row label="Starting capital">{formatMoney(s.starting_capital)}</Row>
          <Row label="Basis">{s.basis === "live" ? "Live results" : "Backtest"}</Row>
          <Row label="Fees and slippage">{s.fees_slippage?.trim() || "Not stated"}</Row>
          <Row label="Data source">{s.data_source}</Row>
          <Row label="As of">{formatDate(s.as_of)}</Row>
        </dl>
      </section>

      <section aria-labelledby="settings-h">
        <SectionHeading id="settings-h">Settings</SectionHeading>
        <p className="mb-3 text-sm text-muted-foreground">
          As tested, with dollar amounts scaled to {formatMoney(capital)}. When you apply a strategy from a portfolio, the
          start date is today and you set the end date in the future.
        </p>
        <SettingsList rows={rows} />
      </section>

      {s.screenshots.length > 0 && (
        <section aria-labelledby="shots-h">
          <SectionHeading id="shots-h">Source screenshots</SectionHeading>
          <Screenshots strategy={s} />
        </section>
      )}

      <section aria-labelledby="version-h">
        <SectionHeading id="version-h">Version</SectionHeading>
        <dl className="divide-y divide-tile-border rounded-md border border-tile-border bg-card">
          <Row label="Version">{s.version_number}</Row>
          <Row label="Published">{formatDate(s.published_at?.slice(0, 10))}</Row>
          <Row label="Change">{changeLabel(s.change_type)}</Row>
          {clientChangeNote(s) && <Row label="Note">{clientChangeNote(s)}</Row>}
        </dl>
      </section>
    </article>
  );
}

function Screenshots({ strategy: s }: { strategy: ProStrategy }) {
  const [current, setCurrent] = useState(0);
  const shot = s.screenshots[current];
  return (
    <div className="space-y-3">
      <a
        href={shot.url}
        target="_blank"
        rel="noreferrer"
        className="group relative block overflow-hidden rounded-lg border border-border bg-navy"
      >
        <img src={shot.url} alt={`${s.short_name}: ${shot.kind ?? "screenshot"} ${current + 1}`} className="max-h-[520px] w-full object-contain" />
        <span className="absolute right-2 top-2 inline-flex items-center gap-1 rounded-md bg-black/60 px-2 py-1 text-[11px] font-semibold text-white opacity-0 transition-opacity group-hover:opacity-100">
          Open full size <ExternalLink className="h-3 w-3" />
        </span>
      </a>
      {s.screenshots.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {s.screenshots.map((x, i) => (
            <button
              key={x.id}
              type="button"
              onClick={() => setCurrent(i)}
              className={
                "h-16 w-28 shrink-0 overflow-hidden rounded-md border-2 bg-navy " +
                (i === current ? "border-primary" : "border-transparent opacity-70 hover:opacity-100")
              }
              aria-label={`Show ${x.kind ?? "screenshot"} ${i + 1}`}
            >
              <img src={x.url} alt="" className="h-full w-full object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
