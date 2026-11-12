// A strategy's chart, shown whole (redesign PRD P1): the TradingView screenshot
// as uploaded, settings line included. Never cover-cropped: in a fixed frame
// it is fitted inside (object-fit: contain); elsewhere it keeps its own ratio.
//
// Rendered on the server: getImageProps gives a plain <img> with the
// optimizer's srcset, so no image component ships to the browser (it cost a
// point of Lighthouse performance against main). Only ChartLink is a client
// component, for the chart_opened event.
import { getImageProps } from "next/image";
import Link from "@/components/Link";
import type { PublicStrategy } from "@core";
import { ChartLink } from "./ChartLink";

export type ChartStrategy = Pick<PublicStrategy, "slug" | "display_number" | "asset" | "time_frame" | "chart_url" | "title">;

export function chartAlt(s: Pick<PublicStrategy, "display_number" | "asset" | "time_frame">): string {
  return `TradingView backtest chart of strategy #${s.display_number} on ${s.asset}${s.time_frame ? `, ${s.time_frame}` : ""}, with every buy and sell marked`;
}

/** The chart at its natural ratio, full container width, up to 1200px. Clicking opens the full-size image. */
function WholeChart({ s, placement, priority = false, sizes }: { s: ChartStrategy; placement: string; priority?: boolean; sizes: string }) {
  if (!s.chart_url) return null;
  const { props } = getImageProps({ src: s.chart_url, alt: chartAlt(s), width: 1600, height: 1000, sizes, priority });
  return (
    <ChartLink href={s.chart_url} slug={s.slug} placement={placement} label={`Open the full-size chart of strategy #${s.display_number} in a new tab`}>
      <img {...props} className="block h-auto w-full" />
    </ChartLink>
  );
}

function Legend({ long = false }: { long?: boolean }) {
  return (
    <>
      <span className="inline-flex items-center gap-1.5">
        <ArrowUp className="h-3.5 w-3.5 text-legend-buy" />
        {long ? "Blue arrows: buys, with order size" : "Blue arrows: buys"}
      </span>
      <span className="inline-flex items-center gap-1.5">
        <ArrowDown className="h-3.5 w-3.5 text-legend-sell" />
        Magenta marks: sells
      </span>
    </>
  );
}

/** Home hero: caption bar with the title, the legend and "Open this strategy", then the chart. */
export function HeroChart({ s }: { s: ChartStrategy }) {
  if (!s.chart_url) return null;
  return (
    <figure className="mt-12 overflow-hidden rounded-t-lg border border-b-0 border-white/[0.14] bg-chart">
      <figcaption className="flex flex-wrap items-center gap-x-6 gap-y-2 bg-navy-deep px-5 py-2.5 text-[13px] font-semibold text-white/[0.82]">
        <span className="font-extrabold text-white">{s.title}</span>
        <Legend />
        <Link
          href={`/${s.slug}`}
          data-source="hero-chart"
          className="inline-flex min-h-[44px] items-center gap-1.5 font-extrabold text-on-navy hover:text-white sm:ml-auto"
        >
          Open this strategy
          <ArrowRight className="h-4 w-4" />
        </Link>
      </figcaption>
      <WholeChart s={s} placement="hero" priority sizes="(min-width: 1248px) 1152px, calc(100vw - 32px)" />
    </figure>
  );
}

/** Strategy page: caption bar with the legend and the time frame, then the chart. */
export function PageChart({ s }: { s: ChartStrategy }) {
  if (!s.chart_url) return null;
  return (
    <figure className="mt-4 overflow-hidden rounded-lg border border-[#1A1F2E] bg-chart">
      <figcaption className="flex flex-wrap items-center gap-x-6 gap-y-2 bg-navy-deep px-5 py-3.5 text-[13px] font-semibold text-white/[0.85]">
        <Legend long />
        {s.time_frame && <span className="text-white/70 sm:ml-auto">{s.time_frame} bars</span>}
      </figcaption>
      <WholeChart s={s} placement="strategy-page" priority sizes="(min-width: 1248px) 780px, (min-width: 1024px) 65vw, calc(100vw - 32px)" />
    </figure>
  );
}

/** Card: a dark 5:4 frame, the chart fitted inside, never cropped. No chart: nothing. */
export function CardChart({ s, eager = false }: { s: ChartStrategy; eager?: boolean }) {
  if (!s.chart_url) return null;
  return (
    <div className="relative aspect-[5/4] bg-chart-card">
      <img
        {...getImageProps({
          src: s.chart_url,
          alt: chartAlt(s),
          fill: true,
          sizes: "(min-width: 1024px) 384px, (min-width: 640px) 50vw, 100vw",
          loading: eager ? "eager" : "lazy",
        }).props}
        className="object-contain"
      />
    </div>
  );
}

const icon = (path: React.ReactNode) =>
  function Icon({ className = "" }: { className?: string }) {
    return (
      <svg aria-hidden="true" className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
        {path}
      </svg>
    );
  };

export const ArrowUp = icon(<><path d="M12 19V5" /><path d="m5 12 7-7 7 7" /></>);
export const ArrowDown = icon(<><path d="M12 5v14" /><path d="m19 12-7 7-7-7" /></>);
export function ArrowRight({ className = "" }: { className?: string }) {
  return (
    <svg aria-hidden="true" className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 12h14" />
      <path d="m12 5 7 7-7 7" />
    </svg>
  );
}
