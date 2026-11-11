// The only reader of the store in Strategy Lab (S7). Every figure comes from
// public.strategies_public; copy and switches from public.site_content; the
// disclaimer from public.disclosures. Pages are regenerated after a publish
// (api/revalidate) and at least every REVALIDATE_SECONDS (R4).
import { type PublicStrategy, normalizeStrategyRow } from "@core";
import { REVALIDATE_SECONDS, SUPABASE_ANON_KEY, SUPABASE_URL } from "./env";
import { type SiteContent, mergeSiteContent } from "./content";

export const STRATEGIES_TAG = "strategies";
export const CONTENT_TAG = "site-content";

async function rest<T>(path: string, tag: string): Promise<T> {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) throw new Error("SUPABASE_URL and SUPABASE_ANON_KEY are not set");
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` },
    next: { revalidate: REVALIDATE_SECONDS, tags: [tag] },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw Object.assign(new Error(`store read ${path.split("?")[0]}: HTTP ${res.status} ${body.slice(0, 200)}`), { status: res.status, body });
  }
  return (await res.json()) as T;
}

const missingRelation = (e: unknown): boolean => {
  const err = e as { status?: number; body?: string };
  return err?.status === 404 || /PGRST205|does not exist|schema cache/i.test(err?.body ?? "");
};

export async function getStrategies(): Promise<PublicStrategy[]> {
  const rows = await rest<PublicStrategy[]>("strategies_public?select=*&order=display_number.asc", STRATEGIES_TAG);
  return rows.map((r) => normalizeStrategyRow(r));
}

export async function getStrategy(slug: string): Promise<PublicStrategy | null> {
  const all = await getStrategies();
  return all.find((s) => s.slug === slug) ?? null;
}

/** The results disclaimer (C2). Null means the shared default wording shows. */
export async function getDisclaimer(): Promise<string | null> {
  try {
    const rows = await rest<Array<{ key: string; body: string }>>("disclosures?select=key,body", CONTENT_TAG);
    return rows.find((r) => r.key === "results")?.body ?? null;
  } catch (e) {
    if (missingRelation(e)) return null;
    throw e;
  }
}

/** Marketing's copy, layout and switches (S12), over the built-in defaults. */
export async function getSiteContent(): Promise<SiteContent> {
  try {
    const rows = await rest<Array<{ key: string; value: Record<string, unknown> }>>("site_content?select=key,value", CONTENT_TAG);
    return mergeSiteContent(rows);
  } catch (e) {
    // Before migration 20261113000001 the defaults stand.
    if (missingRelation(e)) return mergeSiteContent([]);
    throw e;
  }
}
