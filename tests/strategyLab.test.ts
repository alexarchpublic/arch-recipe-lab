// Phase 3: the public page check (R5, D8) and Strategy Lab's content rules (S12, C5).
import { describe, expect, it } from "vitest";
import { comparePageToStore, parsePageFigures } from "@core";
import { DEFAULT_CONTENT, mergeSiteContent } from "@core";
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

describe("case study links", () => {
  it("maps each strategy number to the scenarios that show it, newest study first", async () => {
    const { getCaseStudyLinks } = await import("../apps/strategy-lab/src/lib/caseStudies");
    const manifest = {
      studies: [
        { slug: "old", title: "Old study", url: "https://archpublic.com/case-studies/old/", published: "2026-06-01", strategies: [{ number: 41, scenario: "A", anchor: "scenario-2", window: "2022 to 2026" }] },
        { slug: "new", title: "New study", url: "https://archpublic.com/case-studies/new/", published: "2026-09-01", strategies: [{ number: 41, scenario: "B", anchor: "scenario-1" }, { number: "x", scenario: "bad", anchor: "scenario-3" }] },
        { slug: "none", title: "No links", url: "u", published: "2026-10-01" },
      ],
    };
    const real = globalThis.fetch;
    globalThis.fetch = (async () => new Response(JSON.stringify(manifest))) as typeof fetch;
    try {
      const links = await getCaseStudyLinks();
      expect([...links.keys()]).toEqual([41]);
      expect(links.get(41)!.map((l) => [l.slug, l.url])).toEqual([
        ["new", "https://archpublic.com/case-studies/new/#scenario-1"],
        ["old", "https://archpublic.com/case-studies/old/#scenario-2"],
      ]);
      globalThis.fetch = (async () => new Response("down", { status: 503 })) as typeof fetch;
      expect((await getCaseStudyLinks()).size).toBe(0);
    } finally {
      globalThis.fetch = real;
    }
  });
});
