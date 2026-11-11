// Guided apply, one strategy at a time (P15 to P17, P19).
import { useEffect, useMemo, useRef } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { AlertTriangle, ArrowLeft, ArrowRight, CheckCircle2, Circle, LifeBuoy } from "lucide-react";
import {
  CONCIERGE_URL,
  formatDate,
  formatMoney,
  proStrategyPath,
  scaleAlgorithmInputs,
  settingsBlockText,
  settingsRows,
  suggestedTradingViewName,
} from "@core";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ProLayout } from "@/components/pro/ProLayout";
import { SettingsList } from "@/components/pro/SettingsList";
import { CopyButton, EmptyState, StrategyChips } from "@/components/pro/primitives";
import { usePortfolio } from "@/hooks/usePortfolio";
import { byId, useProStrategies } from "@/data/proStrategies";
import { DEFAULT_BASE_CAPITAL, versionChanges } from "@/lib/portfolio";
import { track } from "@/data/analytics";

function HelpLink({ step }: { step: string }) {
  return (
    <a
      href={CONCIERGE_URL}
      target="_blank"
      rel="noreferrer"
      className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline"
      data-help-step={step}
    >
      <LifeBuoy className="h-4 w-4" /> Stuck? Concierge can set this up with you
    </a>
  );
}

export default function Apply() {
  const { portfolioId } = useParams();
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const p = usePortfolio();
  const { data: strategies } = useProStrategies();
  const portfolio = p.portfolios.find((x) => x.id === portfolioId);

  useEffect(() => {
    if (portfolio && p.activeId !== portfolio.id) p.setActive(portfolio.id);
  }, [portfolio, p]);

  const steps = useMemo(() => {
    if (!portfolio) return [];
    return portfolio.positions
      .filter((x) => x.allocationPct > 0)
      .map((pos) => {
        const snap = pos.snapshot;
        const capitalAllocated = (pos.allocationPct / 100) * portfolio.capital;
        const base = snap.baseInitialCapital && snap.baseInitialCapital > 0 ? snap.baseInitialCapital : DEFAULT_BASE_CAPITAL;
        const inputs = scaleAlgorithmInputs(snap.algorithm_inputs, capitalAllocated / base, snap.algorithm);
        return { pos, snap, capitalAllocated, inputs };
      });
  }, [portfolio]);

  const stepIndex = Math.min(Math.max(parseInt(params.get("step") ?? "1", 10) || 1, 1), Math.max(steps.length, 1)) - 1;
  const started = useRef(false);
  useEffect(() => {
    if (started.current || !portfolio || steps.length === 0) return;
    started.current = true;
    track("apply_started", { portfolio_id: portfolio.id, strategies: steps.length });
  }, [portfolio, steps.length]);

  if (!p.ready) {
    return (
      <ProLayout title="Apply">
        <div className="h-64 animate-pulse rounded-lg bg-muted" />
      </ProLayout>
    );
  }
  if (!portfolio) {
    return (
      <ProLayout title="Apply">
        <EmptyState title="Portfolio not found">
          It may have been deleted, or saved in another browser.{" "}
          <Link className="font-semibold text-primary hover:underline" to="/portfolios">
            Your portfolios
          </Link>
        </EmptyState>
      </ProLayout>
    );
  }
  if (steps.length === 0) {
    return (
      <ProLayout title="Apply">
        <EmptyState title="Nothing to apply yet">
          Add strategies to {portfolio.name} and give each an allocation.{" "}
          <Link className="font-semibold text-primary hover:underline" to="/portfolios">
            Back to the portfolio
          </Link>
        </EmptyState>
      </ProLayout>
    );
  }

  const step = steps[stepIndex];
  const { pos, snap, capitalAllocated, inputs } = step;
  const current = byId(strategies, pos.strategyId);
  const changes = current ? versionChanges(snap, current) : null;
  const rows = settingsRows({
    algorithm: snap.algorithm,
    inputs,
    mode: "apply",
    asset: snap.assetSymbol,
    assetClass: snap.assetClass ?? null,
    timeFrame: snap.time_frame ?? null,
  });
  const name = suggestedTradingViewName({ displayNumber: snap.display_number, algorithm: snap.algorithm, inputs, capitalAllocated });
  const block = settingsBlockText(
    [
      typeof snap.display_number === "number" ? `Strategy #${snap.display_number}: ${snap.title}` : snap.title,
      `Suggested TradingView name: ${name}`,
      `Capital allocated: ${formatMoney(capitalAllocated)}`,
      snap.versionNumber ? `Version: ${snap.versionNumber}` : "",
    ].filter(Boolean),
    rows,
  );
  const applied = pos.applied;
  const appliedThis = !!applied && (!applied.versionId || applied.versionId === snap.versionId);
  const go = (i: number) => setParams({ step: String(i + 1) });
  const copied = (key: string) =>
    track("setting_copied", { strategy_id: pos.strategyId, version: snap.versionNumber ?? null, step: stepIndex + 1, setting: key });

  return (
    <ProLayout title={`Apply ${portfolio.name}`}>
      <Link to="/portfolios" className="mb-5 inline-flex items-center gap-1.5 text-sm font-semibold text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> {portfolio.name}
      </Link>
      <div className="grid gap-6 lg:grid-cols-[260px_1fr]">
        <nav aria-label="Apply steps" className="lg:sticky lg:top-24 lg:self-start">
          <p className="eyebrow mb-2">Apply {portfolio.name}</p>
          <ol className="space-y-1">
            {steps.map((s, i) => {
              const done = !!s.pos.applied && (!s.pos.applied.versionId || s.pos.applied.versionId === s.snap.versionId);
              return (
                <li key={s.pos.strategyId}>
                  <button
                    type="button"
                    onClick={() => go(i)}
                    aria-current={i === stepIndex ? "step" : undefined}
                    className={cn(
                      "flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-sm transition-colors",
                      i === stepIndex ? "bg-card font-bold shadow-sm ring-1 ring-border" : "text-muted-foreground hover:bg-card",
                    )}
                  >
                    {done ? <CheckCircle2 className="h-4 w-4 shrink-0 text-gain" /> : <Circle className="h-4 w-4 shrink-0" />}
                    <span className="truncate">
                      {typeof s.snap.display_number === "number" ? `#${s.snap.display_number} ` : ""}
                      {s.snap.title}
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>
          <p className="mt-3 text-xs text-muted-foreground">
            {steps.filter((s) => s.pos.applied && (!s.pos.applied.versionId || s.pos.applied.versionId === s.snap.versionId)).length} of {steps.length} applied
          </p>
        </nav>

        <section className="min-w-0 space-y-5" aria-labelledby="step-h">
          <div className="rounded-lg border border-border bg-card p-5 shadow-sm">
            <p className="eyebrow">
              Step {stepIndex + 1} of {steps.length}
            </p>
            <div className="mt-2 flex flex-wrap items-start gap-3">
              <div className="min-w-0 flex-1 space-y-2">
                <StrategyChips displayNumber={snap.display_number} asset={snap.assetSymbol} focus={snap.focus} />
                <h1 id="step-h" className="text-xl font-extrabold tracking-[-0.02em] md:text-2xl">
                  {snap.title}
                </h1>
                <p className="text-sm text-muted-foreground">
                  {snap.algorithm}
                  {snap.versionNumber ? ` · version ${snap.versionNumber}` : ""} · {formatMoney(capitalAllocated)} allocated ({+pos.allocationPct.toFixed(2)}% of{" "}
                  {formatMoney(portfolio.capital)})
                </p>
              </div>
              {typeof snap.display_number === "number" && (
                <Button variant="outline" size="sm" asChild>
                  <Link to={proStrategyPath(snap.display_number)}>Strategy page</Link>
                </Button>
              )}
            </div>

            {changes?.changed && (
              <div className="mt-4 flex gap-2 rounded-md border border-warn/50 bg-warn/[0.08] p-3 text-sm">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warn" />
                <p>
                  Version {changes.toVersion} of this strategy has been published since you added it. These steps use the version in
                  your portfolio.{" "}
                  <Link to="/portfolios" className="font-semibold text-primary hover:underline">
                    Review the update
                  </Link>{" "}
                  before you apply.
                </p>
              </div>
            )}
            {current?.archived_at && (
              <p className="mt-4 rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground">This strategy has been archived. You can still apply the version you hold.</p>
            )}
          </div>

          <ol className="space-y-5">
            <li className="rounded-lg border border-border bg-card p-5 shadow-sm">
              <h2 className="text-base font-extrabold tracking-[-0.02em]">1. Add the strategy to your chart in TradingView</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Open a {snap.assetSymbol} chart{snap.time_frame ? ` on the ${snap.time_frame} time frame` : ""}, add {snap.algorithm}, and
                name it:
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <code className="min-w-0 flex-1 break-all rounded-md border border-border bg-muted px-3 py-2 font-mono text-sm">{name}</code>
                <CopyButton value={name} label="Copy name" onCopied={() => copied("suggested_name")} />
              </div>
              <div className="mt-3">
                <HelpLink step="add" />
              </div>
            </li>

            <li className="rounded-lg border border-border bg-card p-5 shadow-sm">
              <div className="flex flex-wrap items-start gap-3">
                <div className="flex-1">
                  <h2 className="text-base font-extrabold tracking-[-0.02em]">2. Enter the settings</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    In the order of TradingView's settings panel, scaled to {formatMoney(capitalAllocated)}. The start date is today;
                    tick the boxes marked Tick.
                  </p>
                </div>
                <CopyButton value={block} label="Copy all" onCopied={() => copied("all")} />
              </div>
              <SettingsList rows={rows} copyable onCopy={(r) => copied(r.key)} className="mt-4" />
              <div className="mt-4">
                <HelpLink step="settings" />
              </div>
            </li>

            <li className="rounded-lg border border-border bg-card p-5 shadow-sm">
              <h2 className="text-base font-extrabold tracking-[-0.02em]">3. Mark it applied</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Your portfolio records which version you applied and when, so you can see when a newer version is published.
              </p>
              {appliedThis && applied ? (
                <div className="mt-3 flex flex-wrap items-center gap-3">
                  <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-gain">
                    <CheckCircle2 className="h-4 w-4" /> Applied{applied.versionNumber ? ` version ${applied.versionNumber}` : ""} on{" "}
                    {formatDate(applied.at.slice(0, 10))}
                  </span>
                  <Button variant="ghost" size="sm" onClick={() => p.clearApplied(pos.strategyId)}>
                    Undo
                  </Button>
                </div>
              ) : (
                <Button
                  className="mt-3 gap-1.5"
                  onClick={() => {
                    p.markApplied(pos.strategyId, { versionId: snap.versionId, versionNumber: snap.versionNumber, capitalAllocated });
                    track("strategy_marked_applied", {
                      strategy_id: pos.strategyId,
                      display_number: snap.display_number ?? null,
                      version: snap.versionNumber ?? null,
                      step: stepIndex + 1,
                    });
                    if (stepIndex < steps.length - 1) go(stepIndex + 1);
                  }}
                >
                  <CheckCircle2 className="h-4 w-4" /> I've applied this strategy
                </Button>
              )}
              <div className="mt-3">
                <HelpLink step="confirm" />
              </div>
            </li>
          </ol>

          <div className="flex items-center justify-between">
            <Button variant="outline" className="gap-1.5" disabled={stepIndex === 0} onClick={() => go(stepIndex - 1)}>
              <ArrowLeft className="h-4 w-4" /> Previous
            </Button>
            {stepIndex < steps.length - 1 ? (
              <Button variant="outline" className="gap-1.5" onClick={() => go(stepIndex + 1)}>
                Next strategy <ArrowRight className="h-4 w-4" />
              </Button>
            ) : (
              <Button variant="outline" onClick={() => navigate("/portfolios")}>
                Back to the portfolio
              </Button>
            )}
          </div>
        </section>
      </div>
    </ProLayout>
  );
}
