import { useState } from "react";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { usePortfolio } from "@/hooks/usePortfolio";
import { parseCurrencyFromString } from "@/lib/portfolio";
import {
  formatPercent,
  formatSignedCurrency,
  formatSignedPercent,
  getDisplayCagr,
  getPnlVsBuyHoldDelta,
  getPnlVsDcaDelta,
  getStrategyPnlPercent,
  isMarketWaveAlgorithm,
} from "@/utils/recipeMetrics";
import { Image as ImageIcon } from "lucide-react";
import { MetricTileGrid } from "@/components/MetricTileGrid";
import { StatTile, deltaTone, signedTone } from "@/components/StatTile";
import { isLegacyAlgorithm } from "@/lib/algorithms";

interface Recipe {
  id: string;
  name: string;
  asset: string;
  asset_class?: string;
  time_horizon: string;
  strategy_type: string;
  algorithm?: string;
  algorithm_inputs?: any;
  buy_hold_pnl_percent?: number | null;
  dca_pnl_percent?: number | null;
  focus: string;
  goal: string;
  display_number?: number | null;
  entry_trade: string;
  exit_trade: string;
  exit_to_entry_proportion: number;
  time_frame: string;
  cagr: number | null;
  annualized_return: number | null;
  net_profit: string | null;
  cash_profit: number | null;
  asset_accumulated?: string | null;
  initial_capital?: number | null;
  screenshots?: Array<{
    id: string;
    image_url: string;
    display_order: number;
  }>;
}

interface RecipeCardProps {
  recipe: Recipe;
  scale?: number;
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

export const RecipeCard = ({ recipe, scale = 1, onClick }: RecipeCardProps) => {
  const returnValue = getDisplayCagr(recipe);
  const scaleFactor = Number.isFinite(scale) ? (scale as number) : 1;
  const parseAssetQuantity = (text?: string | null): number | null => {
    if (!text) return null;
    const match = String(text).match(/\b([0-9]+(?:\.[0-9]+)?)\s*(?:[A-Z]{2,6})?\b/);
    if (!match) return null;
    const qty = parseFloat(match[1]);
    return Number.isFinite(qty) ? qty : null;
  };
  const assetQty = parseAssetQuantity(recipe.asset_accumulated);
  const netProfitNumber = parseCurrencyFromString(recipe.net_profit);
  const scaledAssetQty = assetQty !== null ? +(assetQty * scaleFactor) : null;
  const scaledNetProfitNumber = netProfitNumber !== null ? Math.round(netProfitNumber * scaleFactor) : null;
  const thumbnailUrl = recipe.screenshots && recipe.screenshots.length > 0
    ? recipe.screenshots[0].image_url
    : null;
  const scaledCashProfit = recipe.cash_profit !== null && recipe.cash_profit !== undefined
    ? Math.round((recipe.cash_profit as number) * (Number.isFinite(scale) ? scale : 1))
    : null;

  const pnlPercent = getStrategyPnlPercent(recipe);
  const pnlVsBuyHoldDelta = getPnlVsBuyHoldDelta(recipe);
  const pnlVsDcaDelta = getPnlVsDcaDelta(recipe);

  return (
    <Card
      className="group flex h-full cursor-pointer flex-col overflow-hidden border-border bg-card shadow-sm transition-[border-color,box-shadow,transform] duration-150 ease-out hover:-translate-y-px hover:border-border-strong hover:shadow-md"
      onClick={onClick}
    >
      <div className="aspect-video overflow-hidden bg-navy">
        {thumbnailUrl ? (
          <img
            src={thumbnailUrl}
            alt={`${recipe.name} thumbnail`}
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
          {recipe.goal}
        </CardTitle>
      </CardHeader>

      <CardContent className="flex-1 space-y-4">
        <MetricTileGrid>
          {scaledNetProfitNumber !== null && (
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

          {isMarketWaveAlgorithm(recipe) && pnlVsBuyHoldDelta !== null && (
            <StatTile
              label="vs Buy & Hold"
              value={formatSignedPercent(pnlVsBuyHoldDelta)}
              tone={deltaTone(pnlVsBuyHoldDelta)}
            />
          )}

          {isMarketWaveAlgorithm(recipe) && pnlVsDcaDelta !== null && (
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

function AddToPortfolioButton({ recipe }: { recipe: any }) {
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
        toggleRecipe({
          recipeId: recipe.id,
          title: recipe.name,
          assetSymbol: recipe.asset,
          time_frame: recipe.time_frame,
          baseInitialCapital: recipe.initial_capital ?? undefined,
          baseCashProfit: recipe.cash_profit ?? null,
          baseNetProfit: parseCurrencyFromString(recipe.net_profit),
          assetAccumulatedText: recipe.asset_accumulated ?? null,
          algorithm: recipe.algorithm,
          algorithm_inputs: recipe.algorithm_inputs,
          display_number: recipe.display_number ?? null,
          focus: recipe.focus,
        });
        setFlash(true);
        setTimeout(() => setFlash(false), 1500);
      }}
    >
      {added ? "Added" : "Add to portfolio"}
    </Button>
  );
}
