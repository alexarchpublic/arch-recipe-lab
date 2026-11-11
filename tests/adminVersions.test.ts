// Admin console mappings (PRD section 8): a version row to the form and to
// the client preview, and the form back to draft fields.
import { describe, expect, it } from "vitest";
import {
  type AdminVersion,
  benchmarkShownFor,
  countChecks,
  diffVersions,
  EDITABLE_FIELDS,
  firstNumber,
  formToVersionFields,
  groupVersions,
  normalizeVersionRow,
  runEndIsInFuture,
  runWindow,
  versionToFormRecipe,
  versionToProStrategy,
} from "@/data/adminVersions";

const marketWaveInputs = (end = { year: 2999, month: 1, day: 28 }) => ({
  userInitialCapital: { startingCash: 100000, startingQty: 0 },
  longThreshold: { percent: -4 },
  exitThreshold: { percent: 4 },
  tradeSize: { percentEnabled: true },
  marketWave: { scope: 30 },
  dates: { start: { year: 2024, month: 1, day: 1, hour: 0, minute: 30 }, end },
  benchmark: { showDca: true, showBuyHold: true },
});

function version(overrides: Partial<Record<string, unknown>> = {}): AdminVersion {
  return normalizeVersionRow({
    id: "v-2",
    strategy_id: "s-1",
    version_number: 2,
    status: "draft",
    change_type: "figures",
    change_note: "Real end date",
    display_number: 68,
    archived_at: null,
    is_current: false,
    slug: "mara-lth-1w-position-68",
    title: "MARA weekly accumulation",
    short_name: "MARA LTH 1W Position",
    name: "[MARA] LTH 1W Position",
    asset: "MARA",
    asset_class: "Equities",
    algorithm: "Market Wave",
    strategy_type: "Market Wave",
    time_horizon: "LTH",
    focus: "Accumulation",
    time_frame: "1 Week",
    listed_public: true,
    goal: "MARA 1W Market Wave position",
    basis: "backtested",
    starting_capital: "100000",
    test_start: "2024-01-01",
    test_end: "2026-07-23",
    test_end_source: "chart_last_bar",
    as_of: "2026-08-13",
    net_profit_usd: "55848",
    net_profit_text: "$55,848",
    cash_profit_usd: "40721.1",
    asset_qty: "5329",
    asset_accumulated_text: "5329 MARA",
    asset_unit: "MARA",
    buy_hold_pnl_pct: "-47.06",
    dca_pnl_pct: "-14.39",
    benchmark_shown: "both",
    return_pct: "55.848",
    cagr_pct: "18.9",
    algorithm_inputs: marketWaveInputs(),
    screenshots: [
      { id: "b", url: "https://x/settings.png", kind: "settings", order: 1, sha256: null },
      { id: "a", url: "https://x/chart.png", kind: "chart", order: 0, sha256: null },
    ],
    checks: [
      { code: "no_extraction", level: "warning", message: "…" },
      { code: "no_screenshots", level: "review", message: "…" },
    ],
    acknowledged_checks: [],
    created_by: "alex@archpublic.com",
    created_at: "2026-11-11T00:00:00Z",
    updated_at: "2026-11-11T00:00:00Z",
    published_at: null,
    ...overrides,
  });
}

describe("version rows", () => {
  it("normalises numbers and orders screenshots", () => {
    const v = version();
    expect(v.starting_capital).toBe(100000);
    expect(v.cash_profit_usd).toBeCloseTo(40721.1);
    expect(v.screenshots.map((s) => s.kind)).toEqual(["chart", "settings"]);
    expect(countChecks(v)).toEqual({ error: 0, review: 1, warning: 1 });
  });

  it("maps to the client preview with the strategy id and version id", () => {
    const p = versionToProStrategy(version());
    expect(p.id).toBe("s-1");
    expect(p.version_id).toBe("v-2");
    expect(p.test_end).toBe("2026-07-23");
    expect(p.screenshots[0].kind).toBe("chart");
  });

  it("maps to the legacy names the form reads", () => {
    const f = versionToFormRecipe(version());
    expect(f.id).toBe("s-1");
    expect(f.initial_capital).toBe(100000);
    expect(f.net_profit).toBe("$55,848");
    expect(f.asset_accumulated).toBe("5329 MARA");
    expect(f.cash_profit).toBeCloseTo(40721.1);
    expect(f.buy_hold_pnl_percent).toBeCloseTo(-47.06);
    expect(f.test_end_chart).toBe("2026-07-23");
    expect(f.change_note).toBe("Real end date");
    // A published version starts a new draft: no note, no extraction carried over.
    const fromPublished = versionToFormRecipe(version({ status: "published", extraction_id: "x" }));
    expect(fromPublished.change_note).toBe("");
    expect(fromPublished.extraction_id).toBeNull();
    // Net profit falls back to the number when there is no text.
    expect(versionToFormRecipe(version({ net_profit_text: null })).net_profit).toBe("55848");
  });

  it("groups versions per strategy: published, open draft, history newest first", () => {
    const groups = groupVersions([
      version({ id: "v-1", version_number: 1, status: "published" }),
      version(),
      version({ id: "w-1", strategy_id: "s-2", display_number: 70, version_number: 1, status: "published" }),
    ]);
    expect(groups.map((g) => g.displayNumber)).toEqual([70, 68]);
    const g = groups[1];
    expect(g.published?.id).toBe("v-1");
    expect(g.draft?.id).toBe("v-2");
    expect(g.history.map((v) => v.version_number)).toEqual([2, 1]);
  });

  it("diffs a draft against the published version", () => {
    const d = diffVersions(version({ status: "published", test_end: "2999-01-28" }), version());
    expect(d.map((x) => x.field)).toEqual(["test_end"]);
    expect(diffVersions(null, version()).length).toBeGreaterThan(5);
  });
});

describe("form to draft fields", () => {
  it("reads the first number only: a bracketed note cannot join the digits", () => {
    expect(firstNumber("$20,455 (87% from BTC growth, 13% cash)")).toBe(20455);
    expect(firstNumber("$1,187,041")).toBe(1187041);
    expect(firstNumber("3858 IREN")).toBe(3858);
    expect(firstNumber("0.92 BTC @ $104,000")).toBe(0.92);
    expect(firstNumber("-$656")).toBe(-656);
    expect(firstNumber("")).toBeNull();
    expect(firstNumber(undefined)).toBeNull();
  });

  it("chooses the benchmark the way Recipe Lab displayed it", () => {
    expect(benchmarkShownFor("Market Wave", { benchmark: { showDca: true } }, 30, 12)).toBe("both");
    expect(benchmarkShownFor("Market Wave", { benchmark: { showDca: true, showBuyHold: false } }, 30, 12)).toBe("dca");
    expect(benchmarkShownFor("Market Wave", {}, 30, 12)).toBe("buy_hold");
    expect(benchmarkShownFor("Market Wave", { showDcaBenchmark: true }, null, 12)).toBe("dca");
    expect(benchmarkShownFor("Market Wave", { showBuyHoldBenchmark: false }, 30, null)).toBe("none");
    expect(benchmarkShownFor("Oracle Protocol", {}, 30, 12)).toBe("none");
  });

  it("spots a far-future run end (D10)", () => {
    expect(runEndIsInFuture("Market Wave", marketWaveInputs(), "2026-11-11")).toBe(true);
    expect(runEndIsInFuture("Market Wave", marketWaveInputs({ year: 2026, month: 7, day: 1 }), "2026-11-11")).toBe(false);
    expect(runWindow("Intelligence Algorithm", { start: { year: 2019, month: 1, day: 1 }, end: { year: 2025, month: 1, day: 1 } }))
      .toEqual({ start: "2019-01-01", end: "2025-01-01" });
  });

  const form = {
    name: "[MARA] LTH 1W Position",
    asset_class: "Equities",
    asset: "mara",
    time_horizon: "LTH",
    focus: "Accumulation",
    goal: "MARA 1W Market Wave position",
    time_frame: "1 Week",
    initial_capital: 100000,
    cash_profit: 40721.1,
    asset_accumulated: "5329 MARA",
    net_profit: "$55,848",
    algorithm: "Market Wave",
    algorithm_inputs: marketWaveInputs(),
    as_of: "2026-08-13",
    test_end_chart: "2026-07-23",
    title: "",
    slug: "",
    change_note: "Real end date from the chart",
  };
  const opts = { role: "editor" as const, strategyType: "Market Wave", buyHoldPnlPct: -47.06, dcaPnlPct: -14.39, extractionId: "x-1" };

  it("maps the form to version fields the database accepts", () => {
    const f = formToVersionFields(form, opts);
    expect(Object.keys(f).every((k) => (EDITABLE_FIELDS as readonly string[]).includes(k))).toBe(true);
    expect(f.asset).toBe("MARA");
    expect(f.starting_capital).toBe(100000);
    expect(f.net_profit_usd).toBe(55848);
    expect(f.net_profit_text).toBe("$55,848");
    expect(f.asset_qty).toBe(5329);
    expect(f.test_start).toBe("2024-01-01");
    expect(f.test_end).toBe("2026-07-23");
    expect(f.test_end_source).toBe("chart_last_bar");
    expect(f.benchmark_shown).toBe("both");
    expect(f.title).toBe(form.goal); // blank title defaults to the goal
    expect(f.short_name).toBe("MARA LTH 1W Position");
    expect(f.extraction_id).toBe("x-1");
    expect("slug" in f).toBe(false); // blank slug: the database keeps or makes one
    expect("cagr" in f).toBe(false); // derived in the database (D3)
  });

  it("uses the settings end when it is real", () => {
    const f = formToVersionFields(
      { ...form, test_end_chart: "", algorithm_inputs: marketWaveInputs({ year: 2026, month: 7, day: 1 }) },
      opts,
    );
    expect(f.test_end).toBe("2026-07-01");
    expect(f.test_end_source).toBe("settings");
  });

  it("sends copy only for a marketing editor (A10)", () => {
    const f = formToVersionFields({ ...form, title: "Better title" }, { ...opts, role: "marketing_editor" });
    expect(Object.keys(f).sort()).toEqual(["change_note", "goal", "short_name", "title"]);
    expect(f.title).toBe("Better title");
  });
});
