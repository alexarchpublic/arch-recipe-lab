// Links between strategies and case studies (auto-ingestion Phase 2: LK1,
// LK2, LK5, LK6, LK7, LK11).
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { CASE_STUDIES_URL, DEFAULT_CASE_STUDIES_URL, type CaseStudyRef, caseStudyPageUrl, caseStudyUrl } from "@core";
import { StrategyDetail } from "@/components/pro/StrategyDetail";
import { StrategyCard } from "@/components/pro/StrategyCard";
import { studyLinks } from "../apps/strategy-lab/src/lib/caseStudies";
import { PreferencesProvider } from "@/hooks/usePreferences";
import { PortfolioProvider } from "@/hooks/usePortfolio";
import { proStrategy } from "./fixtures/strategy";

const ORIGIN: CaseStudyRef = {
  slug: "oracle-protocol", title: "Dynamics of The Oracle Protocol", scenario_key: "ethereum-volatility-harvesting",
  anchor: "scenario-5", scenario_title: "Ethereum: volatility harvesting", published_on: "2025-10-05", role: "origin",
};
const FEATURED: CaseStudyRef = {
  slug: "enduring-the-drop", title: "Enduring The Drop", scenario_key: "ethereum-strategy-18",
  anchor: "scenario-5", scenario_title: "Ethereum: Strategy #18", published_on: "2025-11-21", role: "featured",
};

function render(node: React.ReactNode): string {
  const qc = new QueryClient({ defaultOptions: { queries: { enabled: false } } });
  return renderToStaticMarkup(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <PreferencesProvider>
          <PortfolioProvider>{node}</PortfolioProvider>
        </PreferencesProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("case study addresses", () => {
  it("default to archpublic.com, where every study page is captured (LK8)", () => {
    expect(DEFAULT_CASE_STUDIES_URL).toBe("https://archpublic.com/case-studies");
    expect(CASE_STUDIES_URL).toBe(DEFAULT_CASE_STUDIES_URL);
    expect(caseStudyPageUrl("msft")).toBe("https://archpublic.com/case-studies/msft/");
  });

  it("land on the scenario and name the lab and the strategy (LK5, LK11)", () => {
    const url = new URL(caseStudyUrl(ORIGIN, { source: "strategy_lab", displayNumber: 18 }));
    expect(url.origin + url.pathname).toBe("https://archpublic.com/case-studies/oracle-protocol/");
    expect(url.hash).toBe("#scenario-5");
    expect(Object.fromEntries(url.searchParams)).toEqual({
      utm_source: "strategy_lab", utm_medium: "web", utm_campaign: "case_study_links", utm_content: "strategy-18",
      scenario: "scenario-5",
    });
    expect(caseStudyUrl(ORIGIN, { source: "strategy_lab_pro" }, "https://example.com/cs/")).toBe(
      "https://example.com/cs/oracle-protocol/?utm_source=strategy_lab_pro&utm_medium=web&utm_campaign=case_study_links&scenario=scenario-5#scenario-5",
    );
  });
});

describe("the public lab reads links from the view (LK1, LK2)", () => {
  it("keeps the view's order, origin first", () => {
    const links = studyLinks({ display_number: 18, case_studies: [ORIGIN, FEATURED] });
    expect(links.map((l) => [l.slug, l.origin])).toEqual([["oracle-protocol", true], ["enduring-the-drop", false]]);
    expect(links[0].url).toContain("utm_source=strategy_lab&");
    expect(links[0].studyUrl).toBe("https://archpublic.com/case-studies/oracle-protocol/");
  });

  it("gives nothing for a strategy with no case study (LK6)", () => {
    expect(studyLinks({ display_number: 3, case_studies: [] })).toEqual([]);
    expect(studyLinks({ display_number: 3, case_studies: undefined })).toEqual([]);
  });
});

describe("Strategy Lab Pro shows the case study (LK2)", () => {
  it("on the strategy page: origin, then Also featured in", () => {
    const s = proStrategy({ display_number: 18, case_studies: [ORIGIN, FEATURED] });
    const html = render(<StrategyDetail strategy={s} capital={s.starting_capital} />);
    expect(html).toContain("From the case study");
    expect(html).toContain('data-case-studies="2"');
    expect(html.indexOf("Dynamics of The Oracle Protocol")).toBeLessThan(html.indexOf("Also featured in"));
    expect(html).toContain("Enduring The Drop");
    expect(html).toContain("utm_source=strategy_lab_pro&amp;utm_medium=web&amp;utm_campaign=case_study_links&amp;utm_content=strategy-18&amp;scenario=scenario-5#scenario-5");
  });

  it("on the card: the origin only", () => {
    const s = proStrategy({ display_number: 18, case_studies: [ORIGIN, FEATURED] });
    const html = render(<StrategyCard strategy={s} capital={s.starting_capital} />);
    expect(html).toContain("From the case study:");
    expect(html).toContain('data-case-study="oracle-protocol"');
    expect(html).not.toContain("Enduring The Drop");
  });

  it("shows no section and no empty space without one (LK6)", () => {
    const s = proStrategy({ case_studies: [] });
    expect(render(<StrategyDetail strategy={s} capital={s.starting_capital} />)).not.toContain("From the case study");
    expect(render(<StrategyCard strategy={s} capital={s.starting_capital} />)).not.toContain("From the case study");
  });
});
