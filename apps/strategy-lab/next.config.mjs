// Strategy Lab (PRD section 9): the public site, server-rendered. archpublic.com
// serves it under /strategy-lab as a saved copy inside a frame: Arch Public's
// page engine captures this site from its Vercel address and puts each page
// at /strategy-lab + the page's own path. So the app is built at the root of
// its host (no basePath); a build under /strategy-lab came out at
// archpublic.com/strategy-lab/strategy-lab/<page>. It imports the
// shared package in packages/core (R3), the same code Strategy Lab Pro uses.
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "../..");

/** @type {import('next').NextConfig} */
const nextConfig = {
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
  async redirects() {
    return [
      { source: "/strategy-lab", destination: "/", permanent: true },
      { source: "/strategy-lab/:path((?!api/).*)", destination: "/:path", permanent: true },
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

export default nextConfig;
