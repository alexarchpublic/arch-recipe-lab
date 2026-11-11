// A strategy's own page and address (P7). /recipe/N still opens it (PRD 5).
import { useEffect } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Link2 } from "lucide-react";
import { proStrategyUrl } from "@core";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { ProLayout } from "@/components/pro/ProLayout";
import { StrategyDetail } from "@/components/pro/StrategyDetail";
import { AddToPortfolioButton } from "@/components/pro/StrategyCard";
import { CapitalInput, EmptyState } from "@/components/pro/primitives";
import { byDisplayNumber, useProStrategies } from "@/data/proStrategies";
import { usePreferences } from "@/hooks/usePreferences";
import { track } from "@/data/analytics";

export default function StrategyPage() {
  const { displayNumber } = useParams();
  const n = displayNumber && /^\d+$/.test(displayNumber) ? parseInt(displayNumber, 10) : null;
  const { data, isLoading, error } = useProStrategies();
  const strategy = byDisplayNumber(data, n);
  const { viewCapital, setViewCapital } = usePreferences();
  const { toast } = useToast();

  useEffect(() => {
    if (!strategy) return;
    track("strategy_viewed", {
      strategy_id: strategy.id,
      display_number: strategy.display_number,
      version: strategy.version_number,
      asset_class: strategy.asset_class,
      referrer: document.referrer ? new URL(document.referrer).hostname : null,
    });
  }, [strategy]);

  const back = (
    <Link to="/" className="mb-5 inline-flex items-center gap-1.5 text-sm font-semibold text-muted-foreground hover:text-foreground">
      <ArrowLeft className="h-4 w-4" /> All strategies
    </Link>
  );

  if (isLoading) {
    return (
      <ProLayout title="Strategy">
        {back}
        <div className="mx-auto max-w-4xl space-y-4">
          <div className="h-10 w-2/3 animate-pulse rounded bg-muted" />
          <div className="h-64 animate-pulse rounded-lg bg-muted" />
        </div>
      </ProLayout>
    );
  }

  if (error || !strategy) {
    return (
      <ProLayout title="Strategy not found">
        {back}
        <EmptyState title={n ? `Strategy #${n} was not found` : "Strategy not found"}>
          {error ? "Strategies could not be loaded. Reload the page." : "It may have been renumbered or withdrawn. Browse the current strategies instead."}
        </EmptyState>
      </ProLayout>
    );
  }

  const copyLink = async () => {
    if (typeof strategy.display_number !== "number") return;
    try {
      await navigator.clipboard.writeText(proStrategyUrl(strategy.display_number, window.location.origin));
      toast({ title: "Link copied" });
    } catch {
      toast({ variant: "destructive", title: "Could not copy the link", description: "Copy it from the address bar instead." });
    }
  };

  return (
    <ProLayout title={`#${strategy.display_number} ${strategy.title}`}>
      {back}
      <div className="mx-auto max-w-4xl">
        <StrategyDetail
          strategy={strategy}
          capital={viewCapital}
          capitalControl={
            <div className="flex items-center gap-2">
              <label htmlFor="strategy-capital" className="text-xs font-semibold text-muted-foreground">
                Show figures at
              </label>
              <CapitalInput id="strategy-capital" value={viewCapital} onChange={setViewCapital} className="w-40" />
            </div>
          }
          actions={
            <>
              <AddToPortfolioButton strategy={strategy} />
              <Button variant="outline" className="gap-2" onClick={copyLink}>
                <Link2 className="h-4 w-4" /> Copy link
              </Button>
              <Button variant="ghost" asChild>
                <Link to="/portfolios">Go to portfolio</Link>
              </Button>
            </>
          }
        />
      </div>
    </ProLayout>
  );
}
