import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { StrategyPreviewModal } from "@/components/StrategyPreviewModal";
import {
  type AdminRole,
  type AdminVersion,
  type StrategyGroup,
  type VersionCheck,
  PUBLIC_VIEW_FIELDS,
  diffVersions,
  discardDraft,
  publishVersion,
  restoreVersion,
  submitForReview,
  versionToProStrategy,
} from "@/data/adminVersions";
import { afterPublish } from "@/data/strategyLab";
import { publicChartScreenshot } from "@core";

interface VersionReviewProps {
  group: StrategyGroup | null;
  role: AdminRole | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onChanged: () => void;
  onEdit: (group: StrategyGroup) => void;
}

const LEVEL_TITLE: Record<VersionCheck["level"], string> = {
  error: "Errors — block publish",
  review: "To review — acknowledge each to publish",
  warning: "Warnings",
};

const STATUS_LABEL: Record<string, string> = {
  draft: "Draft",
  in_review: "In review",
  published: "Published",
  superseded: "Superseded",
  archived: "Discarded",
};

function show(value: unknown): string {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

const VALUE_FIELDS: Array<[keyof AdminVersion, string]> = [
  ["starting_capital", "Starting capital"],
  ["test_start", "Test start"],
  ["test_end", "Test end"],
  ["test_end_source", "Test end from"],
  ["as_of", "As of"],
  ["net_profit_usd", "Net profit"],
  ["cash_profit_usd", "Cash profit"],
  ["asset_qty", "Asset accumulated"],
  ["return_pct", "Return %"],
  ["cagr_pct", "CAGR %"],
  ["buy_hold_pnl_pct", "Buy and hold %"],
  ["dca_pnl_pct", "DCA %"],
  ["benchmark_shown", "Benchmark shown"],
];

export function VersionReview({ group, role, open, onOpenChange, onChanged, onEdit }: VersionReviewProps) {
  const [acknowledged, setAcknowledged] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState<string | null>(null);
  const [blocking, setBlocking] = useState<VersionCheck[] | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const { toast } = useToast();

  if (!group) return null;
  const draft = group.draft;
  const published = group.published;
  const checks = draft?.checks ?? [];
  const errors = checks.filter((c) => c.level === "error");
  const reviewItems = checks.filter((c) => c.level === "review");
  const isApprover = role === "approver";
  const canPublish =
    !!draft && draft.status === "in_review" && isApprover && errors.length === 0 &&
    reviewItems.every((c) => acknowledged.has(c.code));
  const diff = draft ? diffVersions(published, draft) : [];
  const preview = draft ? versionToProStrategy(draft) : null;
  const publicChart = draft ? publicChartScreenshot(draft.screenshots) : null;

  const run = async (label: string, action: () => Promise<void>) => {
    setBusy(label);
    try {
      await action();
      onChanged();
    } catch (error: unknown) {
      toast({
        variant: "destructive",
        title: `${label} failed`,
        description: error instanceof Error ? error.message : String(error),
      });
    } finally {
      setBusy(null);
    }
  };

  const toggleAck = (code: string, on: boolean) => {
    setAcknowledged((prev) => {
      const next = new Set(prev);
      if (on) next.add(code); else next.delete(code);
      return next;
    });
  };

  const handlePublish = () =>
    run("Publish", async () => {
      if (!draft) return;
      const result = await publishVersion(draft.id, [...acknowledged]);
      if (!result.published) {
        setBlocking(result.blocking ?? []);
        toast({ variant: "destructive", title: "Not published", description: "See the blocking checks." });
        return;
      }
      setBlocking(null);
      setAcknowledged(new Set());
      toast({
        title: `Version ${draft.version_number} published`,
        description: result.parity_ok ? "Parity check clean. Checking the public page…" : "The parity check found a problem. See the banner.",
      });
      // Strategy Lab: refresh now and read the public page back (R4, R5).
      const lab = await afterPublish(
        { ...(draft as unknown as Record<string, unknown>), strategy_id: draft.strategy_id, display_number: group?.displayNumber ?? null, version_number: draft.version_number, slug: draft.slug },
        draft.listed_public,
      );
      toast({ variant: lab.ok ? undefined : "destructive", title: "Strategy Lab", description: lab.message });
    });

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-h-[90vh] max-w-5xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              #{group.displayNumber} {(draft ?? published ?? group.history[0]).title}
            </DialogTitle>
            <DialogDescription>
              {published ? `Published version ${published.version_number}` : "Never published"}
              {draft ? ` · ${STATUS_LABEL[draft.status]} version ${draft.version_number} by ${draft.created_by}` : " · No open draft"}
            </DialogDescription>
          </DialogHeader>

          {draft && (
            <div className="space-y-6">
              {/* Checks (A4, A9, A16) */}
              <section className="space-y-3">
                {(["error", "review", "warning"] as const).map((level) => {
                  const items = checks.filter((c) => c.level === level);
                  if (items.length === 0) return null;
                  return (
                    <div key={level} className="space-y-1">
                      <h4 className="text-sm font-semibold">{LEVEL_TITLE[level]}</h4>
                      <ul className="space-y-1">
                        {items.map((c, i) => (
                          <li key={`${c.code}-${i}`} className="flex items-start gap-2 text-sm">
                            {level === "review" ? (
                              <Checkbox
                                checked={acknowledged.has(c.code)}
                                onCheckedChange={(on) => toggleAck(c.code, !!on)}
                                aria-label={`Acknowledge ${c.code}`}
                              />
                            ) : (
                              <Badge variant={level === "error" ? "destructive" : "outline"} className="text-[10px]">
                                {level}
                              </Badge>
                            )}
                            <span>
                              <span className="font-mono text-xs text-muted-foreground">{c.code}</span> {c.message}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  );
                })}
                {checks.length === 0 && <p className="text-sm text-muted-foreground">No checks raised.</p>}
                {blocking && blocking.length > 0 && (
                  <div className="rounded border border-destructive/50 bg-destructive/5 p-3 text-sm">
                    <p className="font-semibold">Publish was refused by:</p>
                    <ul className="list-disc pl-5">
                      {blocking.map((c, i) => <li key={i}>{c.code}: {c.message}</li>)}
                    </ul>
                  </div>
                )}
              </section>

              <Separator />

              {/* Values beside their source screenshots (A6) */}
              <section className="grid gap-4 md:grid-cols-2">
                <div>
                  <h4 className="mb-2 text-sm font-semibold">Values in this draft</h4>
                  <table className="w-full text-sm">
                    <tbody>
                      {VALUE_FIELDS.map(([field, label]) => (
                        <tr key={field} className="border-b border-border/50">
                          <td className="py-1 pr-3 text-muted-foreground">{label}</td>
                          <td className="py-1 font-mono">{show(draft[field])}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div>
                  <h4 className="mb-2 text-sm font-semibold">Source screenshots</h4>
                  <div className="grid grid-cols-2 gap-2">
                    {draft.screenshots.map((s) => (
                      <a key={s.id} href={s.url} target="_blank" rel="noreferrer" className="block">
                        <img src={s.url} alt={s.kind ?? "screenshot"} className="w-full rounded border border-border" />
                        <span className="text-xs text-muted-foreground">{s.kind ?? "screenshot"}</span>
                      </a>
                    ))}
                    {draft.screenshots.length === 0 && <p className="text-sm text-muted-foreground">None attached.</p>}
                  </div>
                </div>
              </section>

              {/* Diff against the published version (A6) */}
              <section>
                <h4 className="mb-2 text-sm font-semibold">
                  Changes from {published ? `version ${published.version_number}` : "nothing (first version)"} · type: {draft.change_type}
                </h4>
                {diff.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No changes.</p>
                ) : (
                  <table className="w-full table-fixed text-xs">
                    <thead>
                      <tr className="text-left text-muted-foreground">
                        <th className="w-40 py-1">Field</th>
                        <th className="py-1">Before</th>
                        <th className="py-1">After</th>
                      </tr>
                    </thead>
                    <tbody>
                      {diff.map((d) => (
                        <tr key={d.field} className="border-t border-border/50 align-top">
                          <td className="py-1 font-mono">{d.field}</td>
                          <td className="break-all py-1 text-muted-foreground">{show(d.before)}</td>
                          <td className="break-all py-1">{show(d.after)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
                {draft.change_note && <p className="mt-2 text-sm">Note: {draft.change_note}</p>}
              </section>

              <Separator />

              {/* Dual-audience preview (A7) */}
              <section className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <h4 className="text-sm font-semibold">Client preview (Strategy Lab Pro)</h4>
                  <p className="text-sm text-muted-foreground">Opens the strategy as a client will see it after publish.</p>
                  <Button size="sm" variant="outline" onClick={() => setPreviewOpen(true)}>Preview as client</Button>
                </div>
                <div className="space-y-2">
                  <h4 className="text-sm font-semibold">Public preview (Strategy Lab)</h4>
                  <p className="text-sm text-muted-foreground">
                    {draft.listed_public
                      ? "Only these fields reach the public view. Settings, source screenshots and change history never appear."
                      : "Not listed publicly: this strategy will not appear in the public view."}
                  </p>
                  {draft.listed_public && preview && (
                    <div className="max-h-48 overflow-y-auto rounded border border-border p-2">
                      <table className="w-full text-xs">
                        <tbody>
                          {PUBLIC_VIEW_FIELDS.map((f) => (
                            <tr key={f}>
                              <td className="pr-2 font-mono text-muted-foreground">{f}</td>
                              <td className="break-all">{show((preview as unknown as Record<string, unknown>)[f])}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </section>

              {/* The one screenshot that goes public, whole (redesign P1): the
                  reviewer sees it before approving. Read-only. */}
              <section className="space-y-2">
                <h4 className="text-sm font-semibold">Public chart (shown whole on Strategy Lab)</h4>
                {publicChart ? (
                  <>
                    <a href={publicChart.url} target="_blank" rel="noreferrer" className="block overflow-hidden rounded-md border border-border bg-[#131722]">
                      <img src={publicChart.url} alt="The chart screenshot Strategy Lab will show" className="block h-auto w-full" />
                    </a>
                    <p className="text-xs text-muted-foreground">
                      {draft.listed_public
                        ? "Strategy Lab shows this screenshot as uploaded, settings line included. The other screenshots stay in Strategy Lab Pro. If this is not the chart, change the screenshot order (or mark the chart's kind) before approving."
                        : "Not listed publicly, so Strategy Lab will not show it."}
                    </p>
                  </>
                ) : (
                  <p className="text-xs text-muted-foreground">No screenshots: Strategy Lab will show this strategy without a chart.</p>
                )}
              </section>

              <Separator />

              <div className="flex flex-wrap items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => onEdit(group)}>Edit draft</Button>
                {draft.status === "draft" && (
                  <Button size="sm" disabled={!!busy} onClick={() => run("Submit", () => submitForReview(draft.id))}>
                    {busy === "Submit" && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Submit for review
                  </Button>
                )}
                {draft.status === "in_review" && (
                  <Button size="sm" disabled={!canPublish || !!busy} onClick={handlePublish}>
                    {busy === "Publish" && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Publish version {draft.version_number}
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-destructive"
                  disabled={!!busy}
                  onClick={() => run("Discard", () => discardDraft(draft.id))}
                >
                  Discard draft
                </Button>
                {draft.status === "in_review" && !isApprover && (
                  <span className="text-xs text-muted-foreground">Only an approver can publish.</span>
                )}
                {draft.status === "in_review" && isApprover && errors.length > 0 && (
                  <span className="text-xs text-muted-foreground">Clear every error first: edit the draft.</span>
                )}
              </div>
            </div>
          )}

          {/* History (A3) and restore (R6) */}
          <section className="mt-6 space-y-2">
            <h4 className="text-sm font-semibold">Versions</h4>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-muted-foreground">
                  <th>#</th><th>Status</th><th>Type</th><th>Author</th><th>Approver</th><th>Published</th><th />
                </tr>
              </thead>
              <tbody>
                {group.history.map((v) => (
                  <tr key={v.id} className="border-t border-border/50">
                    <td>v{v.version_number}</td>
                    <td>{STATUS_LABEL[v.status]}</td>
                    <td>{v.change_type}</td>
                    <td className="text-xs">{v.created_by}</td>
                    <td className="text-xs">{v.approved_by ?? "—"}</td>
                    <td className="text-xs">{v.published_at ? new Date(v.published_at).toLocaleDateString() : "—"}</td>
                    <td className="text-right">
                      {v.status === "superseded" && role !== "marketing_editor" && (
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={!!draft || !!busy}
                          title={draft ? "Publish or discard the open draft first" : "Copy this version forward for review"}
                          onClick={() => run("Restore", async () => { await restoreVersion(v.id); })}
                        >
                          Restore
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        </DialogContent>
      </Dialog>

      {preview && (
        <StrategyPreviewModal
          strategy={preview}
          open={previewOpen}
          onOpenChange={setPreviewOpen}
        />
      )}
    </>
  );
}
