// Strategy Lab's old addresses (PRD 13, Redirects): the list next.config.mjs
// turns into server redirects, the "Older links" page and /redirects.json.
import { describe, expect, it } from "vitest";
import { LIST_PATH, movedKey, movedList } from "../apps/strategy-lab/src/lib/moved-list.mjs";

const row = (n: number | null, slug: string, id = `${String(n ?? 0).padStart(8, "0")}-aaaa-bbbb-cccc-000000000000`) => ({
  id,
  slug,
  display_number: n,
  title: `Strategy ${n}`,
  asset: "BTC",
});

describe("movedList", () => {
  it("gives /recipes, then each strategy's record id and number, straight to its page", () => {
    const list = movedList([row(22, "aggressive-accumulation-22"), row(99, "bought-nvidia-99")]);
    expect(list.map((m) => [m.from, m.to])).toEqual([
      ["/recipes", LIST_PATH],
      ["/recipes/00000022-aaaa-bbbb-cccc-000000000000", "/aggressive-accumulation-22"],
      ["/strategy/22", "/aggressive-accumulation-22"],
      ["/recipes/00000099-aaaa-bbbb-cccc-000000000000", "/bought-nvidia-99"],
      ["/strategy/99", "/bought-nvidia-99"],
    ]);
    expect(list[2].label).toBe("#22 Strategy 22 (BTC)");
  });

  it("gives no number link to a strategy without a number", () => {
    const list = movedList([row(null, "unnumbered")]);
    expect(list.map((m) => m.from)).toEqual(["/recipes", "/recipes/00000000-aaaa-bbbb-cccc-000000000000"]);
  });

  it("refuses a page address that is not a plain path part", () => {
    expect(() => movedList([row(1, "https://elsewhere.com")])).toThrow(/cannot be a redirect target/);
    expect(() => movedList([row(1, "a/b")])).toThrow(/cannot be a redirect target/);
    expect(() => movedList([row(1, "")])).toThrow(/cannot be a redirect target/);
  });

  it("refuses a page address the site already uses", () => {
    expect(() => movedList([row(1, "strategies")])).toThrow(/already uses/);
    expect(() => movedList([row(1, "recipes")])).toThrow(/already uses/);
  });

  it("refuses an address listed twice", () => {
    expect(() => movedList([row(5, "a-5"), row(5, "b-5", "11111111-aaaa-bbbb-cccc-000000000000")])).toThrow(/listed twice/);
  });

  it("refuses an unexpected record id or number", () => {
    expect(() => movedList([row(1, "a-1", "../../etc")])).toThrow(/record id/);
    expect(() => movedList([{ ...row(1, "a-1"), display_number: "1/2" as unknown as number }])).toThrow(/number/);
  });
});

describe("movedKey", () => {
  it("ignores order and labels, and sees a changed target", () => {
    const a = [
      { from: "/strategy/1", to: "/one-1" },
      { from: "/recipes", to: "/strategies" },
    ];
    expect(movedKey(a)).toBe(movedKey([...a].reverse()));
    expect(movedKey(a)).not.toBe(movedKey([{ from: "/strategy/1", to: "/one-renamed-1" }, a[1]]));
  });
});
