// The R8 content rules on fixtures (redesign PRD 11): the public chart is
// allowed, whole, as chart_url; a settings field or a second screenshot in a
// public row still fails, and so does a page carrying a screenshot that is no
// public row's chart.
import { describe, expect, it } from "vitest";
// @ts-expect-error -- plain ESM script without type declarations
import { PUBLIC_COLUMNS, checkPageHtml, checkPublicRows, screenshotPathsIn } from "../scripts/r8-rules.mjs";

const HOST = "https://xsoixhltejgyuhedhbdu.supabase.co/storage/v1/object/public/recipe-screenshots";
const row = (over: Record<string, unknown> = {}) => ({
  ...Object.fromEntries((PUBLIC_COLUMNS as string[]).map((c) => [c, null])),
  id: "a",
  display_number: 74,
  slug: "intc-lth-1w-position-74",
  test_end: "2022-04-01",
  chart_url: `${HOST}/abc/chart.png`,
  ...over,
});

type Problem = { check: string; detail: string };

describe("R8 rules: public rows", () => {
  it("passes a row whose only screenshot is its chart_url", () => {
    expect(checkPublicRows([row(), row({ id: "b", display_number: 24, chart_url: null })])).toEqual([]);
  });

  it("fails a settings field in a public row", () => {
    const p: Problem[] = checkPublicRows([row({ algorithm_inputs: { tradeSize: 5 } })]);
    expect(p.map((x) => x.check)).toContain("public view columns");
    expect(p.map((x) => x.check)).toContain("no settings in the public view");
  });

  it("fails a second screenshot in a public row", () => {
    const p: Problem[] = checkPublicRows([row({ goal: `See ${HOST}/abc/settings-2.png` })]);
    expect(p.map((x) => x.check)).toContain("source screenshots only as chart_url");
  });

  it("fails a screenshot list exposed as a column", () => {
    const p: Problem[] = checkPublicRows([row({ screenshots: [{ url: `${HOST}/abc/chart.png` }, { url: `${HOST}/abc/s2.png` }] })]);
    expect(p.length).toBeGreaterThan(0);
  });

  it("fails a source screenshot in public_chart_url", () => {
    const p: Problem[] = checkPublicRows([row({ public_chart_url: `${HOST}/abc/chart.png` })]);
    expect(p.map((x) => x.check)).toEqual(expect.arrayContaining(["source screenshots only as chart_url", "public_chart_url in the public location"]));
  });

  it("fails a run-setting year", () => {
    const p: Problem[] = checkPublicRows([row({ test_end: "2999-01-28" })]);
    expect(p.map((x) => x.check)).toContain("no run-setting end years");
  });
});

describe("R8 rules: public pages", () => {
  const charts = [`${HOST}/abc/chart.png`];
  const optimized = `/strategy-lab/_next/image?url=${encodeURIComponent(`${HOST}/abc/chart.png`)}&amp;w=828&amp;q=75`;

  it("finds screenshot addresses, raw and URL-encoded", () => {
    expect(screenshotPathsIn(`<img src="${optimized}"><a href="${HOST}/abc/chart.png">`)).toEqual(["abc/chart.png"]);
  });

  it("passes a page showing public charts, raw or through the image optimizer", () => {
    expect(checkPageHtml(`<a href="${HOST}/abc/chart.png"><img src="${optimized}" srcset="${optimized} 1x"></a>`, charts)).toEqual([]);
  });

  it("fails a page carrying a screenshot that is no public chart", () => {
    const other = `/strategy-lab/_next/image?url=${encodeURIComponent(`${HOST}/abc/settings-2.png`)}&amp;w=828`;
    expect(checkPageHtml(`<img src="${other}">`, charts)[0]).toMatch(/no public chart/);
  });

  it("fails settings and run-setting years in page data", () => {
    expect(checkPageHtml(`self.__next_f.push([1,"{\\"tradeSize\\":5}"])`, charts)).toContain("a settings key");
    expect(checkPageHtml(`<p>ends 2030-01-01</p>`, charts)).toContain("a 2030 or 2999 date");
  });
});
