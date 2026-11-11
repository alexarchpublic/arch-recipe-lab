"use client";
// A strategy's results, exactly as the store holds them (S7), with the basis
// label, test window, starting capital and disclaimer slot beside every block
// (S8, C1 to C3). Dollar figures follow the visitor's account size when they
// have entered one (S4), by the shared scaling rule (D3). Before scripts load,
// the page shows the figures at the strategy's own starting capital, never zero (S10).
import {
  type PublicStrategy,
  ResultsDisclosure,
  displayCagr,
  displayTestEnd,
  formatMoney,
  formatPercent,
  formatQuantity,
  formatSignedCurrency,
  formatSignedPercent,
  formatTestWindow,
  scaledResults,
  showsBuyHold,
  showsDca,
  vsBuyHold,
  vsDca,
} from "@core";
import { Figure, signedTone } from "./Figure";
import { useVisitor } from "./useVisitor";
import { testLength } from "@/lib/strategies";

export function ResultsBlock({
  strategy: s,
  disclaimer,
  hidden = [],
  variant = "full",
  scale = true,
}: {
  strategy: PublicStrategy;
  disclaimer: string | null;
  hidden?: string[];
  variant?: "full" | "card";
  /** Follow the visitor's account size (C5 can switch it off). */
  scale?: boolean;
}) {
  const visitor = useVisitor();
  const capital = scale && visitor?.accountSize ? visitor.accountSize : s.starting_capital;
  const scaled = scaledResults(s, capital);
  const cagr = displayCagr(s);
  const bh = vsBuyHold(s);
  const dca = vsDca(s);
  const show = (f: string) => !hidden.includes(f);
  const card = variant === "card";
  const atSize = capital !== s.starting_capital ? `at ${formatMoney(capital)}` : undefined;
  const shortTest = cagr === null && !!displayTestEnd(s) && s.test_years < 1;

  const figures = card ? (
    <div className="grid grid-cols-2 gap-2">
      {show("return_pct") && <Figure label="Return" field="return_pct" raw={s.return_pct} value={formatSignedPercent(s.return_pct)} tone={signedTone(s.return_pct)} />}
      {show("net_profit_usd") && (
        <Figure label="Net profit" field="net_profit_usd" raw={s.net_profit_usd} value={formatSignedCurrency(Math.round(scaled.netProfit))} tone={signedTone(scaled.netProfit)} sub={atSize} />
      )}
      {bh !== null && show("vs_buy_hold_pct") && <Figure label="vs buy and hold" field="vs_buy_hold_pct" raw={bh} value={formatSignedPercent(bh)} tone={signedTone(bh)} />}
      {bh === null && dca !== null && show("vs_dca_pct") && <Figure label="vs buying monthly" field="vs_dca_pct" raw={dca} value={formatSignedPercent(dca)} tone={signedTone(dca)} />}
      {bh === null && dca === null && cagr !== null && show("cagr_pct") && <Figure label="CAGR" field="cagr_pct" raw={cagr} value={formatPercent(cagr)} />}
    </div>
  ) : (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
      {show("return_pct") && <Figure label="Strategy return" field="return_pct" raw={s.return_pct} value={formatSignedPercent(s.return_pct)} tone={signedTone(s.return_pct)} />}
      {cagr !== null && show("cagr_pct") && <Figure label="CAGR" field="cagr_pct" raw={cagr} value={formatPercent(cagr)} />}
      {shortTest && <Figure label="Test length" field="test_years" raw={s.test_years} value={testLength(s.test_years)} sub="CAGR not shown under a year" />}
      {bh !== null && show("vs_buy_hold_pct") && <Figure label="vs buy and hold" field="vs_buy_hold_pct" raw={bh} value={formatSignedPercent(bh)} tone={signedTone(bh)} />}
      {dca !== null && show("vs_dca_pct") && <Figure label="vs buying monthly (DCA)" field="vs_dca_pct" raw={dca} value={formatSignedPercent(dca)} tone={signedTone(dca)} />}
      {showsBuyHold(s) && s.buy_hold_pnl_pct !== null && show("buy_hold_pnl_pct") && (
        <Figure label="Buy and hold return" field="buy_hold_pnl_pct" raw={s.buy_hold_pnl_pct} value={formatSignedPercent(s.buy_hold_pnl_pct)} />
      )}
      {showsDca(s) && s.dca_pnl_pct !== null && show("dca_pnl_pct") && (
        <Figure label="Buying monthly return" field="dca_pnl_pct" raw={s.dca_pnl_pct} value={formatSignedPercent(s.dca_pnl_pct)} />
      )}
      {s.max_drawdown_pct !== null && show("max_drawdown_pct") && (
        <Figure label="Max drawdown" field="max_drawdown_pct" raw={s.max_drawdown_pct} value={formatPercent(s.max_drawdown_pct)} tone="loss" />
      )}
      {show("net_profit_usd") && (
        <Figure label="Net profit" field="net_profit_usd" raw={s.net_profit_usd} value={formatSignedCurrency(Math.round(scaled.netProfit))} tone={signedTone(scaled.netProfit)} sub={atSize} />
      )}
      {show("ending_value_usd") && <Figure label="Ending value" field="ending_value_usd" raw={s.ending_value_usd} value={formatMoney(scaled.ending)} sub={atSize} />}
      {scaled.cashProfit !== null && show("cash_profit_usd") && (
        <Figure label="Cash profit" field="cash_profit_usd" raw={s.cash_profit_usd} value={formatSignedCurrency(Math.round(scaled.cashProfit))} sub={atSize} />
      )}
      {scaled.assetQty !== null && show("asset_qty") && (
        <Figure label="Asset accumulated" field="asset_qty" raw={s.asset_qty} value={`${formatQuantity(scaled.assetQty, s.asset_class)} ${s.asset}`} sub={atSize} />
      )}
    </div>
  );

  return (
    <div data-results={s.id} data-version={`v${s.version_number}`} data-slug={s.slug} className={card ? "space-y-2" : "space-y-3"}>
      {figures}
      <ResultsDisclosure strategy={s} disclaimer={disclaimer} compact={card}>
        {!card && (
          <>
            <span data-field="test_window">{formatTestWindow(s)}</span>
            <span aria-hidden>·</span>
            <span>
              <span data-field="starting_capital" data-raw={s.starting_capital}>{formatMoney(s.starting_capital)}</span> starting capital
            </span>
          </>
        )}
      </ResultsDisclosure>
    </div>
  );
}
