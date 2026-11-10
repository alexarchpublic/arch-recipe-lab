// Ingestion checks (PRD A4, A9, A16): the model's JSON against the expected
// shape, and the chart header against the settings panel. The API runs the
// bundle, so each check is compared against it too.
import { describe, expect, it } from "vitest";
import * as source from "../lib/recipeScreenshotImport";
// @ts-expect-error: plain JS bundle without type declarations
import * as bundle from "../lib/recipeScreenshotImport.bundle.js";
import type { RecipeScreenshotExtraction } from "../lib/recipeScreenshotImport";

// MARA LTH 1W Position (#68): the header as printed on the chart screenshot.
const HEADER =
  "ARCH: Market Wave Equities 100,000 0 -4 4 3 1 10,000 10,000 30 15 1 5 8 0 0 2,024 1 1 0 30 2,999 1 28 Neon Pink / Neon Green Monthly";

function extraction(settings: Partial<RecipeScreenshotExtraction["settings"]> = {}): RecipeScreenshotExtraction {
  return {
    imageKinds: ["chart", "settings", "stats", "dca"],
    ticker: "MARA",
    chartIndicatorParameters: HEADER,
    lastBarDate: "2026-07-23",
    settings: {
      startingCash: 100000, startingQty: 0,
      longThresholdPercent: -4, exitThresholdPercent: 4,
      entryShares: 3, exitShares: 1, entryFixed: 10000, exitFixed: 10000,
      entryPercent: 30, exitPercent: 15,
      scope: 1, sellBuffer: 5, buyBuffer: 8, staticSellAbove: 0, staticBuyBelow: 0,
      startYear: 2024, startMonth: 1, startDay: 1, startHour: 0, startMinute: 30,
      endYear: 2999, endMonth: 1, endDay: 28,
      percentEnabled: true,
      ...settings,
    },
    stats: { initialCashBalance: 100000, totalPnl: 55848, realizedProfit: 40721.1, strategyRoiPercent: 55.85 },
    dca: { dcaBenchmarkRoiPercent: -14.39, showDcaBenchmark: true },
  };
}

describe("chart header against settings panel (A9)", () => {
  it("reads a header whose run end is the 2999 unlock year", () => {
    const params = source.parseMarketWaveChartParams(HEADER) as { dates: { end: { year: number } } } | null;
    expect(params?.dates.end.year).toBe(2999);
  });

  it("finds no disagreement when the two match", () => {
    expect(source.crossCheckChartAgainstSettings(extraction())).toEqual([]);
  });

  it("reports each value that differs", () => {
    const diffs = source.crossCheckChartAgainstSettings(extraction({ sellBuffer: 6, entryFixed: 1000 }));
    expect(diffs).toEqual([
      { field: "entryFixed", chart: 10000, panel: 1000 },
      { field: "sellBuffer", chart: 5, panel: 6 },
    ]);
    expect(bundle.crossCheckChartAgainstSettings(extraction({ sellBuffer: 6, entryFixed: 1000 }))).toEqual(diffs);
  });

  it("carries the disagreements and the last bar date into the import result", () => {
    const result = source.buildRecipeFromExtraction(extraction({ scope: 2 }));
    expect(result.crossCheck).toEqual([{ field: "scope", chart: 1, panel: 2 }]);
    expect(result.warnings.some((w) => w.includes("scope"))).toBe(true);
    expect(result.lastBarDate).toBe("2026-07-23");
  });
});

describe("model output shape (A4)", () => {
  it("accepts a well-formed extraction", () => {
    expect(source.validateExtractionShape(extraction())).toEqual([]);
  });

  it("flags numbers sent as strings and a bad date", () => {
    const bad = extraction() as unknown as Record<string, Record<string, unknown> | string>;
    bad.stats = { ...(bad.stats as Record<string, unknown>), totalPnl: "55,848" };
    bad.lastBarDate = "23 Jul 2026";
    const problems = source.validateExtractionShape(bad);
    expect(problems.some((p) => p.startsWith("stats.totalPnl"))).toBe(true);
    expect(problems.some((p) => p.startsWith("lastBarDate"))).toBe(true);
    expect(bundle.validateExtractionShape(bad)).toEqual(problems);
  });

  it("the prompt asks for the last bar date and the bundle carries the same prompt version", () => {
    expect(source.RECIPE_SCREENSHOT_EXTRACTION_PROMPT).toContain("lastBarDate");
    expect(bundle.PROMPT_VERSION).toBe(source.PROMPT_VERSION);
  });
});
