// New and updated since your last visit (P9).
import { useMemo } from "react";
import { Link } from "react-router-dom";
import { type ProStrategy, formatDate, proStrategyPath } from "@core";
import { Badge } from "@/components/ui/badge";
import { ProLayout } from "@/components/pro/ProLayout";
import { EmptyState, StrategyChips } from "@/components/pro/primitives";
import { changeLabel } from "@/components/pro/StrategyDetail";
import { browsable, useProStrategies } from "@/data/proStrategies";
import { isAnnounceable, useWhatsNew } from "@/hooks/useWhatsNew";
import { usePortfolio } from "@/hooks/usePortfolio";

const RECENT_DAYS = 60;

function ChangeRow({ s, held }: { s: ProStrategy; held: boolean }) {
  const isNew = s.version_number <= 1 || s.change_type === "initial";
  return (
    <li>
      <Link
        to={typeof s.display_number === "number" ? proStrategyPath(s.display_number) : "/"}
        className="flex flex-col gap-2 rounded-lg border border-border bg-card p-4 transition-colors hover:border-border-strong sm:flex-row sm:items-center"
      >
        <div className="min-w-0 flex-1 space-y-1.5">
          <StrategyChips displayNumber={s.display_number} asset={s.asset} focus={s.focus} horizon={s.time_horizon} />
          <p className="font-extrabold tracking-[-0.02em]">{s.title}</p>
          {s.change_note && s.change_type !== "baseline" && <p className="text-sm text-muted-foreground">{s.change_note}</p>}
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2 sm:flex-col sm:items-end">
          <Badge className={isNew ? "bg-primary hover:bg-primary" : "bg-navy hover:bg-navy"}>{isNew ? "New strategy" : changeLabel(s.change_type)}</Badge>
          <span className="text-xs text-muted-foreground">
            Version {s.version_number} · {formatDate(s.published_at.slice(0, 10))}
          </span>
          {held && <span className="text-xs font-semibold text-warn">In your portfolio</span>}
        </div>
      </Link>
    </li>
  );
}

export default function WhatsNew() {
  const { data, isLoading } = useProStrategies();
  const { sinceLast, previousVisitAt } = useWhatsNew();
  const { portfolios } = usePortfolio();
  const held = useMemo(() => new Set(portfolios.flatMap((p) => p.positions.map((x) => x.strategyId))), [portfolios]);

  const recent = useMemo(() => {
    const cutoff = new Date(Date.now() - RECENT_DAYS * 86400000).toISOString();
    const shown = new Set(sinceLast.map((s) => s.id));
    return browsable(data)
      .filter((s) => isAnnounceable(s) && s.published_at >= cutoff && !shown.has(s.id))
      .sort((a, b) => b.published_at.localeCompare(a.published_at));
  }, [data, sinceLast]);

  return (
    <ProLayout title="What's new">
      <div className="mx-auto max-w-3xl space-y-8">
        <header>
          <h1 className="text-2xl font-extrabold tracking-[-0.02em] md:text-3xl">What's new</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {previousVisitAt
              ? `New strategies and updates published since your last visit on ${formatDate(previousVisitAt.slice(0, 10))}.`
              : "New strategies and updates published recently. From your next visit, this page shows what changed since this one."}
          </p>
        </header>

        {isLoading ? (
          <div className="h-40 animate-pulse rounded-lg bg-muted" />
        ) : (
          <>
            {previousVisitAt && (
              <section aria-labelledby="since-h">
                <h2 id="since-h" className="eyebrow mb-3 text-primary">
                  Since your last visit
                </h2>
                {sinceLast.length === 0 ? (
                  <EmptyState title="Nothing new since your last visit" />
                ) : (
                  <ul className="space-y-3">
                    {sinceLast.map((s) => (
                      <ChangeRow key={s.id} s={s} held={held.has(s.id)} />
                    ))}
                  </ul>
                )}
              </section>
            )}
            <section aria-labelledby="recent-h">
              <h2 id="recent-h" className="eyebrow mb-3 text-primary">
                {previousVisitAt ? "Earlier" : "Recent"}, last {RECENT_DAYS} days
              </h2>
              {recent.length === 0 ? (
                <EmptyState title="No other changes in this period" />
              ) : (
                <ul className="space-y-3">
                  {recent.map((s) => (
                    <ChangeRow key={s.id} s={s} held={held.has(s.id)} />
                  ))}
                </ul>
              )}
            </section>
          </>
        )}
      </div>
    </ProLayout>
  );
}
