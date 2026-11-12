// What an "email me this" capture carries: the strategy's figures at the
// visitor's account size, formatted by the shared package (R3). Runs in the
// browser, so the capture needs no server.
import {
  displayCagr,
  formatMoney,
  formatPercent,
  formatQuantity,
  formatSignedCurrency,
  formatSignedPercent,
  formatTestWindow,
  scaledResults,
  strategyLine,
  vsBuyHold,
  vsDca,
  type PublicStrategy,
} from "@core";
import { canonicalUrl } from "./env";

export function strategyName(s: Pick<PublicStrategy, "display_number" | "title" | "asset">): string {
  return `#${s.display_number} ${s.title} (${s.asset})`;
}

export function figuresText(s: PublicStrategy, capital: number | null): string {
  const scaled = scaledResults(s, capital ?? s.starting_capital);
  const cagr = displayCagr(s);
  const bh = vsBuyHold(s);
  const dca = vsDca(s);
  const lines = [
    `${s.title}: ${strategyLine(s)}`,
    `Backtested results, ${formatTestWindow(s)}`,
    `Starting with ${formatMoney(scaled.beginning)}: ending value ${formatMoney(scaled.ending)}, net profit ${formatSignedCurrency(Math.round(scaled.netProfit))}`,
    scaled.cashProfit !== null ? `Cash profit ${formatSignedCurrency(Math.round(scaled.cashProfit))}` : "",
    scaled.assetQty !== null ? `Asset accumulated ${formatQuantity(scaled.assetQty, s.asset_class)} ${s.asset}` : "",
    `Return ${formatSignedPercent(s.return_pct)}${cagr !== null ? `, CAGR ${formatPercent(cagr)}` : ""}`,
    bh !== null ? `Against buy and hold ${formatSignedPercent(bh)}` : "",
    dca !== null ? `Against buying monthly (DCA) ${formatSignedPercent(dca)}` : "",
    canonicalUrl(`/${s.slug}`),
  ];
  return lines.filter(Boolean).join("\n");
}
