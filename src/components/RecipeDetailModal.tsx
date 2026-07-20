import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious, type CarouselApi } from "@/components/ui/carousel";
import { TrendingUp, DollarSign, Clock, Target, ArrowUpDown, Calendar, Image as ImageIcon, Wallet, Coins, BarChart3, Scale, Link2 } from "lucide-react";
import { useState, useEffect } from "react";
import { scaleRecipeFreeText, scaleAlgorithmInputs } from "@/utils/recipeScaling";
import { usePortfolio } from "@/hooks/usePortfolio";
import { parseCurrencyFromString } from "@/lib/portfolio";
import { getRecipeShareUrl } from "@/lib/recipeShare";
import { useToast } from "@/hooks/use-toast";
import {
  formatSignedPercent,
  getBuyHoldPnlPercent,
  getDcaPnlPercent,
  getDisplayCagr,
  getPnlVsBuyHoldDelta,
  getPnlVsDcaDelta,
  getPortfolioValues,
  getStrategyPnlPercent,
  isMarketWaveAlgorithm,
  shouldShowBuyHoldBenchmark,
  shouldShowDcaBenchmark,
} from "@/utils/recipeMetrics";
import { Button } from "@/components/ui/button";
import { MetricTileGrid } from "@/components/MetricTileGrid";
import { isEquitiesOrEtfClass, isLegacyAlgorithm } from "@/lib/algorithms";

interface Recipe {
  id: string;
  name: string;
  asset: string;
  asset_class?: string;
  time_horizon: string;
  strategy_type: string;
  display_number?: number | null;
  algorithm?: string;
  algorithm_inputs?: any;
  buy_hold_pnl_percent?: number | null;
  dca_pnl_percent?: number | null;
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
  const [api, setApi] = useState<CarouselApi>();
  const { isInPortfolio, toggleRecipe } = usePortfolio();
  const { toast } = useToast();

  useEffect(() => {
    if (!api) {
      return;
    }

    const onSelect = () => {
      setCurrentSlide(api.selectedScrollSnap());
    };

    api.on("select", onSelect);
    onSelect();

    return () => {
      api.off("select", onSelect);
    };
  }, [api]);
  
  if (!recipe) return null;

  const scaledInitialCapital = (initialCapital ?? recipe.initial_capital) ?? null;
  // CAGR is invariant to display scale — compute from recipe base capital + unscaled profit
  const returnValue = getDisplayCagr(recipe);
  const scaleFactor = Number.isFinite(scale) ? scale : 1;
  const scaledEntryTrade = recipe.entry_trade ? (scaleRecipeFreeText(recipe.entry_trade, scaleFactor) as string) : '';
  const scaledExitTrade = recipe.exit_trade ? (scaleRecipeFreeText(recipe.exit_trade, scaleFactor) as string) : '';
  const scaledCashProfit = recipe.cash_profit !== null && recipe.cash_profit !== undefined
    ? Math.round((recipe.cash_profit as number) * scaleFactor)
    : null;

  // Scale algorithm inputs based on initial capital scaling
  const scaledAlgorithmInputs = recipe.algorithm_inputs
    ? scaleAlgorithmInputs(recipe.algorithm_inputs, scaleFactor, recipe.algorithm)
    : recipe.algorithm_inputs;

  // Parse from authored (unscaled) values, then multiply once — matches RecipeCard
  const parseAssetQuantity = (text?: string | null): number | null => {
    if (!text) return null;
    const qtyMatch = String(text).match(/\b([0-9]+(?:\.[0-9]+)?)\s*(?:[A-Z]{2,6})?\b/);
    if (!qtyMatch) return null;
    const qty = parseFloat(qtyMatch[1]);
    return Number.isFinite(qty) ? qty : null;
  };
  const assetQty = parseAssetQuantity(recipe.asset_accumulated);
  const scaledAssetQty = assetQty !== null ? +(assetQty * scaleFactor) : null;
  const netProfitNumber = parseCurrencyFromString(recipe.net_profit);
  const scaledNetProfitNumber = netProfitNumber !== null ? Math.round(netProfitNumber * scaleFactor) : null;

  const pnlPercent = getStrategyPnlPercent(recipe);
  const buyHoldPnlPercent = getBuyHoldPnlPercent(recipe);
  const dcaPnlPercent = getDcaPnlPercent(recipe);
  const pnlVsBuyHoldDelta = getPnlVsBuyHoldDelta(recipe);
  const pnlVsDcaDelta = getPnlVsDcaDelta(recipe);
  const portfolioValues = getPortfolioValues(recipe, scaleFactor, scaledInitialCapital);

  const handleCopyShareLink = async () => {
    if (typeof recipe.display_number !== "number") return;

    const url = getRecipeShareUrl(recipe.display_number);
    try {
      await navigator.clipboard.writeText(url);
      toast({
        title: "Link copied",
        description: "Recipe link copied to clipboard.",
      });
    } catch {
      toast({
        variant: "destructive",
        title: "Could not copy link",
        description: "Copy the URL from your browser address bar instead.",
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <div className="texture-overlay">
        <DialogHeader>
          <div className="flex items-start justify-between gap-3 pr-8">
            <DialogTitle className="text-2xl flex items-center gap-3">
              <span className="font-bold">{recipe.goal}</span>
              {typeof recipe.display_number === "number" && (
                <Badge className="text-base py-1 px-2">#{recipe.display_number}</Badge>
              )}
            </DialogTitle>
            {typeof recipe.display_number === "number" && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="shrink-0 gap-2"
                onClick={handleCopyShareLink}
              >
                <Link2 className="h-4 w-4" />
                Copy link
              </Button>
            )}
          </div>
          <DialogDescription className="flex flex-wrap gap-2 pt-2">
            <Badge variant="outline">{recipe.asset}</Badge>
            {recipe.asset_class && (
              <Badge variant="outline">{recipe.asset_class}</Badge>
            )}
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
                    className="w-full" 
                    opts={{
                      loop: true,
                      align: "start",
                    }}
                    setApi={setApi}
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
                            api?.scrollTo(index);
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
            <MetricTileGrid>
              {portfolioValues.beginning !== null && (
                <div className="flex items-center gap-2 p-2 rounded-lg bg-gray-100 border border-gray-200">
                  <Wallet className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">Beginning Portfolio</p>
                    <p className="text-sm font-semibold">${portfolioValues.beginning.toLocaleString()}</p>
                  </div>
                </div>
              )}

              {portfolioValues.ending !== null && (
                <div className="flex items-center gap-2 p-2 rounded-lg bg-gray-100 border border-gray-200">
                  <Wallet className="h-4 w-4 text-primary" />
                  <div>
                    <p className="text-xs text-muted-foreground">Ending Portfolio</p>
                    <p className="text-sm font-semibold">${portfolioValues.ending.toLocaleString()}</p>
                  </div>
                </div>
              )}

              {returnValue !== null && (
                <div className="flex items-center gap-2 p-2 rounded-lg bg-gray-100 border border-gray-200">
                  <BarChart3 className="h-4 w-4 text-primary" />
                  <div>
                    <p className="text-xs text-muted-foreground">CAGR</p>
                    <p className="text-sm font-semibold text-primary">{returnValue.toFixed(1)}%</p>
                  </div>
                </div>
              )}
              
              {scaledCashProfit !== null && (
                <div className="flex items-center gap-2 p-2 rounded-lg bg-gray-100 border border-gray-200">
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
                <div className="flex items-center gap-2 p-2 rounded-lg bg-gray-100 border border-gray-200">
                  <Coins className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">Asset Accumulated</p>
                    <p className="text-sm font-semibold">{scaledAssetQty.toLocaleString(undefined, { maximumFractionDigits: 3 })} {recipe.asset}</p>
                  </div>
                </div>
              )}

              {scaledNetProfitNumber !== null && (
                <div className="flex items-center gap-2 p-2 rounded-lg bg-gray-100 border border-gray-200">
                  <Wallet className="h-4 w-4 text-primary" />
                  <div>
                    <p className="text-xs text-muted-foreground">Net Profit</p>
                    <p className="text-sm font-semibold">${scaledNetProfitNumber.toLocaleString()}</p>
                  </div>
                </div>
              )}

              {pnlPercent !== null && (
                <div className="flex items-center gap-2 p-2 rounded-lg bg-gray-100 border border-gray-200">
                  <TrendingUp className={`h-4 w-4 ${pnlPercent >= 0 ? 'text-primary' : 'text-destructive'}`} />
                  <div>
                    <p className="text-xs text-muted-foreground">Strategy PnL %</p>
                    <p className={`text-sm font-semibold ${pnlPercent >= 0 ? 'text-primary' : 'text-destructive'}`}>
                      {formatSignedPercent(pnlPercent)}
                    </p>
                  </div>
                </div>
              )}

              {isMarketWaveAlgorithm(recipe) && shouldShowBuyHoldBenchmark(recipe) && buyHoldPnlPercent !== null && (
                <div className="flex items-center gap-2 p-2 rounded-lg bg-gray-100 border border-gray-200">
                  <BarChart3 className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">Buy &amp; Hold PnL %</p>
                    <p className="text-sm font-semibold">{formatSignedPercent(buyHoldPnlPercent)}</p>
                  </div>
                </div>
              )}

              {isMarketWaveAlgorithm(recipe) && shouldShowDcaBenchmark(recipe) && dcaPnlPercent !== null && (
                <div className="flex items-center gap-2 p-2 rounded-lg bg-gray-100 border border-gray-200">
                  <BarChart3 className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">DCA PnL %</p>
                    <p className="text-sm font-semibold">{formatSignedPercent(dcaPnlPercent)}</p>
                  </div>
                </div>
              )}

              {isMarketWaveAlgorithm(recipe) && pnlVsBuyHoldDelta !== null && (
                <div className="flex items-center gap-2 p-2 rounded-lg bg-gray-100 border border-gray-200">
                  <Scale className={`h-4 w-4 ${pnlVsBuyHoldDelta >= 0 ? 'text-primary' : 'text-destructive'}`} />
                  <div>
                    <p className="text-xs text-muted-foreground">vs Buy &amp; Hold</p>
                    <p className={`text-sm font-semibold ${pnlVsBuyHoldDelta >= 0 ? 'text-primary' : 'text-destructive'}`}>
                      {formatSignedPercent(pnlVsBuyHoldDelta)}
                    </p>
                  </div>
                </div>
              )}

              {isMarketWaveAlgorithm(recipe) && pnlVsDcaDelta !== null && (
                <div className="flex items-center gap-2 p-2 rounded-lg bg-gray-100 border border-gray-200">
                  <Scale className={`h-4 w-4 ${pnlVsDcaDelta >= 0 ? 'text-primary' : 'text-destructive'}`} />
                  <div>
                    <p className="text-xs text-muted-foreground">vs DCA</p>
                    <p className={`text-sm font-semibold ${pnlVsDcaDelta >= 0 ? 'text-primary' : 'text-destructive'}`}>
                      {formatSignedPercent(pnlVsDcaDelta)}
                    </p>
                  </div>
                </div>
              )}
            </MetricTileGrid>
          </div>

          {/* Add To Portfolio Button */}
          <div className="pt-2">
            <AddToPortfolioButton recipe={recipe} />
          </div>

          <Separator />

          {/* Parameters - Algorithm specific */}
          <div>
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Target className="h-5 w-5 text-primary" />
              Parameters
            </h3>
            <div className="grid gap-3">
              {recipe.time_frame && (
                <div className="grid grid-cols-[140px_1fr] gap-2 items-start">
                  <span className="text-sm font-medium text-muted-foreground">Chart Time Frame:</span>
                  <span className="text-sm">{recipe.time_frame}</span>
                </div>
              )}
              {recipe.algorithm && (
                <div className="grid grid-cols-[140px_1fr] gap-2 items-start">
                  <span className="text-sm font-medium text-muted-foreground">Algorithm:</span>
                  <span className="text-sm flex items-center gap-2 flex-wrap">
                    {recipe.algorithm}
                    {isLegacyAlgorithm(recipe.algorithm) && (
                      <Badge variant="outline" className="text-xs border-muted-foreground/40">Legacy</Badge>
                    )}
                  </span>
                </div>
              )}

              {/* Intelligence Algorithm */}
              {recipe.algorithm === 'Intelligence Algorithm' && (
                <>
                  <div className="text-sm font-semibold mt-2">Inputs</div>
                  <div className="grid grid-cols-[180px_1fr] gap-2 items-start">
                    <span className="text-sm font-medium text-muted-foreground">Repeat Purchase Method:</span>
                    {scaledAlgorithmInputs?.repeatPurchaseMethod && (
                      <span className="text-sm">{scaledAlgorithmInputs?.repeatPurchaseMethod}</span>
                    )}
                  </div>
                  {scaledAlgorithmInputs?.start && (
                    <div className="grid grid-cols-[180px_1fr] gap-2 items-start">
                      <span className="text-sm font-medium text-muted-foreground">Start Date/Time:</span>
                      <span className="text-sm">{scaledAlgorithmInputs?.start?.year}-{scaledAlgorithmInputs?.start?.month}-{scaledAlgorithmInputs?.start?.day}{(scaledAlgorithmInputs?.start?.hour ?? null) !== null ? ` ${scaledAlgorithmInputs?.start?.hour}:${String(scaledAlgorithmInputs?.start?.minute ?? 0).padStart(2,'0')}` : ''}</span>
                    </div>
                  )}
                  {scaledAlgorithmInputs?.end && (
                    <div className="grid grid-cols-[180px_1fr] gap-2 items-start">
                      <span className="text-sm font-medium text-muted-foreground">End Date:</span>
                      <span className="text-sm">{scaledAlgorithmInputs?.end?.year}-{scaledAlgorithmInputs?.end?.month}-{scaledAlgorithmInputs?.end?.day}</span>
                    </div>
                  )}
                  {typeof scaledAlgorithmInputs?.startBarsBack?.bars === 'number' && (
                    <div className="grid grid-cols-[180px_1fr] gap-2 items-start">
                      <span className="text-sm font-medium text-muted-foreground">Start X Bars Back:</span>
                      <span className="text-sm">{scaledAlgorithmInputs?.startBarsBack?.bars}</span>
                    </div>
                  )}
                  {scaledAlgorithmInputs?.backtest?.exitFullOnLastBar && (
                    <div className="grid grid-cols-[180px_1fr] gap-2 items-start">
                      <span className="text-sm font-medium text-muted-foreground">Exit Full on Last Bar:</span>
                      <span className="text-sm">Yes</span>
                    </div>
                  )}
                  {scaledAlgorithmInputs?.activate?.enabled && (
                    <div className="grid grid-cols-[180px_1fr] gap-2 items-start">
                      <span className="text-sm font-medium text-muted-foreground">Activate Intelligence:</span>
                      <span className="text-sm">Yes{typeof scaledAlgorithmInputs?.activate?.factor === 'number' ? ` (Factor ${scaledAlgorithmInputs?.activate?.factor})` : ''}</span>
                    </div>
                  )}
                  
                  {/* Properties Section */}
                  {scaledAlgorithmInputs?.properties && (
                    <>
                      <div className="text-sm font-semibold mt-4">Properties</div>
                      {typeof scaledAlgorithmInputs.properties.initialCapital === 'number' && (
                        <div className="grid grid-cols-[180px_1fr] gap-2 items-start">
                          <span className="text-sm font-medium text-muted-foreground">Initial Capital:</span>
                          <span className="text-sm">${scaledAlgorithmInputs.properties.initialCapital.toLocaleString()}</span>
                        </div>
                      )}
                      {scaledAlgorithmInputs.properties.orderSize && (
                        <div className="grid grid-cols-[180px_1fr] gap-2 items-start">
                          <span className="text-sm font-medium text-muted-foreground">Order Size:</span>
                          <span className="text-sm">{scaledAlgorithmInputs.properties.orderSize.value} ({scaledAlgorithmInputs.properties.orderSize.type})</span>
                        </div>
                      )}
                      {typeof scaledAlgorithmInputs.properties.pyramiding === 'number' && (
                        <div className="grid grid-cols-[180px_1fr] gap-2 items-start">
                          <span className="text-sm font-medium text-muted-foreground">Pyramiding:</span>
                          <span className="text-sm">{scaledAlgorithmInputs.properties.pyramiding}</span>
                        </div>
                      )}
                    </>
                  )}
                </>
              )}

              {/* Arbitrage Algorithm */}
              {recipe.algorithm === 'Arbitrage Algorithm' && (
                <>
                  <div className="text-sm font-semibold mt-2">Inputs</div>
                  {/* Thresholds */}
                  <div className="grid grid-cols-[180px_1fr] gap-2 items-start">
                    <span className="text-sm font-medium text-muted-foreground">Long Threshold (%):</span>
                    {typeof scaledAlgorithmInputs?.longThreshold?.percent === 'number' && (
                      <span className="text-sm">{scaledAlgorithmInputs?.longThreshold?.percent}</span>
                    )}
                  </div>
                  <div className="grid grid-cols-[180px_1fr] gap-2 items-start">
                    <span className="text-sm font-medium text-muted-foreground">Exit Threshold (%):</span>
                    {typeof scaledAlgorithmInputs?.exitThreshold?.percent === 'number' && (
                      <span className="text-sm">{scaledAlgorithmInputs?.exitThreshold?.percent}</span>
                    )}
                  </div>
                  {/* Cost Basis Section - subsection under Inputs */}
                  {scaledAlgorithmInputs?.costBasis?.onlySellAbove && (
                    <div className="grid grid-cols-[180px_1fr] gap-2 items-start">
                      <span className="text-sm font-medium text-muted-foreground">Only Sell Above Cost Basis:</span>
                      <span className="text-sm">Yes</span>
                    </div>
                  )}
                  {/* Trade Size */}
                  <div className="grid grid-cols-[180px_1fr] gap-2 items-start">
                    <span className="text-sm font-medium text-muted-foreground">Entry Trade Size ($):</span>
                    {typeof scaledAlgorithmInputs?.tradeSize?.entry === 'number' && (
                      <span className="text-sm">${scaledAlgorithmInputs?.tradeSize?.entry.toLocaleString()}</span>
                    )}
                  </div>
                  <div className="grid grid-cols-[180px_1fr] gap-2 items-start">
                    <span className="text-sm font-medium text-muted-foreground">Exit Trade Size ($):</span>
                    {typeof scaledAlgorithmInputs?.tradeSize?.exit === 'number' && (
                      <span className="text-sm">${scaledAlgorithmInputs?.tradeSize?.exit.toLocaleString()}</span>
                    )}
                  </div>
                  {/* Start/End Dates */}
                  {(scaledAlgorithmInputs?.dates?.start && scaledAlgorithmInputs?.dates?.end) && (
                    <div className="grid grid-cols-[180px_1fr] gap-2 items-start">
                      <span className="text-sm font-medium text-muted-foreground">Start/End:</span>
                      <span className="text-sm">{scaledAlgorithmInputs?.dates?.start?.year}-{scaledAlgorithmInputs?.dates?.start?.month}-{scaledAlgorithmInputs?.dates?.start?.day} → {scaledAlgorithmInputs?.dates?.end?.year}-{scaledAlgorithmInputs?.dates?.end?.month}-{scaledAlgorithmInputs?.dates?.end?.day}</span>
                    </div>
                  )}
                </>
              )}

              {/* Oracle Protocol */}
              {recipe.algorithm === 'Oracle Protocol' && (
                <>
                  <div className="text-sm font-semibold mt-2">Inputs</div>
                  {/* Thresholds */}
                  <div className="grid grid-cols-[180px_1fr] gap-2 items-start">
                    <span className="text-sm font-medium text-muted-foreground">Long Threshold (%):</span>
                    {typeof scaledAlgorithmInputs?.longThreshold?.percent === 'number' && (
                      <span className="text-sm">{scaledAlgorithmInputs?.longThreshold?.percent}</span>
                    )}
                  </div>
                  <div className="grid grid-cols-[180px_1fr] gap-2 items-start">
                    <span className="text-sm font-medium text-muted-foreground">Exit Threshold (%):</span>
                    {typeof scaledAlgorithmInputs?.exitThreshold?.percent === 'number' && (
                      <span className="text-sm">{scaledAlgorithmInputs?.exitThreshold?.percent}</span>
                    )}
                  </div>
                  {/* Cost Basis Section - subsection under Inputs */}
                  {scaledAlgorithmInputs?.costBasis?.onlySellAbove && (
                    <div className="grid grid-cols-[180px_1fr] gap-2 items-start">
                      <span className="text-sm font-medium text-muted-foreground">Only Sell Above Cost Basis:</span>
                      <span className="text-sm">Yes</span>
                    </div>
                  )}
                  {typeof scaledAlgorithmInputs?.costBasis?.sellProfitThreshold === 'number' && (
                    <div className="grid grid-cols-[180px_1fr] gap-2 items-start">
                      <span className="text-sm font-medium text-muted-foreground">Sell Profit Threshold (%):</span>
                      <span className="text-sm">{scaledAlgorithmInputs?.costBasis?.sellProfitThreshold}</span>
                    </div>
                  )}
                  {scaledAlgorithmInputs?.costBasis?.buyBelowOnly && (
                    <div className="grid grid-cols-[180px_1fr] gap-2 items-start">
                      <span className="text-sm font-medium text-muted-foreground">Buy Below Cost Basis Only:</span>
                      <span className="text-sm">Yes</span>
                    </div>
                  )}
                  {/* Trade Size */}
                  <div className="grid grid-cols-[180px_1fr] gap-2 items-start">
                    <span className="text-sm font-medium text-muted-foreground">Primary Trade Size Type:</span>
                    {scaledAlgorithmInputs?.tradeSize?.primaryType && (
                      <span className="text-sm">{scaledAlgorithmInputs?.tradeSize?.primaryType}</span>
                    )}
                  </div>
                  <div className="grid grid-cols-[180px_1fr] gap-2 items-start">
                    <span className="text-sm font-medium text-muted-foreground">Entry/Exit %:</span>
                    {(typeof scaledAlgorithmInputs?.tradeSize?.entryPercent === 'number' || typeof scaledAlgorithmInputs?.tradeSize?.exitPercent === 'number') && (
                      <span className="text-sm">{scaledAlgorithmInputs?.tradeSize?.entryPercent} / {scaledAlgorithmInputs?.tradeSize?.exitPercent}</span>
                    )}
                  </div>
                  {scaledAlgorithmInputs?.tradeSize?.useFixedAsMin && (
                    <div className="grid grid-cols-[180px_1fr] gap-2 items-start">
                      <span className="text-sm font-medium text-muted-foreground">Use Fixed Trade Size as Minimum Limit (Percentage):</span>
                      <span className="text-sm">Yes</span>
                    </div>
                  )}
                  <div className="grid grid-cols-[180px_1fr] gap-2 items-start">
                    <span className="text-sm font-medium text-muted-foreground">Entry/Exit Fixed:</span>
                    {(typeof scaledAlgorithmInputs?.tradeSize?.entryFixed === 'number' || typeof scaledAlgorithmInputs?.tradeSize?.exitFixed === 'number') && (
                      <span className="text-sm">${scaledAlgorithmInputs?.tradeSize?.entryFixed?.toLocaleString()} / ${scaledAlgorithmInputs?.tradeSize?.exitFixed?.toLocaleString()}</span>
                    )}
                  </div>
                  {/* Start/End Dates */}
                  {(scaledAlgorithmInputs?.dates?.start && scaledAlgorithmInputs?.dates?.end) && (
                    <div className="grid grid-cols-[180px_1fr] gap-2 items-start">
                      <span className="text-sm font-medium text-muted-foreground">Start/End:</span>
                      <span className="text-sm">{scaledAlgorithmInputs?.dates?.start?.year}-{scaledAlgorithmInputs?.dates?.start?.month}-{scaledAlgorithmInputs?.dates?.start?.day} → {scaledAlgorithmInputs?.dates?.end?.year}-{scaledAlgorithmInputs?.dates?.end?.month}-{scaledAlgorithmInputs?.dates?.end?.day}</span>
                    </div>
                  )}
                  {/* Properties subheader */}
                  {(scaledAlgorithmInputs?.properties?.initialCapital || scaledAlgorithmInputs?.properties?.orderSize || typeof scaledAlgorithmInputs?.properties?.pyramiding === 'number') && (
                    <div className="text-sm font-semibold mt-4">Properties</div>
                  )}
                  {typeof scaledAlgorithmInputs?.properties?.initialCapital === 'number' && (
                    <div className="grid grid-cols-[180px_1fr] gap-2 items-start">
                      <span className="text-sm font-medium text-muted-foreground">Initial Capital:</span>
                      <span className="text-sm">${scaledAlgorithmInputs?.properties?.initialCapital.toLocaleString()}</span>
                    </div>
                  )}
                  {scaledAlgorithmInputs?.properties?.orderSize && (
                    <div className="grid grid-cols-[180px_1fr] gap-2 items-start">
                      <span className="text-sm font-medium text-muted-foreground">Order Size:</span>
                      <span className="text-sm">{scaledAlgorithmInputs?.properties?.orderSize?.value} ({scaledAlgorithmInputs?.properties?.orderSize?.type})</span>
                    </div>
                  )}
                  {typeof scaledAlgorithmInputs?.properties?.pyramiding === 'number' && (
                    <div className="grid grid-cols-[180px_1fr] gap-2 items-start">
                      <span className="text-sm font-medium text-muted-foreground">Pyramiding:</span>
                      <span className="text-sm">{scaledAlgorithmInputs?.properties?.pyramiding}</span>
                    </div>
                  )}
                </>
              )}

              {/* Market Wave */}
              {recipe.algorithm === 'Market Wave' && (
                <>
                  {/* User Initial Capital */}
                  {(typeof scaledAlgorithmInputs?.userInitialCapital?.startingCash === 'number'
                    || typeof scaledAlgorithmInputs?.userInitialCapital?.startingCryptoQty === 'number'
                    || typeof scaledAlgorithmInputs?.userInitialCapital?.startingQty === 'number') && (
                    <div className="text-sm font-semibold mt-2">User Initial Capital</div>
                  )}
                  {typeof scaledAlgorithmInputs?.userInitialCapital?.startingCash === 'number' && (
                    <div className="grid grid-cols-[180px_1fr] gap-2 items-start">
                      <span className="text-sm font-medium text-muted-foreground">Starting Cash:</span>
                      <span className="text-sm">${scaledAlgorithmInputs?.userInitialCapital?.startingCash.toLocaleString()}</span>
                    </div>
                  )}
                  {typeof scaledAlgorithmInputs?.userInitialCapital?.startingCryptoQty === 'number' && (
                    <div className="grid grid-cols-[180px_1fr] gap-2 items-start">
                      <span className="text-sm font-medium text-muted-foreground">Starting Crypto Qty:</span>
                      <span className="text-sm">{scaledAlgorithmInputs?.userInitialCapital?.startingCryptoQty} {recipe.asset}</span>
                    </div>
                  )}
                  {typeof scaledAlgorithmInputs?.userInitialCapital?.startingQty === 'number' && (
                    <div className="grid grid-cols-[180px_1fr] gap-2 items-start">
                      <span className="text-sm font-medium text-muted-foreground">Starting Share Qty:</span>
                      <span className="text-sm">{scaledAlgorithmInputs?.userInitialCapital?.startingQty} {recipe.asset}</span>
                    </div>
                  )}

                  {/* Order Entry & Exit Rules */}
                  <div className="text-sm font-semibold mt-2">Order Entry &amp; Exit Rules</div>
                  {scaledAlgorithmInputs?.longThreshold?.enabled && (
                    <div className="grid grid-cols-[180px_1fr] gap-2 items-start">
                      <span className="text-sm font-medium text-muted-foreground">Long Threshold (%):</span>
                      <span className="text-sm">{typeof scaledAlgorithmInputs?.longThreshold?.percent === 'number' ? scaledAlgorithmInputs?.longThreshold?.percent : '—'}</span>
                    </div>
                  )}
                  {scaledAlgorithmInputs?.exitThreshold?.enabled && (
                    <div className="grid grid-cols-[180px_1fr] gap-2 items-start">
                      <span className="text-sm font-medium text-muted-foreground">Exit Threshold (%):</span>
                      <span className="text-sm">{typeof scaledAlgorithmInputs?.exitThreshold?.percent === 'number' ? scaledAlgorithmInputs?.exitThreshold?.percent : '—'}</span>
                    </div>
                  )}

                  {/* Trade Size */}
                  <div className="text-sm font-semibold mt-2">Trade Size</div>
                  {scaledAlgorithmInputs?.tradeSize?.sharesEnabled && (
                    <>
                      <div className="grid grid-cols-[180px_1fr] gap-2 items-start">
                        <span className="text-sm font-medium text-muted-foreground">Shares Trade Size:</span>
                        <span className="text-sm">Yes</span>
                      </div>
                      {typeof scaledAlgorithmInputs?.tradeSize?.entryShares === 'number' && (
                        <div className="grid grid-cols-[180px_1fr] gap-2 items-start">
                          <span className="text-sm font-medium text-muted-foreground">Entry Trade Size (shares):</span>
                          <span className="text-sm">{scaledAlgorithmInputs?.tradeSize?.entryShares}</span>
                        </div>
                      )}
                      {typeof scaledAlgorithmInputs?.tradeSize?.exitShares === 'number' && (
                        <div className="grid grid-cols-[180px_1fr] gap-2 items-start">
                          <span className="text-sm font-medium text-muted-foreground">Exit Trade Size (shares):</span>
                          <span className="text-sm">{scaledAlgorithmInputs?.tradeSize?.exitShares}</span>
                        </div>
                      )}
                    </>
                  )}
                  {scaledAlgorithmInputs?.tradeSize?.fixedEnabled && (
                    <>
                      <div className="grid grid-cols-[180px_1fr] gap-2 items-start">
                        <span className="text-sm font-medium text-muted-foreground">Fixed Trade Size:</span>
                        <span className="text-sm">Yes</span>
                      </div>
                      {typeof scaledAlgorithmInputs?.tradeSize?.entryFixed === 'number' && (
                        <div className="grid grid-cols-[180px_1fr] gap-2 items-start">
                          <span className="text-sm font-medium text-muted-foreground">Entry Trade Size ($):</span>
                          <span className="text-sm">${scaledAlgorithmInputs?.tradeSize?.entryFixed.toLocaleString()}</span>
                        </div>
                      )}
                      {typeof scaledAlgorithmInputs?.tradeSize?.exitFixed === 'number' && (
                        <div className="grid grid-cols-[180px_1fr] gap-2 items-start">
                          <span className="text-sm font-medium text-muted-foreground">Exit Trade Size ($):</span>
                          <span className="text-sm">${scaledAlgorithmInputs?.tradeSize?.exitFixed.toLocaleString()}</span>
                        </div>
                      )}
                    </>
                  )}
                  {scaledAlgorithmInputs?.tradeSize?.percentEnabled && (
                    <>
                      <div className="grid grid-cols-[180px_1fr] gap-2 items-start">
                        <span className="text-sm font-medium text-muted-foreground">Percentage Trade Size:</span>
                        <span className="text-sm">Yes</span>
                      </div>
                      {typeof scaledAlgorithmInputs?.tradeSize?.entryPercent === 'number' && (
                        <div className="grid grid-cols-[180px_1fr] gap-2 items-start">
                          <span className="text-sm font-medium text-muted-foreground">Entry Trade Size (%):</span>
                          <span className="text-sm">{scaledAlgorithmInputs?.tradeSize?.entryPercent}%</span>
                        </div>
                      )}
                      {typeof scaledAlgorithmInputs?.tradeSize?.exitPercent === 'number' && (
                        <div className="grid grid-cols-[180px_1fr] gap-2 items-start">
                          <span className="text-sm font-medium text-muted-foreground">Exit Trade Size (%):</span>
                          <span className="text-sm">{scaledAlgorithmInputs?.tradeSize?.exitPercent}%</span>
                        </div>
                      )}
                    </>
                  )}
                  {scaledAlgorithmInputs?.tradeSize?.roundDownWholeShares && (
                    <div className="grid grid-cols-[180px_1fr] gap-2 items-start">
                      <span className="text-sm font-medium text-muted-foreground">Round Down to Whole Shares:</span>
                      <span className="text-sm">Yes</span>
                    </div>
                  )}

                  {/* Market Wave */}
                  <div className="text-sm font-semibold mt-2">Market Wave</div>
                  {typeof scaledAlgorithmInputs?.marketWave?.scope === 'number' && (
                    <div className="grid grid-cols-[180px_1fr] gap-2 items-start">
                      <span className="text-sm font-medium text-muted-foreground">Scope:</span>
                      <span className="text-sm">
                        {scaledAlgorithmInputs?.marketWave?.scope}{' '}
                        ({isEquitiesOrEtfClass(recipe.asset_class) ? '0.5=micro, 20=macro' : '0.5=micro, 10=macro'})
                      </span>
                    </div>
                  )}
                  {scaledAlgorithmInputs?.marketWave?.onlySellAbove && (
                    <div className="grid grid-cols-[180px_1fr] gap-2 items-start">
                      <span className="text-sm font-medium text-muted-foreground">Only Sell Above:</span>
                      <span className="text-sm">Yes</span>
                    </div>
                  )}
                  {scaledAlgorithmInputs?.marketWave?.onlyBuyBelow && (
                    <div className="grid grid-cols-[180px_1fr] gap-2 items-start">
                      <span className="text-sm font-medium text-muted-foreground">Only Buy Below:</span>
                      <span className="text-sm">Yes</span>
                    </div>
                  )}
                  {typeof scaledAlgorithmInputs?.marketWave?.sellBuffer === 'number' && (
                    <div className="grid grid-cols-[180px_1fr] gap-2 items-start">
                      <span className="text-sm font-medium text-muted-foreground">Sell Buffer (%):</span>
                      <span className="text-sm">{scaledAlgorithmInputs?.marketWave?.sellBuffer}</span>
                    </div>
                  )}
                  {typeof scaledAlgorithmInputs?.marketWave?.buyBuffer === 'number' && (
                    <div className="grid grid-cols-[180px_1fr] gap-2 items-start">
                      <span className="text-sm font-medium text-muted-foreground">Buy Buffer (%):</span>
                      <span className="text-sm">{scaledAlgorithmInputs?.marketWave?.buyBuffer}</span>
                    </div>
                  )}

                  {/* Static Market Price Filter */}
                  {(scaledAlgorithmInputs?.staticPriceFilter?.sellAboveEnabled
                    || scaledAlgorithmInputs?.staticPriceFilter?.buyBelowEnabled) && (
                    <div className="text-sm font-semibold mt-2">Static Market Price Filter</div>
                  )}
                  {scaledAlgorithmInputs?.staticPriceFilter?.sellAboveEnabled && (
                    <div className="grid grid-cols-[180px_1fr] gap-2 items-start">
                      <span className="text-sm font-medium text-muted-foreground">Only Sell Above:</span>
                      <span className="text-sm">${typeof scaledAlgorithmInputs?.staticPriceFilter?.sellAbove === 'number' ? scaledAlgorithmInputs?.staticPriceFilter?.sellAbove.toLocaleString() : '—'}</span>
                    </div>
                  )}
                  {scaledAlgorithmInputs?.staticPriceFilter?.buyBelowEnabled && (
                    <div className="grid grid-cols-[180px_1fr] gap-2 items-start">
                      <span className="text-sm font-medium text-muted-foreground">Only Buy Below:</span>
                      <span className="text-sm">${typeof scaledAlgorithmInputs?.staticPriceFilter?.buyBelow === 'number' ? scaledAlgorithmInputs?.staticPriceFilter?.buyBelow.toLocaleString() : '—'}</span>
                    </div>
                  )}

                  {/* Trend Filter */}
                  {(scaledAlgorithmInputs?.trendFilter?.buyInDownTrend
                    || scaledAlgorithmInputs?.trendFilter?.buyInUpTrend
                    || scaledAlgorithmInputs?.trendFilter?.sellInDownTrend
                    || scaledAlgorithmInputs?.trendFilter?.sellInUpTrend
                    || scaledAlgorithmInputs?.trendFilter?.buyOnUpTrend
                    || scaledAlgorithmInputs?.trendFilter?.sellOnDownTrend) && (
                    <div className="text-sm font-semibold mt-2">Trend Filter</div>
                  )}
                  {scaledAlgorithmInputs?.trendFilter?.buyInDownTrend && (
                    <div className="grid grid-cols-[180px_1fr] gap-2 items-start">
                      <span className="text-sm font-medium text-muted-foreground">Buy in Down Trend:</span>
                      <span className="text-sm">Yes</span>
                    </div>
                  )}
                  {scaledAlgorithmInputs?.trendFilter?.buyInUpTrend && (
                    <div className="grid grid-cols-[180px_1fr] gap-2 items-start">
                      <span className="text-sm font-medium text-muted-foreground">Buy in Up Trend:</span>
                      <span className="text-sm">Yes</span>
                    </div>
                  )}
                  {scaledAlgorithmInputs?.trendFilter?.sellInDownTrend && (
                    <div className="grid grid-cols-[180px_1fr] gap-2 items-start">
                      <span className="text-sm font-medium text-muted-foreground">Sell in Down Trend:</span>
                      <span className="text-sm">Yes</span>
                    </div>
                  )}
                  {scaledAlgorithmInputs?.trendFilter?.sellInUpTrend && (
                    <div className="grid grid-cols-[180px_1fr] gap-2 items-start">
                      <span className="text-sm font-medium text-muted-foreground">Sell in Up Trend:</span>
                      <span className="text-sm">Yes</span>
                    </div>
                  )}
                  {scaledAlgorithmInputs?.trendFilter?.buyOnUpTrend && (
                    <div className="grid grid-cols-[180px_1fr] gap-2 items-start">
                      <span className="text-sm font-medium text-muted-foreground">Buy on Up Trend breakout:</span>
                      <span className="text-sm">Yes</span>
                    </div>
                  )}
                  {scaledAlgorithmInputs?.trendFilter?.sellOnDownTrend && (
                    <div className="grid grid-cols-[180px_1fr] gap-2 items-start">
                      <span className="text-sm font-medium text-muted-foreground">Sell on Down Trend breakout:</span>
                      <span className="text-sm">Yes</span>
                    </div>
                  )}

                  {/* Start/End Dates */}
                  {(scaledAlgorithmInputs?.dates?.start && scaledAlgorithmInputs?.dates?.end) && (
                    <div className="grid grid-cols-[180px_1fr] gap-2 items-start">
                      <span className="text-sm font-medium text-muted-foreground">Start/End:</span>
                      <span className="text-sm">{scaledAlgorithmInputs?.dates?.start?.year}-{scaledAlgorithmInputs?.dates?.start?.month}-{scaledAlgorithmInputs?.dates?.start?.day}{(scaledAlgorithmInputs?.dates?.start?.hour ?? null) !== null ? ` ${scaledAlgorithmInputs?.dates?.start?.hour}:${String(scaledAlgorithmInputs?.dates?.start?.minute ?? 0).padStart(2,'0')}` : ''} → {scaledAlgorithmInputs?.dates?.end?.year}-{scaledAlgorithmInputs?.dates?.end?.month}-{scaledAlgorithmInputs?.dates?.end?.day}</span>
                    </div>
                  )}

                  {/* Backtesting */}
                  {scaledAlgorithmInputs?.backtest?.exitFullOnLastBar && (
                    <div className="grid grid-cols-[180px_1fr] gap-2 items-start">
                      <span className="text-sm font-medium text-muted-foreground">Exit Full on Last Bar:</span>
                      <span className="text-sm">Yes</span>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

          

          {/* Best For section removed as requested */}
        </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

function AddToPortfolioButton({ recipe }: { recipe: Recipe }) {
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
      {added ? "Added" : "Add To Portfolio"}
    </Button>
  );
}