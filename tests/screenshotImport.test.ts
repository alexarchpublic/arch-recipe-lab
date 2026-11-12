// The ingestion engine. The serverless API runs lib/extraction.bundle.js,
// built from packages/core/src/extraction.ts by `npm run build:reader`, while
// the browser runs the TypeScript source. These tests check both, and that the
// committed bundle is exactly what the build produces today.
import { readFileSync } from "node:fs";
import { build } from "esbuild";
import { describe, expect, it } from "vitest";
import pkg from "../package.json";
import * as source from "../packages/core/src/extraction";
// @ts-expect-error: plain JS bundle without type declarations
import * as bundle from "../lib/extraction.bundle.js";

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

  it("the committed API bundle is the current build of the source", async () => {
    const script = (pkg as { scripts: Record<string, string> }).scripts["build:reader"];
    const banner = script.match(/--banner:js="(.*?)"/)?.[1];
    expect(banner).toBeTruthy();
    const out = await build({
      entryPoints: ["packages/core/src/extraction.ts"],
      bundle: true, format: "esm", platform: "node", target: "node20", write: false, logLevel: "silent",
      banner: { js: banner! },
    });
    expect(readFileSync("lib/extraction.bundle.js", "utf8")).toBe(out.outputFiles[0].text);
  });

  it("drafts a plain-words title with no codes (NM1, NM3)", () => {
    expect(source.defaultTitle("IREN", "1 Hour")).toBe("IREN on the hourly chart");
    expect(source.defaultTitle("MARA", "1 Week")).toBe("MARA on the weekly chart");
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
