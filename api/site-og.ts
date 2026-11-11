import { getLatestRecipeCardOgImage } from "../lib/latestRecipeOgImage";
import { PRO_NAME, PRO_SITE_URL } from "../packages/core/src/site";

export const config = { runtime: "edge" };

const TITLE = `Arch Public ${PRO_NAME}`;
const DESCRIPTION =
  "Choose crypto, ETF and equity strategies, size a portfolio for your capital, and apply it step by step in TradingView. Included with every Arch Public client account.";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** OG HTML for the homepage, using the latest strategy card screenshot. Pro is not indexed (P2). */
export default async function handler(): Promise<Response> {
  const ogImage = await getLatestRecipeCardOgImage();
  const pageUrl = `${PRO_SITE_URL}/`;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="robots" content="noindex, nofollow" />
  <title>${escapeHtml(TITLE)}</title>
  <meta name="description" content="${escapeHtml(DESCRIPTION)}" />
  <meta property="og:title" content="${escapeHtml(TITLE)}" />
  <meta property="og:description" content="${escapeHtml(DESCRIPTION)}" />
  <meta property="og:type" content="website" />
  <meta property="og:url" content="${escapeHtml(pageUrl)}" />
  <meta property="og:image" content="${escapeHtml(ogImage)}" />
  <meta property="og:image:alt" content="${escapeHtml(TITLE)}" />
  <meta property="og:site_name" content="Arch Public ${escapeHtml(PRO_NAME)}" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${escapeHtml(TITLE)}" />
  <meta name="twitter:description" content="${escapeHtml(DESCRIPTION)}" />
  <meta name="twitter:image" content="${escapeHtml(ogImage)}" />
  <meta name="twitter:image:alt" content="${escapeHtml(TITLE)}" />
  <link rel="canonical" href="${escapeHtml(pageUrl)}" />
</head>
<body>
  <p><a href="${escapeHtml(pageUrl)}">Open ${escapeHtml(PRO_NAME)}</a></p>
</body>
</html>`;

  return new Response(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "X-Robots-Tag": "noindex, nofollow",
      "Cache-Control": "public, s-maxage=300, stale-while-revalidate=3600",
    },
  });
}
