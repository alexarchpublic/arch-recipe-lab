// Case studies a strategy appears in (auto-ingestion LK1, LK2, LK5).
//
// The record is the strategy number in each case study scenario. The store
// copies it into store.case_study_refs, and the public view carries it as
// case_studies, origin first. This replaces the earlier fetch of the case
// study site's index: links now arrive with the strategy, in one read.
import { type CaseStudyRef, type PublicStrategy, caseStudyPageUrl, caseStudyUrl } from "@core";

export interface StudyLink {
  slug: string;
  title: string;
  /** The scenario on the study page, with campaign tags. */
  url: string;
  studyUrl: string;
  published: string | null;
  scenario: string | null;
  origin: boolean;
}

export function studyLink(ref: CaseStudyRef, displayNumber: number | null): StudyLink {
  return {
    slug: ref.slug,
    title: ref.title,
    url: caseStudyUrl(ref, { source: "strategy_lab", displayNumber }),
    studyUrl: caseStudyPageUrl(ref.slug),
    published: ref.published_on,
    scenario: ref.scenario_title,
    origin: ref.role === "origin",
  };
}

/** A strategy's case studies, origin first (the view's order). Empty when it has none (LK6). */
export function studyLinks(s: Pick<PublicStrategy, "case_studies" | "display_number">): StudyLink[] {
  return (s.case_studies ?? []).map((ref) => studyLink(ref, s.display_number));
}
