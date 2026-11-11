// Strategy Lab (PRD section 9): the public site, server-rendered, served under
// archpublic.com/strategy-lab by the owner's rewrite (S18). It imports the
// shared package in packages/core (R3), the same code Strategy Lab Pro uses.
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "../..");

/** @type {import('next').NextConfig} */
const nextConfig = {
  basePath: "/strategy-lab",
  poweredByHeader: false,
  // The repository root holds Pro's ESLint setup; CI typechecks this app instead.
  eslint: { ignoreDuringBuilds: true },
  // packages/core sits outside this folder.
  experimental: { externalDir: true },
  outputFileTracingRoot: repoRoot,
  webpack(config) {
    config.resolve.alias["@core"] = path.join(repoRoot, "packages/core/src");
    // packages/core resolves react and friends from this app, never from the
    // repository root (which holds Pro's React 18 when installed locally).
    config.resolve.modules = [path.join(here, "node_modules"), "node_modules"];
    return config;
  },
  // The bare Vercel address opens the site rather than a 404.
  async redirects() {
    return [{ source: "/", destination: "/strategy-lab", basePath: false, permanent: false }];
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
              basePath: false,
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
