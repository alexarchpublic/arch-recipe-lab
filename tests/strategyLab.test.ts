// Phase 3: the public page check (R5, D8) and Strategy Lab's content rules (S12, C5).
import { describe, expect, it } from "vitest";
import { comparePageToStore, parsePageFigures } from "@core";
import { DEFAULT_CONTENT, DEFAULT_SECTIONS, fillTokens, formatSignedCurrency, formatSignedPercent, heroCaseLine, mergeSiteContent, publicChartScreenshot } from "@core";
import { rangeFor, relatedStrategies, testLength, topStrategies } from "../apps/strategy-lab/src/lib/strategies";

const html = `
<div data-results="a1" data-version="v2" data-slug="nvda">
  <p class="x" data-field="return_pct" data-raw="1192.435">+1192.4%</p>
  <p data-field="net_profit_usd" data-raw="1192435">$1,192,435</p>
  <span data-field="test_window">1 Jan 2022 – 22 Jun 2026</span>
</div>
<figure data-results="a1" data-version="v2"><span data-field="buy_hold_pnl_pct" data-raw="668">+668.0%</span></figure>
<div data-results="b2" data-version="v1"><p data-field="return_pct" data-raw="36.694">+36.7%</p></div>`;

const rows = [
  { id: "a1", display_number: 41, version_number: 2, return_pct: 1192.435, net_profit_usd: "1192435.000", buy_hold_pnl_pct: 668 },
  { id: "b2", display_number: 42, version_number: 1, return_pct: 36.694 },
];

describe("page figures", () => {
  it("reads each block's version and fields, merging blocks of one strategy", () => {
    const blocks = parsePageFigures(html);
    expect(blocks).toHaveLength(2);
    expect(blocks[0]).toEqual({
      strategy: "a1",
      version: "v2",
      fields: { return_pct: "1192.435", net_profit_usd: "1192435", buy_hold_pnl_pct: "668" },
    });
  });

  it("passes a page that matches the store", () => {
    expect(comparePageToStore(parsePageFigures(html), rows, ["a1", "b2"])).toEqual([]);
  });

  it("catches a stale version, a wrong value, and a missing or extra strategy", () => {
    const store = [
      { ...rows[0], version_number: 3 },
      { ...rows[1], return_pct: 40 },
      { id: "c3", display_number: 43, version_number: 1 },
    ];
    const problems = comparePageToStore(parsePageFigures(html), store, ["a1", "b2", "c3"]);
    expect(problems.map((p) => p.check).sort()).toEqual(["page_missing_strategy", "page_value", "page_version"]);
    const extra = comparePageToStore(parsePageFigures(html), [rows[0]]);
    expect(extra).toEqual([{ check: "page_extra_strategy", strategy: "b2", page: "v1" }]);
  });
});

describe("site content", () => {
  it("falls back to the defaults and ignores wrong types", () => {
    const c = mergeSiteContent([
      { key: "home", value: { hero: { headline: "Rules, not emotions.", featured: 41 }, sections: ["book", "nonsense", "top"] } },
      { key: "config", value: { finder: false, hiddenFields: ["cash_profit_usd"] } },
    ]);
    expect(c.home.hero.headline).toBe("Rules, not emotions.");
    expect(c.home.hero.featured).toBe(""); // a number is not a slug
    expect(c.home.sections).toEqual(["book", "top"]);
    expect(c.config.finder).toBe(false);
    expect(c.config.accountSize).toBe(true);
    expect(c.config.hiddenFields).toEqual(["cash_profit_usd"]);
    expect(c.booking.meetingUrl).toBe(DEFAULT_CONTENT.booking.meetingUrl);
  });

  it("builds partner pages from partner keys", () => {
    const c = mergeSiteContent([{ key: "partner:acme", value: { name: "Acme Capital", featured: ["nvda-accumulation-41", 3] } }]);
    expect(c.partners.acme.partnerId).toBe("acme");
    expect(c.partners.acme.headline).toBe("Strategy Lab for Acme Capital members");
    expect(c.partners.acme.featured).toEqual(["nvda-accumulation-41"]);
  });
});

describe("public helpers", () => {
  const s = (over: Record<string, unknown>) => ({ id: String(over.slug), slug: "x", asset: "BTC", asset_class: "Crypto", focus: "Accumulation", return_pct: 10, ...over }) as never;
  it("maps an amount to the scheduler's account-size range", () => {
    expect(rangeFor(null)).toBe("");
    expect(rangeFor(5_000)).toBe("under-10k");
    expect(rangeFor(100_000)).toBe("50k-250k");
    expect(rangeFor(5_000_000)).toBe("over-1m");
  });
  it("shows test length in months under a year (D12)", () => {
    expect(testLength(0.5)).toBe("6 months");
    expect(testLength(1.5)).toBe("1 yr 6 mo");
  });
  it("takes marketing's featured list, skipping strategies no longer published", () => {
    const all = [s({ slug: "a", return_pct: 5 }), s({ slug: "b", return_pct: 50 })];
    expect(topStrategies(all, ["gone", "a"]).map((x: { slug: string }) => x.slug)).toEqual(["a"]);
    expect(topStrategies(all, []).map((x: { slug: string }) => x.slug)).toEqual(["b", "a"]);
  });
  it("relates by asset, then class and focus", () => {
    const me = s({ slug: "me", asset: "BTC" });
    const all = [me, s({ slug: "eth", asset: "ETH" }), s({ slug: "btc2", asset: "BTC", focus: "Balanced" }), s({ slug: "spy", asset: "SPY", asset_class: "ETFs", focus: "Balanced" })];
    expect(relatedStrategies(all, me).map((x: { slug: string }) => x.slug)).toEqual(["btc2", "eth"]);
  });
});

describe("redesign: site content", () => {
  it("orders the home sections read, top, size, how, clients, book by default", () => {
    const c = mergeSiteContent([]);
    expect(DEFAULT_SECTIONS).toEqual(["read", "top", "size", "how", "clients", "book"]);
    expect(c.home.sections).toEqual(["read", "top", "size", "how", "clients", "book"]);
  });

  it("keeps finder, library and proof as valid ids outside the default order", () => {
    const c = mergeSiteContent([{ key: "home", value: { sections: ["finder", "read", "library", "proof", "size", "bogus"] } }]);
    expect(c.home.sections).toEqual(["finder", "read", "library", "proof", "size"]);
  });

  it("replaces {count} in every content string, and leaves it for the editor when no count is given", () => {
    const rows = [{ key: "home", value: { top: { title: "All {count} of them" } } }, { key: "partner:acme", value: { name: "Acme" } }];
    const live = mergeSiteContent(rows, { count: 62 });
    expect(live.home.hero.subhead.startsWith("62 backtested strategies")).toBe(true);
    expect(live.home.top.title).toBe("All 62 of them");
    expect(live.home.top.subtitle).toContain("Six of the 62");
    expect(live.partners.acme.subhead).toContain("62 backtested");
    expect(JSON.stringify(live)).not.toContain("{count}");
    const editor = mergeSiteContent(rows);
    expect(editor.home.top.title).toBe("All {count} of them");
    expect(fillTokens(["{count}", { a: "x{count}y" }, 3], 7)).toEqual(["7", { a: "x7y" }, 3]);
  });

  it("shows the hero case line only for the strategy it was written for", () => {
    const c = mergeSiteContent([{ key: "home", value: { hero: { case: { slug: "intc-lth-1w-position-74", line: "Four years of Intel going nowhere." } } } }]);
    expect(heroCaseLine(c.home, "intc-lth-1w-position-74")).toBe("Four years of Intel going nowhere.");
    expect(heroCaseLine(c.home, "nvda-accumulation-41")).toBeNull();
    expect(heroCaseLine(c.home, null)).toBeNull();
    expect(heroCaseLine(mergeSiteContent([]).home, "intc-lth-1w-position-74")).toBeNull();
  });

  it("reads market tags, ignoring unknown values and unpublished slugs", () => {
    const rows = [{ key: "market_tags", value: { "a-1": "falling", "b-2": "sideways", "c-3": "bullish", "d-4": 3, "gone-5": "rising" } }];
    expect(mergeSiteContent(rows, { publishedSlugs: ["a-1", "b-2", "c-3", "d-4"] }).marketTags).toEqual({ "a-1": "falling", "b-2": "sideways" });
    expect(mergeSiteContent(rows).marketTags).toEqual({ "a-1": "falling", "b-2": "sideways", "gone-5": "rising" });
    expect(mergeSiteContent([]).marketTags).toEqual({});
  });
});

describe("redesign: the public chart", () => {
  const shot = (url: string, order: number, kind: string | null = null) => ({ id: url, url, kind, order, sha256: null });
  it("prefers kind chart, else the first by order, else null", () => {
    expect(publicChartScreenshot([shot("s1", 1), shot("c", 0), shot("s2", 2)])?.url).toBe("c");
    expect(publicChartScreenshot([shot("first", 0, "settings"), shot("tagged", 3, "chart")])?.url).toBe("tagged");
    expect(publicChartScreenshot([shot("tie-a", 1), shot("tie-b", 1)])?.url).toBe("tie-a");
    expect(publicChartScreenshot([shot("", 0), shot("real", 1)])?.url).toBe("real");
    expect(publicChartScreenshot([])).toBeNull();
    expect(publicChartScreenshot(null)).toBeNull();
  });
});

describe("redesign: formatting", () => {
  it("groups thousands in percentages, keeping one decimal and a true minus", () => {
    expect(formatSignedPercent(1192.4)).toBe("+1,192.4%");
    expect(formatSignedPercent(-15.71)).toBe("−15.7%");
    expect(formatSignedPercent(95.855)).toBe("+95.9%");
    expect(formatSignedPercent(123456.78)).toBe("+123,456.8%");
  });
  it("prints a plus on positive dollar figures only when asked", () => {
    expect(formatSignedCurrency(95855, { plus: true })).toBe("+$95,855");
    expect(formatSignedCurrency(95855)).toBe("$95,855");
    expect(formatSignedCurrency(-656, { plus: true })).toBe("−$656");
    expect(formatSignedCurrency(0, { plus: true })).toBe("$0");
  });
});
