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
import { Link2 } from "lucide-react";
import { useState, useEffect } from "react";
import { scaleRecipeFreeText, scaleAlgorithmInputs } from "@/utils/recipeScaling";
import { usePortfolio } from "@/hooks/usePortfolio";
import { getRecipeShareUrl } from "@/lib/recipeShare";
import { useToast } from "@/hooks/use-toast";
import {
  type ProStrategy,
  displayCagr,
  basisLabel,
  displayTestEnd,
  formatMoney,
  formatPercent,
  formatSignedCurrency,
  formatSignedPercent,
  formatTestWindow,
  scaleFor,
  scaledResults,
  settingsForDisplay,
  showsBuyHold,
  showsDca,
  vsBuyHold,
  vsDca,
} from "@core";
import { toPortfolioSummary } from "@/data/proStrategies";
import { Button } from "@/components/ui/button";
import { MetricTileGrid } from "@/components/MetricTileGrid";
import { StatTile, deltaTone, signedTone } from "@/components/StatTile";
import { isEquitiesOrEtfClass, isLegacyAlgorithm } from "@/lib/algorithms";

type Recipe = ProStrategy;

interface RecipeDetailModalProps {
  recipe: Recipe | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Capital the visitor entered; figures scale from the strategy's own starting capital (D3). */
  initialCapital?: number;
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

export const RecipeDetailModal = ({ recipe, open, onOpenChange, initialCapital }: RecipeDetailModalProps) => {
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

  // Figures come from the published version; only dollars scale (D3).
  const returnValue = displayCagr(recipe);
  const scaleFactor = scaleFor(initialCapital, recipe);
  const scaled = scaledResults(recipe, initialCapital);
  const scaledEntryTrade = recipe.entry_trade ? (scaleRecipeFreeText(recipe.entry_trade, scaleFactor) as string) : '';
  const scaledExitTrade = recipe.exit_trade ? (scaleRecipeFreeText(recipe.exit_trade, scaleFactor) as string) : '';
  const scaledCashProfit = scaled.cashProfit !== null ? Math.round(scaled.cashProfit) : null;

  // Settings as a client sees them: the end date is the last bar on the chart,
  // never the far-future run year (D10). Dollar inputs scale to the capital.
  const scaledAlgorithmInputs = scaleAlgorithmInputs(
    settingsForDisplay(recipe.algorithm_inputs, recipe.algorithm, displayTestEnd(recipe)),
    scaleFactor,
    recipe.algorithm,
  );

  const scaledAssetQty = scaled.assetQty;
  const scaledNetProfitNumber = Math.round(scaled.netProfit);

  const pnlPercent = recipe.return_pct;
  const buyHoldPnlPercent = recipe.buy_hold_pnl_pct;
  const dcaPnlPercent = recipe.dca_pnl_pct;
  const pnlVsBuyHoldDelta = vsBuyHold(recipe);
  const pnlVsDcaDelta = vsDca(recipe);
  const portfolioValues = { beginning: Math.round(scaled.beginning), ending: Math.round(scaled.ending) };

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
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto bg-card p-8">
        <div>
        <DialogHeader>
          <div className="flex items-start justify-between gap-3 pr-8">
            <DialogTitle className="flex items-center gap-3 text-2xl font-extrabold tracking-[-0.02em] text-balance">
              <span>{recipe.title}</span>
              {typeof recipe.display_number === "number" && (
                <Badge variant="chip">#{recipe.display_number}</Badge>
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
            <Badge variant="chip">{recipe.asset}</Badge>
            {recipe.asset_class && (
              <Badge variant="outline">{recipe.asset_class}</Badge>
            )}
            <Badge className={getFocusPill(recipe.focus)}>{recipe.focus}</Badge>
            <Badge variant="outline" className="rounded-full">{recipe.time_horizon === 'STH' ? 'Short term' : 'Long term'}</Badge>
            <Badge variant="outline">{recipe.strategy_type}</Badge>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 pt-4">
          {/* Screenshots */}
          {recipe.screenshots && recipe.screenshots.length > 0 && (
            <>
              <div>
                <h3 className="eyebrow mb-4 text-primary">Screenshots</h3>
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
                              window.open(screenshot.url, '_blank');
                            }}
                          >
                            <img
                              src={screenshot.url}
                              alt={`${recipe.short_name} screenshot ${index + 1}`}
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
            <h3 className="eyebrow mb-1 text-primary">Results</h3>
            {/* Basis, test period and starting capital travel with every result (C1, C3, D10). */}
            <p className="mb-4 text-xs text-muted-foreground" data-field="test_window">
              {basisLabel(recipe)} · {formatTestWindow(recipe)} · {formatMoney(recipe.starting_capital)} starting capital
              {returnValue === null && displayTestEnd(recipe) && recipe.test_years < 1 && " · CAGR not shown for a test under one year"}
            </p>
            <MetricTileGrid>
              {portfolioValues.beginning !== null && (
                <StatTile label="Beginning portfolio" value={formatSignedCurrency(portfolioValues.beginning)} />
              )}

              {portfolioValues.ending !== null && (
                <StatTile label="Ending portfolio" value={formatSignedCurrency(portfolioValues.ending)} />
              )}

              {returnValue !== null && (
                <StatTile label="CAGR" value={formatPercent(returnValue)} />
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

              {(
                <StatTile
                  label="Net profit"
                  value={formatSignedCurrency(scaledNetProfitNumber)}
                  tone={signedTone(scaledNetProfitNumber)}
                />
              )}

              {pnlPercent !== null && (
                <StatTile
                  label="Strategy PnL"
                  value={formatSignedPercent(pnlPercent)}
                  tone={deltaTone(pnlPercent)}
                />
              )}

              {showsBuyHold(recipe) && buyHoldPnlPercent !== null && (
                <StatTile
                  label="Buy & Hold PnL"
                  value={formatSignedPercent(buyHoldPnlPercent)}
                  tone={deltaTone(buyHoldPnlPercent)}
                />
              )}

              {showsDca(recipe) && dcaPnlPercent !== null && (
                <StatTile
                  label="DCA PnL"
                  value={formatSignedPercent(dcaPnlPercent)}
                  tone={deltaTone(dcaPnlPercent)}
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
            </MetricTileGrid>
          </div>

          {/* Add to portfolio */}
          <div className="pt-2">
            <AddToPortfolioButton recipe={recipe} />
          </div>

          <Separator />

          {/* Parameters - Algorithm specific */}
          <div>
            <h3 className="eyebrow mb-4 text-primary">Parameters</h3>
            <div className="param-grid grid gap-3">
              {recipe.time_frame && (
                <div className="grid grid-cols-[200px_1fr] gap-2 items-start">
                  <span className="text-sm font-medium text-muted-foreground">Chart Time Frame:</span>
                  <span className="text-sm">{recipe.time_frame}</span>
                </div>
              )}
              {recipe.algorithm && (
                <div className="grid grid-cols-[200px_1fr] gap-2 items-start">
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
                  <div className="eyebrow mt-2 text-primary">Inputs</div>
                  <div className="grid grid-cols-[200px_1fr] gap-2 items-start">
                    <span className="text-sm font-medium text-muted-foreground">Repeat Purchase Method:</span>
                    {scaledAlgorithmInputs?.repeatPurchaseMethod && (
                      <span className="text-sm">{scaledAlgorithmInputs?.repeatPurchaseMethod}</span>
                    )}
                  </div>
                  {scaledAlgorithmInputs?.start && (
                    <div className="grid grid-cols-[200px_1fr] gap-2 items-start">
                      <span className="text-sm font-medium text-muted-foreground">Start Date/Time:</span>
                      <span className="text-sm">{scaledAlgorithmInputs?.start?.year}-{scaledAlgorithmInputs?.start?.month}-{scaledAlgorithmInputs?.start?.day}{(scaledAlgorithmInputs?.start?.hour ?? null) !== null ? ` ${scaledAlgorithmInputs?.start?.hour}:${String(scaledAlgorithmInputs?.start?.minute ?? 0).padStart(2,'0')}` : ''}</span>
                    </div>
                  )}
                  {scaledAlgorithmInputs?.end && (
                    <div className="grid grid-cols-[200px_1fr] gap-2 items-start">
                      <span className="text-sm font-medium text-muted-foreground">End Date:</span>
                      <span className="text-sm">{scaledAlgorithmInputs?.end?.year}-{scaledAlgorithmInputs?.end?.month}-{scaledAlgorithmInputs?.end?.day}</span>
                    </div>
                  )}
                  {typeof scaledAlgorithmInputs?.startBarsBack?.bars === 'number' && (
                    <div className="grid grid-cols-[200px_1fr] gap-2 items-start">
                      <span className="text-sm font-medium text-muted-foreground">Start X Bars Back:</span>
                      <span className="text-sm">{scaledAlgorithmInputs?.startBarsBack?.bars}</span>
                    </div>
                  )}
                  {scaledAlgorithmInputs?.backtest?.exitFullOnLastBar && (
                    <div className="grid grid-cols-[200px_1fr] gap-2 items-start">
                      <span className="text-sm font-medium text-muted-foreground">Exit Full on Last Bar:</span>
                      <span className="text-sm">Yes</span>
                    </div>
                  )}
                  {scaledAlgorithmInputs?.activate?.enabled && (
                    <div className="grid grid-cols-[200px_1fr] gap-2 items-start">
                      <span className="text-sm font-medium text-muted-foreground">Activate Intelligence:</span>
                      <span className="text-sm">Yes{typeof scaledAlgorithmInputs?.activate?.factor === 'number' ? ` (Factor ${scaledAlgorithmInputs?.activate?.factor})` : ''}</span>
                    </div>
                  )}
                  
                  {/* Properties Section */}
                  {scaledAlgorithmInputs?.properties && (
                    <>
                      <div className="eyebrow mt-4 text-primary">Properties</div>
                      {typeof scaledAlgorithmInputs.properties.initialCapital === 'number' && (
                        <div className="grid grid-cols-[200px_1fr] gap-2 items-start">
                          <span className="text-sm font-medium text-muted-foreground">Initial capital:</span>
                          <span className="text-sm">${scaledAlgorithmInputs.properties.initialCapital.toLocaleString()}</span>
                        </div>
                      )}
                      {scaledAlgorithmInputs.properties.orderSize && (
                        <div className="grid grid-cols-[200px_1fr] gap-2 items-start">
                          <span className="text-sm font-medium text-muted-foreground">Order Size:</span>
                          <span className="text-sm">{scaledAlgorithmInputs.properties.orderSize.value} ({scaledAlgorithmInputs.properties.orderSize.type})</span>
                        </div>
                      )}
                      {typeof scaledAlgorithmInputs.properties.pyramiding === 'number' && (
                        <div className="grid grid-cols-[200px_1fr] gap-2 items-start">
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
                  <div className="eyebrow mt-2 text-primary">Inputs</div>
                  {/* Thresholds */}
                  <div className="grid grid-cols-[200px_1fr] gap-2 items-start">
                    <span className="text-sm font-medium text-muted-foreground">Long Threshold:</span>
                    {typeof scaledAlgorithmInputs?.longThreshold?.percent === 'number' && (
                      <span className="text-sm">{formatPercent(scaledAlgorithmInputs.longThreshold.percent)}</span>
                    )}
                  </div>
                  <div className="grid grid-cols-[200px_1fr] gap-2 items-start">
                    <span className="text-sm font-medium text-muted-foreground">Exit Threshold:</span>
                    {typeof scaledAlgorithmInputs?.exitThreshold?.percent === 'number' && (
                      <span className="text-sm">{formatPercent(scaledAlgorithmInputs.exitThreshold.percent)}</span>
                    )}
                  </div>
                  {/* Cost Basis Section - subsection under Inputs */}
                  {scaledAlgorithmInputs?.costBasis?.onlySellAbove && (
                    <div className="grid grid-cols-[200px_1fr] gap-2 items-start">
                      <span className="text-sm font-medium text-muted-foreground">Only Sell Above Cost Basis:</span>
                      <span className="text-sm">Yes</span>
                    </div>
                  )}
                  {/* Trade Size */}
                  <div className="grid grid-cols-[200px_1fr] gap-2 items-start">
                    <span className="text-sm font-medium text-muted-foreground">Entry Trade Size ($):</span>
                    {typeof scaledAlgorithmInputs?.tradeSize?.entry === 'number' && (
                      <span className="text-sm">${scaledAlgorithmInputs?.tradeSize?.entry.toLocaleString()}</span>
                    )}
                  </div>
                  <div className="grid grid-cols-[200px_1fr] gap-2 items-start">
                    <span className="text-sm font-medium text-muted-foreground">Exit Trade Size ($):</span>
                    {typeof scaledAlgorithmInputs?.tradeSize?.exit === 'number' && (
                      <span className="text-sm">${scaledAlgorithmInputs?.tradeSize?.exit.toLocaleString()}</span>
                    )}
                  </div>
                  {/* Start/End Dates */}
                  {(scaledAlgorithmInputs?.dates?.start && scaledAlgorithmInputs?.dates?.end) && (
                    <div className="grid grid-cols-[200px_1fr] gap-2 items-start">
                      <span className="text-sm font-medium text-muted-foreground">Start/End:</span>
                      <span className="text-sm">{scaledAlgorithmInputs?.dates?.start?.year}-{scaledAlgorithmInputs?.dates?.start?.month}-{scaledAlgorithmInputs?.dates?.start?.day} → {scaledAlgorithmInputs?.dates?.end?.year}-{scaledAlgorithmInputs?.dates?.end?.month}-{scaledAlgorithmInputs?.dates?.end?.day}</span>
                    </div>
                  )}
                </>
              )}

              {/* Oracle Protocol */}
              {recipe.algorithm === 'Oracle Protocol' && (
                <>
                  <div className="eyebrow mt-2 text-primary">Inputs</div>
                  {/* Thresholds */}
                  <div className="grid grid-cols-[200px_1fr] gap-2 items-start">
                    <span className="text-sm font-medium text-muted-foreground">Long Threshold:</span>
                    {typeof scaledAlgorithmInputs?.longThreshold?.percent === 'number' && (
                      <span className="text-sm">{formatPercent(scaledAlgorithmInputs.longThreshold.percent)}</span>
                    )}
                  </div>
                  <div className="grid grid-cols-[200px_1fr] gap-2 items-start">
                    <span className="text-sm font-medium text-muted-foreground">Exit Threshold:</span>
                    {typeof scaledAlgorithmInputs?.exitThreshold?.percent === 'number' && (
                      <span className="text-sm">{formatPercent(scaledAlgorithmInputs.exitThreshold.percent)}</span>
                    )}
                  </div>
                  {/* Cost Basis Section - subsection under Inputs */}
                  {scaledAlgorithmInputs?.costBasis?.onlySellAbove && (
                    <div className="grid grid-cols-[200px_1fr] gap-2 items-start">
                      <span className="text-sm font-medium text-muted-foreground">Only Sell Above Cost Basis:</span>
                      <span className="text-sm">Yes</span>
                    </div>
                  )}
                  {typeof scaledAlgorithmInputs?.costBasis?.sellProfitThreshold === 'number' && (
                    <div className="grid grid-cols-[200px_1fr] gap-2 items-start">
                      <span className="text-sm font-medium text-muted-foreground">Sell Profit Threshold:</span>
                      <span className="text-sm">{formatPercent(scaledAlgorithmInputs.costBasis.sellProfitThreshold)}</span>
                    </div>
                  )}
                  {scaledAlgorithmInputs?.costBasis?.buyBelowOnly && (
                    <div className="grid grid-cols-[200px_1fr] gap-2 items-start">
                      <span className="text-sm font-medium text-muted-foreground">Buy Below Cost Basis Only:</span>
                      <span className="text-sm">Yes</span>
                    </div>
                  )}
                  {/* Trade Size */}
                  <div className="grid grid-cols-[200px_1fr] gap-2 items-start">
                    <span className="text-sm font-medium text-muted-foreground">Primary Trade Size Type:</span>
                    {scaledAlgorithmInputs?.tradeSize?.primaryType && (
                      <span className="text-sm">{scaledAlgorithmInputs?.tradeSize?.primaryType}</span>
                    )}
                  </div>
                  <div className="grid grid-cols-[200px_1fr] gap-2 items-start">
                    <span className="text-sm font-medium text-muted-foreground">Entry/Exit:</span>
                    {(typeof scaledAlgorithmInputs?.tradeSize?.entryPercent === 'number' || typeof scaledAlgorithmInputs?.tradeSize?.exitPercent === 'number') && (
                      <span className="text-sm">
                        {typeof scaledAlgorithmInputs?.tradeSize?.entryPercent === 'number' ? formatPercent(scaledAlgorithmInputs.tradeSize.entryPercent) : '—'}
                        {' / '}
                        {typeof scaledAlgorithmInputs?.tradeSize?.exitPercent === 'number' ? formatPercent(scaledAlgorithmInputs.tradeSize.exitPercent) : '—'}
                      </span>
                    )}
                  </div>
                  {scaledAlgorithmInputs?.tradeSize?.useFixedAsMin && (
                    <div className="grid grid-cols-[200px_1fr] gap-2 items-start">
                      <span className="text-sm font-medium text-muted-foreground">Use Fixed Trade Size as Minimum Limit (Percentage):</span>
                      <span className="text-sm">Yes</span>
                    </div>
                  )}
                  <div className="grid grid-cols-[200px_1fr] gap-2 items-start">
                    <span className="text-sm font-medium text-muted-foreground">Entry/Exit Fixed:</span>
                    {(typeof scaledAlgorithmInputs?.tradeSize?.entryFixed === 'number' || typeof scaledAlgorithmInputs?.tradeSize?.exitFixed === 'number') && (
                      <span className="text-sm">${scaledAlgorithmInputs?.tradeSize?.entryFixed?.toLocaleString()} / ${scaledAlgorithmInputs?.tradeSize?.exitFixed?.toLocaleString()}</span>
                    )}
                  </div>
                  {/* Start/End Dates */}
                  {(scaledAlgorithmInputs?.dates?.start && scaledAlgorithmInputs?.dates?.end) && (
                    <div className="grid grid-cols-[200px_1fr] gap-2 items-start">
                      <span className="text-sm font-medium text-muted-foreground">Start/End:</span>
                      <span className="text-sm">{scaledAlgorithmInputs?.dates?.start?.year}-{scaledAlgorithmInputs?.dates?.start?.month}-{scaledAlgorithmInputs?.dates?.start?.day} → {scaledAlgorithmInputs?.dates?.end?.year}-{scaledAlgorithmInputs?.dates?.end?.month}-{scaledAlgorithmInputs?.dates?.end?.day}</span>
                    </div>
                  )}
                  {/* Properties subheader */}
                  {(scaledAlgorithmInputs?.properties?.initialCapital || scaledAlgorithmInputs?.properties?.orderSize || typeof scaledAlgorithmInputs?.properties?.pyramiding === 'number') && (
                    <div className="eyebrow mt-4 text-primary">Properties</div>
                  )}
                  {typeof scaledAlgorithmInputs?.properties?.initialCapital === 'number' && (
                    <div className="grid grid-cols-[200px_1fr] gap-2 items-start">
                      <span className="text-sm font-medium text-muted-foreground">Initial capital:</span>
                      <span className="text-sm">${scaledAlgorithmInputs?.properties?.initialCapital.toLocaleString()}</span>
                    </div>
                  )}
                  {scaledAlgorithmInputs?.properties?.orderSize && (
                    <div className="grid grid-cols-[200px_1fr] gap-2 items-start">
                      <span className="text-sm font-medium text-muted-foreground">Order Size:</span>
                      <span className="text-sm">{scaledAlgorithmInputs?.properties?.orderSize?.value} ({scaledAlgorithmInputs?.properties?.orderSize?.type})</span>
                    </div>
                  )}
                  {typeof scaledAlgorithmInputs?.properties?.pyramiding === 'number' && (
                    <div className="grid grid-cols-[200px_1fr] gap-2 items-start">
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
                    <div className="eyebrow mt-2 text-primary">User initial capital</div>
                  )}
                  {typeof scaledAlgorithmInputs?.userInitialCapital?.startingCash === 'number' && (
                    <div className="grid grid-cols-[200px_1fr] gap-2 items-start">
                      <span className="text-sm font-medium text-muted-foreground">Starting Cash:</span>
                      <span className="text-sm">${scaledAlgorithmInputs?.userInitialCapital?.startingCash.toLocaleString()}</span>
                    </div>
                  )}
                  {typeof scaledAlgorithmInputs?.userInitialCapital?.startingCryptoQty === 'number' && (
                    <div className="grid grid-cols-[200px_1fr] gap-2 items-start">
                      <span className="text-sm font-medium text-muted-foreground">Starting Crypto Qty:</span>
                      <span className="text-sm">{scaledAlgorithmInputs?.userInitialCapital?.startingCryptoQty} {recipe.asset}</span>
                    </div>
                  )}
                  {typeof scaledAlgorithmInputs?.userInitialCapital?.startingQty === 'number' && (
                    <div className="grid grid-cols-[200px_1fr] gap-2 items-start">
                      <span className="text-sm font-medium text-muted-foreground">Starting Share Qty:</span>
                      <span className="text-sm">{scaledAlgorithmInputs?.userInitialCapital?.startingQty} {recipe.asset}</span>
                    </div>
                  )}

                  {/* Order Entry & Exit Rules */}
                  <div className="eyebrow mt-2 text-primary">Order entry &amp; exit rules</div>
                  {scaledAlgorithmInputs?.longThreshold?.enabled && (
                    <div className="grid grid-cols-[200px_1fr] gap-2 items-start">
                      <span className="text-sm font-medium text-muted-foreground">Long Threshold:</span>
                      <span className="text-sm">{typeof scaledAlgorithmInputs?.longThreshold?.percent === 'number' ? formatPercent(scaledAlgorithmInputs.longThreshold.percent) : '—'}</span>
                    </div>
                  )}
                  {scaledAlgorithmInputs?.exitThreshold?.enabled && (
                    <div className="grid grid-cols-[200px_1fr] gap-2 items-start">
                      <span className="text-sm font-medium text-muted-foreground">Exit Threshold:</span>
                      <span className="text-sm">{typeof scaledAlgorithmInputs?.exitThreshold?.percent === 'number' ? formatPercent(scaledAlgorithmInputs.exitThreshold.percent) : '—'}</span>
                    </div>
                  )}

                  {/* Trade Size */}
                  <div className="eyebrow mt-2 text-primary">Trade size</div>
                  {scaledAlgorithmInputs?.tradeSize?.sharesEnabled && (
                    <>
                      <div className="grid grid-cols-[200px_1fr] gap-2 items-start">
                        <span className="text-sm font-medium text-muted-foreground">Shares Trade Size:</span>
                        <span className="text-sm">Yes</span>
                      </div>
                      {typeof scaledAlgorithmInputs?.tradeSize?.entryShares === 'number' && (
                        <div className="grid grid-cols-[200px_1fr] gap-2 items-start">
                          <span className="text-sm font-medium text-muted-foreground">Entry Trade Size (shares):</span>
                          <span className="text-sm">{scaledAlgorithmInputs?.tradeSize?.entryShares}</span>
                        </div>
                      )}
                      {typeof scaledAlgorithmInputs?.tradeSize?.exitShares === 'number' && (
                        <div className="grid grid-cols-[200px_1fr] gap-2 items-start">
                          <span className="text-sm font-medium text-muted-foreground">Exit Trade Size (shares):</span>
                          <span className="text-sm">{scaledAlgorithmInputs?.tradeSize?.exitShares}</span>
                        </div>
                      )}
                    </>
                  )}
                  {scaledAlgorithmInputs?.tradeSize?.fixedEnabled && (
                    <>
                      <div className="grid grid-cols-[200px_1fr] gap-2 items-start">
                        <span className="text-sm font-medium text-muted-foreground">Fixed Trade Size:</span>
                        <span className="text-sm">Yes</span>
                      </div>
                      {typeof scaledAlgorithmInputs?.tradeSize?.entryFixed === 'number' && (
                        <div className="grid grid-cols-[200px_1fr] gap-2 items-start">
                          <span className="text-sm font-medium text-muted-foreground">Entry Trade Size ($):</span>
                          <span className="text-sm">${scaledAlgorithmInputs?.tradeSize?.entryFixed.toLocaleString()}</span>
                        </div>
                      )}
                      {typeof scaledAlgorithmInputs?.tradeSize?.exitFixed === 'number' && (
                        <div className="grid grid-cols-[200px_1fr] gap-2 items-start">
                          <span className="text-sm font-medium text-muted-foreground">Exit Trade Size ($):</span>
                          <span className="text-sm">${scaledAlgorithmInputs?.tradeSize?.exitFixed.toLocaleString()}</span>
                        </div>
                      )}
                    </>
                  )}
                  {scaledAlgorithmInputs?.tradeSize?.percentEnabled && (
                    <>
                      <div className="grid grid-cols-[200px_1fr] gap-2 items-start">
                        <span className="text-sm font-medium text-muted-foreground">Percentage Trade Size:</span>
                        <span className="text-sm">Yes</span>
                      </div>
                      {typeof scaledAlgorithmInputs?.tradeSize?.entryPercent === 'number' && (
                        <div className="grid grid-cols-[200px_1fr] gap-2 items-start">
                          <span className="text-sm font-medium text-muted-foreground">Entry Trade Size:</span>
                          <span className="text-sm">{formatPercent(scaledAlgorithmInputs.tradeSize.entryPercent)}</span>
                        </div>
                      )}
                      {typeof scaledAlgorithmInputs?.tradeSize?.exitPercent === 'number' && (
                        <div className="grid grid-cols-[200px_1fr] gap-2 items-start">
                          <span className="text-sm font-medium text-muted-foreground">Exit Trade Size:</span>
                          <span className="text-sm">{formatPercent(scaledAlgorithmInputs.tradeSize.exitPercent)}</span>
                        </div>
                      )}
                    </>
                  )}
                  {scaledAlgorithmInputs?.tradeSize?.roundDownWholeShares && (
                    <div className="grid grid-cols-[200px_1fr] gap-2 items-start">
                      <span className="text-sm font-medium text-muted-foreground">Round Down to Whole Shares:</span>
                      <span className="text-sm">Yes</span>
                    </div>
                  )}

                  {/* Market Wave */}
                  <div className="eyebrow mt-2 text-primary">Market Wave</div>
                  {typeof scaledAlgorithmInputs?.marketWave?.scope === 'number' && (
                    <div className="grid grid-cols-[200px_1fr] gap-2 items-start">
                      <span className="text-sm font-medium text-muted-foreground">Scope:</span>
                      <span className="text-sm">
                        {scaledAlgorithmInputs?.marketWave?.scope}{' '}
                        ({isEquitiesOrEtfClass(recipe.asset_class) ? '0.5=micro, 20=macro' : '0.5=micro, 10=macro'})
                      </span>
                    </div>
                  )}
                  {scaledAlgorithmInputs?.marketWave?.onlySellAbove && (
                    <div className="grid grid-cols-[200px_1fr] gap-2 items-start">
                      <span className="text-sm font-medium text-muted-foreground">Only Sell Above:</span>
                      <span className="text-sm">Yes</span>
                    </div>
                  )}
                  {scaledAlgorithmInputs?.marketWave?.onlyBuyBelow && (
                    <div className="grid grid-cols-[200px_1fr] gap-2 items-start">
                      <span className="text-sm font-medium text-muted-foreground">Only Buy Below:</span>
                      <span className="text-sm">Yes</span>
                    </div>
                  )}
                  {typeof scaledAlgorithmInputs?.marketWave?.sellBuffer === 'number' && (
                    <div className="grid grid-cols-[200px_1fr] gap-2 items-start">
                      <span className="text-sm font-medium text-muted-foreground">Sell Buffer:</span>
                      <span className="text-sm">{formatPercent(scaledAlgorithmInputs.marketWave.sellBuffer)}</span>
                    </div>
                  )}
                  {typeof scaledAlgorithmInputs?.marketWave?.buyBuffer === 'number' && (
                    <div className="grid grid-cols-[200px_1fr] gap-2 items-start">
                      <span className="text-sm font-medium text-muted-foreground">Buy Buffer:</span>
                      <span className="text-sm">{formatPercent(scaledAlgorithmInputs.marketWave.buyBuffer)}</span>
                    </div>
                  )}

                  {/* Static Market Price Filter */}
                  {(scaledAlgorithmInputs?.staticPriceFilter?.sellAboveEnabled
                    || scaledAlgorithmInputs?.staticPriceFilter?.buyBelowEnabled) && (
                    <div className="eyebrow mt-2 text-primary">Static market price filter</div>
                  )}
                  {scaledAlgorithmInputs?.staticPriceFilter?.sellAboveEnabled && (
                    <div className="grid grid-cols-[200px_1fr] gap-2 items-start">
                      <span className="text-sm font-medium text-muted-foreground">Only Sell Above:</span>
                      <span className="text-sm">${typeof scaledAlgorithmInputs?.staticPriceFilter?.sellAbove === 'number' ? scaledAlgorithmInputs?.staticPriceFilter?.sellAbove.toLocaleString() : '—'}</span>
                    </div>
                  )}
                  {scaledAlgorithmInputs?.staticPriceFilter?.buyBelowEnabled && (
                    <div className="grid grid-cols-[200px_1fr] gap-2 items-start">
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
                    <div className="eyebrow mt-2 text-primary">Trend filter</div>
                  )}
                  {scaledAlgorithmInputs?.trendFilter?.buyInDownTrend && (
                    <div className="grid grid-cols-[200px_1fr] gap-2 items-start">
                      <span className="text-sm font-medium text-muted-foreground">Buy in Down Trend:</span>
                      <span className="text-sm">Yes</span>
                    </div>
                  )}
                  {scaledAlgorithmInputs?.trendFilter?.buyInUpTrend && (
                    <div className="grid grid-cols-[200px_1fr] gap-2 items-start">
                      <span className="text-sm font-medium text-muted-foreground">Buy in Up Trend:</span>
                      <span className="text-sm">Yes</span>
                    </div>
                  )}
                  {scaledAlgorithmInputs?.trendFilter?.sellInDownTrend && (
                    <div className="grid grid-cols-[200px_1fr] gap-2 items-start">
                      <span className="text-sm font-medium text-muted-foreground">Sell in Down Trend:</span>
                      <span className="text-sm">Yes</span>
                    </div>
                  )}
                  {scaledAlgorithmInputs?.trendFilter?.sellInUpTrend && (
                    <div className="grid grid-cols-[200px_1fr] gap-2 items-start">
                      <span className="text-sm font-medium text-muted-foreground">Sell in Up Trend:</span>
                      <span className="text-sm">Yes</span>
                    </div>
                  )}
                  {scaledAlgorithmInputs?.trendFilter?.buyOnUpTrend && (
                    <div className="grid grid-cols-[200px_1fr] gap-2 items-start">
                      <span className="text-sm font-medium text-muted-foreground">Buy on Up Trend breakout:</span>
                      <span className="text-sm">Yes</span>
                    </div>
                  )}
                  {scaledAlgorithmInputs?.trendFilter?.sellOnDownTrend && (
                    <div className="grid grid-cols-[200px_1fr] gap-2 items-start">
                      <span className="text-sm font-medium text-muted-foreground">Sell on Down Trend breakout:</span>
                      <span className="text-sm">Yes</span>
                    </div>
                  )}

                  {/* Start/End Dates */}
                  {(scaledAlgorithmInputs?.dates?.start && scaledAlgorithmInputs?.dates?.end) && (
                    <div className="grid grid-cols-[200px_1fr] gap-2 items-start">
                      <span className="text-sm font-medium text-muted-foreground">Start/End:</span>
                      <span className="text-sm">{scaledAlgorithmInputs?.dates?.start?.year}-{scaledAlgorithmInputs?.dates?.start?.month}-{scaledAlgorithmInputs?.dates?.start?.day}{(scaledAlgorithmInputs?.dates?.start?.hour ?? null) !== null ? ` ${scaledAlgorithmInputs?.dates?.start?.hour}:${String(scaledAlgorithmInputs?.dates?.start?.minute ?? 0).padStart(2,'0')}` : ''} → {scaledAlgorithmInputs?.dates?.end?.year}-{scaledAlgorithmInputs?.dates?.end?.month}-{scaledAlgorithmInputs?.dates?.end?.day}</span>
                    </div>
                  )}

                  {/* Backtesting */}
                  {scaledAlgorithmInputs?.backtest?.exitFullOnLastBar && (
                    <div className="grid grid-cols-[200px_1fr] gap-2 items-start">
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