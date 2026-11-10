// Characterization tests for how Recipe Lab computes and formats figures today.
// Recipe Lab is the source of truth (PRD section 2), so these pin its current
// output before Phase 1 moves the logic into the shared package (R3).
//
// Phase 1 moved display off these functions: the app now reads figures the
// database derives once per version (D3) through @core. The three defects
// Phase 0 recorded as `it.fails` are fixed on that path and tested there
// (tests/core.test.ts, tests/db/phase1.test.sql). The legacy functions below
// are still used by the admin form and the TradingView settings scaler.
import { describe, expect, it } from "vitest";
import {
  computeCagr,
  formatPercent,
  formatSignedCurrency,
  formatSignedPercent,
  getPnlVsBuyHoldDelta,
  getPnlVsDcaDelta,
  getPortfolioValues,
  getStrategyPnlPercent,
  shouldShowBuyHoldBenchmark,
  shouldShowDcaBenchmark,
} from "@/utils/recipeMetrics";
import { getScale, scaleAlgorithmInputs, scaleRecipeFreeText } from "@/utils/recipeScaling";
import { scaledResults } from "@core";
import { toPortfolioSummary } from "@/data/proStrategies";
import { proStrategy } from "./fixtures/strategy";
import {
  computePortfolioAggregates,
  computeScaledMetricsForRecipe,
  parseCurrencyFromString,
} from "@/lib/portfolio";

const marketWave = (overrides: Record<string, unknown> = {}) => ({
  algorithm: "Market Wave",
  initial_capital: 100000,
  net_profit: "$20,455",
  buy_hold_pnl_percent: 30,
  dca_pnl_percent: 12,
  algorithm_inputs: {
    dates: {
      start: { year: 2020, month: 1, day: 1 },
      end: { year: 2025, month: 1, day: 1 },
    },
  },
  ...overrides,
});

describe("headline results", () => {
  it("return % is net profit over the strategy's own starting capital", () => {
    expect(getStrategyPnlPercent(marketWave())).toBeCloseTo(20.455, 6);
    expect(getStrategyPnlPercent(marketWave({ initial_capital: 50000 }))).toBeCloseTo(40.91, 6);
    expect(getStrategyPnlPercent(marketWave({ initial_capital: null }))).toBeNull();
  });

  it("CAGR is computed from the test window in the settings", () => {
    const recipe = marketWave({ net_profit: "$100,000" });
    // $100k doubles over 2020-01-01 to 2025-01-01 (5.002 years).
    expect(computeCagr(recipe)).toBeCloseTo(14.86, 1);
  });

  it("CAGR is null without dates or capital", () => {
    expect(computeCagr(marketWave({ algorithm_inputs: {} }))).toBeNull();
    expect(computeCagr(marketWave({ initial_capital: 0 }))).toBeNull();
  });

  it("PRD D10, fixed in Phase 1: clients see the stored CAGR, not one computed from the run year", () => {
    // The legacy function still divides by the 2999 run year; nothing that
    // clients see calls it any more. See tests/core.test.ts.
    const recipe = marketWave({
      net_profit: "$1,187,000",
      algorithm_inputs: {
        dates: {
          start: { year: 2020, month: 1, day: 1 },
          end: { year: 2999, month: 12, day: 31 },
        },
      },
    });
    expect(computeCagr(recipe)).toBeLessThan(1);
  });
});

describe("benchmarks", () => {
  it("Market Wave shows buy and hold by default and DCA only when chosen", () => {
    expect(shouldShowBuyHoldBenchmark(marketWave())).toBe(true);
    expect(shouldShowDcaBenchmark(marketWave())).toBe(false);
    const dcaChosen = marketWave({
      algorithm_inputs: { benchmark: { showBuyHold: false, showDca: true } },
    });
    expect(shouldShowBuyHoldBenchmark(dcaChosen)).toBe(false);
    expect(shouldShowDcaBenchmark(dcaChosen)).toBe(true);
  });

  it("the lead is strategy return minus benchmark return, in points", () => {
    expect(getPnlVsBuyHoldDelta(marketWave())).toBeCloseTo(-9.545, 6);
    const dcaChosen = marketWave({ algorithm_inputs: { benchmark: { showDca: true } } });
    expect(getPnlVsDcaDelta(dcaChosen)).toBeCloseTo(8.455, 6);
  });

  it("other algorithms show no benchmark", () => {
    const arbitrage = marketWave({ algorithm: "Arbitrage Algorithm" });
    expect(shouldShowBuyHoldBenchmark(arbitrage)).toBe(false);
    expect(getPnlVsBuyHoldDelta(arbitrage)).toBeNull();
  });
});

describe("parsing stored free text", () => {
  it("reads a plain dollar amount", () => {
    expect(parseCurrencyFromString("$20,455")).toBe(20455);
    expect(parseCurrencyFromString("-$656")).toBe(-656);
    expect(parseCurrencyFromString("")).toBeNull();
  });

  it("PRD section 13, fixed in Phase 1: the legacy parser still glues a bracketed note on, so nothing parses text at display", () => {
    // Version figures are numbers (D1), parsed once by store.first_number in
    // the database (tests/db/phase1.test.sql checks this exact string).
    expect(parseCurrencyFromString("$20,455 (87% from BTC growth, 13% cash)")).toBe(204558713);
  });
});

describe("scaling to an account size", () => {
  it("the browser view scales from a fixed $100,000 base", () => {
    expect(getScale(50000)).toBe(0.5);
    expect(getScale(null)).toBe(1);
    expect(scaleRecipeFreeText("$96,170", 0.5)).toBe("$48,085");
    expect(scaleRecipeFreeText("0.92 BTC", 0.5)).toBe("0.46 BTC");
  });

  it("portfolio values scale beginning and profit by the same factor", () => {
    expect(getPortfolioValues(marketWave(), 2)).toEqual({ beginning: 200000, ending: 240910 });
    expect(getPortfolioValues(marketWave(), 2, 150000)).toEqual({ beginning: 150000, ending: 190910 });
  });

  it("Market Wave settings scale cash and whole shares, never price levels", () => {
    const inputs = {
      userInitialCapital: { startingCash: 100000, startingQty: 7 },
      tradeSize: { entryShares: 3, exitShares: 1 },
      staticPriceFilter: { sellAbove: 250, buyBelow: 120 },
    };
    expect(scaleAlgorithmInputs(inputs, 0.5, "Market Wave")).toEqual({
      userInitialCapital: { startingCash: 50000, startingQty: 3 },
      tradeSize: { entryShares: 1, exitShares: 0 },
      staticPriceFilter: { sellAbove: 250, buyBelow: 120 },
    });
    expect(inputs.userInitialCapital.startingCash).toBe(100000);
  });

  it("portfolio totals add the scaled positions", () => {
    const row = computeScaledMetricsForRecipe(
      200000,
      { recipeId: "a", allocationPct: 50 },
      {
        recipeId: "a",
        title: "A",
        assetSymbol: "BTC",
        baseInitialCapital: 100000,
        baseCashProfit: 2742,
        baseNetProfit: 20455,
        assetAccumulatedText: "$96,170 (0.92 BTC @ $104,000)",
      } as never,
    );
    expect(row.capitalAllocated).toBe(100000);
    expect(row.netProfit).toBe(20455);
    expect(row.assetQuantity).toBeCloseTo(0.92, 6);
    const totals = computePortfolioAggregates([row, { ...row, recipeId: "b" }]);
    expect(totals.totalNetProfit).toBe(40910);
    expect(totals.assetAccumulations.BTC).toBeCloseTo(1.84, 6);
  });

  it("PRD D3, fixed in Phase 1: the browser and the portfolio scale a $50,000 strategy by the same rule", () => {
    const strategy = proStrategy({ starting_capital: 50000, net_profit_usd: 10000, ending_value_usd: 60000 });
    const browser = scaledResults(strategy, 100000);
    const portfolioRow = computeScaledMetricsForRecipe(
      100000,
      { recipeId: strategy.id, allocationPct: 100 },
      toPortfolioSummary(strategy),
    );
    expect(browser.netProfit).toBe(20000);
    expect(portfolioRow.netProfit).toBe(browser.netProfit);
  });
});

describe("formatting", () => {
  it("signed values use a true minus sign", () => {
    expect(formatSignedPercent(-91.5)).toBe("−91.5%");
    expect(formatSignedPercent(368.3)).toBe("+368.3%");
    expect(formatSignedCurrency(-656)).toBe("−$656");
    expect(formatPercent(39)).toBe("39.0%");
  });
});
