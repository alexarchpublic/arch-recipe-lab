import { ImageResponse } from "next/og";
import { ShareCard } from "@/components/ShareImage";
import { getSiteContent, getStrategies } from "@/lib/data";

export const revalidate = 120;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "Arch Public Strategy Lab";

export default async function Image() {
  const [content, strategies] = await Promise.all([getSiteContent(), getStrategies().catch(() => [])]);
  return new ImageResponse(
    <ShareCard eyebrow="Arch Public Strategy Lab" title={content.home.hero.headline} line={`${strategies.length} algorithm strategies for stocks, ETFs and crypto`} />,
    size,
  );
}
