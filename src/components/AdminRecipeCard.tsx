import { useState } from "react";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Edit, Eye, Image as ImageIcon, Archive, ArchiveRestore, ClipboardCheck } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { MetricTileGrid } from "@/components/MetricTileGrid";
import { StatTile, deltaTone, signedTone } from "@/components/StatTile";
import { cn } from "@/lib/utils";
import { refreshStrategyLab } from "@/data/strategyLab";
import {
  formatPercent,
  formatSignedCurrency,
  formatSignedPercent,
  scaledResults,
  vsBuyHold,
  vsDca,
} from "@core";
import { isLegacyAlgorithm } from "@/lib/algorithms";
import {
  type StrategyGroup,
  countChecks,
  setArchived,
  versionToProStrategy,
} from "@/data/adminVersions";

interface AdminRecipeCardProps {
  group: StrategyGroup;
  onEdit: (group: StrategyGroup) => void;
  onReview: (group: StrategyGroup) => void;
  onView: (group: StrategyGroup) => void;
  onChanged: () => void;
}

const getFocusPill = (focus: string) => {
  switch (focus) {
    case "Cash Yielding":
      return "bg-primary text-primary-foreground";
    case "Accumulation":
      return "bg-navy text-white";
    case "Balanced":
      return "bg-muted text-foreground border-border";
    default:
      return "bg-muted text-muted-foreground";
  }
};

const STATUS_LABEL: Record<string, string> = { draft: "Draft", in_review: "In review" };

export function AdminRecipeCard({ group, onEdit, onReview, onView, onChanged }: AdminRecipeCardProps) {
  const [archiving, setArchiving] = useState(false);
  const { toast } = useToast();

  // The card shows the open draft when there is one, else the published version.
  const v = group.draft ?? group.published ?? group.history[0];
  const s = versionToProStrategy(v);
  const scaled = scaledResults(s);
  const thumbnailUrl = v.screenshots.length > 0 ? v.screenshots[0].url : null;
  const checks = countChecks(group.draft);
  const archived = !!group.archivedAt;
  const bh = vsBuyHold(s);
  const dca = vsDca(s);

  const handleToggleArchive = async () => {
    setArchiving(true);
    try {
      // Archive replaces delete (A12): history and files stay, clients who hold it keep it.
      await setArchived(group.strategyId, !archived);
      void refreshStrategyLab("strategies");
      toast({ title: archived ? "Strategy unarchived" : "Strategy archived" });
      onChanged();
    } catch (error: unknown) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to update the strategy",
      });
    } finally {
      setArchiving(false);
    }
  };

  return (
    <Card className={cn(
      "group overflow-hidden border-border bg-card shadow-sm transition-[border-color,box-shadow,transform] duration-150 ease-out hover:-translate-y-px hover:border-border-strong hover:shadow-md",
      archived && "opacity-75",
    )}>
      <div className="aspect-video overflow-hidden bg-navy">
        {thumbnailUrl ? (
          <img src={thumbnailUrl} alt={`${v.title} thumbnail`} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-white/50">
            <div className="text-center">
              <ImageIcon className="mx-auto mb-2 h-12 w-12 opacity-50" />
              <p className="text-sm">No screenshot</p>
            </div>
          </div>
        )}
      </div>

      <CardHeader className="space-y-3">
        <div className="flex flex-wrap items-center gap-1.5">
          {typeof group.displayNumber === "number" && <Badge variant="chip">#{group.displayNumber}</Badge>}
          <Badge variant="chip">{v.asset}</Badge>
          <Badge className={getFocusPill(v.focus)}>{v.focus}</Badge>
          <Badge variant="outline" className="rounded-full">{v.time_horizon}</Badge>
          {isLegacyAlgorithm(v.algorithm) && <Badge variant="outline">Legacy</Badge>}
          {archived && <Badge variant="secondary">Archived</Badge>}
          {!v.listed_public && <Badge variant="outline">Not public</Badge>}
        </div>
        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          {group.published ? (
            <Badge variant="outline">Published v{group.published.version_number}</Badge>
          ) : (
            <Badge variant="destructive">Never published</Badge>
          )}
          {group.draft && (
            <Badge variant="secondary">
              {STATUS_LABEL[group.draft.status]} v{group.draft.version_number}
            </Badge>
          )}
          {group.draft && checks.error > 0 && (
            <Badge variant="destructive">{checks.error} error{checks.error === 1 ? "" : "s"}</Badge>
          )}
          {group.draft && checks.review > 0 && (
            <Badge variant="outline" className="border-amber-500 text-amber-700">
              {checks.review} to review
            </Badge>
          )}
        </div>
        <CardTitle className="text-balance text-lg font-extrabold leading-snug tracking-[-0.02em]">
          {v.title}
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-4">
        <MetricTileGrid>
          {s.cagr_pct !== null && <StatTile label="CAGR" value={formatPercent(s.cagr_pct)} />}
          {bh !== null && <StatTile label="vs Buy & Hold" value={formatSignedPercent(bh)} tone={deltaTone(bh)} />}
          {dca !== null && <StatTile label="vs DCA" value={formatSignedPercent(dca)} tone={deltaTone(dca)} />}
          {scaled.cashProfit !== null && (
            <StatTile label="Cash profit" value={formatSignedCurrency(scaled.cashProfit)} />
          )}
          {scaled.assetQty !== null && (
            <StatTile
              label="Asset accumulated"
              value={`${scaled.assetQty.toLocaleString(undefined, { maximumFractionDigits: 3 })} ${v.asset}`}
            />
          )}
          <StatTile label="Net profit" value={formatSignedCurrency(scaled.netProfit)} tone={signedTone(scaled.netProfit)} />
          <StatTile label="PnL" value={formatSignedPercent(s.return_pct)} tone={deltaTone(s.return_pct)} />
          <StatTile label="Algorithm" value={v.algorithm} fullWidth />
        </MetricTileGrid>
      </CardContent>

      <CardFooter className="pt-0">
        <div className="flex w-full items-center justify-between gap-2">
          <Button size="sm" variant={group.draft ? "default" : "outline"} onClick={() => onReview(group)} className="gap-1">
            <ClipboardCheck className="h-4 w-4" />
            {group.draft ? "Review draft" : "Versions"}
          </Button>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleToggleArchive}
              className="h-8 w-8 p-0"
              disabled={archiving}
              aria-label={archived ? "Unarchive strategy" : "Archive strategy"}
              title={archived ? "Unarchive" : "Archive"}
            >
              {archived ? <ArchiveRestore className="h-4 w-4" /> : <Archive className="h-4 w-4" />}
            </Button>
            <Button variant="outline" size="sm" onClick={() => onView(group)} className="h-8 w-8 p-0" title="Preview as client">
              <Eye className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={() => onEdit(group)} className="h-8 w-8 p-0" title="Edit (saves a draft)">
              <Edit className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardFooter>
    </Card>
  );
}
