// Case studies and the strategies they came from (PRD 7 "Case study", S17).
//
// The link lives once, in each case study's content: a scenario names its
// strategy by number (alexarchpublic/case-studies, scenarios[].strategyNumber).
// The case study site publishes them in case-studies.json; Strategy Lab reads
// that index to link every strategy back to its study. Numbers never change,
// so neither side depends on the other's addresses.

export interface StudyLink {
  slug: string;
  title: string;
  url: string; // the scenario on the study page
  studyUrl: string;
  published: string;
  scenario: string;
  label: string | null;
  window: string | null;
}

interface Manifest {
  baseUrl?: string;
  studies?: Array<{
    slug: string;
    title: string;
    url: string;
    published: string;
    strategies?: Array<{ number: number; scenario: string; label?: string | null; anchor: string; window?: string | null }>;
  }>;
}

export const CASE_STUDIES_TAG = "case-studies";
const INDEX_URL = process.env.CASE_STUDIES_INDEX_URL?.trim() || "https://arch-case-studies.vercel.app/case-studies.json";

/** Strategy number -> the case study scenarios that show it, newest study first. Empty if the index cannot be read. */
export async function getCaseStudyLinks(): Promise<Map<number, StudyLink[]>> {
  const out = new Map<number, StudyLink[]>();
  try {
    const res = await fetch(INDEX_URL, { next: { revalidate: 600, tags: [CASE_STUDIES_TAG] } });
    if (!res.ok) return out;
    const m = (await res.json()) as Manifest;
    for (const s of m.studies ?? []) {
      for (const link of s.strategies ?? []) {
        if (!Number.isInteger(link.number)) continue;
        const list = out.get(link.number) ?? [];
        list.push({
          slug: s.slug,
          title: s.title,
          studyUrl: s.url,
          url: `${s.url}#${link.anchor}`,
          published: s.published,
          scenario: link.scenario,
          label: link.label ?? null,
          window: link.window ?? null,
        });
        out.set(link.number, list);
      }
    }
    for (const list of out.values()) list.sort((a, b) => b.published.localeCompare(a.published));
  } catch {
    // The case study site being down never breaks a strategy page.
  }
  return out;
}
