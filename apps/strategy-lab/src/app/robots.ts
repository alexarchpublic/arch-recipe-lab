import type { MetadataRoute } from "next";
import { canonicalUrl } from "@/lib/env";

// Served at /strategy-lab/robots.txt. Search engines read the domain root's
// robots.txt, which the main site owns; this one names the sitemap for anyone
// who asks, and the middleware marks the Vercel address noindex (S18).
export default function robots(): MetadataRoute.Robots {
  return { rules: [{ userAgent: "*", allow: "/" }], sitemap: canonicalUrl("/sitemap.xml") };
}
