import { useEffect, useMemo, useState } from "react";
import { Sheet, SheetContent, SheetDescription, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { usePortfolio } from "@/hooks/usePortfolio";
import { Heart, Trash2, RefreshCw } from "lucide-react";

export function PortfolioDrawer() {
  const { setOnFirstAdd } = usePortfolio();
  const [open, setOpen] = useState(false);

  // Open the drawer automatically the first time an item is added
  useEffect(() => {
    setOnFirstAdd(() => () => setOpen(true));
    return () => setOnFirstAdd(null);
  }, [setOnFirstAdd]);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          className="fixed bottom-6 right-6 h-12 w-12 rounded-full shadow-lg"
          variant="default"
        >
          <Heart className="h-5 w-5" />
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
    normalize,
    clear,
  } = usePortfolio();

  const positionEntries = useMemo(() => Object.values(positions), [positions]);

  return (
    <div className="flex h-full flex-col">
      <div className="space-y-1">
        <SheetTitle>Portfolio</SheetTitle>
        <SheetDescription>Allocate your capital across selected recipes.</SheetDescription>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2">
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

      <div className="mt-4 space-y-3 overflow-auto">
        {positionEntries.length === 0 && (
          <div className="text-sm text-muted-foreground">No recipes added yet. Tap the heart on a recipe to add it.</div>
        )}

        {positionEntries.map(pos => {
          const r = recipes[pos.recipeId];
          const row = rows.find(x => x.recipeId === pos.recipeId)!;
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
                  max={100}
                  step={0.5}
                />
                <div className="mt-2 flex items-center gap-2">
                  <Input
                    type="number"
                    value={pos.allocationPct}
                    min={0}
                    max={100}
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
                  <div className="text-muted-foreground">PnL</div>
                  <div className={"font-medium " + ((row.pnl ?? 0) < 0 ? "text-destructive" : "")}>{currency(row.pnl)}</div>
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

      <div className="mt-4 space-y-2">
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
            <div className="text-muted-foreground">PnL</div>
            <div className={"font-medium " + ((aggregates.totalPnL ?? 0) < 0 ? "text-destructive" : "")}>{currency(aggregates.totalPnL)}</div>
          </div>
        </div>

        {Object.keys(aggregates.assetAccumulations).length > 0 && (
          <div className="mt-2 text-xs">
            <div className="text-muted-foreground">Accumulation</div>
            <div className="mt-1 space-y-1">
              {Object.entries(aggregates.assetAccumulations).map(([sym, qty]) => (
                <div key={sym} className="flex items-center justify-between">
                  <span className="font-medium">{sym}</span>
                  <span>{qty.toFixed(6)}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="mt-auto flex items-center gap-2 pt-4">
        <Button variant="secondary" className="gap-2" onClick={normalize}>
          <RefreshCw className="h-4 w-4" /> Normalize 100%
        </Button>
        <Button variant="destructive" className="gap-2" onClick={clear}>
          <Trash2 className="h-4 w-4" /> Clear
        </Button>
      </div>
    </div>
  );
}


