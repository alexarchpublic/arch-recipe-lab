import { useEffect, useMemo, useRef, useState } from "react";
import { Sheet, SheetContent, SheetDescription, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { usePortfolio } from "@/hooks/usePortfolio";
import { Trash2, Copy } from "lucide-react";
import { TradingViewModal } from "@/components/TradingViewModal";
// import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export function PortfolioDrawer() {
  const { setOnFirstAdd, positions } = usePortfolio() as any;
  const [open, setOpen] = useState(false);
  const [flash, setFlash] = useState(false);
  const prevCountRef = useRef<number>(0);

  // Open the drawer automatically the first time an item is added
  useEffect(() => {
    setOnFirstAdd(() => () => setOpen(true));
    return () => setOnFirstAdd(null);
  }, [setOnFirstAdd]);

  // Flash the trigger button briefly when a recipe is added
  useEffect(() => {
    const count = Object.keys(positions || {}).length;
    if (count > prevCountRef.current) {
      setFlash(true);
      setTimeout(() => setFlash(false), 1500);
    }
    prevCountRef.current = count;
  }, [positions]);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          className={"fixed bottom-6 right-6 h-12 px-5 rounded-full shadow-lg transition-colors " + (flash ? "bg-green-600 hover:bg-green-600 text-white" : "")}
          variant="default"
        >
          Portfolio
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-full sm:max-w-md">
        <DrawerInner />
      </SheetContent>
    </Sheet>
  );
}

export default PortfolioDrawer;

function currency(n: number | null): string {
  if (n === null) return "—";
  return `$${Math.round(n).toLocaleString()}`;
}

function pct(n: number): string {
  return `${(Math.round(n * 100) / 100).toFixed(2)}%`;
}

const assetHexBySymbol: Record<string, string> = {
  // Recognizable brand-adjacent colors
  BTC: '#f7931a',     // Bitcoin orange
  ETH: '#627eea',     // Ethereum blue/purple
  SOL: '#14f195',     // Solana green
  XRP: '#23292f',     // XRP black-ish
  SUI: '#2F80ED',     // Sui blue
};

function DrawerInner() {
  const {
    positions,
    initialCapital,
    recipes,
    rows,
    aggregates,
    remainingPct,
    setInitialCapital,
    setAllocation,
    removeRecipe,
    clear,
    // optimizeAllocations,
  } = usePortfolio();

  const positionEntries = useMemo(() => Object.values(positions), [positions]);
  const [tradingViewModalOpen, setTradingViewModalOpen] = useState(false);
  
  const [capitalInput, setCapitalInput] = useState<string>(() => 
    initialCapital.toLocaleString('en-US', { maximumFractionDigits: 0 })
  );

  useEffect(() => {
    setCapitalInput(initialCapital.toLocaleString('en-US', { maximumFractionDigits: 0 }));
  }, [initialCapital]);

  const formatCurrency = (value: number): string => {
    if (!Number.isFinite(value) || value <= 0) return '';
    return Math.round(value).toLocaleString('en-US', { maximumFractionDigits: 0 });
  };

  const parseCurrency = (value: string): number => {
    const cleaned = value.replace(/[^0-9]/g, '');
    const num = parseFloat(cleaned);
    return Number.isFinite(num) && num >= 0 ? num : 0;
  };

  const handleCapitalChange = (value: string) => {
    setCapitalInput(value);
    const parsed = parseCurrency(value);
    if (parsed > 0) {
      setInitialCapital(parsed);
    }
  };
  // const assetOptions = useMemo(() => {
  //   const set = new Set<string>();
  //   Object.values(recipes).forEach((r: any) => set.add(r.assetSymbol));
  //   return Array.from(set);
  // }, [recipes]);

  // const [objective, setObjective] = useState<"cash" | "pnl" | "asset">("cash");
  // const [asset, setAsset] = useState<string | undefined>(undefined);
  // useEffect(() => {
  //   if (!asset && assetOptions.length > 0) setAsset(assetOptions[0]);
  // }, [asset, assetOptions]);

  return (
    <div className="flex h-full flex-col">
      <div className="space-y-1 flex-shrink-0">
        <SheetTitle>Portfolio</SheetTitle>
        <SheetDescription>Allocate your capital across selected recipes.</SheetDescription>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2 flex-shrink-0">
        <div className="space-y-1">
          <div className="text-xs text-muted-foreground">Initial Capital</div>
          <Input
            type="text"
            value={capitalInput}
            onChange={e => handleCapitalChange(e.target.value)}
            onBlur={(e) => {
              const parsed = parseCurrency(e.target.value);
              if (parsed > 0) {
                setCapitalInput(formatCurrency(parsed));
              }
            }}
            placeholder="$100,000"
            min={0}
          />
        </div>
        <div className="space-y-1">
          <div className="text-xs text-muted-foreground">Remaining Allocation</div>
          <div className={"text-sm font-medium " + (remainingPct < 0 ? "text-destructive" : remainingPct > 0 ? "text-amber-500" : "")}>{pct(remainingPct)}</div>
        </div>
      </div>

      {/* Scrollable Positions Section */}
      <div className="mt-4 flex-1 overflow-y-auto min-h-0">
        <div className="space-y-3">
        {positionEntries.length === 0 && (
          <div className="text-sm text-muted-foreground">No recipes added yet. Tap the heart on a recipe to add it.</div>
        )}

        {positionEntries.map(pos => {
          const r = recipes[pos.recipeId];
          const row = rows.find(x => x.recipeId === pos.recipeId);
          if (!r || !row) return null;
          const sliderMax = Math.max(0, Math.min(100, remainingPct + pos.allocationPct));
          return (
            <div key={pos.recipeId} className="rounded-md border p-3">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-medium leading-tight">
                    {typeof r.display_number === 'number' ? `Recipe #${r.display_number}` : r.title}
                  </div>
                  <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                    <Badge 
                      className="px-1 py-0.5 text-[10px] text-white"
                      style={{ backgroundColor: assetHexBySymbol[r.assetSymbol] || '#6b7280' }}
                    >
                      {r.assetSymbol}
                    </Badge>
                    <span>Alloc: {pct(pos.allocationPct)}</span>
                  </div>
                </div>
                <Button variant="ghost" size="icon" onClick={() => removeRecipe(pos.recipeId)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>

              <div className="mt-3">
                <Slider
                  value={[pos.allocationPct]}
                  onValueChange={([v]) => setAllocation(pos.recipeId, v)}
                  max={sliderMax}
                  step={0.5}
                />
                <div className="mt-2 flex items-center gap-2">
                  <Input
                    type="number"
                    value={pos.allocationPct}
                    min={0}
                    max={sliderMax}
                    step={0.5}
                    onChange={e => setAllocation(pos.recipeId, Number(e.target.value))}
                    className="w-24"
                  />
                  <div className="text-xs text-muted-foreground">Capital: {currency(row.capitalAllocated)}</div>
                </div>
              </div>

              <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
                <div className="rounded-md bg-gray-100 border border-gray-200 p-2">
                  <div className="text-muted-foreground">Cash Profit</div>
                  <div className="font-medium">{currency(row.cashRealized)}</div>
                </div>
                <div className="rounded-md bg-gray-100 border border-gray-200 p-2">
                  <div className="text-muted-foreground">Net Profit</div>
                  <div className={"font-medium " + ((row.netProfit ?? 0) < 0 ? "text-destructive" : "")}>{currency(row.netProfit)}</div>
                </div>
                <div className="rounded-md bg-gray-100 border border-gray-200 p-2">
                  <div className="text-muted-foreground">Qty ({row.assetSymbol})</div>
                  <div className="font-medium">{row.assetQuantity !== null ? row.assetQuantity.toFixed(6) : "—"}</div>
                </div>
              </div>
            </div>
          );
        })}
        </div>
      </div>

      <div className="mt-4 space-y-2 flex-shrink-0">
        <div className="text-sm font-semibold">Aggregates</div>
        <div className="grid grid-cols-3 gap-2 text-xs">
          <div className="rounded-md bg-gray-100 border border-gray-200 p-2">
            <div className="text-muted-foreground">Capital</div>
            <div className="font-medium">{currency(aggregates.totalCapitalAllocated)}</div>
          </div>
          <div className="rounded-md bg-gray-100 border border-gray-200 p-2">
            <div className="text-muted-foreground">Cash Profit</div>
            <div className="font-medium">{currency(aggregates.totalCashRealized)}</div>
          </div>
          <div className="rounded-md bg-gray-100 border border-gray-200 p-2">
            <div className="text-muted-foreground">Net Profit</div>
            <div className={"font-medium " + ((aggregates.totalNetProfit ?? 0) < 0 ? "text-destructive" : "")}>{currency(aggregates.totalNetProfit)}</div>
          </div>
        </div>

        {Object.keys(aggregates.assetAccumulations).length > 0 && (
          <div className="mt-3 text-xs">
            <div className="text-sm font-semibold mb-2">Crypto Accumulation</div>
            <div className="rounded-md bg-gray-100 border border-gray-200 p-3 space-y-2">
              {Object.entries(aggregates.assetAccumulations).map(([sym, qty]) => (
                <div key={sym} className="flex items-center justify-between">
                  <Badge 
                    className="px-2 py-1 text-xs text-white"
                    style={{ backgroundColor: assetHexBySymbol[sym] || '#6b7280' }}
                  >
                    {sym}
                  </Badge>
                  <span className="font-medium">{qty.toFixed(6)}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="mt-auto flex items-center gap-2 pt-4 flex-shrink-0">
        <Button 
          variant="outline" 
          className="gap-2 flex-1" 
          onClick={() => setTradingViewModalOpen(true)}
          disabled={positionEntries.length === 0}
        >
          <Copy className="h-4 w-4" /> Copy To TradingView
        </Button>
        <Button variant="destructive" className="gap-2" onClick={clear}>
          <Trash2 className="h-4 w-4" /> Clear
        </Button>
      </div>

      <TradingViewModal open={tradingViewModalOpen} onOpenChange={setTradingViewModalOpen} />
    </div>
  );
}


