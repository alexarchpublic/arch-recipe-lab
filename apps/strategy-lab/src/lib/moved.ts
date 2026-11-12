// The old Strategy Lab addresses and where each one goes now (PRD 13,
// Redirects): the old site's /recipes and /recipes/<record-id>, and the short
// /strategy/<number> that case studies link to. Shared by the hand-off pages,
// the "Older links" page that lets archpublic.com's page engine find them,
// and /redirects.json.
import type { Metadata } from "next";
import { getStrategies } from "./data";
import { canonicalUrl } from "./env";
import { strategyName } from "./figures";

export interface MovedTarget {
  to: string;
  label: string;
}

const LIST: MovedTarget = { to: "/strategies", label: "All Strategy Lab strategies" };

export async function oldRecipe(id: string): Promise<MovedTarget> {
  const all = await getStrategies().catch(() => []);
  const hit = all.find((s) => s.id === id) ?? (/^\d+$/.test(id) ? all.find((s) => String(s.display_number) === id) : undefined);
  return hit ? { to: `/${hit.slug}`, label: strategyName(hit) } : LIST;
}

export async function byNumber(number: string): Promise<MovedTarget> {
  const all = await getStrategies().catch(() => []);
  const hit = /^\d{1,5}$/.test(number) ? all.find((s) => String(s.display_number) === number) : undefined;
  return hit ? { to: `/${hit.slug}`, label: strategyName(hit) } : LIST;
}

export const oldList = (): MovedTarget => LIST;

/** Every old address with its target, for the "Older links" page and /redirects.json. */
export async function allMoved(): Promise<Array<{ from: string } & MovedTarget>> {
  const all = await getStrategies();
  return [
    { from: "/recipes", ...LIST },
    ...all.map((s) => ({ from: `/recipes/${s.id}`, to: `/${s.slug}`, label: strategyName(s) })),
    ...all.filter((s) => s.display_number != null).map((s) => ({ from: `/strategy/${s.display_number}`, to: `/${s.slug}`, label: strategyName(s) })),
  ];
}

/** A hand-off page is not a page of its own: search engines are pointed at the target. */
export function movedMetadata(t: MovedTarget): Metadata {
  return { title: t.label, alternates: { canonical: canonicalUrl(t.to) }, robots: { index: false, follow: true } };
}
