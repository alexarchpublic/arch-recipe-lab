import type { Metadata } from "next";
import { AlertCapture } from "@/components/AlertCapture";
import { StickyActions } from "@/components/StickyActions";
import { StrategyCard } from "@/components/StrategyCard";
import { StrategyList } from "@/components/StrategyList";
import { displayCagr } from "@core";
import { listRow } from "@/lib/strategies";
import { getDisclaimer, getSiteContent, getStrategies } from "@/lib/data";
import { canonicalUrl } from "@/lib/env";

export const revalidate = 120;

export async function generateMetadata(): Promise<Metadata> {
  const strategies = await getStrategies().catch(() => []);
  const title = "All strategies · Strategy Lab | Arch Public";
  const description = `${strategies.length} algorithm strategies for stocks, ETFs and crypto, with backtested results and how each one trades.`;
  return { title, description, alternates: { canonical: canonicalUrl("/strategies") }, openGraph: { title, description, url: canonicalUrl("/strategies") } };
}

export default async function StrategiesPage() {
  const [strategies, content, disclaimer] = await Promise.all([getStrategies(), getSiteContent(), getDisclaimer()]);
  return (
    <>
      <section className="border-b border-line bg-card py-10 sm:py-14">
        <div className="container">
          <p className="kicker">The library</p>
          <h1 className="mt-3 text-[clamp(32px,3.8vw,52px)] font-black leading-[1.05] tracking-[-0.022em] text-navy">Every strategy, with its chart</h1>
          <p className="mt-3 max-w-[680px] text-lg leading-relaxed text-ink">
            All {strategies.length} published Arch Public strategies, each with its backtest chart and what it returned against simply holding the asset. Enter your account size to see the dollar figures at your own amount.
          </p>
        </div>
      </section>
      <div className="bg-surface">
      <div className="container py-10 sm:py-14">
        <StrategyList
          strategies={strategies.map((s) => listRow(s, displayCagr(s)))}
          cards={Object.fromEntries(
            strategies.map((s) => [s.id, <StrategyCard key={s.id} strategy={s} hidden={content.config.hiddenFields} marketTag={content.marketTags[s.slug]} />]),
          )}
          disclaimer={disclaimer}
          scale={content.config.accountSize}
          marketTags={content.marketTags}
        />
        {content.config.alerts && (
          <section className="mt-14 rounded-lg border border-line bg-card p-6 sm:p-8" aria-labelledby="alerts-h">
            <h2 id="alerts-h" className="text-[22px] font-extrabold text-navy">Tell me when new strategies publish</h2>
            <p className="mt-2 text-[15px] text-ink">One email when a strategy publishes in the asset classes you choose.</p>
            <div className="mt-4 max-w-md">
              <AlertCapture id="list" consentText={content.booking.consentMarketing} privacyUrl={content.actions.privacyUrl} />
            </div>
          </section>
        )}
      </div>
      </div>
      <StickyActions source="list" />
    </>
  );
}
