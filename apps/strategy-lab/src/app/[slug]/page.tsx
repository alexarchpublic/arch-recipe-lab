// A strategy's public page (PRD 9, "Strategy page"; S6, S7, S9). Results and
// mechanism, never settings. Server-rendered at a readable address and
// regenerated after each publish.
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BasisLabel, formatDate, formatMoney, formatTestWindow } from "@core";
import { AccountSize } from "@/components/AccountSize";
import { AlertCapture } from "@/components/AlertCapture";
import { BookDemoButton, StartFreeLink } from "@/components/Booking";
import { ComparisonBars } from "@/components/ComparisonBars";
import { EmailMeThis } from "@/components/EmailMeThis";
import { ResultsBlock } from "@/components/ResultsBlock";
import { SettingsLabel } from "@/components/SettingsLabel";
import { StickyActions } from "@/components/StickyActions";
import { Chip, StrategyCard } from "@/components/StrategyCard";
import { ViewTracker } from "@/components/ViewTracker";
import { getDisclaimer, getSiteContent, getStrategies, getStrategy } from "@/lib/data";
import { canonicalUrl } from "@/lib/env";
import { assetClassLabel, focusHelp, focusLabel, horizonLabel, relatedStrategies } from "@/lib/strategies";

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
  const description = `How Arch Public's ${s.short_name} strategy trades ${s.asset}, with its backtested results against ${s.benchmark_shown === "none" ? "its starting capital" : "its benchmark"} and what it would have done at your account size.`;
  return {
    title,
    description,
    alternates: { canonical: canonicalUrl(`/${s.slug}`) },
    openGraph: { title: s.title, description, url: canonicalUrl(`/${s.slug}`), type: "article" },
  };
}

export default async function StrategyPage({ params }: Props) {
  const { slug } = await params;
  const [all, content, disclaimer] = await Promise.all([getStrategies(), getSiteContent(), getDisclaimer()]);
  const s = all.find((x) => x.slug === slug);
  if (!s) notFound();
  const related = relatedStrategies(all, s, 3);
  const cfg = content.config;
  // best_for is not shown: Recipe Lab, the source of truth, does not display it,
  // and some values are truncated in the source (PRD 2, "Best for: Th").
  const summary = [s.goal && s.goal !== s.title ? s.goal : null].filter(Boolean) as string[];
  const narrative = [
    { label: "How it trades", text: s.how_it_trades },
    { label: "In rising markets", text: s.up_market_behavior },
    { label: "In falling markets", text: s.down_market_behavior },
  ].filter((n) => n.text?.trim());

  return (
    <>
      <ViewTracker slug={s.slug} id={s.id} version={s.version_number} assetClass={s.asset_class} />
      <div className="border-b border-border bg-card">
        <div className="container py-8">
          <nav className="text-xs text-muted-foreground" aria-label="Breadcrumb">
            <Link href="/" className="hover:text-primary">Strategy Lab</Link> <span aria-hidden>/</span>{" "}
            <Link href="/strategies" className="hover:text-primary">Strategies</Link> <span aria-hidden>/</span>{" "}
            <Link href={`/strategies?class=${s.asset_class}`} className="hover:text-primary">{assetClassLabel(s.asset_class)}</Link>
          </nav>
          <div className="mt-3 flex flex-wrap gap-1.5">
            <Chip>{s.asset}</Chip>
            <Chip>{assetClassLabel(s.asset_class)}</Chip>
            <Chip>{focusLabel(s.focus)}</Chip>
            <Chip>{horizonLabel(s.time_horizon)}</Chip>
          </div>
          <h1 className="mt-3 max-w-3xl text-3xl leading-tight sm:text-4xl">{s.title}</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Strategy #{s.display_number} · {s.short_name} · {s.algorithm}
            {s.time_frame ? ` · ${s.time_frame} chart` : ""}
          </p>
          {summary.map((line) => (
            <p key={line} className="mt-2 max-w-3xl text-base">{line}</p>
          ))}
          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <BasisLabel basis={s.basis} />
            <span>As of {formatDate(s.as_of)}</span>
          </div>
        </div>
      </div>

      <div className="container grid gap-10 py-10 lg:grid-cols-[1fr_320px]">
        <div className="min-w-0 space-y-10">
          <section aria-labelledby="results-h">
            <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
              <h2 id="results-h" className="text-xl">Results</h2>
              {cfg.accountSize && <AccountSize strategy={s.slug} compact />}
            </div>
            <ResultsBlock strategy={s} disclaimer={disclaimer} hidden={cfg.hiddenFields} scale={cfg.accountSize} />
            {cfg.accountSize && cfg.emailMeThis && (
              <div className="mt-4">
                <EmailMeThis slug={s.slug} startingCapital={s.starting_capital} consentText={content.booking.consentMarketing} privacyUrl={content.actions.privacyUrl} />
              </div>
            )}
          </section>

          <section aria-labelledby="chart-h">
            <h2 id="chart-h" className="mb-3 text-xl">{s.public_chart_url ? "Chart" : "Against its benchmark"}</h2>
            {s.public_chart_url ? (
              // The cropped public derivative, without the settings header (D9, S9).
              <img src={s.public_chart_url} alt={`Backtest chart of ${s.short_name} on ${s.asset}`} className="w-full rounded-lg border border-border bg-card" loading="lazy" />
            ) : (
              <div className="rounded-lg border border-border bg-card p-5">
                <ComparisonBars strategy={s} />
              </div>
            )}
          </section>

          <section aria-labelledby="how-h">
            <h2 id="how-h" className="mb-3 text-xl">How it trades</h2>
            {narrative.length > 0 && (
              <div className="mb-4 space-y-3">
                {narrative.map((n) => (
                  <div key={n.label}>
                    <h3 className="text-sm font-bold">{n.label}</h3>
                    <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{n.text}</p>
                  </div>
                ))}
              </div>
            )}
            <dl className="grid gap-px overflow-hidden rounded-lg border border-border bg-border sm:grid-cols-2">
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

          <SettingsLabel slug={s.slug} id={s.id} />

          {related.length > 0 && (
            <section aria-labelledby="related-h">
              <h2 id="related-h" className="mb-3 text-xl">Similar strategies</h2>
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {related.map((r) => (
                  <StrategyCard key={r.id} strategy={r} disclaimer={disclaimer} hidden={cfg.hiddenFields} scale={cfg.accountSize} />
                ))}
              </div>
            </section>
          )}
        </div>

        <aside className="space-y-4 lg:sticky lg:top-20 lg:self-start">
          <div className="rounded-lg border border-border bg-card p-5 shadow-sm">
            <p className="text-base font-extrabold">Talk it through</p>
            <p className="mt-1 text-sm text-muted-foreground">A 30-minute demo of this strategy, live, at the account size you have in mind.</p>
            <div className="mt-4 flex flex-col gap-2">
              <BookDemoButton strategy={s.slug} source="strategy-aside">Book a demo about this strategy</BookDemoButton>
              <StartFreeLink strategy={s.slug} source="strategy-aside" />
            </div>
          </div>
          {cfg.alerts && (
            <div className="rounded-lg border border-border bg-muted p-5">
              <p className="text-sm font-extrabold">New {s.asset_class === "ETFs" ? "ETF" : assetClassLabel(s.asset_class).toLowerCase()} strategies by email</p>
              <div className="mt-3">
                <AlertCapture defaultClasses={[s.asset_class]} consentText={content.booking.consentMarketing} privacyUrl={content.actions.privacyUrl} />
              </div>
            </div>
          )}
        </aside>
      </div>
      <StickyActions strategy={s.slug} source="strategy" />
    </>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="bg-card px-4 py-3">
      <dt className="eyebrow">{label}</dt>
      <dd className="mt-0.5 text-sm font-semibold">{children}</dd>
    </div>
  );
}
