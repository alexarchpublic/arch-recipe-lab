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
import { scaleRecipeFreeText } from "@/utils/recipeScaling";

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
  scale?: number;
  initialCapital?: number;
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

export const RecipeDetailModal = ({ recipe, open, onOpenChange, scale = 1, initialCapital }: RecipeDetailModalProps) => {
  const [currentSlide, setCurrentSlide] = useState(0);
  const carouselRef = useRef<any>(null);
  
  if (!recipe) return null;
  // Helpers
  const parseCurrencyFromString = (text?: string | null): number | null => {
    if (!text) return null;
    const match = String(text).replace(/[^0-9.,-]/g, "").replace(/,/g, "");
    const num = parseFloat(match);
    return Number.isFinite(num) ? num : null;
  };

  const getStartEndDates = (): { start?: Date; end?: Date } => {
    const ai = recipe.algorithm_inputs as any;
    if (!ai) return {};
    // Intelligence: start/end at root
    if (recipe.algorithm === 'Intelligence Algorithm') {
      const s = ai.start, e = ai.end;
      const start = s && s.year && s.month && s.day ? new Date(s.year, (s.month - 1) || 0, s.day, s.hour || 0, s.minute || 0) : undefined;
      const end = e && e.year && e.month && e.day ? new Date(e.year, (e.month - 1) || 0, e.day) : undefined;
      return { start, end };
    }
    // Arbitrage/Oracle: dates.start/end
    const ds = ai.dates?.start, de = ai.dates?.end;
    const start = ds && ds.year && ds.month && ds.day ? new Date(ds.year, (ds.month - 1) || 0, ds.day, ds.hour || 0, ds.minute || 0) : undefined;
    const end = de && de.year && de.month && de.day ? new Date(de.year, (de.month - 1) || 0, de.day) : undefined;
    return { start, end };
  };

  const computeCagr = (): number | null => {
    const startEnd = getStartEndDates();
    const start = startEnd.start;
    const end = startEnd.end;
    const begin = (initialCapital ?? recipe.initial_capital) ?? null;
    const netProfit = parseCurrencyFromString(recipe.net_profit);
    if (!begin || !netProfit || !start || !end) return null;
    const years = (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24 * 365.25);
    if (years <= 0) return null;
    const endingValue = begin + netProfit;
    if (begin <= 0 || endingValue <= 0) return null;
    const cagr = Math.pow(endingValue / begin, 1 / years) - 1;
    return Number.isFinite(cagr) ? cagr * 100 : null;
  };

  const computedCagr = computeCagr();
  const returnValue = computedCagr ?? recipe.cagr ?? recipe.annualized_return;
  const scaledEntryTrade = recipe.entry_trade ? (scaleRecipeFreeText(recipe.entry_trade, scale) as string) : '';
  const scaledExitTrade = recipe.exit_trade ? (scaleRecipeFreeText(recipe.exit_trade, scale) as string) : '';
  const scaledInitialCapital = (initialCapital ?? recipe.initial_capital) ?? null;
  const scaledCashProfit = recipe.cash_profit !== null && recipe.cash_profit !== undefined
    ? Math.round((recipe.cash_profit as number) * (Number.isFinite(scale) ? scale : 1))
    : null;
  const scaledAssetAccumulated = recipe.asset_accumulated
    ? scaleRecipeFreeText(recipe.asset_accumulated, scale)
    : null;
  const scaledNetProfitRaw = recipe.net_profit
    ? scaleRecipeFreeText(recipe.net_profit, scale)
    : null;

  // Parse numeric asset quantity and format as "<qty> <ASSET>"
  const parseAssetQuantity = (text?: string | null): number | null => {
    if (!text) return null;
    // Try to find a number followed by optional space and asset ticker, or number in parentheses
    const qtyMatch = String(text).match(/\b([0-9]+(?:\.[0-9]+)?)\s*(?:[A-Z]{2,6})?\b/);
    if (!qtyMatch) return null;
    const qty = parseFloat(qtyMatch[1]);
    return Number.isFinite(qty) ? qty : null;
  };
  const assetQty = parseAssetQuantity(scaledAssetAccumulated as any);
  const assetAccumulatedDisplay = assetQty !== null ? `${assetQty.toLocaleString(undefined, { maximumFractionDigits: 3 })} ${recipe.asset}` : null;

  // Format Net Profit as dollars
  const netProfitNumber = parseCurrencyFromString(scaledNetProfitRaw as any);
  const netProfitDisplay = netProfitNumber !== null ? `$${netProfitNumber.toLocaleString()}` : (scaledNetProfitRaw as any);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl pr-8">{recipe.goal}</DialogTitle>
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

          {/* Goal section removed; goal is now the title */}

          {/* Results (moved above Parameters) */}
          <div>
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-primary" />
              Results
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {scaledInitialCapital !== null && (
                <div className="p-4 rounded-lg bg-secondary/50 border border-border">
                  <p className="text-xs text-muted-foreground mb-1">Initial Capital</p>
                  <p className="text-lg font-semibold">${Math.round(scaledInitialCapital).toLocaleString()}</p>
                </div>
              )}
              {scaledCashProfit !== null && (
                <div className="p-4 rounded-lg bg-accent/10 border border-accent/20">
                  <p className="text-xs text-muted-foreground mb-1">Cash Profit</p>
                  <p className="text-lg font-semibold text-accent">${scaledCashProfit.toLocaleString()}</p>
                </div>
              )}
              {assetAccumulatedDisplay && (
                <div className="p-4 rounded-lg bg-secondary/50 border border-border">
                  <p className="text-xs text-muted-foreground mb-1">Asset Accumulated</p>
                  <p className="text-sm font-semibold">{assetAccumulatedDisplay}</p>
                </div>
              )}
              {netProfitDisplay && (
                <div className="p-4 rounded-lg bg-primary/10 border border-primary/20">
                  <p className="text-xs text-muted-foreground mb-1">Net Profit</p>
                  <p className="text-sm font-semibold text-primary">{netProfitDisplay}</p>
                </div>
              )}
              {returnValue !== null && (
                <div className="p-4 rounded-lg bg-gradient-hero text-white border-0">
                  <p className="text-xs opacity-90 mb-1">CAGR</p>
                  <p className="text-2xl font-bold">{returnValue.toFixed(2)}%</p>
                </div>
              )}
            </div>
          </div>

          <Separator />

          {/* Parameters - Algorithm specific */}
          <div>
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Target className="h-5 w-5 text-primary" />
              Parameters
            </h3>
            <div className="grid gap-3">
              {recipe.algorithm && (
                <div className="grid grid-cols-[140px_1fr] gap-2 items-start">
                  <span className="text-sm font-medium text-muted-foreground">Algorithm:</span>
                  <span className="text-sm">{recipe.algorithm}</span>
                </div>
              )}

              {/* Intelligence Algorithm */}
              {recipe.algorithm === 'Intelligence Algorithm' && (
                <>
                  <div className="text-sm font-semibold mt-2">Inputs</div>
                  <div className="grid grid-cols-[180px_1fr] gap-2 items-start">
                    <span className="text-sm font-medium text-muted-foreground">Repeat Purchase Method:</span>
                    {recipe.algorithm_inputs?.repeatPurchaseMethod && (
                      <span className="text-sm">{recipe.algorithm_inputs?.repeatPurchaseMethod}</span>
                    )}
                  </div>
                  {recipe.algorithm_inputs?.start && (
                    <div className="grid grid-cols-[180px_1fr] gap-2 items-start">
                      <span className="text-sm font-medium text-muted-foreground">Start Date/Time:</span>
                      <span className="text-sm">{recipe.algorithm_inputs?.start?.year}-{recipe.algorithm_inputs?.start?.month}-{recipe.algorithm_inputs?.start?.day}{(recipe.algorithm_inputs?.start?.hour ?? null) !== null ? ` ${recipe.algorithm_inputs?.start?.hour}:${String(recipe.algorithm_inputs?.start?.minute ?? 0).padStart(2,'0')}` : ''}</span>
                    </div>
                  )}
                  {recipe.algorithm_inputs?.end && (
                    <div className="grid grid-cols-[180px_1fr] gap-2 items-start">
                      <span className="text-sm font-medium text-muted-foreground">End Date:</span>
                      <span className="text-sm">{recipe.algorithm_inputs?.end?.year}-{recipe.algorithm_inputs?.end?.month}-{recipe.algorithm_inputs?.end?.day}</span>
                    </div>
                  )}
                  {typeof recipe.algorithm_inputs?.startBarsBack?.bars === 'number' && (
                    <div className="grid grid-cols-[180px_1fr] gap-2 items-start">
                      <span className="text-sm font-medium text-muted-foreground">Start X Bars Back:</span>
                      <span className="text-sm">{recipe.algorithm_inputs?.startBarsBack?.bars}</span>
                    </div>
                  )}
                  {recipe.algorithm_inputs?.backtest?.exitFullOnLastBar && (
                    <div className="grid grid-cols-[180px_1fr] gap-2 items-start">
                      <span className="text-sm font-medium text-muted-foreground">Exit Full on Last Bar:</span>
                      <span className="text-sm">Yes</span>
                    </div>
                  )}
                  {recipe.algorithm_inputs?.activate?.enabled && (
                    <div className="grid grid-cols-[180px_1fr] gap-2 items-start">
                      <span className="text-sm font-medium text-muted-foreground">Activate Intelligence:</span>
                      <span className="text-sm">Yes{typeof recipe.algorithm_inputs?.activate?.factor === 'number' ? ` (Factor ${recipe.algorithm_inputs?.activate?.factor})` : ''}</span>
                    </div>
                  )}
                </>
              )}

              {/* Arbitrage Algorithm */}
              {recipe.algorithm === 'Arbitrage Algorithm' && (
                <>
                  <div className="text-sm font-semibold mt-2">Inputs</div>
                  <div className="grid grid-cols-[180px_1fr] gap-2 items-start">
                    <span className="text-sm font-medium text-muted-foreground">Long Threshold (%):</span>
                    {typeof recipe.algorithm_inputs?.longThreshold?.percent === 'number' && (
                      <span className="text-sm">{recipe.algorithm_inputs?.longThreshold?.percent}</span>
                    )}
                  </div>
                  <div className="grid grid-cols-[180px_1fr] gap-2 items-start">
                    <span className="text-sm font-medium text-muted-foreground">Exit Threshold (%):</span>
                    {typeof recipe.algorithm_inputs?.exitThreshold?.percent === 'number' && (
                      <span className="text-sm">{recipe.algorithm_inputs?.exitThreshold?.percent}</span>
                    )}
                  </div>
                  <div className="grid grid-cols-[180px_1fr] gap-2 items-start">
                    <span className="text-sm font-medium text-muted-foreground">Entry Trade Size ($):</span>
                    {typeof recipe.algorithm_inputs?.tradeSize?.entry === 'number' && (
                      <span className="text-sm">{recipe.algorithm_inputs?.tradeSize?.entry}</span>
                    )}
                  </div>
                  <div className="grid grid-cols-[180px_1fr] gap-2 items-start">
                    <span className="text-sm font-medium text-muted-foreground">Exit Trade Size ($):</span>
                    {typeof recipe.algorithm_inputs?.tradeSize?.exit === 'number' && (
                      <span className="text-sm">{recipe.algorithm_inputs?.tradeSize?.exit}</span>
                    )}
                  </div>
                  {(recipe.algorithm_inputs?.dates?.start && recipe.algorithm_inputs?.dates?.end) && (
                    <div className="grid grid-cols-[180px_1fr] gap-2 items-start">
                      <span className="text-sm font-medium text-muted-foreground">Start/End:</span>
                      <span className="text-sm">{recipe.algorithm_inputs?.dates?.start?.year}-{recipe.algorithm_inputs?.dates?.start?.month}-{recipe.algorithm_inputs?.dates?.start?.day} → {recipe.algorithm_inputs?.dates?.end?.year}-{recipe.algorithm_inputs?.dates?.end?.month}-{recipe.algorithm_inputs?.dates?.end?.day}</span>
                    </div>
                  )}
                </>
              )}

              {/* Oracle Protocol */}
              {recipe.algorithm === 'Oracle Protocol' && (
                <>
                  <div className="text-sm font-semibold mt-2">Inputs</div>
                  <div className="grid grid-cols-[180px_1fr] gap-2 items-start">
                    <span className="text-sm font-medium text-muted-foreground">Long Threshold (%):</span>
                    {typeof recipe.algorithm_inputs?.longThreshold?.percent === 'number' && (
                      <span className="text-sm">{recipe.algorithm_inputs?.longThreshold?.percent}</span>
                    )}
                  </div>
                  <div className="grid grid-cols-[180px_1fr] gap-2 items-start">
                    <span className="text-sm font-medium text-muted-foreground">Exit Threshold (%):</span>
                    {typeof recipe.algorithm_inputs?.exitThreshold?.percent === 'number' && (
                      <span className="text-sm">{recipe.algorithm_inputs?.exitThreshold?.percent}</span>
                    )}
                  </div>
                  <div className="grid grid-cols-[180px_1fr] gap-2 items-start">
                    <span className="text-sm font-medium text-muted-foreground">Primary Trade Size Type:</span>
                    {recipe.algorithm_inputs?.tradeSize?.primaryType && (
                      <span className="text-sm">{recipe.algorithm_inputs?.tradeSize?.primaryType}</span>
                    )}
                  </div>
                  <div className="grid grid-cols-[180px_1fr] gap-2 items-start">
                    <span className="text-sm font-medium text-muted-foreground">Entry/Exit %:</span>
                    {(typeof recipe.algorithm_inputs?.tradeSize?.entryPercent === 'number' || typeof recipe.algorithm_inputs?.tradeSize?.exitPercent === 'number') && (
                      <span className="text-sm">{recipe.algorithm_inputs?.tradeSize?.entryPercent} / {recipe.algorithm_inputs?.tradeSize?.exitPercent}</span>
                    )}
                  </div>
                  <div className="grid grid-cols-[180px_1fr] gap-2 items-start">
                    <span className="text-sm font-medium text-muted-foreground">Entry/Exit Fixed:</span>
                    {(typeof recipe.algorithm_inputs?.tradeSize?.entryFixed === 'number' || typeof recipe.algorithm_inputs?.tradeSize?.exitFixed === 'number') && (
                      <span className="text-sm">{recipe.algorithm_inputs?.tradeSize?.entryFixed} / {recipe.algorithm_inputs?.tradeSize?.exitFixed}</span>
                    )}
                  </div>
                  {(recipe.algorithm_inputs?.dates?.start && recipe.algorithm_inputs?.dates?.end) && (
                    <div className="grid grid-cols-[180px_1fr] gap-2 items-start">
                      <span className="text-sm font-medium text-muted-foreground">Start/End:</span>
                      <span className="text-sm">{recipe.algorithm_inputs?.dates?.start?.year}-{recipe.algorithm_inputs?.dates?.start?.month}-{recipe.algorithm_inputs?.dates?.start?.day} → {recipe.algorithm_inputs?.dates?.end?.year}-{recipe.algorithm_inputs?.dates?.end?.month}-{recipe.algorithm_inputs?.dates?.end?.day}</span>
                    </div>
                  )}
                  {/* Properties subheader */}
                  {(recipe.algorithm_inputs?.properties?.initialCapital || recipe.algorithm_inputs?.properties?.orderSize || typeof recipe.algorithm_inputs?.properties?.pyramiding === 'number') && (
                    <div className="text-sm font-semibold mt-4">Properties</div>
                  )}
                  {typeof recipe.algorithm_inputs?.properties?.initialCapital === 'number' && (
                    <div className="grid grid-cols-[180px_1fr] gap-2 items-start">
                      <span className="text-sm font-medium text-muted-foreground">Initial Capital:</span>
                      <span className="text-sm">{recipe.algorithm_inputs?.properties?.initialCapital}</span>
                    </div>
                  )}
                  {recipe.algorithm_inputs?.properties?.orderSize && (
                    <div className="grid grid-cols-[180px_1fr] gap-2 items-start">
                      <span className="text-sm font-medium text-muted-foreground">Order Size:</span>
                      <span className="text-sm">{recipe.algorithm_inputs?.properties?.orderSize?.value} ({recipe.algorithm_inputs?.properties?.orderSize?.type})</span>
                    </div>
                  )}
                  {typeof recipe.algorithm_inputs?.properties?.pyramiding === 'number' && (
                    <div className="grid grid-cols-[180px_1fr] gap-2 items-start">
                      <span className="text-sm font-medium text-muted-foreground">Pyramiding:</span>
                      <span className="text-sm">{recipe.algorithm_inputs?.properties?.pyramiding}</span>
                    </div>
                  )}
                </>
              )}
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
              {scaledInitialCapital !== null && (
                <div className="p-4 rounded-lg bg-secondary/50 border border-border">
                  <p className="text-xs text-muted-foreground mb-1">Initial Capital</p>
                  <p className="text-lg font-semibold">${Math.round(scaledInitialCapital).toLocaleString()}</p>
                </div>
              )}
              
              {scaledCashProfit !== null && (
                <div className="p-4 rounded-lg bg-accent/10 border border-accent/20">
                  <p className="text-xs text-muted-foreground mb-1">Cash Profit</p>
                  <p className="text-lg font-semibold text-accent">${scaledCashProfit.toLocaleString()}</p>
                </div>
              )}
              
              {assetAccumulatedDisplay && (
                <div className="p-4 rounded-lg bg-secondary/50 border border-border">
                  <p className="text-xs text-muted-foreground mb-1">Asset Accumulated</p>
                  <p className="text-sm font-semibold">{assetAccumulatedDisplay}</p>
                </div>
              )}
              
              {netProfitDisplay && (
                <div className="p-4 rounded-lg bg-primary/10 border border-primary/20">
                  <p className="text-xs text-muted-foreground mb-1">Net Profit</p>
                  <p className="text-sm font-semibold text-primary">{netProfitDisplay}</p>
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

          {/* Best For section removed as requested */}
        </div>
      </DialogContent>
    </Dialog>
  );
};