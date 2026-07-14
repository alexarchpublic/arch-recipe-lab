import { getLatestRecipeCardOgImage } from "../lib/latestRecipeOgImage";

export const config = { runtime: "edge" };

const PRODUCTION_SITE_URL = "https://recipes.archpublic.com";
const TITLE = "Arch Public Recipe Lab";
const DESCRIPTION =
  "Browse and filter crypto trading algorithm recipes with backtested results. Build portfolios and export to TradingView.";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** OG HTML for the homepage, using the latest recipe card screenshot. */
export default async function handler(): Promise<Response> {
  const ogImage = await getLatestRecipeCardOgImage();
  const pageUrl = `${PRODUCTION_SITE_URL}/`;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(TITLE)}</title>
  <meta name="description" content="${escapeHtml(DESCRIPTION)}" />
  <meta property="og:title" content="${escapeHtml(TITLE)}" />
  <meta property="og:description" content="${escapeHtml(DESCRIPTION)}" />
  <meta property="og:type" content="website" />
  <meta property="og:url" content="${escapeHtml(pageUrl)}" />
  <meta property="og:image" content="${escapeHtml(ogImage)}" />
  <meta property="og:image:alt" content="${escapeHtml(TITLE)}" />
  <meta property="og:site_name" content="Arch Public Recipe Lab" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${escapeHtml(TITLE)}" />
  <meta name="twitter:description" content="${escapeHtml(DESCRIPTION)}" />
  <meta name="twitter:image" content="${escapeHtml(ogImage)}" />
  <meta name="twitter:image:alt" content="${escapeHtml(TITLE)}" />
  <link rel="canonical" href="${escapeHtml(pageUrl)}" />
</head>
<body>
  <p><a href="${escapeHtml(pageUrl)}">View Recipe Lab</a></p>
</body>
</html>`;

  return new Response(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "public, s-maxage=300, stale-while-revalidate=3600",
    },
  });
}
