// A strategy in a list: identity, the headline figures and its disclosure.
import Link from "next/link";
import type { PublicStrategy } from "@core";
import { assetClassLabel, focusLabel, horizonLabel } from "@/lib/strategies";
import { ResultsBlock } from "./ResultsBlock";

export function Chip({ children }: { children: React.ReactNode }) {
  return <span className="inline-flex items-center rounded-full bg-chip px-2 py-0.5 text-[11px] font-bold text-navy">{children}</span>;
}

export function StrategyCard({ strategy: s, disclaimer, hidden, scale = true }: { strategy: PublicStrategy; disclaimer: string | null; hidden?: string[]; scale?: boolean }) {
  return (
    <article className="group relative flex h-full flex-col rounded-lg border border-border bg-card p-4 shadow-sm transition hover:shadow-md">
      <div className="flex flex-wrap gap-1.5">
        <Chip>{s.asset}</Chip>
        <Chip>{assetClassLabel(s.asset_class)}</Chip>
        <Chip>{focusLabel(s.focus)}</Chip>
        <Chip>{horizonLabel(s.time_horizon)}</Chip>
      </div>
      <h3 className="mt-3 text-base leading-snug">
        <Link href={`/${s.slug}`} className="after:absolute after:inset-0 after:rounded-lg hover:text-primary focus:outline-none">
          {s.title}
        </Link>
      </h3>
      <p className="mt-0.5 text-xs text-muted-foreground">
        Strategy #{s.display_number} · {s.short_name} · {s.algorithm}
        {s.time_frame ? ` · ${s.time_frame}` : ""}
      </p>
      <div className="mt-3 flex-1">
        <ResultsBlock strategy={s} disclaimer={disclaimer} hidden={hidden} variant="card" scale={scale} />
      </div>
      <Link href={`/${s.slug}`} className="mt-3 text-sm font-bold text-primary hover:underline">
        View strategy →
      </Link>
    </article>
  );
}
