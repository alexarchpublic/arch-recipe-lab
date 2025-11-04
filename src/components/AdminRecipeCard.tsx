import { useState } from "react";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Heart } from "lucide-react";
import { usePortfolio } from "@/hooks/usePortfolio";
import { useToast } from "@/hooks/use-toast";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { TrendingUp, DollarSign, Clock, Target, Edit, Trash2, Eye, Image as ImageIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { parseCurrencyFromString } from "@/lib/portfolio";

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
  created_at: string;
  updated_at: string;
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
  const { toast } = useToast();
  const { isInPortfolio, toggleRecipe } = usePortfolio();

  // Get thumbnail from screenshots prop
  const thumbnailUrl = recipe.screenshots && recipe.screenshots.length > 0 
    ? recipe.screenshots[0].image_url 
    : null;

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

  const returnValue = recipe.cagr || recipe.annualized_return;
  
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
          <CardTitle className="text-lg leading-tight group-hover:text-primary transition-colors">
            {recipe.name}
          </CardTitle>
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
        <p className="text-sm text-muted-foreground line-clamp-2">
          {recipe.goal}
        </p>
        
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
          
          {recipe.cash_profit !== null && (
            <div className="flex items-center gap-2 p-2 rounded-lg bg-secondary/50">
              <DollarSign className="h-4 w-4 text-accent" />
              <div>
                <p className="text-xs text-muted-foreground">Cash Profit</p>
                <p className="text-sm font-semibold text-foreground">
                  ${recipe.cash_profit.toLocaleString()}
                </p>
              </div>
            </div>
          )}
          
          <div className="flex items-center gap-2 p-2 rounded-lg bg-secondary/50">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <div>
              <p className="text-xs text-muted-foreground">Time Frame</p>
              <p className="text-sm font-semibold">{recipe.time_frame}</p>
            </div>
          </div>
          
          <div className="flex items-center gap-2 p-2 rounded-lg bg-secondary/50">
            <Target className="h-4 w-4 text-muted-foreground" />
            <div>
              <p className="text-xs text-muted-foreground">Exit/Entry</p>
              <p className="text-sm font-semibold">{recipe.exit_to_entry_proportion}%</p>
            </div>
          </div>
        </div>
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
