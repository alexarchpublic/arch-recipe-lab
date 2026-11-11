// A strategy's public page (PRD 9, "Strategy page"; S6, S7, S9; redesign PRD
// section 5). Results and mechanism, never settings. The chart leads.
// Server-rendered at a readable address and regenerated after each publish.
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  type PublicStrategy,
  DisclaimerSlot,
  basisLabel,
  displayCagr,
  displayTestEnd,
  formatDate,
  formatMoney,
  formatPercent,
  formatSignedPercent,
  formatTestWindow,
  showsBuyHold,
  showsDca,
} from "@core";
import { AccountSize } from "@/components/AccountSize";
import { AlertCapture } from "@/components/AlertCapture";
import { BookDemoButton, StartFreeLink } from "@/components/Booking";
import { CaseStudyLinks } from "@/components/CaseStudyLinks";
import { PageChart } from "@/components/Chart";
import { ComparisonBars } from "@/components/ComparisonBars";
import { EmailMeThis } from "@/components/EmailMeThis";
import { ResultsBlock } from "@/components/ResultsBlock";
import { SettingsLabel } from "@/components/SettingsLabel";
import { StickyActions } from "@/components/StickyActions";
import { Chip, MarketChip, StrategyCard } from "@/components/StrategyCard";
import { ViewTracker } from "@/components/ViewTracker";
import { getCaseStudyLinks } from "@/lib/caseStudies";
import { getDisclaimer, getSiteContent, getStrategies, getStrategy } from "@/lib/data";
import { canonicalUrl } from "@/lib/env";
import { assetClassLabel, chartFields, focusHelp, focusLabel, horizonLabel, relatedStrategies, testLength } from "@/lib/strategies";

export const revalidate = 120;
export const dynamicParams = true;

export async function generateStaticParams() {
  try {
    return (await getStrategies()).map((s) => ({ slug: s.slug }));
  } catch {
    return [];
  }
}

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const s = await getStrategy(slug).catch(() => null);
  if (!s) return { title: "Strategy not found · Strategy Lab", robots: { index: false } };
  const title = `${s.title} · ${s.asset} strategy | Arch Public Strategy Lab`;
  const description = `How Arch Public's ${s.short_name} strategy trades ${s.asset}, with its backtest chart, its results against ${s.benchmark_shown === "none" ? "its starting capital" : "its benchmark"} and what it would have done at your account size.`;
  return {
    title,
    description,
    alternates: { canonical: canonicalUrl(`/${s.slug}`) },
    openGraph: { title: s.title, description, url: canonicalUrl(`/${s.slug}`), type: "article" },
  };
}

const h2 = "text-[26px] font-extrabold tracking-[-0.02em] text-navy sm:text-[28px]";

/** Up to four large tiles: strategy return, each benchmark shown, CAGR (or test length under a year). */
function HeadlineTiles({ s, hidden }: { s: PublicStrategy; hidden: string[] }) {
  const show = (f: string) => !hidden.includes(f);
  const cagr = displayCagr(s);
  const shortTest = cagr === null && !!displayTestEnd(s) && s.test_years < 1;
  const tone = (v: number) => (v < 0 ? "text-loss" : "text-navy");
  const tile = "min-w-0 flex-[1_1_200px] rounded-lg px-6 py-5";
  const label = "text-[11px] font-bold uppercase tracking-[0.08em]";
  const value = "mt-2 font-mono text-[30px] font-semibold leading-[1.1] tabular-nums sm:text-[36px]";
  return (
    <div className="mt-7 flex flex-wrap gap-4" data-results={s.id} data-version={`v${s.version_number}`} data-slug={s.slug}>
      {show("return_pct") && (
        <div className={`${tile} bg-navy`}>
          <p className={`${label} text-on-navy`}>Strategy return</p>
          <p className={`${value} ${s.return_pct < 0 ? "text-[#FF9EA1]" : "text-gain-on-navy"}`} data-field="return_pct" data-raw={s.return_pct}>
            {formatSignedPercent(s.return_pct)}
          </p>
        </div>
      )}
      {showsBuyHold(s) && s.buy_hold_pnl_pct !== null && show("buy_hold_pnl_pct") && (
        <div className={`${tile} bg-surface`}>
          <p className={`${label} text-ink-muted`}>Buy and hold {s.asset}</p>
          <p className={`${value} ${tone(s.buy_hold_pnl_pct)}`} data-field="buy_hold_pnl_pct" data-raw={s.buy_hold_pnl_pct}>
            {formatSignedPercent(s.buy_hold_pnl_pct)}
          </p>
        </div>
      )}
      {showsDca(s) && s.dca_pnl_pct !== null && show("dca_pnl_pct") && (
        <div className={`${tile} bg-surface`}>
          <p className={`${label} text-ink-muted`}>Buying {s.asset} monthly</p>
          <p className={`${value} ${tone(s.dca_pnl_pct)}`} data-field="dca_pnl_pct" data-raw={s.dca_pnl_pct}>
            {formatSignedPercent(s.dca_pnl_pct)}
          </p>
        </div>
      )}
      {cagr !== null && show("cagr_pct") && (
        <div className={`${tile} bg-surface`}>
          <p className={`${label} text-ink-muted`}>CAGR</p>
          <p className={`${value} text-navy`} data-field="cagr_pct" data-raw={cagr}>
            {formatPercent(cagr)}
          </p>
        </div>
      )}
      {shortTest && (
        <div className={`${tile} bg-surface`}>
          <p className={`${label} text-ink-muted`}>Test length</p>
          <p className={`${value} text-navy`} data-field="test_years" data-raw={s.test_years}>
            {testLength(s.test_years)}
          </p>
          <p className="mt-1 text-xs text-ink-muted">CAGR not shown under a year</p>
        </div>
      )}
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="bg-card px-5 py-3.5">
      <dt className="text-[11px] font-bold uppercase tracking-[0.08em] text-ink-muted">{label}</dt>
      <dd className="mt-1 text-[15px] font-bold text-navy">{children}</dd>
    </div>
  );
}

export default async function StrategyPage({ params }: Props) {
  const { slug } = await params;
  const [all, content, disclaimer, studies] = await Promise.all([getStrategies(), getSiteContent(), getDisclaimer(), getCaseStudyLinks()]);
  const s = all.find((x) => x.slug === slug);
  if (!s) notFound();
  const caseStudies = s.display_number !== null ? studies.get(s.display_number) ?? [] : [];
  const related = relatedStrategies(all, s, 3);
  const cfg = content.config;
  const tag = content.marketTags[s.slug];
  // best_for is not shown: Recipe Lab, the source of truth, does not display it,
  // and some values are truncated in the source (PRD 2, "Best for: Th").
  const goal = s.goal && s.goal !== s.title ? s.goal : null;
  const narrative = [
    { label: "How it trades", text: s.how_it_trades },
    { label: "In rising markets", text: s.up_market_behavior },
    { label: "In falling markets", text: s.down_market_behavior },
  ].filter((n) => n.text?.trim());
  const showHow = !cfg.requireNarrative || narrative.length > 0;

  // Main blocks in order; the side panel follows block 5 on phones and sits
  // beside all of them, sticky, on desktop.
  const blocks: Array<{ key: string; node: React.ReactNode }> = [];
  if (s.chart_url) {
    blocks.push({
      key: "chart",
      node: (
        <section aria-labelledby="chart-h">
          <h2 id="chart-h" className={h2}>The chart</h2>
          <p className="mt-2 text-base leading-relaxed text-ink">Every trade from the backtest, straight from TradingView.</p>
          <PageChart s={chartFields(s)} />
        </section>
      ),
    });
  }
  if (!cfg.hiddenFields.includes("return_pct")) {
    blocks.push({
      key: "bench",
      node: (
        <section aria-labelledby="bench-h">
          <h2 id="bench-h" className={h2}>{s.benchmark_shown === "none" ? "The result" : "Against its benchmarks"}</h2>
          <div className="mt-4 flex flex-col gap-4 rounded-lg border border-line p-6" data-results={s.id} data-version={`v${s.version_number}`} data-slug={s.slug}>
            <ComparisonBars strategy={s} variant="page" />
            <p className="text-xs text-ink-muted">Total return over the test period, {basisLabel(s).replace(/ results$/, "").toLowerCase()}.</p>
            <DisclaimerSlot text={disclaimer} className="!-mt-3 !text-xs !text-ink-muted" />
          </div>
        </section>
      ),
    });
  }
  blocks.push({
    key: "results",
    node: (
      <section aria-labelledby="results-h">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <h2 id="results-h" className={h2}>{cfg.accountSize ? "Results at your account size" : "Results"}</h2>
          {cfg.accountSize && <AccountSize strategy={s.slug} variant="stacked" />}
        </div>
        <div className="mt-4">
          <ResultsBlock strategy={s} hidden={cfg.hiddenFields} variant="page" scale={cfg.accountSize} />
        </div>
        {cfg.accountSize && cfg.emailMeThis && (
          <div className="mt-4">
            <EmailMeThis slug={s.slug} startingCapital={s.starting_capital} consentText={content.booking.consentMarketing} privacyUrl={content.actions.privacyUrl} source="strategy" boxed />
          </div>
        )}
      </section>
    ),
  });
  const asideAfter = blocks.length; // the side panel goes here on phones
  if (caseStudies.length) {
    blocks.push({ key: "case", node: <CaseStudyLinks links={caseStudies} short={`Strategy #${s.display_number}, ${s.short_name},`} /> });
  }
  if (showHow) {
    blocks.push({
      key: "how",
      node: (
        <section aria-labelledby="how-h">
          <h2 id="how-h" className={h2}>How it trades</h2>
          {narrative.length > 0 && (
            <div className="mt-4 space-y-4">
              {narrative.map((n) => (
                <div key={n.label}>
                  <h3 className="text-base font-extrabold text-navy">{n.label}</h3>
                  <p className="mt-1 text-base leading-relaxed text-ink">{n.text}</p>
                </div>
              ))}
            </div>
          )}
          <dl className="mt-4 grid gap-px overflow-hidden rounded-lg border border-line bg-line sm:grid-cols-2">
            <Row label="Algorithm">{s.algorithm}</Row>
            <Row label="Chart">{s.time_frame ?? "Not stated"}</Row>
            <Row label="Horizon">{horizonLabel(s.time_horizon)}</Row>
            <Row label="Aim">{focusLabel(s.focus)}: {focusHelp[s.focus]?.toLowerCase()}</Row>
            <Row label="Test period">{formatTestWindow(s)}</Row>
            <Row label="Starting capital"><span data-field="starting_capital" data-raw={s.starting_capital}>{formatMoney(s.starting_capital)}</span></Row>
            <Row label="Fees and slippage">{s.fees_slippage?.trim() || "Not stated"}</Row>
            <Row label="Data source">{s.data_source}</Row>
          </dl>
        </section>
      ),
    });
  }
  blocks.push({ key: "pro", node: <SettingsLabel slug={s.slug} id={s.id} /> });
  if (related.length) {
    blocks.push({
      key: "related",
      node: (
        <section aria-labelledby="related-h">
          <h2 id="related-h" className={h2}>Similar strategies</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {related.map((r) => (
              <StrategyCard key={r.id} strategy={r} hidden={cfg.hiddenFields} marketTag={content.marketTags[r.slug]} compact />
            ))}
          </div>
        </section>
      ),
    });
  }

  const aside = (
    <aside key="aside" id="talk" className="min-w-0 lg:col-start-2 lg:[grid-row:1/span_var(--rows)]" aria-label="Talk it through">
      <div className="flex flex-col gap-4 lg:sticky lg:top-24">
        <div className="rounded-lg border border-line bg-card p-7 shadow-panel">
          <h2 className="text-[22px] font-extrabold text-navy">Talk it through</h2>
          <p className="mt-2 text-[15px] leading-relaxed text-ink">A 30-minute demo of this strategy, live, at the account size you have in mind.</p>
          <div className="mt-5 flex flex-col gap-2.5">
            <BookDemoButton strategy={s.slug} source="strategy-aside" className="!min-h-[52px] w-full !text-[15px]">
              Book a demo about this strategy
            </BookDemoButton>
            <StartFreeLink strategy={s.slug} source="strategy-aside" className="!min-h-[52px] w-full !text-[15px]" />
          </div>
        </div>
        {cfg.alerts && (
          <div className="rounded-lg border border-line bg-surface p-6">
            <h2 className="text-base font-extrabold text-navy">New {s.asset_class === "ETFs" ? "ETF" : assetClassLabel(s.asset_class).toLowerCase()} strategies by email</h2>
            <div className="mt-3.5">
              <AlertCapture id="aside" defaultClasses={[s.asset_class]} consentText={content.booking.consentMarketing} privacyUrl={content.actions.privacyUrl} />
            </div>
          </div>
        )}
      </div>
    </aside>
  );

  const ordered: React.ReactNode[] = [];
  blocks.forEach((b, i) => {
    if (i === asideAfter) ordered.push(aside);
    ordered.push(
      <div key={b.key} className="min-w-0 lg:col-start-1">
        {b.node}
      </div>,
    );
  });
  if (asideAfter >= blocks.length) ordered.push(aside);

  return (
    <>
      <ViewTracker slug={s.slug} id={s.id} version={s.version_number} assetClass={s.asset_class} />
      <section className="border-b border-line bg-card py-10">
        <div className="container">
          <nav className="text-[13px] text-ink-muted" aria-label="Breadcrumb">
            <Link href="/" className="text-primary hover:underline">Strategy Lab</Link> <span aria-hidden>/</span>{" "}
            <Link href="/strategies" className="text-primary hover:underline">Strategies</Link> <span aria-hidden>/</span>{" "}
            <Link href={`/strategies?class=${s.asset_class}`} className="text-primary hover:underline">{assetClassLabel(s.asset_class)}</Link>
          </nav>
          <div className="mt-3.5 flex flex-wrap gap-1.5">
            <MarketChip tag={tag} />
            <Chip>{s.asset}</Chip>
            <Chip>{assetClassLabel(s.asset_class)}</Chip>
            <Chip>{focusLabel(s.focus)}</Chip>
            <Chip>{horizonLabel(s.time_horizon)}</Chip>
          </div>
          <h1 className="mt-3.5 max-w-[860px] text-[clamp(32px,3.8vw,52px)] font-black leading-[1.05] tracking-[-0.022em] text-navy">{s.title}</h1>
          <p className="mt-2.5 text-[15px] text-ink-muted">
            Strategy #{s.display_number} · {s.short_name} · {s.algorithm}
            {s.time_frame ? ` · ${s.time_frame} chart` : ""}
          </p>
          {goal && <p className="mt-2 max-w-3xl text-base text-ink">{goal}</p>}
          <p className="mt-3 text-[13px] text-ink-muted" data-disclosure="results">
            <span data-disclosure="basis" data-basis={s.basis} className="mr-1 inline-block rounded-full bg-tint px-2 py-0.5 text-xs font-bold text-tint-ink">
              {basisLabel(s).replace(/ results$/, "")}
            </span>{" "}
            As of {formatDate(s.as_of)} · <span data-field="test_window">{formatTestWindow(s)}</span> ·{" "}
            <span>{formatMoney(s.starting_capital)}</span> starting capital
          </p>
          <HeadlineTiles s={s} hidden={cfg.hiddenFields} />
        </div>
      </section>

      <div className="bg-card">
        <div
          className="container grid gap-14 pb-24 pt-14 lg:grid-cols-[minmax(0,1fr)_330px] lg:gap-x-12"
          style={{ ["--rows" as string]: String(blocks.length) }}
        >
          {ordered}
        </div>
      </div>
      <StickyActions strategy={s.slug} source="strategy" />
    </>
  );
}
