// The shared package (PRD R3): scaling, benchmarks, dates and formatting that
// both front ends use. Figures themselves are derived in the database at save
// (tests/db/phase1.test.sql).
import { describe, expect, it } from "vitest";
import {
  TRADINGVIEW_END_INSTRUCTION,
  basisLabel,
  displayCagr,
  displayTestEnd,
  formatDate,
  formatTestWindow,
  isRunSettingEnd,
  normalizeStrategyRow,
  scaleFor,
  scaledResults,
  settingsForDisplay,
  showsBuyHold,
  showsDca,
  vsBuyHold,
  vsDca,
} from "@core";
import { toPortfolioSummary } from "@/data/proStrategies";
import { computeScaledMetricsForRecipe } from "@/lib/portfolio";
import { proStrategy } from "./fixtures/strategy";

describe("one scaling rule (D3)", () => {
  it("scales from the strategy's own starting capital", () => {
    expect(scaleFor(50000, { starting_capital: 100000 })).toBe(0.5);
    expect(scaleFor(100000, { starting_capital: 50000 })).toBe(2);
    expect(scaleFor(null, { starting_capital: 100000 })).toBe(1);
  });

  it("scales dollars and quantities, never percentages", () => {
    const s = proStrategy();
    const r = scaledResults(s, 50000);
    expect(r).toEqual({ beginning: 50000, ending: 77924, netProfit: 27924, cashProfit: 20360.55, assetQty: 2664.5 });
    expect(s.return_pct).toBe(55.848);
  });

  it("a portfolio position gives the same dollars as the strategy page", () => {
    const s = proStrategy({ starting_capital: 50000, net_profit_usd: 10000, ending_value_usd: 60000, asset_qty: 4 });
    const page = scaledResults(s, 25000);
    const row = computeScaledMetricsForRecipe(100000, { recipeId: s.id, allocationPct: 25 }, toPortfolioSummary(s));
    expect(row.netProfit).toBe(page.netProfit);
    expect(row.assetQuantity).toBe(page.assetQty);
  });

  it("a portfolio pins the version it was added at (P12)", () => {
    const summary = toPortfolioSummary(proStrategy());
    expect(summary.versionId).toBe("10000000-0000-0000-0000-000000000068");
    expect(summary.versionNumber).toBe(2);
    expect(summary.testEnd).toBe("2026-07-23");
  });
});

describe("benchmarks follow the stored choice", () => {
  it("shows only what the version says", () => {
    const dca = proStrategy({ benchmark_shown: "dca" });
    expect(showsBuyHold(dca)).toBe(false);
    expect(showsDca(dca)).toBe(true);
    expect(vsBuyHold(dca)).toBeNull();
    expect(vsDca(dca)).toBe(70.238);
    expect(vsBuyHold(proStrategy({ benchmark_shown: "none" }))).toBeNull();
  });
});

describe("end dates (D10)", () => {
  it("settings shown to a client carry the test end, never the run year", () => {
    const s = proStrategy();
    const shown = settingsForDisplay(s.algorithm_inputs, s.algorithm, s.test_end);
    expect(shown?.dates.end).toEqual({ year: 2026, month: 7, day: 23 });
    expect(shown?.dates.start).toEqual(s.algorithm_inputs.dates.start);
    expect(s.algorithm_inputs.dates.end.year).toBe(2999); // the stored setting is untouched
    expect(JSON.stringify(shown)).not.toMatch(/2999|2030/);
  });

  it("a baseline still ending in a run year shows no end date at all", () => {
    const baseline = proStrategy({ test_end: "2999-01-28", as_of: "2026-08-13" });
    expect(displayTestEnd(baseline)).toBeNull();
    const shown = settingsForDisplay(baseline.algorithm_inputs, baseline.algorithm, displayTestEnd(baseline));
    expect(shown?.dates.end).toBeUndefined();
    expect(formatTestWindow(baseline)).toBe("from 1 Jan 2024");
    expect(toPortfolioSummary(baseline).testEnd).toBeNull();
    expect(displayCagr(baseline)).toBeNull(); // computed to 2999, so not shown
    expect(displayCagr(proStrategy())).toBe(18.9);
  });

  it("Intelligence Algorithm keeps its dates at the top level", () => {
    const shown = settingsForDisplay({ end: { year: 2030, month: 1, day: 28 } }, "Intelligence Algorithm", "2025-01-01");
    expect(shown?.end).toEqual({ year: 2025, month: 1, day: 1 });
  });

  it("recognises a run-setting end year", () => {
    expect(isRunSettingEnd({ year: 2999, month: 1, day: 28 }, "2026-07-23")).toBe(true);
    expect(isRunSettingEnd({ year: 2026, month: 7, day: 23 }, "2026-07-23")).toBe(false);
    expect(isRunSettingEnd({ year: 2030, month: 1, day: 28 }, null, new Date("2026-11-11"))).toBe(true);
    expect(isRunSettingEnd({ year: 2025, month: 1, day: 1 }, null, new Date("2026-11-11"))).toBe(false);
    expect(TRADINGVIEW_END_INSTRUCTION).not.toMatch(/\d{4}/);
  });

  it("formats the test window", () => {
    expect(formatDate("2026-07-23")).toBe("23 Jul 2026");
    expect(formatTestWindow(proStrategy())).toBe("1 Jan 2024 – 23 Jul 2026");
  });
});

describe("rows from the API", () => {
  it("turns numeric strings into numbers and sorts screenshots", () => {
    const raw = proStrategy({
      starting_capital: "100000" as never,
      cagr_pct: null,
      screenshots: [
        { id: "b", url: "b", kind: "stats", order: 1, sha256: null },
        { id: "a", url: "a", kind: "chart", order: 0, sha256: null },
      ],
    });
    const row = normalizeStrategyRow(raw);
    expect(row.starting_capital).toBe(100000);
    expect(row.cagr_pct).toBeNull();
    expect(row.screenshots.map((x) => x.id)).toEqual(["a", "b"]);
  });

  it("labels the basis on every results block (C1)", () => {
    expect(basisLabel(proStrategy())).toBe("Backtested results");
    expect(basisLabel(proStrategy({ basis: "live" }))).toBe("Live results");
  });
});
