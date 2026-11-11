// Portfolios: several, named, saved in this browser, exportable (P10, P11);
// each position pinned to a version (P12); one scaling rule with totals
// (P13) labelled as sums of separate backtests (P14).
import { useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowRight, CheckCircle2, Copy, Download, FolderPlus, MoreHorizontal, Pencil, RefreshCw, Trash2, Upload } from "lucide-react";
import {
  BasisLabel,
  DisclaimerSlot,
  formatDate,
  formatMoney,
  formatQuantity,
  formatSignedCurrency,
  formatSignedPercent,
  proStrategyPath,
} from "@core";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { ProLayout } from "@/components/pro/ProLayout";
import { CapitalInput, EmptyState, StrategyChips } from "@/components/pro/primitives";
import { usePortfolio } from "@/hooks/usePortfolio";
import { byId, toPortfolioSummary, useProStrategies } from "@/data/proStrategies";
import { useDisclaimer } from "@/data/disclosures";
import { exportFileName } from "@/data/portfolioStore";
import { track } from "@/data/analytics";
import { type ScaledRecipeMetrics, versionChanges } from "@/lib/portfolio";
import type { Position } from "@/data/portfolioStore";
import type { ProStrategy } from "@core";
import { CRYPTO_ASSETS } from "@/lib/algorithms";

function pctText(n: number): string {
  return `${(Math.round(n * 100) / 100).toLocaleString("en-US", { maximumFractionDigits: 2 })}%`;
}

function Tile({ label, value, tone }: { label: string; value: string; tone?: "loss" }) {
  return (
    <div className="rounded-md border border-tile-border bg-muted px-2.5 py-2">
      <p className="eyebrow">{label}</p>
      <p className={"mt-0.5 font-mono text-sm font-semibold tabular-nums " + (tone === "loss" ? "text-destructive" : "")}>{value}</p>
    </div>
  );
}

function PositionCard({
  position,
  row,
  current,
  maxPct,
  capital,
}: {
  position: Position;
  row: ScaledRecipeMetrics;
  current: ProStrategy | null;
  maxPct: number;
  capital: number;
}) {
  const { setAllocation, removeStrategy, updatePosition } = usePortfolio();
  const snap = position.snapshot;
  const changes = current ? versionChanges(snap, current) : null;
  const pinned = snap.versionNumber;
  const applied = position.applied;
  const appliedCurrent = applied && (!applied.versionId || applied.versionId === snap.versionId);
  const n = snap.display_number;

  return (
    <li className="rounded-lg border border-border bg-card p-4 shadow-sm" data-position={position.strategyId}>
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1 space-y-1.5">
          <StrategyChips displayNumber={n} asset={snap.assetSymbol} focus={snap.focus} />
          {typeof n === "number" ? (
            <Link to={proStrategyPath(n)} className="block font-extrabold leading-snug tracking-[-0.02em] hover:text-primary">
              {current?.title ?? snap.title}
            </Link>
          ) : (
            <p className="font-extrabold">{snap.title}</p>
          )}
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
            <span>{snap.algorithm}</span>
            {snap.time_frame && <span>· {snap.time_frame}</span>}
            <span>· {pinned ? `Version ${pinned}` : "Saved before versions were tracked"}</span>
            {applied && (
              <span className={"inline-flex items-center gap-1 font-semibold " + (appliedCurrent ? "text-gain" : "text-warn")}>
                <CheckCircle2 className="h-3.5 w-3.5" />
                Applied {applied.versionNumber ? `v${applied.versionNumber}` : ""} on {formatDate(applied.at.slice(0, 10))}
              </span>
            )}
          </p>
        </div>
        <Button variant="ghost" size="icon" className="shrink-0 text-muted-foreground hover:bg-destructive/10 hover:text-destructive" onClick={() => removeStrategy(position.strategyId)} aria-label={`Remove ${snap.title}`}>
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>

      {current?.archived_at && (
        <p className="mt-3 rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground">
          This strategy has been archived. It stays in your portfolio and you can still read it, but it no longer appears in the list.
        </p>
      )}
      {!current && (
        <p className="mt-3 rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground">
          This strategy is no longer published. The figures below are from the version you saved.
        </p>
      )}

      {changes?.changed && current && (
        <div className="mt-3 rounded-md border border-warn/50 bg-warn/[0.08] p-3 text-sm" role="status">
          <p className="font-bold">
            Updated{changes.fromVersion ? ` from version ${changes.fromVersion}` : ""} to version {changes.toVersion}
          </p>
          <ul className="mt-1.5 space-y-0.5 text-xs">
            {changes.figures.map((f) => (
              <li key={f.field}>
                {f.label}:{" "}
                <span className="font-mono">
                  {fmtChange(f.field, f.before, snap.assetSymbol)} → {fmtChange(f.field, f.after, snap.assetSymbol)}
                </span>{" "}
                {f.field !== "return_pct" && f.field !== "starting_capital" && <span className="text-muted-foreground">(at the strategy's starting capital)</span>}
              </li>
            ))}
            {changes.settingsChanged && <li>Settings changed. Review them on the strategy page before you apply.</li>}
            {changes.changeNote && <li className="text-muted-foreground">Note: {changes.changeNote}</li>}
          </ul>
          <div className="mt-2 flex flex-wrap gap-2">
            <Button size="sm" className="h-8 gap-1.5" onClick={() => {
              updatePosition(position.strategyId, toPortfolioSummary(current));
              track("portfolio_position_updated", { strategy_id: current.id, from_version: changes.fromVersion, to_version: current.version_number });
            }}>
              <RefreshCw className="h-3.5 w-3.5" /> Update to version {changes.toVersion}
            </Button>
            {typeof n === "number" && (
              <Button size="sm" variant="outline" className="h-8" asChild>
                <Link to={proStrategyPath(n)}>See the strategy</Link>
              </Button>
            )}
          </div>
        </div>
      )}

      <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto] sm:items-center">
        <Slider value={[position.allocationPct]} onValueChange={([v]) => setAllocation(position.strategyId, v)} max={100} step={0.5} aria-label="Allocation" />
        <div className="flex items-center gap-2">
          <Input
            type="number"
            value={Number.isFinite(position.allocationPct) ? +position.allocationPct.toFixed(2) : 0}
            min={0}
            max={maxPct}
            step={0.5}
            onChange={(e) => setAllocation(position.strategyId, Number(e.target.value))}
            className="h-9 w-24 font-mono tabular-nums"
            aria-label="Allocation percent"
          />
          <span className="text-sm text-muted-foreground">%</span>
          <span className="ml-2 font-mono text-sm font-semibold tabular-nums">{formatMoney(row.capitalAllocated)}</span>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
        <Tile label="Cash profit" value={row.cashRealized === null ? "—" : formatSignedCurrency(row.cashRealized)} />
        <Tile label="Net profit" value={row.netProfit === null ? "—" : formatSignedCurrency(row.netProfit)} tone={(row.netProfit ?? 0) < 0 ? "loss" : undefined} />
        <Tile label={`${row.assetSymbol} accumulated`} value={row.assetQuantity === null ? "—" : formatQuantity(row.assetQuantity, snap.assetClass ?? ((CRYPTO_ASSETS as readonly string[]).includes(snap.assetSymbol) ? "Crypto" : "Equities"))} />
      </div>
    </li>
  );
}

function fmtChange(field: string, v: number | null, asset: string): string {
  if (v === null) return "none";
  if (field === "return_pct") return formatSignedPercent(v);
  if (field === "asset_qty") return `${v.toLocaleString("en-US", { maximumFractionDigits: 4 })} ${asset}`;
  if (field === "starting_capital") return formatMoney(v);
  return formatSignedCurrency(v);
}

export default function Portfolios() {
  const p = usePortfolio();
  const { active, portfolios, rows, aggregates, remainingPct } = p;
  const { data: strategies } = useProStrategies();
  const disclaimer = useDisclaimer("results");
  const { toast } = useToast();
  const navigate = useNavigate();
  const fileRef = useRef<HTMLInputElement>(null);
  const [renaming, setRenaming] = useState<string | null>(null);
  const [nameDraft, setNameDraft] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);

  const allocated = 100 - remainingPct;
  const funded = active?.positions.filter((x) => x.allocationPct > 0).length ?? 0;
  const updates = useMemo(
    () =>
      (active?.positions ?? []).filter((x) => {
        const cur = byId(strategies, x.strategyId);
        return cur ? versionChanges(x.snapshot, cur).changed : false;
      }).length,
    [active, strategies],
  );

  if (!p.ready || !active) {
    return (
      <ProLayout title="Portfolios">
        <div className="h-64 animate-pulse rounded-lg bg-muted" />
      </ProLayout>
    );
  }

  const doExport = () => {
    const text = p.exportPortfolio(active.id);
    const blob = new Blob([text], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = exportFileName(active);
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const doImport = async (file: File) => {
    try {
      const imported = p.importPortfolio(await file.text());
      toast({ title: "Portfolio opened", description: `${imported.name}, ${imported.positions.length} strategies.` });
    } catch (e) {
      toast({ variant: "destructive", title: "Could not open the file", description: e instanceof Error ? e.message : String(e) });
    }
  };

  const startRename = () => {
    setNameDraft(active.name);
    setRenaming(active.id);
  };

  return (
    <ProLayout title="Portfolios">
      <div className="mx-auto max-w-5xl">
        <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-end">
          <div className="flex-1">
            <h1 className="text-2xl font-extrabold tracking-[-0.02em] md:text-3xl">Portfolios</h1>
            <p className="mt-1 text-sm text-muted-foreground">Saved in this browser. Export one to open it on another device.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Select value={active.id} onValueChange={p.setActive}>
              <SelectTrigger className="w-[240px] bg-card" aria-label="Portfolio">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {portfolios.map((x) => (
                  <SelectItem key={x.id} value={x.id}>
                    {x.name} ({x.positions.length})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" className="gap-1.5" onClick={() => p.createPortfolio()}>
              <FolderPlus className="h-4 w-4" /> New
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon" aria-label="More portfolio actions">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onSelect={startRename}>
                  <Pencil className="mr-2 h-4 w-4" /> Rename
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => p.duplicatePortfolio(active.id)}>
                  <Copy className="mr-2 h-4 w-4" /> Duplicate
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={doExport}>
                  <Download className="mr-2 h-4 w-4" /> Export to a file
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => fileRef.current?.click()}>
                  <Upload className="mr-2 h-4 w-4" /> Open a file
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={() => setConfirmDelete(true)} className="text-destructive focus:text-destructive">
                  <Trash2 className="mr-2 h-4 w-4" /> Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <input
              ref={fileRef}
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void doImport(f);
                e.target.value = "";
              }}
            />
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
          <section aria-label={`${active.name} positions`} className="min-w-0">
            <div className="mb-4 flex flex-wrap items-end gap-4 rounded-lg border border-border bg-card p-4 shadow-sm">
              <div>
                <label htmlFor="portfolio-capital" className="eyebrow mb-1.5 block">
                  Capital for {active.name}
                </label>
                <CapitalInput id="portfolio-capital" value={active.capital} onChange={p.setCapital} className="w-48" />
              </div>
              <div>
                <p className="eyebrow mb-1.5">Allocated</p>
                <p className={"font-mono text-lg font-bold tabular-nums " + (Math.abs(remainingPct) < 0.01 ? "text-gain" : "text-warn")}>{pctText(allocated)}</p>
              </div>
              <div className="ml-auto flex gap-2">
                <Button variant="outline" size="sm" onClick={p.splitEvenly} disabled={active.positions.length === 0}>
                  Split evenly
                </Button>
                <Button variant="outline" size="sm" onClick={p.normalize} disabled={allocated <= 0 || Math.abs(remainingPct) < 0.01}>
                  Scale to 100%
                </Button>
              </div>
            </div>

            {active.positions.length === 0 ? (
              <EmptyState title="No strategies in this portfolio yet">
                <Link to="/" className="font-semibold text-primary hover:underline">
                  Browse strategies
                </Link>{" "}
                and use Add to portfolio. They are added to {active.name}.
              </EmptyState>
            ) : (
              <ul className="space-y-4">
                {active.positions.map((pos) => {
                  const row = rows.find((r) => r.recipeId === pos.strategyId);
                  if (!row) return null;
                  return (
                    <PositionCard
                      key={pos.strategyId}
                      position={pos}
                      row={row}
                      current={byId(strategies, pos.strategyId)}
                      maxPct={Math.max(0, Math.min(100, remainingPct + pos.allocationPct))}
                      capital={active.capital}
                    />
                  );
                })}
              </ul>
            )}
          </section>

          <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
            <section className="rounded-lg border border-border bg-card p-4 shadow-sm" aria-labelledby="totals-h" data-results="portfolio">
              <h2 id="totals-h" className="eyebrow mb-1 text-primary">
                Totals
              </h2>
              <p className="mb-3 text-xs text-muted-foreground">
                Sums of separate backtests. Each strategy was tested on its own, so no combined drawdown or correlation is shown.
              </p>
              <div className="grid grid-cols-2 gap-2">
                <Tile label="Capital allocated" value={formatMoney(aggregates.totalCapitalAllocated)} />
                <Tile label="Cash profit" value={aggregates.totalCashRealized === null ? "—" : formatSignedCurrency(aggregates.totalCashRealized)} />
                <Tile label="Net profit" value={aggregates.totalNetProfit === null ? "—" : formatSignedCurrency(aggregates.totalNetProfit)} tone={(aggregates.totalNetProfit ?? 0) < 0 ? "loss" : undefined} />
                {remainingPct > 0.01 && <Tile label="Unallocated" value={formatMoney((remainingPct / 100) * active.capital)} />}
              </div>
              {Object.keys(aggregates.assetAccumulations).length > 0 && (
                <div className="mt-3">
                  <p className="eyebrow mb-1.5">Assets accumulated</p>
                  <ul className="divide-y divide-tile-border rounded-md border border-tile-border bg-muted text-sm">
                    {Object.entries(aggregates.assetAccumulations).map(([sym, q]) => (
                      <li key={sym} className="flex items-center justify-between px-3 py-1.5">
                        <Badge variant="chip">{sym}</Badge>
                        <span className="font-mono font-semibold tabular-nums">{q.toLocaleString("en-US", { maximumFractionDigits: 6 })}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              <div className="mt-3 space-y-1.5" data-disclosure="results">
                <BasisLabel basis="backtested" />
                <DisclaimerSlot text={disclaimer} />
              </div>
            </section>

            <section className="rounded-lg border border-primary/30 bg-card p-4 shadow-sm">
              <h2 className="text-base font-extrabold tracking-[-0.02em]">Apply {active.name}</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Step through each strategy with its settings in TradingView's order, a copy button on every value, and today's
                date already filled in.
              </p>
              {updates > 0 && <p className="mt-2 text-xs font-semibold text-warn">{updates} strategy update{updates > 1 ? "s" : ""} to review first.</p>}
              <Button className="mt-3 w-full gap-1.5" disabled={funded === 0} onClick={() => navigate(`/portfolios/${active.id}/apply`)}>
                Start guided apply <ArrowRight className="h-4 w-4" />
              </Button>
              {funded === 0 && active.positions.length > 0 && <p className="mt-2 text-xs text-muted-foreground">Allocate some capital first.</p>}
            </section>
          </aside>
        </div>
      </div>

      <Dialog open={renaming !== null} onOpenChange={(o) => !o && setRenaming(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Rename portfolio</DialogTitle>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (renaming) p.renamePortfolio(renaming, nameDraft);
              setRenaming(null);
            }}
          >
            <Input value={nameDraft} onChange={(e) => setNameDraft(e.target.value)} autoFocus aria-label="Portfolio name" maxLength={60} />
            <DialogFooter className="mt-4">
              <Button type="submit">Save</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {active.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              Its {active.positions.length} strategies and applied records are removed from this browser. Export it first if you
              may want it back.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep it</AlertDialogCancel>
            <AlertDialogAction onClick={() => p.deletePortfolio(active.id)} className="bg-destructive hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </ProLayout>
  );
}
