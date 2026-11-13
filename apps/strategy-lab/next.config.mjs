// Strategy Lab (PRD section 9): the public site, server-rendered. archpublic.com
// serves it under /strategy-lab as a saved copy inside a frame: Arch Public's
// page engine captures this site from its Vercel address and puts each page
// at /strategy-lab + the page's own path. So the app is built at the root of
// its host (no basePath); a build under /strategy-lab came out at
// archpublic.com/strategy-lab/strategy-lab/<page>. It imports the
// shared package in packages/core (R3), the same code Strategy Lab Pro uses.
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PHASE_PRODUCTION_BUILD } from "next/constants.js";
import { LIST_PATH, MAX_MOVED, WARN_MOVED, readMoved } from "./src/lib/moved-list.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "../..");

/**
 * The old addresses (PRD 13, Redirects), read once from the store. A build
 * stops, and the deploy before it stays live, when the store cannot be read,
 * no strategy comes back, or the list passes the page engine's 500. Anywhere
 * else (next dev) a failed read leaves the list empty.
 */
async function loadMoved(phase) {
  const env = (n) => process.env[n]?.trim() || "";
  const url = (env("SUPABASE_URL") || env("NEXT_PUBLIC_SUPABASE_URL")).replace(/\/+$/, "");
  const key = env("SUPABASE_ANON_KEY") || env("NEXT_PUBLIC_SUPABASE_ANON_KEY") || env("SUPABASE_PUBLISHABLE_KEY");
  try {
    const list = await readMoved(url, key);
    if (list.length < 2) throw new Error("the store returned no public strategies");
    if (list.length > MAX_MOVED) throw new Error(`${list.length} old addresses, over the page engine's ${MAX_MOVED} redirects`);
    if (list.length >= WARN_MOVED) console.warn(`Strategy Lab: ${list.length} old addresses; the page engine keeps at most ${MAX_MOVED} redirects.`);
    return list;
  } catch (e) {
    const why = `Strategy Lab old addresses: ${e instanceof Error ? e.message : e}`;
    if (phase === PHASE_PRODUCTION_BUILD) throw new Error(why);
    console.warn(`${why}. Continuing without them.`);
    return [];
  }
}

export default async function config(phase) {
  const moved = await loadMoved(phase);

/** @type {import('next').NextConfig} */
const nextConfig = {
  // The list, for the "Older links" page, /redirects.json and api/revalidate (lib/moved.ts).
  env: { MOVED_LIST: JSON.stringify(moved) },
  poweredByHeader: false,
  // The repository root holds Pro's ESLint setup; CI typechecks this app instead.
  eslint: { ignoreDuringBuilds: true },
  // packages/core sits outside this folder.
  experimental: { externalDir: true },
  // Charts (redesign PRD 7.1): the uploaded TradingView screenshots are PNGs of
  // up to 700 KB and 3,000px, so they go through the image optimizer, resized
  // and re-encoded, never sent as they are. Staging rows point at the same
  // production storage host.
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "xsoixhltejgyuhedhbdu.supabase.co", pathname: "/storage/v1/object/public/recipe-screenshots/**" },
    ],
    formats: ["image/webp"],
    minimumCacheTTL: 86400,
  },
  outputFileTracingRoot: repoRoot,
  webpack(config) {
    config.resolve.alias["@core"] = path.join(repoRoot, "packages/core/src");
    // packages/core resolves react and friends from this app, never from the
    // repository root (which holds Pro's React 18 when installed locally).
    config.resolve.modules = [path.join(here, "node_modules"), "node_modules"];
    return config;
  },
  // Addresses from when the app lived under /strategy-lab on this host. The
  // Pro admin console still calls the two API routes there, so those are
  // rewritten (a redirect would break its cross-origin preflight); pages move.
  //
  // The old Strategy Lab addresses follow, each straight to its page
  // (PRD 13, Redirects). archpublic.com's page engine keeps a server redirect
  // to the same site as a redirect, where it saved the earlier hand-off pages
  // as pages. 307, not 308: a strategy's page address can change while its
  // number does not, and browsers keep a 308 for good. The query string
  // (utm_*, partner) goes along. Any other record id or number goes to the
  // list; those two come last, since the first match wins.
  async redirects() {
    return [
      { source: "/strategy-lab", destination: "/", permanent: true },
      { source: "/strategy-lab/:path((?!api/).*)", destination: "/:path", permanent: true },
      ...moved.map((m) => ({ source: m.from, destination: m.to, permanent: false })),
      { source: "/recipes/:id", destination: LIST_PATH, permanent: false },
      { source: "/strategy/:number", destination: LIST_PATH, permanent: false },
    ];
  },
  async rewrites() {
    return [{ source: "/strategy-lab/api/:path*", destination: "/api/:path*" }];
  },
  async headers() {
    // S18: search sees one copy. Pages reached through the owner's
    // archpublic.com/strategy-lab proxy are indexable; at any other address,
    // such as the Vercel one, they carry noindex. Vercel replaces
    // x-forwarded-host with its own host, so the proxy marks its requests with
    // an "X-Arch-Proxy" header instead (any value). INDEX_ALL_HOSTS=1 turns the
    // rule off.
    const canonical = "(www\\.)?archpublic\\.com";
    const noindex =
      process.env.INDEX_ALL_HOSTS === "1"
        ? []
        : [
            {
              source: "/:path*",
              missing: [
                { type: "host", value: canonical },
                { type: "header", key: "x-arch-proxy" },
              ],
              headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }],
            },
          ];
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        ],
      },
      ...noindex,
    ];
  },
};

  return nextConfig;
}
