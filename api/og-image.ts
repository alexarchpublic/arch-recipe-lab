import { getLatestRecipeCardOgImage } from "../lib/latestRecipeOgImage";

export const config = { runtime: "edge" };

/** Redirects social crawlers to the latest recipe card screenshot. */
export default async function handler(): Promise<Response> {
  const ogImage = await getLatestRecipeCardOgImage();

  return new Response(null, {
    status: 302,
    headers: {
      Location: ogImage,
      "Cache-Control": "public, s-maxage=300, stale-while-revalidate=3600",
    },
  });
}
