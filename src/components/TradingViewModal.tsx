import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { usePortfolio } from "@/hooks/usePortfolio";
import { scaleAlgorithmInputs } from "@/utils/recipeScaling";
import { computeScaledMetricsForRecipe, DEFAULT_BASE_CAPITAL } from "@/lib/portfolio";

interface TradingViewModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function TradingViewModal({ open, onOpenChange }: TradingViewModalProps) {
  const { positions, initialCapital, recipes, rows } = usePortfolio();

  const portfolioEntries = Object.values(positions).map(pos => {
    const recipe = recipes[pos.recipeId];
    if (!recipe) return null;
    
    const row = rows.find(r => r.recipeId === pos.recipeId);
    const baseCapital = recipe.baseInitialCapital ?? DEFAULT_BASE_CAPITAL;
    const capitalAllocated = row?.capitalAllocated ?? 0;
    const scaleFactor = baseCapital > 0 ? capitalAllocated / baseCapital : 1;
    
    const scaledInputs = recipe.algorithm_inputs 
      ? scaleAlgorithmInputs(recipe.algorithm_inputs, scaleFactor)
      : null;

    return {
      recipe,
      position: pos,
      scaledInputs,
      capitalAllocated,
    };
  }).filter((entry): entry is NonNullable<typeof portfolioEntries[0]> => entry !== null);

  const formatDate = (dateObj: any): string => {
    if (!dateObj || !dateObj.year || !dateObj.month || !dateObj.day) return '';
    const hour = dateObj.hour !== null && dateObj.hour !== undefined ? ` ${dateObj.hour}:${String(dateObj.minute ?? 0).padStart(2, '0')}` : '';
    return `${dateObj.year}-${dateObj.month}-${dateObj.day}${hour}`;
  };

  const formatRecipeParams = (recipe: any, scaledInputs: any, capitalAllocated: number): string => {
    const lines: string[] = [];
    if (typeof recipe.display_number === 'number') {
      lines.push(`Recipe Number: #${recipe.display_number}`);
    }
    lines.push(`Recipe Name: ${recipe.title}`);
    lines.push(`Algorithm: ${recipe.algorithm || 'N/A'}`);
    lines.push(`Capital Allocated: $${Math.round(capitalAllocated).toLocaleString()}`);
    lines.push('');

    if (!scaledInputs) {
      lines.push('No algorithm inputs available.');
      return lines.join('\n');
    }

    if (recipe.algorithm === 'Intelligence Algorithm') {
      lines.push('Intelligence Algorithm Parameters:');
      if (scaledInputs.repeatPurchaseMethod) {
        lines.push(`  Repeat Purchase Method: ${scaledInputs.repeatPurchaseMethod}`);
      }
      if (scaledInputs.start) {
        lines.push(`  Start Date/Time: ${formatDate(scaledInputs.start)}`);
      }
      if (scaledInputs.end) {
        lines.push(`  End Date: ${formatDate(scaledInputs.end)}`);
      }
      if (typeof scaledInputs.startBarsBack?.bars === 'number') {
        lines.push(`  Start X Bars Back: ${scaledInputs.startBarsBack.bars}`);
      }
      if (scaledInputs.backtest?.exitFullOnLastBar) {
        lines.push(`  Exit Full on Last Bar: Yes`);
      }
      if (scaledInputs.activate?.enabled) {
        const factor = typeof scaledInputs.activate.factor === 'number' ? ` (Factor ${scaledInputs.activate.factor})` : '';
        lines.push(`  Activate Intelligence: Yes${factor}`);
      }
    } else if (recipe.algorithm === 'Arbitrage Algorithm') {
      lines.push('Arbitrage Algorithm Parameters:');
      if (typeof scaledInputs.longThreshold?.percent === 'number') {
        lines.push(`  Long Threshold: ${scaledInputs.longThreshold.percent}%`);
      }
      if (typeof scaledInputs.exitThreshold?.percent === 'number') {
        lines.push(`  Exit Threshold: ${scaledInputs.exitThreshold.percent}%`);
      }
      if (typeof scaledInputs.tradeSize?.entry === 'number') {
        lines.push(`  Entry Trade Size: $${scaledInputs.tradeSize.entry.toLocaleString()}`);
      }
      if (typeof scaledInputs.tradeSize?.exit === 'number') {
        lines.push(`  Exit Trade Size: $${scaledInputs.tradeSize.exit.toLocaleString()}`);
      }
      if (scaledInputs.dates?.start && scaledInputs.dates?.end) {
        lines.push(`  Start Date: ${formatDate(scaledInputs.dates.start)}`);
        lines.push(`  End Date: ${formatDate(scaledInputs.dates.end)}`);
      }
    } else if (recipe.algorithm === 'Oracle Protocol') {
      lines.push('Oracle Protocol Parameters:');
      if (typeof scaledInputs.longThreshold?.percent === 'number') {
        lines.push(`  Long Threshold: ${scaledInputs.longThreshold.percent}%`);
      }
      if (typeof scaledInputs.exitThreshold?.percent === 'number') {
        lines.push(`  Exit Threshold: ${scaledInputs.exitThreshold.percent}%`);
      }
      if (scaledInputs.tradeSize?.primaryType) {
        lines.push(`  Primary Trade Size Type: ${scaledInputs.tradeSize.primaryType}`);
      }
      if (typeof scaledInputs.tradeSize?.entryPercent === 'number') {
        lines.push(`  Entry Trade Size (%): ${scaledInputs.tradeSize.entryPercent}%`);
      }
      if (typeof scaledInputs.tradeSize?.exitPercent === 'number') {
        lines.push(`  Exit Trade Size (%): ${scaledInputs.tradeSize.exitPercent}%`);
      }
      if (typeof scaledInputs.tradeSize?.entryFixed === 'number') {
        lines.push(`  Entry Trade Size ($): $${scaledInputs.tradeSize.entryFixed.toLocaleString()}`);
      }
      if (typeof scaledInputs.tradeSize?.exitFixed === 'number') {
        lines.push(`  Exit Trade Size ($): $${scaledInputs.tradeSize.exitFixed.toLocaleString()}`);
      }
      if (scaledInputs.dates?.start && scaledInputs.dates?.end) {
        lines.push(`  Start Date: ${formatDate(scaledInputs.dates.start)}`);
        lines.push(`  End Date: ${formatDate(scaledInputs.dates.end)}`);
      }
      if (scaledInputs.properties) {
        lines.push('');
        lines.push('Properties:');
        if (typeof scaledInputs.properties.initialCapital === 'number') {
          lines.push(`  Initial Capital: $${scaledInputs.properties.initialCapital.toLocaleString()}`);
        }
        if (scaledInputs.properties.orderSize) {
          lines.push(`  Order Size: ${scaledInputs.properties.orderSize.value} (${scaledInputs.properties.orderSize.type})`);
        }
        if (typeof scaledInputs.properties.pyramiding === 'number') {
          lines.push(`  Pyramiding: ${scaledInputs.properties.pyramiding}`);
        }
      }
    }

    return lines.join('\n');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Copy To TradingView</DialogTitle>
          <DialogDescription className="space-y-2">
            <div>
              Algorithm parameters and scaled input values for each recipe in your portfolio.
              Use these values to manually configure your TradingView strategies.
            </div>
            <div className="font-semibold text-foreground mt-3">
              IMPORTANT
            </div>
            <div>
              Remember to set the start date to today's date, change the end year to some point in the future (we recommend 5+ years)
            </div>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 pt-4">
          {portfolioEntries.length === 0 ? (
            <div className="text-sm text-muted-foreground text-center py-8">
              No recipes in portfolio. Add recipes to see their TradingView parameters.
            </div>
          ) : (
            portfolioEntries.map((entry, index) => {
              const { recipe, scaledInputs, capitalAllocated } = entry;
              const paramsText = formatRecipeParams(recipe, scaledInputs, capitalAllocated);

              return (
                <div key={recipe.recipeId} className="space-y-3">
                  <div className="flex items-start gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        {typeof recipe.display_number === 'number' && (
                          <Badge variant="default" className="text-base font-bold px-3 py-1">#{recipe.display_number}</Badge>
                        )}
                        <h3 className="text-lg font-semibold">Recipe Name: {recipe.title}</h3>
                        <Badge variant="outline">{recipe.assetSymbol}</Badge>
                        {recipe.algorithm && (
                          <Badge variant="secondary">{recipe.algorithm}</Badge>
                        )}
                      </div>
                      <div className="text-sm text-muted-foreground mb-3">
                        Capital Allocated: ${Math.round(capitalAllocated).toLocaleString()}
                      </div>
                    </div>
                  </div>

                  <div className="rounded-md border bg-muted/30 p-4">
                    <pre className="text-sm whitespace-pre-wrap font-mono">
                      {paramsText}
                    </pre>
                  </div>

                  {index < portfolioEntries.length - 1 && <Separator />}
                </div>
              );
            })
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

