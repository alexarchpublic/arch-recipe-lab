import { createClient } from "@supabase/supabase-js";

export const config = { runtime: "edge" };

const PRODUCTION_SITE_URL = "https://recipes.archpublic.com";
const DEFAULT_OG_IMAGE = `${PRODUCTION_SITE_URL}/APLogo.png`;

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function buildOgHtml(options: {
  title: string;
  description: string;
  pageUrl: string;
  ogImage: string;
}): string {
  const { title, description, pageUrl, ogImage } = options;
  const fullTitle = `${title} | Recipe Lab`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(fullTitle)}</title>
  <meta name="description" content="${escapeHtml(description)}" />
  <meta property="og:title" content="${escapeHtml(title)}" />
  <meta property="og:description" content="${escapeHtml(description)}" />
  <meta property="og:type" content="article" />
  <meta property="og:url" content="${escapeHtml(pageUrl)}" />
  <meta property="og:image" content="${escapeHtml(ogImage)}" />
  <meta property="og:site_name" content="Arch Public Recipe Lab" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${escapeHtml(title)}" />
  <meta name="twitter:description" content="${escapeHtml(description)}" />
  <meta name="twitter:image" content="${escapeHtml(ogImage)}" />
  <link rel="canonical" href="${escapeHtml(pageUrl)}" />
</head>
<body>
  <p><a href="${escapeHtml(pageUrl)}">View ${escapeHtml(title)} on Recipe Lab</a></p>
</body>
</html>`;
}

export default async function handler(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const displayNumberParam = url.searchParams.get("id");

  if (!displayNumberParam || !/^\d+$/.test(displayNumberParam)) {
    return new Response("Not found", { status: 404 });
  }

  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const supabaseKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return new Response("Server configuration error", { status: 500 });
  }

  const supabase = createClient(supabaseUrl, supabaseKey);
  const displayNumber = parseInt(displayNumberParam, 10);

  const recipeSelect = `
      name,
      asset,
      focus,
      goal,
      display_number,
      recipe_screenshots (image_url, display_order)
    `;

  const fetchRecipe = (filterArchived: boolean) => {
    let query = supabase
      .from("recipes")
      .select(recipeSelect)
      .eq("display_number", displayNumber);

    if (filterArchived) {
      query = query.is("archived_at", null);
    }

    return query.maybeSingle();
  };

  let { data: recipe, error } = await fetchRecipe(true);

  if (!recipe) {
    ({ data: recipe, error } = await fetchRecipe(false));
  }

  if (error || !recipe) {
    return new Response("Not found", { status: 404 });
  }

  const screenshots = [...(recipe.recipe_screenshots ?? [])].sort(
    (a, b) => a.display_order - b.display_order,
  );
  const ogImage = screenshots[0]?.image_url ?? DEFAULT_OG_IMAGE;

  const title =
    typeof recipe.display_number === "number"
      ? `Recipe #${recipe.display_number}: ${recipe.name}`
      : recipe.name;
  const description = `${recipe.asset} · ${recipe.focus} — ${recipe.goal}`;
  const pageUrl = `${PRODUCTION_SITE_URL}/recipe/${displayNumberParam}`;

  return new Response(
    buildOgHtml({ title, description, pageUrl, ogImage }),
    {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
      },
    },
  );
}
