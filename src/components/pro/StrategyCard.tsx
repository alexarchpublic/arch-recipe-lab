import { Link } from "react-router-dom";
import { Check, Image as ImageIcon, Plus } from "lucide-react";
import { type ProStrategy, proStrategyPath } from "@core";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { usePortfolio } from "@/hooks/usePortfolio";
import { MAX_COMPARE, usePreferences } from "@/hooks/usePreferences";
import { toPortfolioSummary } from "@/data/proStrategies";
import { StrategyResults } from "./StrategyResults";
import { StrategyChips } from "./primitives";

export function AddToPortfolioButton({ strategy, className, full }: { strategy: ProStrategy; className?: string; full?: boolean }) {
  const { isInPortfolio, toggleStrategy, active } = usePortfolio();
  const added = isInPortfolio(strategy.id);
  return (
    <Button
      type="button"
      variant={added ? "secondary" : "default"}
      className={cn(full && "w-full", added && "border border-gain/40 text-gain hover:text-gain", "gap-1.5", className)}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        toggleStrategy(toPortfolioSummary(strategy));
      }}
      title={added ? `In ${active?.name}. Click to remove.` : `Add to ${active?.name}`}
    >
      {added ? <Check className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
      {added ? `In ${active?.name ?? "portfolio"}` : "Add to portfolio"}
    </Button>
  );
}

export function StrategyCard({ strategy: s, capital, isNew }: { strategy: ProStrategy; capital: number; isNew?: boolean }) {
  const { compare, toggleCompare } = usePreferences();
  const picked = compare.includes(s.id);
  const full = !picked && compare.length >= MAX_COMPARE;
  const thumb = s.screenshots[0]?.url ?? s.public_chart_url ?? null;
  const href = typeof s.display_number === "number" ? proStrategyPath(s.display_number) : null;

  const body = (
    <>
      <div className="relative aspect-video overflow-hidden bg-navy">
        {thumb ? (
          <img src={thumb} alt="" loading="lazy" className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]" />
        ) : (
          <div className="flex h-full items-center justify-center text-white/40">
            <ImageIcon className="h-10 w-10" />
          </div>
        )}
        {isNew && (
          <span className="absolute left-2 top-2 rounded-md bg-primary px-2 py-0.5 text-[11px] font-extrabold uppercase tracking-[0.06em] text-white">
            {s.version_number > 1 ? "Updated" : "New"}
          </span>
        )}
      </div>
      <div className="space-y-3 p-4 pb-3">
        <StrategyChips displayNumber={s.display_number} asset={s.asset} focus={s.focus} horizon={s.time_horizon} />
        <h3 className="text-balance text-lg font-extrabold leading-snug tracking-[-0.02em]">{s.title}</h3>
        <p className="text-xs font-semibold text-muted-foreground">
          {s.algorithm}
          {s.time_frame ? ` · ${s.time_frame}` : ""}
        </p>
      </div>
      <div className="flex-1 px-4 pb-3">
        <StrategyResults strategy={s} capital={capital} variant="card" />
      </div>
    </>
  );

  return (
    <article className="group flex h-full flex-col overflow-hidden rounded-lg border border-border bg-card shadow-sm transition-[border-color,box-shadow,transform] hover:-translate-y-px hover:border-border-strong hover:shadow-md">
      {href ? (
        <Link to={href} className="flex flex-1 flex-col focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" aria-label={`${s.title}, strategy #${s.display_number}`}>
          {body}
        </Link>
      ) : (
        <div className="flex flex-1 flex-col">{body}</div>
      )}
      <div className="flex items-center gap-2 border-t border-tile-border px-4 py-3">
        <label className={cn("flex items-center gap-2 text-xs font-semibold", full ? "text-muted-foreground/50" : "text-muted-foreground")}>
          <Checkbox checked={picked} disabled={full} onCheckedChange={() => toggleCompare(s.id)} aria-label={`Compare ${s.title}`} />
          Compare
        </label>
        <AddToPortfolioButton strategy={s} className="ml-auto h-9" />
      </div>
    </article>
  );
}
