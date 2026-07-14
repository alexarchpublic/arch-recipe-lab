import { createClient } from "@supabase/supabase-js";

const PRODUCTION_SITE_URL = "https://recipes.archpublic.com";
export const FALLBACK_OG_IMAGE = `${PRODUCTION_SITE_URL}/og-image.png`;

/** Card thumbnail for the most recently created non-archived recipe that has screenshots. */
export async function getLatestRecipeCardOgImage(): Promise<string> {
  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const supabaseKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return FALLBACK_OG_IMAGE;
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  const { data: recipe, error } = await supabase
    .from("recipes")
    .select("recipe_screenshots!inner(image_url, display_order)")
    .is("archived_at", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !recipe) {
    return FALLBACK_OG_IMAGE;
  }

  const screenshots = [...(recipe.recipe_screenshots ?? [])].sort(
    (a, b) => a.display_order - b.display_order,
  );

  return screenshots[0]?.image_url ?? FALLBACK_OG_IMAGE;
}
