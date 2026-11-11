import { createClient } from "@supabase/supabase-js";
import { PRO_SITE_URL } from "../packages/core/src/site";

export const FALLBACK_OG_IMAGE = `${PRO_SITE_URL}/og-image.png`;

/** Card thumbnail for the most recently created non-archived strategy that has screenshots. */
export async function getLatestRecipeCardOgImage(): Promise<string> {
  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const supabaseKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return FALLBACK_OG_IMAGE;
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  // Reads the Pro view: the base tables are admin-only since Phase 1.
  const { data, error } = await supabase
    .from("strategies_pro")
    .select("screenshots")
    .is("archived_at", null)
    .order("strategy_created_at", { ascending: false })
    .limit(10);

  if (error || !data) {
    return FALLBACK_OG_IMAGE;
  }

  for (const row of data as Array<{ screenshots: Array<{ url: string; order: number }> | null }>) {
    const first = [...(row.screenshots ?? [])].sort((a, b) => a.order - b.order)[0];
    if (first?.url) return first.url;
  }
  return FALLBACK_OG_IMAGE;
}
