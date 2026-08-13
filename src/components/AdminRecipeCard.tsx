import { useState } from "react";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Heart, Edit, Trash2, Eye, Image as ImageIcon, Archive, ArchiveRestore } from "lucide-react";
import { usePortfolio } from "@/hooks/usePortfolio";
import { useToast } from "@/hooks/use-toast";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { MetricTileGrid } from "@/components/MetricTileGrid";
import { StatTile, deltaTone, signedTone } from "@/components/StatTile";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
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
  const pnlVsDcaDelta = getPnlVsDcaDelta(recipe);

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
    <Card className={cn(
      "group overflow-hidden border-border bg-card shadow-sm transition-[border-color,box-shadow,transform] duration-150 ease-out hover:-translate-y-px hover:border-border-strong hover:shadow-md",
      recipe.archived_at && "opacity-75",
    )}>
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
          {isLegacyAlgorithm(recipe.algorithm) && (
            <Badge variant="outline">Legacy</Badge>
          )}
        </div>
        <CardTitle className="text-balance text-lg font-extrabold leading-snug tracking-[-0.02em]">
          {recipe.goal}
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-4">
        <MetricTileGrid>
          {returnValue !== null && (
            <StatTile label="CAGR" value={formatPercent(returnValue)} />
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

          {scaledCashProfit !== null && (
            <StatTile label="Cash profit" value={formatSignedCurrency(scaledCashProfit)} />
          )}

          {scaledAssetQty !== null && (
            <StatTile
              label="Asset accumulated"
              value={`${scaledAssetQty.toLocaleString(undefined, { maximumFractionDigits: 3 })} ${recipe.asset}`}
            />
          )}

          {scaledNetProfitNumber !== null && (
            <StatTile
              label="Net profit"
              value={formatSignedCurrency(scaledNetProfitNumber)}
              tone={signedTone(scaledNetProfitNumber)}
            />
          )}

          {pnlPercent !== null && (
            <StatTile
              label="PnL"
              value={formatSignedPercent(pnlPercent)}
              tone={deltaTone(pnlPercent)}
            />
          )}

          {recipe.algorithm && (
            <StatTile
              label="Algorithm"
              value={recipe.algorithm}
              fullWidth
            />
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
              className={isInPortfolio(recipe.id) ? "h-8 w-8 p-0 text-destructive hover:text-destructive" : "h-8 w-8 p-0"}
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
              <Heart className={isInPortfolio(recipe.id) ? "h-4 w-4 fill-destructive" : "h-4 w-4"} />
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
