import type { Metadata } from "next";
import { AlertCapture } from "@/components/AlertCapture";
import { StickyActions } from "@/components/StickyActions";
import { StrategyList } from "@/components/StrategyList";
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
      <div className="container py-10">
        <h1 className="text-3xl sm:text-4xl">Strategies</h1>
        <p className="mt-2 max-w-2xl text-muted-foreground">
          Every published Arch Public strategy, with the result of its backtest. Enter your account size to see the dollar figures at your own amount.
        </p>
        <div className="mt-8">
          <StrategyList strategies={strategies} disclaimer={disclaimer} hidden={content.config.hiddenFields} scale={content.config.accountSize} />
        </div>
        {content.config.alerts && (
          <section className="mt-12 rounded-lg border border-border bg-card p-6" aria-labelledby="alerts-h">
            <h2 id="alerts-h" className="text-xl">Tell me when new strategies publish</h2>
            <p className="mt-1 text-sm text-muted-foreground">One email when a strategy publishes in the asset classes you choose.</p>
            <div className="mt-4">
              <AlertCapture consentText={content.booking.consentMarketing} privacyUrl={content.actions.privacyUrl} />
            </div>
          </section>
        )}
      </div>
      <StickyActions source="list" />
    </>
  );
}
