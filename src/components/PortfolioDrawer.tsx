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
          className={"fixed bottom-6 right-6 h-12 px-5 rounded-full shadow-lg " + (flash ? "bg-gain text-white hover:bg-gain hover:brightness-100" : "")}
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
  const abs = `$${Math.abs(Math.round(n)).toLocaleString()}`;
  return n < 0 ? `−${abs}` : abs;
}

function pct(n: number): string {
  return `${(Math.round(n * 100) / 100).toFixed(2)}%`;
}

function signedPct(n: number): string {
  const abs = (Math.round(Math.abs(n) * 100) / 100).toFixed(2);
  if (n < 0) return `−${abs}%`;
  if (n > 0) return `+${abs}%`;
  return `${abs}%`;
}

const getFocusPill = (focus?: string | null): string => {
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
          <div className="eyebrow">Initial capital</div>
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
            className="font-mono tabular-nums"
          />
        </div>
        <div className="space-y-1">
          <div className="eyebrow">Remaining allocation</div>
          <div className={"font-mono text-sm font-semibold tabular-nums " + (remainingPct < 0 ? "text-destructive" : remainingPct > 0 ? "text-warn" : "")}>{signedPct(remainingPct)}</div>
        </div>
      </div>

      {/* Scrollable Positions Section */}
      <div className="mt-4 flex-1 overflow-y-auto min-h-0">
        <div className="space-y-3">
        {positionEntries.length === 0 && (
          <div className="text-sm text-muted-foreground">No recipes added yet. Add a recipe from the browser.</div>
        )}

        {positionEntries.map(pos => {
          const r = recipes[pos.recipeId];
          const row = rows.find(x => x.recipeId === pos.recipeId);
          if (!r || !row) return null;
          const sliderMax = Math.max(0, Math.min(100, remainingPct + pos.allocationPct));
          return (
            <div key={pos.recipeId} className="rounded-md border border-border bg-card p-3">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-extrabold leading-tight tracking-[-0.02em]">
                    {typeof r.display_number === 'number' ? `Recipe #${r.display_number}` : r.title}
                  </div>
                  <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                    <Badge variant="chip" className="px-1 py-0.5 text-[10px]">
                      {r.assetSymbol}
                    </Badge>
                    {r.focus && (
                      <Badge className={`px-1 py-0.5 text-[10px] ${getFocusPill(r.focus)}`}>
                        {r.focus}
                      </Badge>
                    )}
                    {r.algorithm && (
                      <Badge variant="outline" className="px-2 py-0.5 text-[10px] text-center whitespace-nowrap">
                        {r.algorithm}
                      </Badge>
                    )}
                    <span className="font-mono tabular-nums">Alloc: {pct(pos.allocationPct)}</span>
                  </div>
                </div>
                <Button variant="ghost" size="icon" className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive" onClick={() => removeRecipe(pos.recipeId)}>
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
                    className="w-24 font-mono tabular-nums"
                  />
                  <div className="font-mono text-xs tabular-nums text-muted-foreground">Capital: {currency(row.capitalAllocated)}</div>
                </div>
              </div>

              <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
                <div className="rounded-md border border-tile-border bg-muted p-2">
                  <div className="eyebrow">Cash profit</div>
                  <div className="mt-0.5 font-mono font-semibold tabular-nums">{currency(row.cashRealized)}</div>
                </div>
                <div className="rounded-md border border-tile-border bg-muted p-2">
                  <div className="eyebrow">Net profit</div>
                  <div className={"mt-0.5 font-mono font-semibold tabular-nums " + ((row.netProfit ?? 0) < 0 ? "text-destructive" : "")}>{currency(row.netProfit)}</div>
                </div>
                <div className="rounded-md border border-tile-border bg-muted p-2">
                  <div className="eyebrow">Qty ({row.assetSymbol})</div>
                  <div className="mt-0.5 font-mono font-semibold tabular-nums">{row.assetQuantity !== null ? row.assetQuantity.toFixed(6) : "—"}</div>
                </div>
              </div>
            </div>
          );
        })}
        </div>
      </div>

      <div className="mt-4 space-y-2 flex-shrink-0">
        <div className="eyebrow">Aggregates</div>
        <div className="grid grid-cols-3 gap-2 text-xs">
          <div className="rounded-md border border-tile-border bg-muted p-2">
            <div className="eyebrow">Capital</div>
            <div className="mt-0.5 font-mono font-semibold tabular-nums">{currency(aggregates.totalCapitalAllocated)}</div>
          </div>
          <div className="rounded-md border border-tile-border bg-muted p-2">
            <div className="eyebrow">Cash profit</div>
            <div className="mt-0.5 font-mono font-semibold tabular-nums">{currency(aggregates.totalCashRealized)}</div>
          </div>
          <div className="rounded-md border border-tile-border bg-muted p-2">
            <div className="eyebrow">Net profit</div>
            <div className={"mt-0.5 font-mono font-semibold tabular-nums " + ((aggregates.totalNetProfit ?? 0) < 0 ? "text-destructive" : "")}>{currency(aggregates.totalNetProfit)}</div>
          </div>
        </div>

        {Object.keys(aggregates.assetAccumulations).length > 0 && (
          <div className="mt-3 text-xs">
            <div className="eyebrow mb-2">Asset accumulation</div>
            <div className="space-y-2 rounded-md border border-tile-border bg-muted p-3">
              {Object.entries(aggregates.assetAccumulations).map(([sym, qty]) => (
                <div key={sym} className="flex items-center justify-between">
                  <Badge variant="chip" className="px-2 py-1 text-xs">
                    {sym}
                  </Badge>
                  <span className="font-mono font-semibold tabular-nums">{qty.toFixed(6)}</span>
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
          <Copy className="h-4 w-4" /> Copy to TradingView
        </Button>
        <Button variant="destructive" className="gap-2" onClick={clear}>
          <Trash2 className="h-4 w-4" /> Clear all
        </Button>
      </div>

      <TradingViewModal open={tradingViewModalOpen} onOpenChange={setTradingViewModalOpen} />
    </div>
  );
}


