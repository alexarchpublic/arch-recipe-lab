import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from "@/components/ui/carousel";
import { TrendingUp, DollarSign, Clock, Target, ArrowUpDown, Calendar, Image as ImageIcon } from "lucide-react";
import { useState, useRef } from "react";

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
  sell_above_cost_basis: boolean | null;
  exit_to_entry_proportion: number;
  time_frame: string;
  backtesting_period: string;
  initial_capital: number | null;
  cash_profit: number | null;
  asset_accumulated: string | null;
  net_profit: string | null;
  cagr: number | null;
  annualized_return: number | null;
  best_for: string | null;
  screenshots?: Array<{
    id: string;
    image_url: string;
    display_order: number;
  }>;
}

interface RecipeDetailModalProps {
  recipe: Recipe | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
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

export const RecipeDetailModal = ({ recipe, open, onOpenChange }: RecipeDetailModalProps) => {
  const [currentSlide, setCurrentSlide] = useState(0);
  const carouselRef = useRef<any>(null);
  
  if (!recipe) return null;

  const returnValue = recipe.cagr || recipe.annualized_return;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl pr-8">{recipe.name}</DialogTitle>
          <DialogDescription className="flex flex-wrap gap-2 pt-2">
            <Badge variant="outline">{recipe.asset}</Badge>
            <Badge className={getFocusColor(recipe.focus)}>{recipe.focus}</Badge>
            <Badge variant="outline">{recipe.time_horizon === 'STH' ? 'Short Term' : 'Long Term'}</Badge>
            <Badge variant="outline">{recipe.strategy_type}</Badge>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 pt-4">
          {/* Screenshots */}
          {recipe.screenshots && recipe.screenshots.length > 0 && (
            <>
              <div>
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <ImageIcon className="h-5 w-5 text-primary" />
                  Screenshots ({recipe.screenshots.length})
                </h3>
                <div className="relative">
                  <Carousel 
                    ref={carouselRef}
                    className="w-full" 
                    opts={{
                      loop: true,
                      align: "start",
                    }}
                    onSlideChange={(index) => setCurrentSlide(index)}
                  >
                    <CarouselContent>
                      {recipe.screenshots.map((screenshot, index) => (
                        <CarouselItem key={screenshot.id}>
                          <div 
                            className="aspect-video bg-muted rounded-lg overflow-hidden cursor-pointer"
                            onClick={() => {
                              // Open full-size image in new tab
                              window.open(screenshot.image_url, '_blank');
                            }}
                          >
                            <img
                              src={screenshot.image_url}
                              alt={`${recipe.name} screenshot ${index + 1}`}
                              className="w-full h-full object-contain hover:opacity-90 transition-opacity"
                            />
                          </div>
                        </CarouselItem>
                      ))}
                    </CarouselContent>
                    {recipe.screenshots.length > 1 && (
                      <>
                        <CarouselPrevious className="left-4 z-10" />
                        <CarouselNext className="right-4 z-10" />
                      </>
                    )}
                  </Carousel>
                  
                  {/* Dots indicator */}
                  {recipe.screenshots.length > 1 && (
                    <div className="flex justify-center mt-4 gap-2">
                      {recipe.screenshots.map((_, index) => (
                        <button
                          key={index}
                          onClick={() => {
                            setCurrentSlide(index);
                            carouselRef.current?.scrollTo(index);
                          }}
                          className={`w-2 h-2 rounded-full transition-colors ${
                            index === currentSlide 
                              ? 'bg-primary' 
                              : 'bg-muted-foreground/30 hover:bg-muted-foreground/50'
                          }`}
                          aria-label={`Go to screenshot ${index + 1}`}
                        />
                      ))}
                    </div>
                  )}
                </div>
              </div>
              <Separator />
            </>
          )}

          {/* Goal */}
          <div>
            <h3 className="text-sm font-semibold mb-2 text-primary">Goal</h3>
            <p className="text-sm text-muted-foreground">{recipe.goal}</p>
          </div>

          <Separator />

          {/* Parameters */}
          <div>
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Target className="h-5 w-5 text-primary" />
              Parameters
            </h3>
            <div className="grid gap-3">
              <div className="grid grid-cols-[140px_1fr] gap-2 items-start">
                <span className="text-sm font-medium text-muted-foreground">Entry Trade:</span>
                <span className="text-sm">{recipe.entry_trade}</span>
              </div>
              <div className="grid grid-cols-[140px_1fr] gap-2 items-start">
                <span className="text-sm font-medium text-muted-foreground">Exit Trade:</span>
                <span className="text-sm">{recipe.exit_trade}</span>
              </div>
              {recipe.sell_above_cost_basis !== null && (
                <div className="grid grid-cols-[140px_1fr] gap-2 items-start">
                  <span className="text-sm font-medium text-muted-foreground">Sell Above Cost Basis:</span>
                  <span className="text-sm">{recipe.sell_above_cost_basis ? 'Yes' : 'No'}</span>
                </div>
              )}
              <div className="grid grid-cols-[140px_1fr] gap-2 items-start">
                <span className="text-sm font-medium text-muted-foreground">Exit/Entry Proportion:</span>
                <span className="text-sm font-semibold text-primary">{recipe.exit_to_entry_proportion}%</span>
              </div>
              <div className="grid grid-cols-[140px_1fr] gap-2 items-start">
                <span className="text-sm font-medium text-muted-foreground">Time Frame:</span>
                <span className="text-sm">{recipe.time_frame}</span>
              </div>
              <div className="grid grid-cols-[140px_1fr] gap-2 items-start">
                <span className="text-sm font-medium text-muted-foreground">Backtesting Period:</span>
                <span className="text-sm">{recipe.backtesting_period}</span>
              </div>
            </div>
          </div>

          <Separator />

          {/* Results */}
          <div>
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-accent" />
              Results
            </h3>
            <div className="grid md:grid-cols-2 gap-4">
              {recipe.initial_capital !== null && (
                <div className="p-4 rounded-lg bg-secondary/50 border border-border">
                  <p className="text-xs text-muted-foreground mb-1">Initial Capital</p>
                  <p className="text-lg font-semibold">${recipe.initial_capital.toLocaleString()}</p>
                </div>
              )}
              
              {recipe.cash_profit !== null && (
                <div className="p-4 rounded-lg bg-accent/10 border border-accent/20">
                  <p className="text-xs text-muted-foreground mb-1">Cash Profit</p>
                  <p className="text-lg font-semibold text-accent">${recipe.cash_profit.toLocaleString()}</p>
                </div>
              )}
              
              {recipe.asset_accumulated && (
                <div className="p-4 rounded-lg bg-secondary/50 border border-border">
                  <p className="text-xs text-muted-foreground mb-1">Asset Accumulated</p>
                  <p className="text-sm font-semibold">{recipe.asset_accumulated}</p>
                </div>
              )}
              
              {recipe.net_profit && (
                <div className="p-4 rounded-lg bg-primary/10 border border-primary/20">
                  <p className="text-xs text-muted-foreground mb-1">Net Profit</p>
                  <p className="text-sm font-semibold text-primary">{recipe.net_profit}</p>
                </div>
              )}
              
              {returnValue !== null && (
                <div className="p-4 rounded-lg bg-gradient-hero text-white border-0">
                  <p className="text-xs opacity-90 mb-1">
                    {recipe.cagr ? 'CAGR' : 'Annualized Return'}
                  </p>
                  <p className="text-2xl font-bold">{returnValue.toFixed(2)}%</p>
                </div>
              )}
            </div>
          </div>

          {recipe.best_for && (
            <>
              <Separator />
              <div>
                <h3 className="text-sm font-semibold mb-2 text-primary">Best For</h3>
                <p className="text-sm text-muted-foreground">{recipe.best_for}</p>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};