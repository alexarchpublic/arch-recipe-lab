import { Link } from "react-router-dom";
import { CONCIERGE_URL, WALKTHROUGH_VIDEO_URL } from "@core";
import { ProLayout } from "@/components/pro/ProLayout";

function Q({ q, children, id }: { q: string; children: React.ReactNode; id?: string }) {
  return (
    <section id={id} className="scroll-mt-24 rounded-lg border border-border bg-card p-5 shadow-sm">
      <h2 className="text-base font-extrabold tracking-[-0.02em]">{q}</h2>
      <div className="mt-2 space-y-2 text-sm leading-relaxed text-muted-foreground">{children}</div>
    </section>
  );
}

export default function Help() {
  return (
    <ProLayout title="Help">
      <div className="mx-auto max-w-3xl space-y-4">
        <header className="mb-2">
          <h1 className="text-2xl font-extrabold tracking-[-0.02em] md:text-3xl">Help</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Strategy Lab Pro comes with every Arch Public client account, the free tier included.
          </p>
        </header>

        <Q q="How it works">
          <ol className="list-decimal space-y-1 pl-5">
            <li>
              <strong className="text-foreground">Choose.</strong> Browse <Link className="text-primary hover:underline" to="/">strategies</Link>, filter by
              asset, focus and algorithm, and open any strategy for its results, assumptions, settings and screenshots.
            </li>
            <li>
              <strong className="text-foreground">Build.</strong> Add strategies to a <Link className="text-primary hover:underline" to="/portfolios">portfolio</Link>,
              enter your capital and split it between them. Every dollar figure scales from each strategy's own starting capital.
            </li>
            <li>
              <strong className="text-foreground">Apply.</strong> Start guided apply and work through one strategy at a time: the settings
              in TradingView's order, a copy button on each value, today's date filled in. Mark each one applied when you are done.
            </li>
          </ol>
          <p>
            <a className="font-semibold text-primary hover:underline" href={WALKTHROUGH_VIDEO_URL} target="_blank" rel="noreferrer">
              Watch the five-minute walkthrough
            </a>{" "}
            (recorded before the rename; the steps are the same).
          </p>
        </Q>

        <Q q="What changed from Recipe Lab?" id="whats-changed">
          <ul className="list-disc space-y-1 pl-5">
            <li>The name: Recipe Lab is now Strategy Lab Pro, and recipes are called strategies. Numbers have not changed, so your TradingView setups still match.</li>
            <li>Each strategy has its own page and link, at /strategy/ and its number. Old /recipe/ links open the same strategy.</li>
            <li>Your saved portfolio opens as it was, under Portfolios. You can now keep several, name them, and export one to a file.</li>
            <li>Copy to TradingView is now guided apply, one strategy at a time, with a copy button on every value.</li>
            <li>Nothing to sign in to. Pro stays at the same address.</li>
          </ul>
        </Q>

        <Q q="Where are my portfolios saved?">
          <p>
            In this browser on this device. To use one elsewhere, open it in Portfolios and choose Export to a file, then Open a file on the
            other device. Clearing your browser's site data removes them, so export anything you want to keep.
          </p>
        </Q>

        <Q q="What happens when a strategy is updated?">
          <p>
            Each strategy in a portfolio is pinned to the version you added. When research publishes a new version, the portfolio shows what
            changed and offers to update. Guided apply always uses the version in your portfolio, and records which version you applied.
          </p>
        </Q>

        <Q q="Why is there no end date to copy?">
          <p>
            The end date in a strategy's settings is a TradingView run setting, not the end of the test. When you apply a strategy, set the
            end date to a date in the future; we recommend five or more years ahead. The test period on each strategy page is the period the
            results cover.
          </p>
        </Q>

        <Q q="Why do some strategies show no CAGR?">
          <p>A yearly rate is not meaningful for a test shorter than a year, so those strategies show their return and test period instead.</p>
        </Q>

        <Q q="Are these results live?">
          <p>
            Results marked Backtested are from historical backtests in TradingView, not from live accounts. Portfolio totals add up separate
            backtests; they do not model how the strategies would have run together.
          </p>
        </Q>

        <Q q="Need a hand?">
          <p>
            Arch Public's{" "}
            <a className="font-semibold text-primary hover:underline" href={CONCIERGE_URL} target="_blank" rel="noreferrer">
              concierge team
            </a>{" "}
            can set up strategies with you.
          </p>
        </Q>
      </div>
    </ProLayout>
  );
}
