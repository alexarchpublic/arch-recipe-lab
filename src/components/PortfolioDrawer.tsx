import { useEffect, useMemo, useRef, useState } from "react";
import { Sheet, SheetContent, SheetDescription, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { usePortfolio } from "@/hooks/usePortfolio";
import { Plus, Trash2 } from "lucide-react";
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
          className={"fixed bottom-6 right-6 h-12 w-12 rounded-full shadow-lg transition-colors " + (flash ? "bg-green-600 hover:bg-green-600" : "")}
          variant="default"
        >
          <Plus className="h-5 w-5" />
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
            type="number"
            value={initialCapital}
            onChange={e => setInitialCapital(Number(e.target.value))}
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
                  <div className="font-medium leading-tight">{r.title}</div>
                  <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                    <Badge className="px-1 py-0.5 text-[10px]">{r.assetSymbol}</Badge>
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
                <div className="rounded-md bg-secondary/50 p-2">
                  <div className="text-muted-foreground">Cash Realized</div>
                  <div className="font-medium">{currency(row.cashRealized)}</div>
                </div>
                <div className="rounded-md bg-secondary/50 p-2">
                  <div className="text-muted-foreground">Net Profit</div>
                  <div className={"font-medium " + ((row.netProfit ?? 0) < 0 ? "text-destructive" : "")}>{currency(row.netProfit)}</div>
                </div>
                <div className="rounded-md bg-secondary/50 p-2">
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
          <div className="rounded-md bg-muted/50 p-2">
            <div className="text-muted-foreground">Capital</div>
            <div className="font-medium">{currency(aggregates.totalCapitalAllocated)}</div>
          </div>
          <div className="rounded-md bg-muted/50 p-2">
            <div className="text-muted-foreground">Cash Realized</div>
            <div className="font-medium">{currency(aggregates.totalCashRealized)}</div>
          </div>
          <div className="rounded-md bg-muted/50 p-2">
            <div className="text-muted-foreground">Net Profit</div>
            <div className={"font-medium " + ((aggregates.totalNetProfit ?? 0) < 0 ? "text-destructive" : "")}>{currency(aggregates.totalNetProfit)}</div>
          </div>
        </div>

        {Object.keys(aggregates.assetAccumulations).length > 0 && (
          <div className="mt-3 text-xs">
            <div className="text-sm font-semibold mb-2">Crypto Accumulation</div>
            <div className="rounded-md bg-secondary/50 p-3 space-y-2">
              {Object.entries(aggregates.assetAccumulations).map(([sym, qty]) => (
                <div key={sym} className="flex items-center justify-between">
                  <Badge className="px-2 py-1 text-xs">{sym}</Badge>
                  <span className="font-medium">{qty.toFixed(6)}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="mt-auto flex items-center gap-2 pt-4 flex-shrink-0">
        <Button variant="destructive" className="gap-2" onClick={clear}>
          <Trash2 className="h-4 w-4" /> Clear
        </Button>
      </div>
    </div>
  );
}


