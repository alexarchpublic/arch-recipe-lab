import type { MetadataRoute } from "next";
import { getSiteContent, getStrategies } from "@/lib/data";
import { canonicalUrl } from "@/lib/env";

export const revalidate = 120;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [strategies, content] = await Promise.all([getStrategies().catch(() => []), getSiteContent()]);
  return [
    { url: canonicalUrl("/"), changeFrequency: "weekly", priority: 1 },
    { url: canonicalUrl("/strategies"), changeFrequency: "weekly", priority: 0.9 },
    ...strategies.map((s) => ({ url: canonicalUrl(`/${s.slug}`), lastModified: s.as_of, changeFrequency: "monthly" as const, priority: 0.8 })),
    ...Object.keys(content.partners).map((p) => ({ url: canonicalUrl(`/p/${p}`), changeFrequency: "monthly" as const, priority: 0.5 })),
  ];
}
