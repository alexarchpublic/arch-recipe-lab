import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Heart } from "lucide-react";
import { usePortfolio } from "@/hooks/usePortfolio";
import { TrendingUp, DollarSign, Clock, Target, Image as ImageIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface Recipe {
  id: string;
  name: string;
  asset: string;
  time_horizon: string;
  strategy_type: string;
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
  const returnValue = recipe.cagr || recipe.annualized_return;
  const thumbnailUrl = recipe.screenshots && recipe.screenshots.length > 0 
    ? recipe.screenshots[0].image_url 
    : null;
  const scaledCashProfit = recipe.cash_profit !== null && recipe.cash_profit !== undefined
    ? Math.round((recipe.cash_profit as number) * (Number.isFinite(scale) ? scale : 1))
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
            {recipe.name}
          </CardTitle>
          <Button
            variant="ghost"
            size="icon"
            onClick={(e) => {
              e.stopPropagation();
              toggleRecipe({
                recipeId: recipe.id,
                title: recipe.name,
                assetSymbol: recipe.asset,
                baseInitialCapital: undefined,
                baseCashProfit: recipe.cash_profit ?? null,
                assetAccumulatedText: null,
              });
            }}
            className={inPortfolio ? "text-red-500" : ""}
            aria-label={inPortfolio ? "Remove from portfolio" : "Add to portfolio"}
          >
            <Heart className={inPortfolio ? "h-4 w-4 fill-red-500" : "h-4 w-4"} />
          </Button>
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
        <p className="text-xs text-muted-foreground">
          {recipe.strategy_type}
        </p>
      </CardFooter>
    </Card>
  );
};