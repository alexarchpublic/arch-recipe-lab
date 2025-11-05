import { useState } from "react";
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

const assetHexBySymbol: Record<string, string> = {
  // Recognizable brand-adjacent colors
  BTC: '#f7931a',     // Bitcoin orange
  ETH: '#627eea',     // Ethereum blue/purple
  SOL: '#14f195',     // Solana green
  XRP: '#23292f',     // XRP black-ish
  SUI: '#2F80ED',     // Sui blue
};

export function TradingViewModal({ open, onOpenChange }: TradingViewModalProps) {
  const { positions, initialCapital, recipes, rows } = usePortfolio();
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

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

  const formatCurrencyShort = (n: number | null | undefined): string => {
    if (n === null || n === undefined) return "";
    return `$${Math.round(n).toLocaleString()}`;
  };

  const todayString = (): string => {
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  };

  const getAlgoCode = (algo?: string | null): string => {
    if (!algo) return '';
    if (algo === 'Oracle Protocol') return 'OP';
    if (algo === 'Arbitrage Algorithm') return 'AA';
    if (algo === 'Intelligence Algorithm') return 'IA';
    return '';
  };

  const getSuggestedName = (entry: any): string => {
    const { recipe, scaledInputs, capitalAllocated } = entry;
    const num = typeof recipe.display_number === 'number' ? `R${recipe.display_number}` : 'R?';
    const algo = getAlgoCode(recipe.algorithm);
    const start = `Start(${todayString()})`;
    const capital = `(${formatCurrencyShort(capitalAllocated)})`;

    if (recipe.algorithm === 'Arbitrage Algorithm') {
      const entrySize = typeof scaledInputs?.tradeSize?.entry === 'number' ? `$${scaledInputs.tradeSize.entry.toLocaleString()}` : '?';
      const exitSize = typeof scaledInputs?.tradeSize?.exit === 'number' ? `$${scaledInputs.tradeSize.exit.toLocaleString()}` : '?';
      return `${num} ${algo} ${start} ${capital} ${entrySize}/${exitSize}`.trim();
    }
    if (recipe.algorithm === 'Oracle Protocol') {
      // Always use dollar amounts - prefer fixed, otherwise calculate from percentage
      let entrySize = '?';
      if (typeof scaledInputs?.tradeSize?.entryFixed === 'number') {
        entrySize = `$${scaledInputs.tradeSize.entryFixed.toLocaleString()}`;
      } else if (typeof scaledInputs?.tradeSize?.entryPercent === 'number' && capitalAllocated > 0) {
        const entryDollar = Math.round(capitalAllocated * (scaledInputs.tradeSize.entryPercent / 100));
        entrySize = `$${entryDollar.toLocaleString()}`;
      }
      
      let exitSize = '?';
      if (typeof scaledInputs?.tradeSize?.exitFixed === 'number') {
        exitSize = `$${scaledInputs.tradeSize.exitFixed.toLocaleString()}`;
      } else if (typeof scaledInputs?.tradeSize?.exitPercent === 'number' && capitalAllocated > 0) {
        const exitDollar = Math.round(capitalAllocated * (scaledInputs.tradeSize.exitPercent / 100));
        exitSize = `$${exitDollar.toLocaleString()}`;
      }
      
      return `${num} ${algo} ${start} ${capital} ${entrySize}/${exitSize}`.trim();
    }
    if (recipe.algorithm === 'Intelligence Algorithm') {
      const factor = typeof scaledInputs?.activate?.factor === 'number' ? ` IF(${scaledInputs.activate.factor})` : '';
      const method = scaledInputs?.repeatPurchaseMethod ? ` (${scaledInputs.repeatPurchaseMethod})` : '';
      return `${num} ${algo} ${start} ${capital}${factor}${method}`.trim();
    }
    return `${num} ${algo} ${start} ${capital}`.trim();
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
              const suggestedName = getSuggestedName(entry);

              return (
                <div key={recipe.recipeId} className="space-y-3">
                  <div className="flex items-start gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        {typeof recipe.display_number === 'number' && (
                          <Badge variant="default" className="text-base font-bold px-3 py-1">#{recipe.display_number}</Badge>
                        )}
                        <h3 className="text-lg font-semibold">
                          {typeof recipe.display_number === 'number' 
                            ? `Recipe #${recipe.display_number}` 
                            : `Recipe Name: ${recipe.title}`}
                        </h3>
                        <Badge 
                          variant="outline"
                          className="text-white"
                          style={{ backgroundColor: assetHexBySymbol[recipe.assetSymbol] || '#6b7280', borderColor: assetHexBySymbol[recipe.assetSymbol] || '#6b7280' }}
                        >
                          {recipe.assetSymbol}
                        </Badge>
                        {recipe.algorithm && (
                          <Badge variant="secondary">{recipe.algorithm}</Badge>
                        )}
                      </div>
                      {/* Suggested TradingView Name */}
                      <div className="flex items-center gap-2 mb-3">
                        <div className="text-sm text-muted-foreground">Suggested TradingView Name:</div>
                        <div className="text-sm font-medium bg-secondary/60 border border-border rounded px-2 py-1">
                          {suggestedName}
                        </div>
                        <button
                          className="text-xs px-2 py-1 rounded bg-primary text-primary-foreground hover:opacity-90"
                          onClick={() => {
                            navigator.clipboard.writeText(suggestedName);
                            setCopiedIndex(index);
                            setTimeout(() => setCopiedIndex(null), 1500);
                          }}
                        >
                          {copiedIndex === index ? 'Copied!' : 'Copy'}
                        </button>
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

