// Settings for the public site. Everything here is a public value or has a
// working default; nothing secret is needed to render a page.

const env = (name: string): string | undefined => {
  const v = process.env[name];
  return v && v.trim() ? v.trim() : undefined;
};

/** The store. Strategy Lab reads only public views with the publishable key (S7). */
export const SUPABASE_URL = (env("SUPABASE_URL") ?? env("NEXT_PUBLIC_SUPABASE_URL") ?? "").replace(/\/+$/, "");
export const SUPABASE_ANON_KEY = env("SUPABASE_ANON_KEY") ?? env("NEXT_PUBLIC_SUPABASE_ANON_KEY") ?? env("SUPABASE_PUBLISHABLE_KEY") ?? "";

/** Where the site is meant to be found (S18). Canonical links and the sitemap point here. */
export const CANONICAL_ORIGIN = (env("CANONICAL_ORIGIN") ?? "https://archpublic.com").replace(/\/+$/, "");
/** The path archpublic.com serves the site under. The app itself is built at its host's root. */
export const PUBLIC_PATH = "/strategy-lab";
export const canonicalUrl = (path = "/"): string => `${CANONICAL_ORIGIN}${PUBLIC_PATH}${path === "/" ? "" : path}`;

/** Hosts that serve the indexable copy. Any other host (the Vercel address) is marked noindex. */
export const CANONICAL_HOSTS = (env("CANONICAL_HOSTS") ?? "archpublic.com,www.archpublic.com")
  .split(",")
  .map((h) => h.trim().toLowerCase())
  .filter(Boolean);

/** HubSpot (section 12). The portal is Arch Public's; the form is created for Strategy Lab. */
export const HUBSPOT_PORTAL_ID = env("NEXT_PUBLIC_HUBSPOT_PORTAL_ID") ?? "43848678";
// The form and its consent subscription are written into lib/hubspot.ts: the
// browser sends captures straight to HubSpot, so they cannot come from server env.

/** One GA4 property for Strategy Lab (section 12). Fires only after consent. */
export const GA4_ID = env("NEXT_PUBLIC_GA4_ID") ?? "G-7KS3HK4626";

/** How often a page is regenerated without a publish hook (R4: under five minutes). */
export const REVALIDATE_SECONDS = 120;

/** The Pro app, whose admin console asks this site to refresh after a publish. */
export const PRO_ORIGINS = (env("PRO_ORIGINS") ?? "https://recipes.archpublic.com")
  .split(",")
  .map((o) => o.trim().replace(/\/+$/, ""))
  .filter(Boolean);
