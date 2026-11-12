// @vitest-environment jsdom
// The admin form asks for one name (auto-ingestion NM1, acceptance: "The form
// in the admin screen asks for one name"), shows the line clients see under
// it, and flags titles that break the naming rules.
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { RecipeForm } from "@/components/RecipeForm";

const noop = () => {};
const render = (recipe: Record<string, unknown> | null, otherTitles: string[] = []) =>
  renderToStaticMarkup(<RecipeForm recipe={recipe} role="editor" otherTitles={otherTitles} onSuccess={noop} onCancel={noop} />);

describe("admin form naming", () => {
  it("asks for a title and nothing else by way of a name", () => {
    const html = render(null);
    expect(html).toContain('for="title"');
    expect(html).toContain("Title *");
    expect(html).not.toContain("Recipe Name");
    expect(html).not.toContain("Short name");
    expect(html).not.toContain('id="short_name"');
    expect(html).not.toContain('id="name"');
  });

  it("shows the line built from stored fields", () => {
    const html = render({ id: "s1", display_number: 68, asset: "MARA", time_frame: "1 Week", algorithm: "Market Wave", title: "Bitcoin miner's long run" });
    expect(html).toContain("Strategy #68 · MARA · Weekly chart · Market Wave");
    expect(html).not.toContain('data-testid="title-issues"');
  });

  it("flags a coded, duplicate title", () => {
    const html = render(
      { id: "s1", display_number: 62, asset: "IREN", time_frame: "1 Hour", algorithm: "Market Wave", title: "IREN STH 1H Scalp" },
      ["iren sth 1h scalp"],
    );
    expect(html).toContain('data-testid="title-issues"');
    expect(html).toContain("Leave STH or LTH out of the title.");
    expect(html).toContain("Another live strategy has this title.");
  });
});
