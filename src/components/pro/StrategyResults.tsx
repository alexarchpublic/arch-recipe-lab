// A strategy's results block: figures from the published version, dollars
// scaled to the capital in view by one rule (D3), with the basis label, test
// window, starting capital and disclaimer slot beside it (C1, C2, C3, P5).
import {
  type ProStrategy,
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
import { MetricTileGrid } from "@/components/MetricTileGrid";
import { StatTile, deltaTone, signedTone } from "@/components/StatTile";
import { useDisclaimer } from "@/data/disclosures";

export function CagrNote({ strategy }: { strategy: PublicStrategy }) {
  if (displayCagr(strategy) !== null) return null;
  if (!displayTestEnd(strategy)) return null;
  if (strategy.test_years >= 1) return null;
  return <span>CAGR not shown for a test under one year</span>;
}

export function StrategyResults({
  strategy,
  capital,
  variant = "full",
  disclaimer: disclaimerOverride,
}: {
  strategy: ProStrategy | PublicStrategy;
  capital?: number | null;
  variant?: "full" | "card";
  /** Admin preview passes the wording directly. */
  disclaimer?: string;
}) {
  const fetched = useDisclaimer("results");
  const disclaimer = disclaimerOverride ?? fetched;
  const scaled = scaledResults(strategy, capital ?? strategy.starting_capital);
  const cagr = displayCagr(strategy);
  const bh = vsBuyHold(strategy);
  const dca = vsDca(strategy);
  const card = variant === "card";
  const ver = `v${strategy.version_number}`;

  const tiles = card ? (
    <MetricTileGrid>
      <StatTile label="Net profit" field="net_profit_usd" raw={strategy.net_profit_usd} value={formatSignedCurrency(Math.round(scaled.netProfit))} tone={signedTone(scaled.netProfit)} />
      {scaled.cashProfit !== null && <StatTile label="Cash profit" field="cash_profit_usd" raw={strategy.cash_profit_usd} value={formatSignedCurrency(Math.round(scaled.cashProfit))} />}
      <StatTile label="Return" field="return_pct" raw={strategy.return_pct} value={formatSignedPercent(strategy.return_pct)} tone={deltaTone(strategy.return_pct)} />
      {bh !== null && <StatTile label="vs Buy & Hold" field="vs_buy_hold_pct" raw={bh} value={formatSignedPercent(bh)} tone={deltaTone(bh)} />}
      {dca !== null && <StatTile label="vs DCA" field="vs_dca_pct" raw={dca} value={formatSignedPercent(dca)} tone={deltaTone(dca)} />}
      {cagr !== null && <StatTile label="CAGR" field="cagr_pct" raw={cagr} value={formatPercent(cagr)} />}
      {scaled.assetQty !== null && (
        <StatTile label="Asset accumulated" field="asset_qty" raw={strategy.asset_qty} value={`${formatQuantity(scaled.assetQty, strategy.asset_class)} ${strategy.asset}`} fullWidth />
      )}
    </MetricTileGrid>
  ) : (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      <StatTile label="Beginning portfolio" field="starting_capital" raw={strategy.starting_capital} value={formatMoney(scaled.beginning)} />
      <StatTile label="Ending portfolio" field="ending_value_usd" raw={strategy.ending_value_usd} value={formatMoney(scaled.ending)} />
      <StatTile label="Net profit" field="net_profit_usd" raw={strategy.net_profit_usd} value={formatSignedCurrency(Math.round(scaled.netProfit))} tone={signedTone(scaled.netProfit)} />
      {scaled.cashProfit !== null && <StatTile label="Cash profit" field="cash_profit_usd" raw={strategy.cash_profit_usd} value={formatSignedCurrency(Math.round(scaled.cashProfit))} />}
      {scaled.assetQty !== null && (
        <StatTile label="Asset accumulated" field="asset_qty" raw={strategy.asset_qty} value={`${formatQuantity(scaled.assetQty, strategy.asset_class)} ${strategy.asset}`} />
      )}
      <StatTile label="Strategy return" field="return_pct" raw={strategy.return_pct} value={formatSignedPercent(strategy.return_pct)} tone={deltaTone(strategy.return_pct)} />
      {cagr !== null && <StatTile label="CAGR" field="cagr_pct" raw={cagr} value={formatPercent(cagr)} />}
      {strategy.max_drawdown_pct !== null && (
        <StatTile label="Max drawdown" field="max_drawdown_pct" raw={strategy.max_drawdown_pct} value={formatPercent(strategy.max_drawdown_pct)} tone="loss" />
      )}
      {showsBuyHold(strategy) && strategy.buy_hold_pnl_pct !== null && (
        <StatTile label="Buy & hold return" field="buy_hold_pnl_pct" raw={strategy.buy_hold_pnl_pct} value={formatSignedPercent(strategy.buy_hold_pnl_pct)} tone={deltaTone(strategy.buy_hold_pnl_pct)} />
      )}
      {showsDca(strategy) && strategy.dca_pnl_pct !== null && (
        <StatTile label="DCA return" field="dca_pnl_pct" raw={strategy.dca_pnl_pct} value={formatSignedPercent(strategy.dca_pnl_pct)} tone={deltaTone(strategy.dca_pnl_pct)} />
      )}
      {bh !== null && <StatTile label="vs Buy & Hold" field="vs_buy_hold_pct" raw={bh} value={formatSignedPercent(bh)} tone={deltaTone(bh)} />}
      {dca !== null && <StatTile label="vs DCA" field="vs_dca_pct" raw={dca} value={formatSignedPercent(dca)} tone={deltaTone(dca)} />}
    </div>
  );

  return (
    <div data-results={strategy.id} data-version={ver} className={card ? "space-y-3" : "space-y-4"}>
      {tiles}
      <ResultsDisclosure strategy={strategy} disclaimer={disclaimer} compact={card}>
        {!card && (
          <>
            <span data-field="test_window">{formatTestWindow(strategy)}</span>
            <span aria-hidden>·</span>
            <span>{formatMoney(strategy.starting_capital)} starting capital</span>
            <CagrNote strategy={strategy} />
          </>
        )}
      </ResultsDisclosure>
    </div>
  );
}
