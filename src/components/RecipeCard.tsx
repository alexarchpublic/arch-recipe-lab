import { useState } from "react";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Heart } from "lucide-react";
import { usePortfolio } from "@/hooks/usePortfolio";
import { parseCurrencyFromString } from "@/lib/portfolio";
import { TrendingUp, DollarSign, Clock, Target, Image as ImageIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface Recipe {
  id: string;
  name: string;
  asset: string;
  time_horizon: string;
  strategy_type: string;
  algorithm?: string;
  algorithm_inputs?: any;
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

const getFocusColor = (focus: string) => {
  switch (focus) {
    case 'Cash Yielding':
      return 'bg-accent text-accent-foreground';
    case 'Accumulation':
      return 'bg-primary text-primary-foreground';
    case 'Balanced':
      return 'bg-secondary text-secondary-foreground';
    default:
      return 'bg-muted text-muted-foreground';
  }
};

const getAssetColor = (asset: string) => {
  const colors: Record<string, string> = {
    'BTC': 'bg-orange-500 text-white',
    'ETH': 'bg-purple-500 text-white',
    'SOL': 'bg-violet-500 text-white',
    'XRP': 'bg-blue-500 text-white',
    'SUI': 'bg-cyan-500 text-white',
  };
  return colors[asset] || 'bg-muted text-muted-foreground';
};

export const RecipeCard = ({ recipe, scale = 1, onClick }: RecipeCardProps) => {
  const { isInPortfolio, toggleRecipe } = usePortfolio();

  const getStartEndDates = (): { start?: Date; end?: Date } => {
    const ai = recipe.algorithm_inputs as any;
    if (!ai) return {};
    if (recipe.algorithm === 'Intelligence Algorithm') {
      const s = ai.start, e = ai.end;
      const start = s && s.year && s.month && s.day ? new Date(s.year, (s.month - 1) || 0, s.day, s.hour || 0, s.minute || 0) : undefined;
      const end = e && e.year && e.month && e.day ? new Date(e.year, (e.month - 1) || 0, e.day) : undefined;
      return { start, end };
    }
    const ds = ai?.dates?.start, de = ai?.dates?.end;
    const start = ds && ds.year && ds.month && ds.day ? new Date(ds.year, (ds.month - 1) || 0, ds.day, ds.hour || 0, ds.minute || 0) : undefined;
    const end = de && de.year && de.month && de.day ? new Date(de.year, (de.month - 1) || 0, de.day) : undefined;
    return { start, end };
  };

  const computeCagr = (): number | null => {
    const { start, end } = getStartEndDates();
    const begin = recipe.initial_capital ?? null;
    const netProfit = parseCurrencyFromString(recipe.net_profit);
    if (!begin || !netProfit || !start || !end) return null;
    const years = (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24 * 365.25);
    if (years <= 0) return null;
    const endingValue = begin + netProfit;
    if (begin <= 0 || endingValue <= 0) return null;
    const cagr = Math.pow(endingValue / begin, 1 / years) - 1;
    return Number.isFinite(cagr) ? cagr * 100 : null;
  };

  const returnValue = computeCagr() ?? recipe.cagr ?? recipe.annualized_return;
  // Parse asset accumulated numeric qty and net profit dollars
  const parseAssetQuantity = (text?: string | null): number | null => {
    if (!text) return null;
    const match = String(text).match(/\b([0-9]+(?:\.[0-9]+)?)\s*(?:[A-Z]{2,6})?\b/);
    if (!match) return null;
    const qty = parseFloat(match[1]);
    return Number.isFinite(qty) ? qty : null;
  };
  const assetQty = parseAssetQuantity(recipe.asset_accumulated);
  const netProfitNumber = parseCurrencyFromString(recipe.net_profit);
  const scaleFactor = Number.isFinite(scale) ? (scale as number) : 1;
  const scaledAssetQty = assetQty !== null ? +(assetQty * scaleFactor) : null;
  const scaledNetProfitNumber = netProfitNumber !== null ? Math.round(netProfitNumber * scaleFactor) : null;
  const thumbnailUrl = recipe.screenshots && recipe.screenshots.length > 0 
    ? recipe.screenshots[0].image_url 
    : null;
  const scaledCashProfit = recipe.cash_profit !== null && recipe.cash_profit !== undefined
    ? Math.round((recipe.cash_profit as number) * (Number.isFinite(scale) ? scale : 1))
    : null;
  
  // Calculate PnL %
  const scaledInitialCapital = recipe.initial_capital !== null && recipe.initial_capital !== undefined
    ? Math.round((recipe.initial_capital as number) * (Number.isFinite(scale) ? scale : 1))
    : null;
  const pnlPercent = scaledInitialCapital !== null && scaledInitialCapital > 0 && scaledNetProfitNumber !== null
    ? (scaledNetProfitNumber / scaledInitialCapital) * 100
    : null;
  
  const inPortfolio = isInPortfolio(recipe.id);
  
  return (
    <Card 
      className="group cursor-pointer transition-all duration-300 hover:shadow-card-hover hover:scale-[1.02] bg-gradient-card border-border/50"
      onClick={onClick}
    >
      {/* Thumbnail */}
      <div className="aspect-video bg-muted rounded-t-lg overflow-hidden">
        {thumbnailUrl ? (
          <img
            src={thumbnailUrl}
            alt={`${recipe.name} thumbnail`}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-muted-foreground">
            <div className="text-center">
              <ImageIcon className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No screenshot</p>
            </div>
          </div>
        )}
      </div>

      <CardHeader className="space-y-3">
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="text-lg leading-tight group-hover:text-primary transition-colors">
            {recipe.goal}
          </CardTitle>
          {typeof recipe.display_number === 'number' && (
            <Badge variant="secondary" className="ml-2 font-semibold">#{recipe.display_number}</Badge>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge className={getAssetColor(recipe.asset)}>
            {recipe.asset}
          </Badge>
          <Badge className={getFocusColor(recipe.focus)}>
            {recipe.focus}
          </Badge>
          <Badge variant="outline" className="border-muted-foreground/30">
            {recipe.time_horizon}
          </Badge>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        
        <div className="grid grid-cols-2 gap-3">
          {returnValue && (
            <div className="flex items-center gap-2 p-2 rounded-lg bg-secondary/50">
              <TrendingUp className="h-4 w-4 text-primary" />
              <div>
                <p className="text-xs text-muted-foreground">CAGR</p>
                <p className="text-sm font-semibold text-primary">{returnValue.toFixed(1)}%</p>
              </div>
            </div>
          )}
          
          {scaledCashProfit !== null && (
            <div className="flex items-center gap-2 p-2 rounded-lg bg-secondary/50">
              <DollarSign className="h-4 w-4 text-accent" />
              <div>
                <p className="text-xs text-muted-foreground">Cash Profit</p>
                <p className="text-sm font-semibold text-foreground">
                  ${scaledCashProfit.toLocaleString()}
                </p>
              </div>
            </div>
          )}

          {scaledAssetQty !== null && (
            <div className="flex items-center gap-2 p-2 rounded-lg bg-secondary/50">
              <Target className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">Asset Accumulated</p>
                <p className="text-sm font-semibold">{scaledAssetQty.toLocaleString(undefined, { maximumFractionDigits: 3 })} {recipe.asset}</p>
              </div>
            </div>
          )}

          {scaledNetProfitNumber !== null && (
            <div className="flex items-center gap-2 p-2 rounded-lg bg-secondary/50">
              <DollarSign className="h-4 w-4 text-primary" />
              <div>
                <p className="text-xs text-muted-foreground">Net Profit</p>
                <p className="text-sm font-semibold">${scaledNetProfitNumber.toLocaleString()}</p>
              </div>
            </div>
          )}

          {pnlPercent !== null && (
            <div className="flex items-center gap-2 p-2 rounded-lg bg-secondary/50">
              <TrendingUp className={`h-4 w-4 ${pnlPercent >= 0 ? 'text-primary' : 'text-destructive'}`} />
              <div>
                <p className="text-xs text-muted-foreground">PnL %</p>
                <p className={`text-sm font-semibold ${pnlPercent >= 0 ? 'text-primary' : 'text-destructive'}`}>
                  {pnlPercent >= 0 ? '+' : ''}{pnlPercent.toFixed(1)}%
                </p>
              </div>
            </div>
          )}

          {recipe.algorithm && (
            <div className="flex items-center gap-2 p-2 rounded-lg bg-secondary/50 col-span-2">
              <Target className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">Algorithm</p>
                <p className="text-sm font-semibold">{recipe.algorithm}</p>
              </div>
            </div>
          )}
        </div>
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
        "w-full transition-colors " +
        (flash || added ? "bg-green-600 hover:bg-green-600 text-white" : "")
      }
      variant={added ? "secondary" : "outline"}
      onClick={(e) => {
        e.stopPropagation();
        toggleRecipe({
          recipeId: recipe.id,
          title: recipe.name,
          assetSymbol: recipe.asset,
          baseInitialCapital: recipe.initial_capital ?? undefined,
          baseCashProfit: recipe.cash_profit ?? null,
          baseNetProfit: parseCurrencyFromString(recipe.net_profit),
          assetAccumulatedText: recipe.asset_accumulated ?? null,
          algorithm: recipe.algorithm,
          algorithm_inputs: recipe.algorithm_inputs,
        });
        setFlash(true);
        setTimeout(() => setFlash(false), 1500);
      }}
    >
      {added ? "Added" : "Add To Portfolio"}
    </Button>
  );
}