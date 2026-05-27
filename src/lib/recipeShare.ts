const PRODUCTION_SITE_URL = "https://recipes.archpublic.com";

export function getRecipeShareUrl(displayNumber: number): string {
  const base =
    typeof window !== "undefined" ? window.location.origin : PRODUCTION_SITE_URL;
  return `${base}/recipe/${displayNumber}`;
}

export { PRODUCTION_SITE_URL };
