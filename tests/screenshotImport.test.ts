// The ingestion engine. The serverless API runs the hand-built bundle in
// lib/recipeScreenshotImport.bundle.js, while the browser runs the TypeScript
// source. These tests check both, so the two cannot drift silently.
import { describe, expect, it } from "vitest";
import * as source from "../lib/recipeScreenshotImport";
// @ts-expect-error: plain JS bundle without type declarations
import * as bundle from "../lib/recipeScreenshotImport.bundle.js";

describe("screenshot ingestion", () => {
  it("classifies screenshots by filename, three or four at a time", () => {
    expect(source.classifyKindsFromFilenames(["chart.png", "settings.png", "stats.png"])).toEqual([
      "chart",
      "settings",
      "stats",
    ]);
    expect(
      source.classifyKindsFromFilenames(["DCA.png", "Inputs.png", "Graph.png", "Stats.png"]),
    ).toEqual(["dca", "settings", "chart", "stats"]);
    expect(source.classifyKindsFromFilenames(["chart.png", "chart2.png", "stats.png"])).toBeNull();
    expect(source.classifyKindsFromFilenames(["chart.png", "stats.png"])).toBeNull();
  });

  it("normalises chart time frames", () => {
    expect(source.normalizeTimeFrame("Weekly")).toBe("1 Week");
    expect(source.normalizeTimeFrame("1D")).toBe("1 Day");
    expect(source.normalizeTimeFrame("4h")).toBe("4 Hours");
    expect(source.normalizeTimeFrame("")).toBe("1 Hour");
  });

  it("infers the asset class from the ticker", () => {
    expect(source.inferAssetClass("btc")).toBe("Crypto");
    expect(source.inferAssetClass("QQQ")).toBe("ETFs");
    expect(source.inferAssetClass("NVDA")).toBe("Equities");
  });

  it("the API bundle matches the TypeScript source", () => {
    expect(bundle.RECIPE_SCREENSHOT_EXTRACTION_PROMPT).toBe(source.RECIPE_SCREENSHOT_EXTRACTION_PROMPT);
    const names = [
      ["chart.png", "settings.png", "stats.png"],
      ["dca.png", "inputs.png", "graph.png", "stats.png"],
      ["a.png", "b.png", "c.png"],
    ];
    for (const files of names) {
      expect(bundle.classifyKindsFromFilenames(files)).toEqual(source.classifyKindsFromFilenames(files));
    }
  });
});
