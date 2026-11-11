// Phase 2: Strategy Lab Pro (PRD section 10).
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import {
  DEFAULT_DISCLAIMER,
  PRO_SITE_URL,
  proStrategyUrl,
  scaleAlgorithmInputs,
  settingsBlockText,
  settingsForDisplay,
  displayTestEnd,
  settingsRows,
  suggestedTradingViewName,
} from "@core";
import { toPortfolioSummary } from "@/data/proStrategies";
import { LEGACY_KEY, emptyBook, exportPortfolio, migrateV1, parseBook, parseImport } from "@/data/portfolioStore";
import { versionChanges } from "@/lib/portfolio";
import { StrategyResults } from "@/components/pro/StrategyResults";
import { StrategyDetail } from "@/components/pro/StrategyDetail";
import { proStrategy } from "./fixtures/strategy";

const NOW = new Date(2026, 10, 12, 9, 0); // 12 Nov 2026, local time

// A portfolio exactly as Recipe Lab saved it in localStorage["portfolio:v1"].
const RECIPE_LAB_V1 = JSON.stringify({
  positions: {
    a: { recipeId: "a", allocationPct: 60 },
    b: { recipeId: "b", allocationPct: 40 },
  },
  initialCapital: 250000,
  recipes: {
    a: { recipeId: "a", title: "BTC Daily", assetSymbol: "BTC", baseInitialCapital: 100000, baseNetProfit: 20455, algorithm: "Arbitrage Algorithm", algorithm_inputs: { tradeSize: { entry: 1000, exit: 1200 } }, display_number: 7 },
    b: { recipeId: "b", title: "MARA Weekly", assetSymbol: "MARA", baseInitialCapital: 50000, baseCashProfit: 1000, baseNetProfit: 2000, display_number: 68 },
  },
});

describe("saved portfolios open unchanged (P11)", () => {
  it("turns Recipe Lab's portfolio into the first portfolio, same strategies, allocations and capital", () => {
    const p = migrateV1(RECIPE_LAB_V1)!;
    expect(p.name).toBe("My portfolio");
    expect(p.capital).toBe(250000);
    expect(p.positions.map((x) => [x.strategyId, x.allocationPct])).toEqual([["a", 60], ["b", 40]]);
    expect(p.positions[0].snapshot.algorithm_inputs).toEqual({ tradeSize: { entry: 1000, exit: 1200 } });
  });

  it("reads the new store first, and never re-imports Recipe Lab's portfolio once one exists", () => {
    const fromLegacy = parseBook(null, RECIPE_LAB_V1);
    expect(fromLegacy.portfolios).toHaveLength(1);
    expect(fromLegacy.portfolios[0].positions).toHaveLength(2);

    const stored = JSON.stringify({ ...emptyBook(), portfolios: [] });
    const afterDeletingAll = parseBook(stored, RECIPE_LAB_V1);
    expect(afterDeletingAll.portfolios).toHaveLength(1);
    expect(afterDeletingAll.portfolios[0].positions).toHaveLength(0);
  });

  it("survives a missing or broken store", () => {
    expect(parseBook(null, null).portfolios).toHaveLength(1);
    expect(parseBook("{not json", "also not json").portfolios[0].positions).toEqual([]);
    expect(LEGACY_KEY).toBe("portfolio:v1");
  });
});

describe("several portfolios, exportable (P10)", () => {
  it("round-trips through a file with a new id", () => {
    const p = migrateV1(RECIPE_LAB_V1)!;
    const back = parseImport(exportPortfolio(p));
    expect(back.id).not.toBe(p.id);
    expect(back.name).toBe(p.name);
    expect(back.capital).toBe(p.capital);
    expect(back.positions).toEqual(p.positions);
  });

  it("refuses a file that is not a portfolio", () => {
    expect(() => parseImport('{"hello":1}')).toThrow(/not a Strategy Lab Pro portfolio/);
    expect(() => parseImport("garbage")).toThrow();
  });
});

describe("positions pinned to a version (P12)", () => {
  it("is unchanged while the version is current", () => {
    const s = proStrategy();
    const c = versionChanges(toPortfolioSummary(s), s);
    expect(c.changed).toBe(false);
    expect(c.pinnedKnown).toBe(true);
  });

  it("flags new figures and new settings, with the change note", () => {
    const pinned = toPortfolioSummary(proStrategy());
    const next = proStrategy({
      version_id: "v3", version_number: 3, net_profit_usd: 60000, change_type: "settings", change_note: "Wider exit threshold",
      algorithm_inputs: { ...proStrategy().algorithm_inputs, exitThreshold: { enabled: true, percent: 2 } },
    });
    const c = versionChanges(pinned, next);
    expect(c.changed).toBe(true);
    expect(c.fromVersion).toBe(2);
    expect(c.toVersion).toBe(3);
    expect(c.figures.map((f) => [f.field, f.before, f.after])).toEqual([["net_profit", 55848, 60000]]);
    expect(c.settingsChanged).toBe(true);
    expect(c.changeNote).toBe("Wider exit threshold");
  });

  it("does not ask clients to act on a wording-only version", () => {
    const pinned = toPortfolioSummary(proStrategy());
    const c = versionChanges(pinned, proStrategy({ version_id: "v3", version_number: 3, change_type: "copy", title: "New title" }));
    expect(c.changed).toBe(false);
  });

  it("compares a Recipe Lab snapshot by its figures, and hides the internal baseline note", () => {
    const old = migrateV1(RECIPE_LAB_V1)!.positions[1].snapshot; // no version kept
    const cur = proStrategy({ id: "b", starting_capital: 50000, cash_profit_usd: 1000, net_profit_usd: 2500, change_type: "baseline", change_note: "Baseline: copied unchanged" });
    const c = versionChanges(old, cur);
    expect(c.pinnedKnown).toBe(false);
    expect(c.changed).toBe(true);
    expect(c.changeNote).toBeNull();
  });
});

describe("guided apply rows (P15, P16)", () => {
  const mw = proStrategy({
    algorithm_inputs: {
      userInitialCapital: { startingCash: 100000, startingQty: 0 },
      longThreshold: { enabled: true, percent: -0.3 },
      tradeSize: { percentEnabled: true, entryPercent: 87, exitPercent: 97, fixedEnabled: true, entryFixed: 5000, exitFixed: 6000 },
      marketWave: { scope: 8, onlyBuyBelow: true, buyBuffer: 8.8 },
      dates: { start: { year: 2024, month: 1, day: 1, hour: 0, minute: 30 }, end: { year: 2999, month: 1, day: 28 } },
    },
  });

  it("fills in today's start, never prints the stored end year, and copies plain numbers", () => {
    const inputs = scaleAlgorithmInputs(mw.algorithm_inputs, 0.5, mw.algorithm);
    const rows = settingsRows({ algorithm: mw.algorithm, inputs, mode: "apply", asset: mw.asset, assetClass: mw.asset_class, timeFrame: mw.time_frame, now: NOW });
    const byKey = Object.fromEntries(rows.map((r) => [r.key, r]));
    expect(byKey["dates.start"]).toMatchObject({ value: "2026-11-12 00:30", copy: "2026-11-12 00:30", prefilled: true });
    expect(byKey["dates.end"].copy).toBeNull();
    expect(byKey["dates.end"].value).toMatch(/future/);
    expect(byKey["userInitialCapital.startingCash"]).toMatchObject({ value: "$50,000", copy: "50000" });
    expect(byKey["tradeSize.entryFixed"]).toMatchObject({ value: "$2,500", copy: "2500" });
    expect(byKey["longThreshold.percent"]).toMatchObject({ value: "-0.3%", copy: "-0.3" });
    expect(byKey["marketWave.onlyBuyBelow"]).toMatchObject({ checkbox: true, copy: null });
    const block = settingsBlockText(["Header"], rows);
    expect(block).not.toMatch(/2999|2030/);
  });

  it("keeps TradingView's panel order", () => {
    const rows = settingsRows({ algorithm: mw.algorithm, inputs: mw.algorithm_inputs, mode: "apply", now: NOW });
    const sections = [...new Set(rows.map((r) => r.section))];
    expect(sections).toEqual(["Chart", "User initial capital", "Order entry & exit rules", "Trade size", "Market Wave", "Dates"]);
  });

  it("shows the test end, read from the chart, on the strategy page", () => {
    const inputs = settingsForDisplay(mw.algorithm_inputs, mw.algorithm, displayTestEnd(mw));
    const rows = settingsRows({ algorithm: mw.algorithm, inputs, mode: "as_tested" });
    expect(rows.find((r) => r.key === "dates.end")?.value).toBe("2026-07-23");
  });

  it("names the TradingView setup as Recipe Lab did, so client setups still match", () => {
    const inputs = scaleAlgorithmInputs(mw.algorithm_inputs, 1.5, mw.algorithm);
    expect(suggestedTradingViewName({ displayNumber: 68, algorithm: "Market Wave", inputs, capitalAllocated: 150000, now: NOW })).toBe(
      "R68 MW Start(2026-11-12) ($150,000) $7,500/$9,000 Scope(8)",
    );
    expect(
      suggestedTradingViewName({ displayNumber: 7, algorithm: "Arbitrage Algorithm", inputs: { tradeSize: { entry: 1000, exit: 1200 } }, capitalAllocated: 100000, now: NOW }),
    ).toBe("R7 AA Start(2026-11-12) ($100,000) $1,000/$1,200");
  });
});

function render(node: React.ReactNode): string {
  const qc = new QueryClient({ defaultOptions: { queries: { enabled: false } } });
  return renderToStaticMarkup(
    <QueryClientProvider client={qc}>
      <MemoryRouter>{node}</MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("every results block carries the basis label and disclaimer slot (C1, C2, P5)", () => {
  it("on a card and on the strategy page", () => {
    for (const variant of ["card", "full"] as const) {
      const html = render(<StrategyResults strategy={proStrategy()} capital={50000} variant={variant} />);
      expect(html).toContain('data-disclosure="basis"');
      expect(html).toContain("Backtested results");
      expect(html).toContain('data-disclosure="disclaimer"');
      expect(html).toContain(DEFAULT_DISCLAIMER);
    }
  });

  it("uses the wording set in the admin console", () => {
    const html = render(<StrategyResults strategy={proStrategy()} disclaimer="Counsel's wording." />);
    expect(html).toContain("Counsel&#x27;s wording.");
  });
});

describe("the strategy page reads figures from the store (R5, build-time check for Pro)", () => {
  it("carries each figure's field and raw store value, and never a run-setting year", () => {
    const s = proStrategy();
    const html = render(<StrategyDetail strategy={s} capital={s.starting_capital} />);
    const pairs = [...html.matchAll(/data-field="([a-z_]+)" data-raw="([^"]+)"/g)].map((m) => [m[1], Number(m[2])]);
    const raw = Object.fromEntries(pairs);
    expect(raw.net_profit_usd).toBe(s.net_profit_usd);
    expect(raw.return_pct).toBe(s.return_pct);
    expect(raw.cagr_pct).toBe(s.cagr_pct);
    expect(raw.vs_buy_hold_pct).toBe(s.vs_buy_hold_pct);
    expect(html).not.toMatch(/2999|2030/);
    expect(html).toContain('data-version="v2"');
  });
});

describe("one setting for Pro's address (rename checklist)", () => {
  it("builds strategy links from it", () => {
    expect(PRO_SITE_URL).toBe("https://recipes.archpublic.com");
    expect(proStrategyUrl(68)).toBe("https://recipes.archpublic.com/strategy/68");
  });
});

describe("new since your last visit (P9)", () => {
  it("compares against the end of the previous visit, and a reload does not start a new one", async () => {
    const store = new Map<string, string>();
    (globalThis as { localStorage?: unknown }).localStorage = {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
      removeItem: (k: string) => void store.delete(k),
    };
    const { startVisit, touchVisit } = await import("@/data/preferences");
    const t = (h: number, m = 0) => new Date(Date.UTC(2026, 10, 12, h, m));
    expect(startVisit(t(9))).toBeNull(); // first visit ever
    touchVisit(t(9, 20));
    expect(startVisit(t(9, 25))).toBeNull(); // reload in the same visit
    expect(startVisit(t(15))).toBe(t(9, 25).toISOString()); // next visit
    expect(startVisit(t(15, 5))).toBe(t(9, 25).toISOString()); // reload keeps it
    delete (globalThis as { localStorage?: unknown }).localStorage;
  });
});

describe("change notes clients read (P7, D10)", () => {
  const cleanup =
    "Phase 1 clean-up: test end 22 Oct 2026 read from the last bar on the chart (11 Nov: live 6h bar). The 2030-01-28 in the settings is the TradingView run setting.";

  it("summarises the Phase 1 review notes and never prints a run-setting year", async () => {
    const { clientChangeNote, CLEANUP_CLIENT_NOTE } = await import("@core");
    expect(clientChangeNote({ change_type: "figures", change_note: cleanup })).toBe(CLEANUP_CLIENT_NOTE);
    expect(clientChangeNote({ change_type: "settings", change_note: "Runs to 2999 now" })).toBeNull();
    expect(clientChangeNote({ change_type: "baseline", change_note: "Baseline: copied unchanged" })).toBeNull();
    expect(clientChangeNote({ change_type: "settings", change_note: "Wider exit threshold" })).toBe("Wider exit threshold");
  });

  it("keeps them off the strategy page and the portfolio update notice", () => {
    const s = proStrategy({ change_note: cleanup });
    const html = render(<StrategyDetail strategy={s} capital={s.starting_capital} />);
    expect(html).not.toMatch(/2030|2999|audit|bar timer/);
    expect(html).toContain("Test end date set to the last bar on the chart");
    const c = versionChanges(toPortfolioSummary(proStrategy({ version_id: "v1", version_number: 1, net_profit_usd: 1 })), s);
    expect(c.changeNote).not.toMatch(/2030/);
  });
});
