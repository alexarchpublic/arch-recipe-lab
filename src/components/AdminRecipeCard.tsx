import { useState } from "react";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Heart } from "lucide-react";
import { usePortfolio } from "@/hooks/usePortfolio";
import { useToast } from "@/hooks/use-toast";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { TrendingUp, DollarSign, Target, Edit, Trash2, Eye, Image as ImageIcon, Archive, ArchiveRestore, Scale } from "lucide-react";
import { MetricTileGrid } from "@/components/MetricTileGrid";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { parseCurrencyFromString } from "@/lib/portfolio";
import {
  formatSignedPercent,
  getDisplayCagr,
  getPnlVsBuyHoldDelta,
  getStrategyPnlPercent,
  isMarketWaveAlgorithm,
} from "@/utils/recipeMetrics";

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
  archived_at?: string | null;
  screenshots?: Array<{
    id: string;
    image_url: string;
    display_order: number;
  }>;
}

interface AdminRecipeCardProps {
  recipe: Recipe;
  onEdit: (recipe: Recipe) => void;
  onDelete: () => void;
  onView: (recipe: Recipe) => void;
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

export function AdminRecipeCard({ recipe, onEdit, onDelete, onView }: AdminRecipeCardProps) {
  const [deleting, setDeleting] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const { toast } = useToast();
  const { isInPortfolio, toggleRecipe } = usePortfolio();

  // Get thumbnail from screenshots prop
  const thumbnailUrl = recipe.screenshots && recipe.screenshots.length > 0 
    ? recipe.screenshots[0].image_url 
    : null;

  const returnValue = getDisplayCagr(recipe);
  
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
  const scaledAssetQty = assetQty !== null ? assetQty : null;
  const scaledNetProfitNumber = netProfitNumber !== null ? netProfitNumber : null;
  const scaledCashProfit = recipe.cash_profit !== null && recipe.cash_profit !== undefined
    ? recipe.cash_profit
    : null;

  const pnlPercent = getStrategyPnlPercent(recipe);
  const pnlVsBuyHoldDelta = getPnlVsBuyHoldDelta(recipe);

  const handleDelete = async () => {
    setDeleting(true);
    try {
      // Delete recipe (cascade will handle screenshots)
      const { error } = await supabase
        .from('recipes')
        .delete()
        .eq('id', recipe.id);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Recipe deleted successfully",
      });

      onDelete();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to delete recipe",
      });
    } finally {
      setDeleting(false);
    }
  };

  const handleToggleArchive = async () => {
    setArchiving(true);
    try {
      const nextArchivedAt = recipe.archived_at ? null : new Date().toISOString();
      const { error } = await supabase
        .from('recipes')
        .update({ archived_at: nextArchivedAt })
        .eq('id', recipe.id);

      if (error) {
        const msg = String((error as any)?.message || "");
        if (msg.includes("archived_at") || msg.includes("does not exist")) {
          throw new Error(
            "Archiving isn't enabled in the database yet (missing recipes.archived_at). Apply the latest Supabase migrations, then retry.",
          );
        }
        throw error;
      }

      toast({
        title: "Success",
        description: recipe.archived_at ? "Recipe unarchived." : "Recipe archived.",
      });

      onDelete();
    } catch (error: unknown) {
      const message =
        error instanceof Error
          ? error.message
          : typeof error === "string"
            ? error
            : "Failed to update recipe";
      toast({
        variant: "destructive",
        title: "Error",
        description: message,
      });
    } finally {
      setArchiving(false);
    }
  };
  
  return (
    <Card className="group hover:shadow-lg transition-all duration-300 bg-gradient-card border-border/50">
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
          <div className="flex items-center gap-2 flex-wrap">
            <CardTitle className="text-lg leading-tight group-hover:text-primary transition-colors">
              {recipe.goal}
            </CardTitle>
            {typeof recipe.display_number === 'number' && (
              <Badge variant="default" className="text-base font-bold px-3 py-1">#{recipe.display_number}</Badge>
            )}
          </div>
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
        
        <MetricTileGrid>
          {returnValue !== null && (
            <div className="flex items-center gap-2 p-2 rounded-lg bg-secondary/50">
              <TrendingUp className="h-4 w-4 text-primary" />
              <div>
                <p className="text-xs text-muted-foreground">CAGR</p>
                <p className="text-sm font-semibold text-primary">{returnValue.toFixed(1)}%</p>
              </div>
            </div>
          )}

          {isMarketWaveAlgorithm(recipe) && pnlVsBuyHoldDelta !== null && (
            <div className="flex items-center gap-2 p-2 rounded-lg bg-secondary/50">
              <Scale className={`h-4 w-4 ${pnlVsBuyHoldDelta >= 0 ? 'text-primary' : 'text-destructive'}`} />
              <div>
                <p className="text-xs text-muted-foreground">vs Buy &amp; Hold</p>
                <p className={`text-sm font-semibold ${pnlVsBuyHoldDelta >= 0 ? 'text-primary' : 'text-destructive'}`}>
                  {formatSignedPercent(pnlVsBuyHoldDelta)}
                </p>
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
        </MetricTileGrid>
      </CardContent>
      
      <CardFooter className="pt-0">
        <div className="flex justify-between items-center w-full">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>{recipe.strategy_type}</span>
            {recipe.algorithm && (
              <span className="before:content-['•'] before:mx-2 text-muted-foreground/80" />
            )}
            {recipe.algorithm && (
              <span>{recipe.algorithm}</span>
            )}
          </div>
          
          {/* Action Buttons */}
          <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
            <Button
              variant="outline"
              size="sm"
              onClick={handleToggleArchive}
              className="h-8 w-8 p-0"
              disabled={archiving}
              aria-label={recipe.archived_at ? "Unarchive recipe" : "Archive recipe"}
              title={recipe.archived_at ? "Unarchive" : "Archive"}
            >
              {recipe.archived_at ? <ArchiveRestore className="h-4 w-4" /> : <Archive className="h-4 w-4" />}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className={isInPortfolio(recipe.id) ? "h-8 w-8 p-0 text-red-500" : "h-8 w-8 p-0"}
              onClick={() =>
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
                  display_number: recipe.display_number ?? null,
                })
              }
              aria-label={isInPortfolio(recipe.id) ? "Remove from portfolio" : "Add to portfolio"}
            >
              <Heart className={isInPortfolio(recipe.id) ? "h-4 w-4 fill-red-500" : "h-4 w-4"} />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onView(recipe)}
              className="h-8 w-8 p-0"
            >
              <Eye className="h-4 w-4" />
            </Button>
            
            <Button
              variant="outline"
              size="sm"
              onClick={() => onEdit(recipe)}
              className="h-8 w-8 p-0"
            >
              <Edit className="h-4 w-4" />
            </Button>
            
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="destructive"
                  size="sm"
                  className="h-8 w-8 p-0"
                  disabled={deleting}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete Recipe</AlertDialogTitle>
                  <AlertDialogDescription>
                    Are you sure you want to delete "{recipe.name}"? This action cannot be undone.
                    All associated screenshots will also be deleted.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleDelete}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    disabled={deleting}
                  >
                    {deleting ? "Deleting..." : "Delete"}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
      </CardFooter>
    </Card>
  );
}
