import { useState } from "react";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { usePortfolio } from "@/hooks/usePortfolio";
import {
  type ProStrategy,
  displayCagr,
  formatPercent,
  formatSignedCurrency,
  formatSignedPercent,
  scaledResults,
  vsBuyHold,
  vsDca,
} from "@core";
import { toPortfolioSummary } from "@/data/proStrategies";
import { Image as ImageIcon } from "lucide-react";
import { MetricTileGrid } from "@/components/MetricTileGrid";
import { StatTile, deltaTone, signedTone } from "@/components/StatTile";
import { isLegacyAlgorithm } from "@/lib/algorithms";

interface RecipeCardProps {
  recipe: ProStrategy;
  /** Capital the visitor entered; figures scale from the strategy's own starting capital (D3). */
  capital?: number;
  onClick: () => void;
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

export const RecipeCard = ({ recipe, capital, onClick }: RecipeCardProps) => {
  const returnValue = displayCagr(recipe);
  const scaled = scaledResults(recipe, capital);
  const scaledAssetQty = scaled.assetQty;
  const scaledNetProfitNumber = Math.round(scaled.netProfit);
  const thumbnailUrl = recipe.screenshots.length > 0 ? recipe.screenshots[0].url : null;
  const scaledCashProfit = scaled.cashProfit !== null ? Math.round(scaled.cashProfit) : null;

  const pnlPercent = recipe.return_pct;
  const pnlVsBuyHoldDelta = vsBuyHold(recipe);
  const pnlVsDcaDelta = vsDca(recipe);

  return (
    <Card
      className="group flex h-full cursor-pointer flex-col overflow-hidden border-border bg-card shadow-sm transition-[border-color,box-shadow,transform] duration-150 ease-out hover:-translate-y-px hover:border-border-strong hover:shadow-md"
      onClick={onClick}
    >
      <div className="aspect-video overflow-hidden bg-navy">
        {thumbnailUrl ? (
          <img
            src={thumbnailUrl}
            alt={`${recipe.short_name} thumbnail`}
            className="h-full w-full object-cover"
          />
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
          {typeof recipe.display_number === "number" && (
            <Badge variant="chip">#{recipe.display_number}</Badge>
          )}
          <Badge variant="chip">{recipe.asset}</Badge>
          <Badge className={getFocusPill(recipe.focus)}>{recipe.focus}</Badge>
          <Badge variant="outline" className="rounded-full">
            {recipe.time_horizon}
          </Badge>
        </div>
        <CardTitle className="text-balance text-lg font-extrabold leading-snug tracking-[-0.02em] text-foreground">
          {recipe.title}
        </CardTitle>
      </CardHeader>

      <CardContent className="flex-1 space-y-4">
        <MetricTileGrid>
          {(
            <StatTile
              label="Net profit"
              value={formatSignedCurrency(scaledNetProfitNumber)}
              tone={signedTone(scaledNetProfitNumber)}
            />
          )}

          {scaledCashProfit !== null && (
            <StatTile label="Cash profit" value={formatSignedCurrency(scaledCashProfit)} />
          )}

          {pnlPercent !== null && (
            <StatTile
              label="PnL"
              value={formatSignedPercent(pnlPercent)}
              tone={deltaTone(pnlPercent)}
            />
          )}

          {pnlVsBuyHoldDelta !== null && (
            <StatTile
              label="vs Buy & Hold"
              value={formatSignedPercent(pnlVsBuyHoldDelta)}
              tone={deltaTone(pnlVsBuyHoldDelta)}
            />
          )}

          {pnlVsDcaDelta !== null && (
            <StatTile
              label="vs DCA"
              value={formatSignedPercent(pnlVsDcaDelta)}
              tone={deltaTone(pnlVsDcaDelta)}
            />
          )}

          {returnValue !== null && (
            <StatTile label="CAGR" value={formatPercent(returnValue)} />
          )}

          {scaledAssetQty !== null && (
            <StatTile
              label="Asset accumulated"
              value={`${scaledAssetQty.toLocaleString(undefined, { maximumFractionDigits: 3 })} ${recipe.asset}`}
              fullWidth
            />
          )}

          {recipe.algorithm && (
            <StatTile
              label="Algorithm"
              value={
                <span className="inline-flex flex-wrap items-center gap-2">
                  <span>{recipe.algorithm}</span>
                  {isLegacyAlgorithm(recipe.algorithm) && (
                    <Badge variant="outline" className="text-xs">Legacy</Badge>
                  )}
                </span>
              }
              fullWidth
            />
          )}
        </MetricTileGrid>
      </CardContent>

      <CardFooter className="pt-0">
        <AddToPortfolioButton recipe={recipe} />
      </CardFooter>
    </Card>
  );
};

function AddToPortfolioButton({ recipe }: { recipe: ProStrategy }) {
  const { isInPortfolio, toggleRecipe } = usePortfolio();
  const [flash, setFlash] = useState(false);
  const added = isInPortfolio(recipe.id);
  return (
    <Button
      className={
        "w-full " +
        (flash || added ? "bg-gain text-white hover:bg-gain hover:brightness-100" : "")
      }
      variant={added ? "secondary" : "outline"}
      onClick={(e) => {
        e.stopPropagation();
        toggleRecipe(toPortfolioSummary(recipe));
        setFlash(true);
        setTimeout(() => setFlash(false), 1500);
      }}
    >
      {added ? "Added" : "Add to portfolio"}
    </Button>
  );
}
