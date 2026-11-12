// One title per strategy and the line under it (auto-ingestion NM1 to NM6, NO5).
import { describe, expect, it } from "vitest";
import { strategyLine, timeFrameLabel, titleProblems, TITLE_MAX_LENGTH } from "@core/naming";

describe("the line under the title", () => {
  it("is built from stored fields", () => {
    expect(strategyLine({ display_number: 68, asset: "MARA", time_frame: "1 Week", algorithm: "Market Wave" }))
      .toBe("Strategy #68 · MARA · Weekly chart · Market Wave");
    expect(strategyLine({ display_number: 62, asset: "IREN", time_frame: "1 Hour", algorithm: "Market Wave" }))
      .toBe("Strategy #62 · IREN · Hourly chart · Market Wave");
  });

  it("drops what is missing", () => {
    expect(strategyLine({ display_number: null, asset: "BTC", time_frame: null, algorithm: "Oracle Protocol" }))
      .toBe("BTC · Oracle Protocol");
  });

  it("names every time frame in words", () => {
    expect(["1 Week", "1 Day", "6 Hours", "4 Hours", "1 Hour"].map(timeFrameLabel)).toEqual([
      "Weekly chart", "Daily chart", "6-hour chart", "4-hour chart", "Hourly chart",
    ]);
  });
});

describe("title rules", () => {
  it("passes the PRD's example titles", () => {
    for (const t of [
      "Microsoft through a whipsaw year",
      "Trading Apple's chop for cash yield",
      "Capturing Apple's long uptrend",
      "Gold through its record bull run",
      "Alphabet: cash yield at all-time highs",
    ]) {
      expect(titleProblems(t), t).toEqual([]);
    }
  });

  it("rejects codes, brackets and algorithm names (NM3)", () => {
    expect(titleProblems("IREN STH 1H Scalp").length).toBeGreaterThanOrEqual(3);
    expect(titleProblems("MSFT 2026 YTD")).toContain("Leave YTD out of the title.");
    expect(titleProblems("[MARA] weekly trend")).toContain("Leave brackets out of the title.");
    expect(titleProblems("Gold with Market Wave")).toContain("Leave the algorithm name out of the title.");
  });

  it("rejects figures and promises (NM4)", () => {
    expect(titleProblems("Bitcoin up 120%")).toContain("Leave return figures out of the title.");
    expect(titleProblems("The best way to hold Gold")).toContain("Leave promises and superlatives out of the title.");
  });

  it("limits length (NM5) and asks for a unique title (NM6)", () => {
    expect(titleProblems("x".repeat(TITLE_MAX_LENGTH))).toEqual([]);
    expect(titleProblems("x".repeat(TITLE_MAX_LENGTH + 1))[0]).toMatch(/49 characters/);
    expect(titleProblems("Gold through its record bull run", { otherTitles: ["gold through its  record bull run"] }))
      .toContain("Another live strategy has this title.");
  });
});
