// Names and addresses (PRD section 5 and the rename checklist in section 13).
//
// The Pro address used to be hard-coded in seven places. It is one setting
// now, because the dev team chooses Pro's final address at the login move.
// Override it with PRO_SITE_URL (server) or VITE_PRO_SITE_URL (browser build).

const fromEnv = (name = "PRO_SITE_URL"): string | undefined => {
  try {
    // Edge functions and Node.
    const p = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process;
    const v = p?.env?.[name] || p?.env?.[`VITE_${name}`];
    if (v) return v;
  } catch {
    // no process in the browser
  }
  try {
    // Vite replaces import.meta.env at build time. Named one by one: Vite only
    // replaces static property reads.
    const env = (import.meta as unknown as { env?: Record<string, string | undefined> }).env;
    const v = name === "CASE_STUDIES_URL" ? env?.VITE_CASE_STUDIES_URL : env?.VITE_PRO_SITE_URL;
    if (v) return v;
  } catch {
    // not built by Vite
  }
  return undefined;
};

export const DEFAULT_PRO_SITE_URL = "https://recipes.archpublic.com";
export const PRO_SITE_URL = (fromEnv() ?? DEFAULT_PRO_SITE_URL).replace(/\/+$/, "");

export const PRO_NAME = "Strategy Lab Pro";
export const PUBLIC_NAME = "Strategy Lab";
export const COMPANY_NAME = "Arch Public";
export const COMPANY_URL = "https://archpublic.com";

/** Arch Public's concierge service, linked from every apply step (P19). */
export const CONCIERGE_URL = "https://archpublic.com/concierge/";

/** The product walkthrough. Recorded under the old name; a new recording is on the rename checklist. */
export const WALKTHROUGH_VIDEO_URL = "https://youtu.be/f_HjWioMlF8";

/** A strategy's page in Pro. Numbers never change: clients name TradingView setups after them. */
export function proStrategyPath(displayNumber: number): string {
  return `/strategy/${displayNumber}`;
}

export function proStrategyUrl(displayNumber: number, origin: string = PRO_SITE_URL): string {
  return `${origin.replace(/\/+$/, "")}${proStrategyPath(displayNumber)}`;
}

/**
 * Where case studies live (auto-ingestion LK7, LK8). archpublic.com serves a
 * saved copy of the case study site at this path, and every study page is
 * captured there. Override with CASE_STUDIES_URL or VITE_CASE_STUDIES_URL.
 */
export const DEFAULT_CASE_STUDIES_URL = "https://archpublic.com/case-studies";
export const CASE_STUDIES_URL = (fromEnv("CASE_STUDIES_URL") ?? DEFAULT_CASE_STUDIES_URL).replace(/\/+$/, "");

/** A case study page: "<base>/<slug>/". */
export function caseStudyPageUrl(slug: string, base: string = CASE_STUDIES_URL): string {
  return `${base.replace(/\/+$/, "")}/${slug}/`;
}

/**
 * The scenario a strategy came from, on its case study page (LK5): the page,
 * campaign tags naming the lab and the strategy (LK11), the scenario again as
 * ?scenario= (archpublic.com's frame passes the query on but drops the
 * anchor; the case study page scrolls to it), then "#<anchor>".
 */
export function caseStudyUrl(
  ref: { slug: string; anchor: string },
  from: { source: "strategy_lab" | "strategy_lab_pro"; displayNumber?: number | null },
  base: string = CASE_STUDIES_URL,
): string {
  const q = new URLSearchParams({ utm_source: from.source, utm_medium: "web", utm_campaign: "case_study_links" });
  if (typeof from.displayNumber === "number") q.set("utm_content", `strategy-${from.displayNumber}`);
  q.set("scenario", ref.anchor);
  return `${caseStudyPageUrl(ref.slug, base)}?${q.toString()}#${encodeURIComponent(ref.anchor)}`;
}
