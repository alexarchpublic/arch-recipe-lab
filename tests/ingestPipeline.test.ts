// The case study pipeline's logic (auto-ingestion Phase 3). scripts/ingest/
// runs lib/pipeline.bundle.js, built from packages/core/src/pipeline.ts by
// `npm run build:pipeline`; these tests check the source and that the
// committed bundle is the current build.
import { readFileSync } from "node:fs";
import { build } from "esbuild";
import { describe, expect, it } from "vitest";
import pkg from "../package.json";
import * as p from "../packages/core/src/pipeline";
import type { CaseStudy, CaseStudyScenario } from "../packages/core/src/pipeline";
import type { RecipeScreenshotExtraction } from "../packages/core/src/extraction";

const study: CaseStudy = {
  slug: "msft",
  status: "ready",
  ticker: "MSFT",
  company: "Microsoft",
  title: "MSFT and the price of feeling safe",
  product: "Market Wave Algorithm for Equities",
  published: "2026-08-11",
};

const scenario: CaseStudyScenario = {
  key: "full-cycle",
  title: "The full cycle",
  window: "November 1, 2021 to August 11, 2026",
  chart: "Weekly chart",
  strategyNumber: 64,
  strategyReturn: "+111.5%",
  benchmarks: [
    { name: "Buy and hold", value: "+49.7%" },
    { name: "DCA", value: "+21.3%" },
  ],
  stats: [
    { label: "Ending value", value: "$211,501" },
    { label: "Realized profit, banked in cash", value: "$61,212" },
    { label: "Unrealized profit on open shares", value: "$50,289" },
    { label: "Shares held", value: "415 at $381.76 avg cost" },
    { label: "Cash", value: "$2,781" },
  ],
};

// What Claude read from strategy #64's four screenshots on 12 Nov 2026.
const reading: RecipeScreenshotExtraction = {
  imageKinds: ["chart", "settings", "stats", "dca"],
  ticker: "MSFT",
  assetName: "Microsoft Corp.",
  assetClass: "Equities",
  timeFrame: "1W",
  chartIndicatorParameters: "100,000 0 -2 3.4 1 1 100 100 46.5 50 3 6.8 7.3 0 0 2,021 11 1 0 30 2,030 1 28",
  dcaInterval: "Monthly",
  lastBarDate: "2026-08-10",
  settings: {
    startingCash: 100000, startingQty: 0, longThresholdEnabled: true, longThresholdPercent: -2,
    exitThresholdEnabled: true, exitThresholdPercent: 3.4, sharesEnabled: false, entryShares: 1, exitShares: 1,
    fixedEnabled: false, entryFixed: 100, exitFixed: 100, percentEnabled: true, entryPercent: 46.5, exitPercent: 50,
    roundDownWholeShares: false, scope: 3, onlySellAbove: true, onlyBuyBelow: true, sellBuffer: 6.8, buyBuffer: 7.3,
    staticSellAboveEnabled: false, staticSellAbove: 0, staticBuyBelowEnabled: false, staticBuyBelow: 0,
    buyInDownTrend: false, buyInUpTrend: false, sellInDownTrend: false, sellInUpTrend: false, buyOnUpTrend: false,
    sellOnDownTrend: true, startYear: 2021, startMonth: 11, startDay: 1, startHour: 0, startMinute: 30,
    endYear: 2030, endMonth: 1, endDay: 28, exitFullOnLastBar: false, showDcaBenchmark: false, dcaInterval: "Monthly",
  },
  stats: {
    initialCashBalance: 100000, initialShares: 0, currentShares: 415, currentSharesValue: 208720.1,
    currentCashBalance: 2780.76, totalBaseCost: 158431.44, avgCostBasis: 381.76, unrealizedProfit: 50288.66,
    realizedProfit: 61212.2, totalPnl: 111500.86, buyHoldRoiPercent: 49.66, strategyRoiPercent: 111.5,
    strategyPortfolioValue: 211500.86,
  },
  dca: { dcaBenchmarkRoiPercent: 21.33, dcaPortfolioValue: 121331.55, showDcaBenchmark: false },
};

const readResult = () => p.buildRecipeFromExtraction(JSON.parse(JSON.stringify(reading)));
const check = (over: Partial<Parameters<typeof p.checkScenario>[0]> = {}) =>
  p.checkScenario({
    study, scenario, sourceKinds: ["chart", "settings", "stats", "dca"], extraction: reading,
    result: readResult(), schemaErrors: [], today: "2026-11-12", ...over,
  });

describe("what a scenario states", () => {
  it("reads figures, signs and typographic minus signs", () => {
    expect(p.parseFigure("+33.2%")).toBe(33.2);
    expect(p.parseFigure("−50%")).toBe(-50);
    expect(p.parseFigure("-$656")).toBe(-656);
    expect(p.parseFigure("$133,204")).toBe(133204);
    expect(p.parseFigure("n/a")).toBeNull();
    const f = p.scenarioFigures(scenario);
    expect(f).toMatchObject({
      returnPct: 111.5, buyHoldPct: 49.7, dcaPct: 21.3, endingValue: 211501, realizedProfit: 61212,
      unrealizedProfit: 50289, sharesHeld: 415, avgCost: 381.76, cash: 2781,
      windowStart: "2021-11-01", windowEnd: "2026-08-11", timeFrame: "1 Week",
    });
  });

  it("reads the windows and chart labels case studies use", () => {
    expect(p.parseWindow("Jan 1 to Jul 22, 2026")).toEqual({ start: "2026-01-01", end: "2026-07-22" });
    expect(p.parseWindow("Jul 2017 to Jul 2026")).toEqual({ start: "2017-07-01", end: null, endMonth: "2026-07" });
    expect(p.parseWindow("since launch")).toEqual({ start: null, end: null });
    expect(p.parseWindow("October 15, 2025 to August 6, 2026, ten months")).toEqual({ start: "2025-10-15", end: "2026-08-06" });
    expect(p.chartLabelTimeFrame("Four hour chart")).toBe("4 Hours");
    expect(p.chartLabelTimeFrame("6-hour bars")).toBe("6 Hours");
    expect(p.chartLabelTimeFrame("1 hour chart")).toBe("1 Hour");
    expect(p.chartLabelTimeFrame("Bitcoin price and Strategy's purchases")).toBeNull();
  });

  it("covers Market Wave only, and asks a mixed study to name the scenario's algorithm", () => {
    expect(p.scenarioIsMarketWave(study, scenario)).toBe(true);
    const mixed = { ...study, product: "Intelligence Algorithm, Market Wave and Tax-Loss Harvesting" };
    expect(p.scenarioIsMarketWave(mixed, scenario)).toBe(false);
    expect(p.scenarioIsMarketWave(mixed, { ...scenario, algorithm: "Market Wave" })).toBe(true);
    expect(p.scenarioIsMarketWave({ ...study, product: "Oracle Protocol" }, scenario)).toBe(false);
  });
});

describe("what to do with each scenario (TR3, TR4, TR5)", () => {
  const files = { chart: "aa", settings: "bb" };
  const hash = p.fingerprintInput(scenario, files);

  it("hashes figures and screenshots, not wording elsewhere", () => {
    expect(p.fingerprintInput({ ...scenario, numberToRead: "changed" }, files)).toBe(hash);
    expect(p.fingerprintInput({ ...scenario, strategyReturn: "+111.6%" }, files)).not.toBe(hash);
    expect(p.fingerprintInput(scenario, { ...files, settings: "cc" })).not.toBe(hash);
  });

  it("new, update, unchanged, skipped, draft", () => {
    const base = { study, scenario, hash: "h", storedHash: null as string | null, hasSources: true };
    expect(p.planScenario({ ...base, scenario: { ...scenario, strategyNumber: undefined } }).action).toBe("new");
    expect(p.planScenario(base).action).toBe("update");
    expect(p.planScenario({ ...base, storedHash: "h" }).action).toBe("unchanged");
    expect(p.planScenario({ ...base, storedHash: "old" }).action).toBe("update");
    expect(p.planScenario({ ...base, hasSources: false }).action).toBe("skip");
    expect(p.planScenario({ ...base, study: { ...study, status: "draft" } }).action).toBe("draft-study");
    expect(p.planScenario({ ...base, scenario: { ...scenario, key: undefined } }).action).toBe("skip");
  });
});

describe("what holds a strategy", () => {
  it("a clean reading of #64 holds nothing", () => {
    const findings = check();
    expect(p.holds(findings)).toEqual([]);
    expect(findings.map((f) => f.code)).toContain("future_end");
  });

  it("holds on a missing screenshot, a failed read, the wrong ticker or time frame", () => {
    expect(p.holds(check({ sourceKinds: ["chart", "stats"] })).map((f) => f.code)).toEqual(["missing_screenshot"]);
    expect(p.holds(check({ extraction: null, result: null, readError: "usage limit" })).map((f) => f.code)).toEqual(["unreadable"]);
    expect(p.holds(check({ study: { ...study, ticker: "AAPL" } })).map((f) => f.code)).toEqual(["ticker"]);
    expect(p.holds(check({ scenario: { ...scenario, chart: "Daily chart" } })).map((f) => f.code)).toEqual(["time_frame"]);
    expect(p.holds(check({ schemaErrors: ["settings.scope: expected a number"] })).map((f) => f.code)).toEqual(["schema"]);
  });

  it("holds when the chart header and the settings panel disagree (A9)", () => {
    const bad = JSON.parse(JSON.stringify(reading));
    bad.settings.scope = 4;
    const findings = check({ extraction: bad, result: p.buildRecipeFromExtraction(bad) });
    expect(p.holds(findings).some((f) => f.code === "chart_vs_panel")).toBe(true);
  });

  it("a figure that differs from the case study is a warning, and the case study's stands (EX5)", () => {
    const findings = check({ scenario: { ...scenario, strategyReturn: "+109.0%" } });
    expect(p.holds(findings)).toEqual([]);
    expect(findings.find((f) => f.code === "figure_differs")?.message).toMatch(/strategy return/);
  });

  it("a far-future settings end takes the case study's end date; the chart's last bar only cross-checks it (EX6)", () => {
    const noBar = { ...reading, lastBarDate: null };
    const noBarResult = () => p.buildRecipeFromExtraction(JSON.parse(JSON.stringify(noBar)));
    expect(p.holds(check({ extraction: noBar, result: noBarResult() }))).toEqual([]);
    const farBar = { ...reading, lastBarDate: "2026-11-09" };
    const far = check({ extraction: farBar, result: p.buildRecipeFromExtraction(JSON.parse(JSON.stringify(farBar))) });
    expect(p.holds(far)).toEqual([]);
    expect(far.find((f) => f.code === "end_vs_window")?.message).toMatch(/2026-08-11/);
    // No end day in the case study: the chart's reading must fall in the stated month, and must exist.
    const monthOnly = { ...scenario, window: "Nov 2021 to Aug 2026" };
    expect(p.holds(check({ scenario: monthOnly })).map((f) => f.code)).toEqual([]);
    expect(p.holds(check({ scenario: monthOnly, extraction: farBar, result: p.buildRecipeFromExtraction(JSON.parse(JSON.stringify(farBar))) })).map((f) => f.code))
      .toEqual(["end_vs_window"]);
    expect(p.holds(check({ scenario: { ...scenario, window: undefined }, extraction: noBar, result: noBarResult() })).map((f) => f.code))
      .toEqual(["no_end_date"]);
  });
});

describe("names (NM1-NM10)", () => {
  const ok = { title: "Microsoft through a full cycle", summary: "Trades Microsoft's swings for cash and shares.", description: "Buys in slices on dips below its cost and sells into strength above it." };

  it("passes a plain title and catches codes, figures, length and duplicates", () => {
    expect(p.namingProblems(ok, [])).toEqual([]);
    expect(p.namingProblems({ ...ok, title: "MSFT LTH 1W Swing" }, []).join(" ")).toMatch(/STH or LTH/);
    expect(p.namingProblems({ ...ok, title: "Harvesting MARA on the 4-hour chart" }, []).join(" ")).toMatch(/time frame/);
    expect(p.namingProblems({ ...ok, title: "Gold on the weekly chart" }, []).join(" ")).toMatch(/time frame/);
    expect(p.namingProblems({ ...ok, title: "Microsoft through a two-year grind" }, [])).toEqual([]);
    expect(p.namingProblems({ ...ok, title: "Microsoft +111%" }, []).join(" ")).toMatch(/figures/);
    expect(p.namingProblems({ ...ok, summary: "x".repeat(111) }, [])).toHaveLength(1);
    expect(p.namingProblems(ok, ["microsoft through a full  cycle"]).join(" ")).toMatch(/Another live strategy/);
    expect(p.namingProblems({ ...ok, description: "Returned 50% a year." }, []).join(" ")).toMatch(/figures/);
  });

  it("keeps house style: no dashes, no exclamation marks, no promises about losses", () => {
    expect(p.namingProblems({ ...ok, description: "Buys dips — then sells." }, []).join(" ")).toMatch(/dashes/);
    expect(p.namingProblems({ ...ok, summary: "Cash from the chop!" }, []).join(" ")).toMatch(/exclamation/);
    expect(p.namingProblems({ ...ok, description: "Sells only above cost, so it never locks in a loss." }, []).join(" ")).toMatch(/promises/);
    expect(p.namingProblems({ ...ok, description: "Sells only above its average cost." }, [])).toEqual([]);
  });

  it("falls back to 'Asset: scenario title', within the limit", () => {
    expect(p.fallbackTitle("Microsoft", "The whipsaw year")).toBe("Microsoft: whipsaw year");
    const long = p.fallbackTitle("Microsoft", "Three years, same logic, run on the daily chart for everyone");
    expect(long.length).toBeLessThanOrEqual(p.TITLE_MAX_LENGTH);
    expect(long.startsWith("Microsoft: ")).toBe(true);
  });

  it("says the asset the way people do", () => {
    expect(p.plainAssetName("Microsoft Corp.", "MSFT")).toBe("Microsoft");
    expect(p.plainAssetName("IREN LIMITED", "IREN")).toBe("IREN");
    expect(p.plainAssetName("MARA Holdings, Inc.", "MARA")).toBe("MARA");
    expect(p.plainAssetName(null, "GLD")).toBe("GLD");
  });

  it("the prompt carries the rules, the live titles and the last problems", () => {
    const prompt = p.namingPrompt({
      asset: "MSFT", assetName: "Microsoft", timeFrame: "1 Week", studyTitle: study.title!, scenarioTitle: "The full cycle",
      window: scenario.window!, context: ["Context line."], numberToRead: null, settingsSummary: "buys dips",
      otherTitles: ["Gold through its record bull run"], previousProblems: ["Leave YTD out of the title."],
    });
    expect(prompt).toContain("at most 48 characters");
    expect(prompt).toContain("- Gold through its record bull run");
    expect(prompt).toContain("Leave YTD out of the title.");
    expect(prompt).toContain("Weekly chart");
  });
});

describe("the draft", () => {
  it("stores the case study's figures and the chart's last bar as the test end", () => {
    const fields = p.draftFields({
      study, scenario, result: readResult(),
      naming: { title: "Microsoft through a full cycle", summary: "s", description: "d" }, asOf: "2026-11-12",
    });
    expect(fields).toMatchObject({
      asset: "MSFT", time_frame: "1 Week", algorithm: "Market Wave", title: "Microsoft through a full cycle",
      starting_capital: 100000, net_profit_usd: 111500, cash_profit_usd: 61212, asset_qty: 415,
      buy_hold_pnl_pct: 49.7, dca_pnl_pct: 21.3, benchmark_shown: "both", listed_public: true,
      test_start: "2021-11-01", test_end: "2026-08-11", test_end_source: "chart_last_bar", as_of: "2026-08-11",
    });
    expect((fields.algorithm_inputs as Record<string, unknown>).buyHoldPnlPercent).toBe(49.7);
    // With the reading: exact data window figures where they round to the case study's (EX5).
    const exact = p.draftFields({ study, scenario, result: readResult(), extraction: reading,
      naming: { title: "t", summary: "s", description: "d" }, asOf: "2026-11-12" });
    expect(exact).toMatchObject({ net_profit_usd: 111500.86, cash_profit_usd: 61212.2, asset_qty: 415, buy_hold_pnl_pct: 49.66, dca_pnl_pct: 21.33 });
    // A data window that disagrees: the case study's figure stands.
    const off = p.draftFields({ study, scenario: { ...scenario, strategyReturn: "+109.0%" }, result: readResult(), extraction: reading,
      naming: { title: "t", summary: "s", description: "d" }, asOf: "2026-11-12" });
    expect(off.net_profit_usd).toBe(109000);
    // A study that compares only with DCA hides buy and hold.
    const dcaOnly = p.draftFields({ study, scenario: { ...scenario, benchmarks: [{ name: "DCA", value: "+21.3%" }] }, result: readResult(),
      extraction: reading, naming: { title: "t", summary: "s", description: "d" }, asOf: "2026-11-12" });
    expect(dcaOnly.benchmark_shown).toBe("dca");
    expect((dcaOnly.algorithm_inputs as { benchmark: Record<string, unknown> }).benchmark).toMatchObject({ showBuyHold: false, showDca: true });
    const proOnly = p.draftFields({ study, scenario: { ...scenario, public: false }, result: readResult(), naming: { title: "t", summary: "s", description: "d" } });
    expect(proOnly.listed_public).toBe(false);
  });
});

describe("settings against the store (Phase 3 acceptance)", () => {
  it("matches #64 as published, and names each difference", () => {
    const read = readResult().recipe.algorithm_inputs;
    const stored = JSON.parse(JSON.stringify(read));
    expect(p.compareSettings(read, stored)).toEqual([]);
    stored.marketWave.buyBuffer = 7.4;
    delete stored.trendFilter.buyOnUpTrend; // an older row without the field: false
    expect(p.compareSettings(read, stored)).toEqual([{ path: "marketWave.buyBuffer", read: 7.3, stored: 7.4 }]);
    expect(p.COMPARED_SETTINGS).toHaveLength(40);
  });
});

describe("the pipeline bundle", () => {
  it("is the current build of the source", async () => {
    const script = (pkg as { scripts: Record<string, string> }).scripts["build:pipeline"];
    const banner = script.match(/--banner:js="(.*?)"/)?.[1];
    expect(banner).toBeTruthy();
    const out = await build({
      entryPoints: ["packages/core/src/pipeline.ts"],
      bundle: true, format: "esm", platform: "node", target: "node20", write: false, logLevel: "silent",
      banner: { js: banner! },
    });
    expect(readFileSync("lib/pipeline.bundle.js", "utf8")).toBe(out.outputFiles[0].text);
  });
});
