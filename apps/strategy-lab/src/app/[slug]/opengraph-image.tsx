import { ImageResponse } from "next/og";
import { basisLabel, formatSignedPercent, formatTestWindow } from "@core";
import { ShareCard } from "@/components/ShareImage";
import { getStrategy } from "@/lib/data";

export const revalidate = 120;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "Arch Public Strategy Lab strategy";

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const s = await getStrategy(slug).catch(() => null);
  if (!s) {
    return new ImageResponse(<ShareCard eyebrow="Strategy Lab" title="Arch Public Strategy Lab" line="Algorithm strategies for stocks, ETFs and crypto" />, size);
  }
  return new ImageResponse(
    <ShareCard
      eyebrow={`${s.asset} · ${s.algorithm}`}
      title={s.title}
      line={`Strategy #${s.display_number} · ${s.short_name}`}
      figure={formatSignedPercent(s.return_pct)}
      figureLabel={`Return, ${formatTestWindow(s)}`}
      basis={basisLabel(s)}
    />,
    size,
  );
}
