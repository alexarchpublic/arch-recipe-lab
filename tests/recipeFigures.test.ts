// Characterization tests for how Recipe Lab computes and formats figures today.
// Recipe Lab is the source of truth (PRD section 2), so these pin its current
// output before Phase 1 moves the logic into the shared package (R3).
//
// Tests marked `it.fails` record defects the PRD names. They pass while the
// defect exists. When Phase 1 fixes one, its test starts failing: change it to
// a plain `it` in the same change.
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

  it.fails("PRD D10: CAGR uses the real backtest window, not the TradingView unlock year", () => {
    // +1,187% over 2020 to 2025 is a large CAGR. Today the 2999 run setting is
    // used as the end date and CAGR comes out near 0.27%.
    const recipe = marketWave({
      net_profit: "$1,187,000",
      algorithm_inputs: {
        dates: {
          start: { year: 2020, month: 1, day: 1 },
          end: { year: 2999, month: 12, day: 31 },
        },
      },
    });
    expect(computeCagr(recipe)).toBeGreaterThan(10);
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

  it.fails("PRD section 13: a dollar amount followed by a bracketed note parses as the amount", () => {
    // Today the digits in the note are glued on: 204,558,713.
    expect(parseCurrencyFromString("$20,455 (87% from BTC growth, 13% cash)")).toBe(20455);
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

  it.fails("PRD D3: one scaling rule, so both views give the same dollars for a $50,000 strategy", () => {
    // Browser view at $100,000: fixed $100k base, scale 1.
    const browserScale = getScale(100000);
    // Portfolio at $100,000: the strategy's own $50,000 base, scale 2.
    const portfolioRow = computeScaledMetricsForRecipe(
      100000,
      { recipeId: "a", allocationPct: 100 },
      {
        recipeId: "a",
        title: "A",
        assetSymbol: "BTC",
        baseInitialCapital: 50000,
        baseCashProfit: null,
        baseNetProfit: 10000,
        assetAccumulatedText: null,
      } as never,
    );
    expect(10000 * browserScale).toBe(portfolioRow.netProfit);
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
