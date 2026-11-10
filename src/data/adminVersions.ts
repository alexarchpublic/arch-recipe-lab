// Admin console data (PRD section 8): every version of every strategy, the
// RPCs that move a version through draft, review and publish, and the
// mappings between a version row, the form and the client preview.
//
// Reads go through public.admin_strategy_versions, which returns rows only to
// signed-in admins. Writes go through the admin_* functions; the database
// checks the caller's role (A1) and computes every derived figure (D3).
import {
  type ProStrategy,
  type PublicStrategy,
  type SourceScreenshot,
  normalizeStrategyRow,
} from "@core";

export type VersionStatus = "draft" | "in_review" | "published" | "superseded" | "archived";
export type CheckLevel = "error" | "review" | "warning";

export interface VersionCheck {
  code: string;
  level: CheckLevel;
  message: string;
}

/** A row of public.admin_strategy_versions. */
export interface AdminVersion extends Omit<ProStrategy, "id" | "strategy_created_at" | "version_id" | "published_at"> {
  id: string; // version id
  strategy_id: string;
  is_current: boolean;
  status: VersionStatus;
  restored_from: string | null;
  extraction_id: string | null;
  test_end_source: "settings" | "chart_last_bar";
  listed_public: boolean;
  net_profit_text: string | null;
  asset_accumulated_text: string | null;
  backtesting_period_text: string | null;
  legacy_cagr: number | null;
  annualized_return: number | null;
  checks: VersionCheck[];
  acknowledged_checks: string[];
  created_by: string;
  created_at: string;
  updated_at: string;
  submitted_by: string | null;
  submitted_at: string | null;
  approved_by: string | null;
  published_at: string | null;
  superseded_at: string | null;
}

export interface StrategyGroup {
  strategyId: string;
  displayNumber: number | null;
  archivedAt: string | null;
  published: AdminVersion | null;
  /** The open draft or version in review, if any. */
  draft: AdminVersion | null;
  /** Every version, newest first. */
  history: AdminVersion[];
}

export interface ParityRun {
  id: number;
  ran_at: string;
  trigger: string;
  ok: boolean;
  counts: Record<string, unknown>;
  problems: Array<Record<string, unknown>>;
}

export type AdminRole = "editor" | "approver" | "marketing_editor";

/** Columns of public.strategies_public, as store.public_view_allowlist() lists them (D7). */
export const PUBLIC_VIEW_FIELDS = [
  "id", "display_number", "version_id", "version_number", "slug", "title", "short_name", "asset",
  "asset_class", "algorithm", "strategy_type", "time_horizon", "focus", "time_frame", "goal", "best_for",
  "how_it_trades", "up_market_behavior", "down_market_behavior", "basis", "starting_capital", "test_start",
  "test_end", "fees_slippage", "data_source", "as_of", "net_profit_usd", "cash_profit_usd", "asset_qty",
  "asset_unit", "buy_hold_pnl_pct", "dca_pnl_pct", "max_drawdown_pct", "benchmark_shown",
  "ending_value_usd", "return_pct", "test_years", "cagr_pct", "vs_buy_hold_pct", "vs_dca_pct",
  "public_chart_url",
] as const;

/** Fields a version may carry from the form (store.editable_fields). */
export const EDITABLE_FIELDS = [
  "basis", "starting_capital", "test_start", "test_end", "test_end_source", "fees_slippage", "data_source",
  "as_of", "net_profit_usd", "cash_profit_usd", "asset_qty", "asset_unit", "buy_hold_pnl_pct", "dca_pnl_pct",
  "max_drawdown_pct", "benchmark_shown",
  "algorithm_inputs", "algorithm", "time_frame", "entry_trade", "exit_trade", "sell_above_cost_basis",
  "exit_to_entry_proportion", "asset",
  "title", "short_name", "goal", "best_for", "how_it_trades", "up_market_behavior", "down_market_behavior",
  "slug", "name", "asset_class", "strategy_type", "time_horizon", "focus", "listed_public",
  "net_profit_text", "asset_accumulated_text", "backtesting_period_text", "annualized_return",
  "change_note", "extraction_id", "public_chart_url",
] as const;

/** Copy fields a marketing editor may change (A10). */
export const COPY_FIELDS = [
  "title", "short_name", "goal", "best_for", "how_it_trades", "up_market_behavior", "down_market_behavior",
  "change_note",
] as const;

/** Fields compared in the review diff (A6), in display order. */
export const DIFF_FIELDS = [
  "title", "short_name", "slug", "goal", "listed_public", "basis", "starting_capital", "test_start", "test_end",
  "test_end_source", "as_of", "net_profit_usd", "cash_profit_usd", "asset_qty", "buy_hold_pnl_pct",
  "dca_pnl_pct", "max_drawdown_pct", "benchmark_shown", "return_pct", "cagr_pct", "vs_buy_hold_pct",
  "vs_dca_pct", "time_frame", "entry_trade", "exit_trade", "algorithm_inputs", "public_chart_url",
] as const;

async function client() {
  // Loaded on use, so the pure helpers below import without a browser.
  const { supabase } = await import("@/integrations/supabase/client");
  return supabase;
}

const EXTRA_NUMERIC = ["legacy_cagr", "annualized_return"] as const;

export function normalizeVersionRow(row: Record<string, unknown>): AdminVersion {
  const v = normalizeStrategyRow(row as unknown as PublicStrategy) as unknown as Record<string, unknown>;
  for (const field of EXTRA_NUMERIC) {
    const value = v[field];
    v[field] = value === null || value === undefined || value === "" ? null : Number(value);
  }
  v.checks = Array.isArray(v.checks) ? v.checks : [];
  v.acknowledged_checks = Array.isArray(v.acknowledged_checks) ? v.acknowledged_checks : [];
  v.screenshots = Array.isArray(v.screenshots)
    ? [...(v.screenshots as SourceScreenshot[])].sort((a, b) => a.order - b.order)
    : [];
  v.algorithm_inputs = (v.algorithm_inputs as Record<string, unknown>) ?? {};
  return v as unknown as AdminVersion;
}

export function groupVersions(rows: AdminVersion[]): StrategyGroup[] {
  const byStrategy = new Map<string, AdminVersion[]>();
  for (const row of rows) {
    const list = byStrategy.get(row.strategy_id) ?? [];
    list.push(row);
    byStrategy.set(row.strategy_id, list);
  }
  const groups: StrategyGroup[] = [];
  for (const [strategyId, list] of byStrategy) {
    list.sort((a, b) => b.version_number - a.version_number);
    const published = list.find((v) => v.status === "published") ?? null;
    const draft = list.find((v) => v.status === "draft" || v.status === "in_review") ?? null;
    groups.push({
      strategyId,
      displayNumber: list[0].display_number ?? null,
      archivedAt: list[0].archived_at ?? null,
      published,
      draft,
      history: list,
    });
  }
  // Newest strategy first, as the console listed them before.
  groups.sort((a, b) => (b.displayNumber ?? 0) - (a.displayNumber ?? 0));
  return groups;
}

export async function fetchStrategyGroups(): Promise<StrategyGroup[]> {
  const supabase = await client();
  const { data, error } = await supabase.from("admin_strategy_versions").select("*");
  if (error) throw error;
  return groupVersions((data ?? []).map((r) => normalizeVersionRow(r as Record<string, unknown>)));
}

export async function fetchLatestParity(): Promise<ParityRun | null> {
  const supabase = await client();
  const { data, error } = await supabase
    .from("admin_parity_runs")
    .select("*")
    .order("id", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return (data as unknown as ParityRun) ?? null;
}

export async function fetchAdminRole(): Promise<AdminRole | null> {
  const supabase = await client();
  const { data, error } = await supabase.rpc("admin_role");
  if (error) throw error;
  return (data as AdminRole | null) ?? null;
}

export async function saveDraft(strategyId: string | null, fields: Record<string, unknown>): Promise<string> {
  const supabase = await client();
  const { data, error } = await supabase.rpc("admin_save_draft", {
    p_strategy: strategyId,
    p_fields: fields as never,
  });
  if (error) throw error;
  return data as string;
}

export async function refreshDraftScreenshots(versionId: string): Promise<void> {
  const supabase = await client();
  const { error } = await supabase.rpc("admin_refresh_draft_screenshots", { p_version: versionId });
  if (error) throw error;
}

export async function submitForReview(versionId: string): Promise<void> {
  const supabase = await client();
  const { error } = await supabase.rpc("admin_submit_for_review", { p_version: versionId });
  if (error) throw error;
}

export async function discardDraft(versionId: string): Promise<void> {
  const supabase = await client();
  const { error } = await supabase.rpc("admin_discard_draft", { p_version: versionId });
  if (error) throw error;
}

export interface PublishResult {
  published: boolean;
  version_id?: string;
  parity_ok?: boolean;
  blocking?: VersionCheck[];
}

export async function publishVersion(versionId: string, acknowledged: string[]): Promise<PublishResult> {
  const supabase = await client();
  const { data, error } = await supabase.rpc("admin_publish", {
    p_version: versionId,
    p_acknowledged: acknowledged,
  });
  if (error) throw error;
  return data as unknown as PublishResult;
}

export async function restoreVersion(versionId: string): Promise<string> {
  const supabase = await client();
  const { data, error } = await supabase.rpc("admin_restore", { p_version: versionId });
  if (error) throw error;
  return data as string;
}

export async function setArchived(strategyId: string, archived: boolean): Promise<void> {
  const supabase = await client();
  const { error } = await supabase.rpc("admin_set_archived", { p_strategy: strategyId, p_archived: archived });
  if (error) throw error;
}

export async function uploadPublicChart(strategyId: string, versionNumber: number, png: Blob): Promise<string> {
  const supabase = await client();
  const path = `${strategyId}/v${versionNumber}.png`;
  const { error } = await supabase.storage
    .from("strategy-public")
    .upload(path, png, { contentType: "image/png", upsert: true, cacheControl: "3600" });
  if (error) throw error;
  const { data } = supabase.storage.from("strategy-public").getPublicUrl(path);
  // A version suffix busts caches when a draft's crop is redone.
  return `${data.publicUrl}?v=${Date.now()}`;
}

// ---------------------------------------------------------------------------
// Pure mappings (tested in tests/adminVersions.test.ts)
// ---------------------------------------------------------------------------

export function countChecks(v: Pick<AdminVersion, "checks"> | null | undefined): Record<CheckLevel, number> {
  const out: Record<CheckLevel, number> = { error: 0, review: 0, warning: 0 };
  for (const c of v?.checks ?? []) out[c.level] = (out[c.level] ?? 0) + 1;
  return out;
}

/** A version as the client app would show it, for the Pro preview (A7). */
export function versionToProStrategy(v: AdminVersion): ProStrategy {
  return {
    ...(v as unknown as ProStrategy),
    id: v.strategy_id,
    version_id: v.id,
    strategy_created_at: v.created_at,
    published_at: v.published_at ?? v.updated_at,
    archived_at: v.archived_at ?? null,
    screenshots: [...(v.screenshots ?? [])].sort((a, b) => a.order - b.order),
  };
}

/** The legacy field names RecipeForm reads, from a version. */
export function versionToFormRecipe(v: AdminVersion): Record<string, unknown> {
  return {
    ...v,
    id: v.strategy_id,
    version_id: v.id,
    initial_capital: v.starting_capital,
    net_profit: v.net_profit_text ?? String(v.net_profit_usd),
    asset_accumulated: v.asset_accumulated_text ?? (v.asset_qty !== null ? String(v.asset_qty) : undefined),
    cash_profit: v.cash_profit_usd ?? undefined,
    backtesting_period: v.backtesting_period_text ?? "N/A",
    buy_hold_pnl_percent: v.buy_hold_pnl_pct,
    dca_pnl_percent: v.dca_pnl_pct,
    cagr: v.legacy_cagr ?? undefined,
    // Version section
    title: v.title,
    short_name: v.short_name,
    slug: v.slug,
    as_of: v.as_of,
    test_end_chart: v.test_end_source === "chart_last_bar" ? v.test_end : "",
    max_drawdown_pct: v.max_drawdown_pct ?? undefined,
    listed_public: v.listed_public,
    change_note: v.status === "draft" || v.status === "in_review" ? v.change_note ?? "" : "",
    extraction_id: v.status === "draft" || v.status === "in_review" ? v.extraction_id : null,
  };
}

/**
 * First number in a free-text money or quantity field, the same rule as
 * store.first_number: "$20,455 (87% from BTC growth)" is 20455, not the
 * digits of the whole string run together.
 */
export function firstNumber(text: string | number | null | undefined): number | null {
  if (text === null || text === undefined) return null;
  if (typeof text === "number") return Number.isFinite(text) ? text : null;
  // A minus sign before the dollar sign counts: "-$656" is -656.
  const m = String(text).match(/(-)?\$?\s*(-?[0-9][0-9,]*(?:\.[0-9]+)?)/);
  if (!m) return null;
  const n = Number(m[2].replace(/,/g, ""));
  if (!Number.isFinite(n)) return null;
  return m[1] && n > 0 ? -n : n;
}

type Parts = { year?: number | null; month?: number | null; day?: number | null } | null | undefined;

/** The settings fields these helpers read; the rest pass through untouched. */
export interface SettingsInputs {
  [key: string]: unknown;
  dates?: { start?: Parts; end?: Parts };
  start?: Parts;
  end?: Parts;
  benchmark?: { showBuyHold?: unknown; showDca?: unknown; [key: string]: unknown };
  showBuyHoldBenchmark?: unknown;
  showDcaBenchmark?: unknown;
}

function partsToIso(p: Parts): string | null {
  if (!p?.year || !p?.month || !p?.day) return null;
  return `${p.year}-${String(p.month).padStart(2, "0")}-${String(p.day).padStart(2, "0")}`;
}

/** The run window typed into TradingView (store.run_start / store.run_end). */
export function runWindow(algorithm: string | null | undefined, inputs: SettingsInputs | null | undefined): {
  start: string | null;
  end: string | null;
} {
  const ai = inputs ?? {};
  if (algorithm === "Intelligence Algorithm") {
    return {
      start: partsToIso(ai.start) ?? partsToIso(ai.dates?.start),
      end: partsToIso(ai.end) ?? partsToIso(ai.dates?.end),
    };
  }
  return {
    start: partsToIso(ai.dates?.start) ?? partsToIso(ai.start),
    end: partsToIso(ai.dates?.end) ?? partsToIso(ai.end),
  };
}

export function todayIso(now = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** True when the settings end date is a far-future run setting (D10, A16). */
export function runEndIsInFuture(algorithm: string | null | undefined, inputs: SettingsInputs | null | undefined, asOf = todayIso()): boolean {
  const { end } = runWindow(algorithm, inputs);
  return !!end && end > asOf;
}

/** Which comparison Recipe Lab displayed for these settings (PRD 13). */
export function benchmarkShownFor(
  algorithm: string | null | undefined,
  inputs: SettingsInputs | null | undefined,
  buyHold: number | null | undefined,
  dca: number | null | undefined,
): "both" | "buy_hold" | "dca" | "none" {
  if (algorithm !== "Market Wave") return "none";
  const ai = inputs ?? {};
  const showBuyHold = !(ai.benchmark?.showBuyHold === false || ai.showBuyHoldBenchmark === false);
  const showDca = ai.benchmark?.showDca === true || ai.showDcaBenchmark === true;
  const bh = showBuyHold && buyHold !== null && buyHold !== undefined;
  const dc = showDca && dca !== null && dca !== undefined;
  if (bh && dc) return "both";
  if (bh) return "buy_hold";
  if (dc) return "dca";
  return "none";
}

export interface FormValues {
  name: string;
  asset_class: string;
  asset: string;
  time_horizon: string;
  focus: string;
  goal: string;
  entry_trade?: string;
  exit_trade?: string;
  sell_above_cost_basis?: boolean;
  exit_to_entry_proportion?: number;
  time_frame?: string;
  backtesting_period?: string;
  initial_capital?: number;
  cash_profit?: number;
  asset_accumulated?: string;
  net_profit?: string;
  algorithm: string;
  algorithm_inputs?: SettingsInputs;
  // Version section
  title?: string;
  short_name?: string;
  slug?: string;
  as_of?: string;
  test_end_chart?: string;
  max_drawdown_pct?: number | null;
  listed_public?: boolean;
  change_note?: string;
}

export interface FieldOptions {
  role: AdminRole | null;
  strategyType: string;
  buyHoldPnlPct: number | null;
  dcaPnlPct: number | null;
  extractionId?: string | null;
}

const blankToNull = (v: string | undefined | null) => (v === undefined || v === null || v.trim() === "" ? null : v.trim());

/**
 * The form's values as fields for admin_save_draft. Only keys the database
 * accepts are sent; a marketing editor sends copy only (A10).
 */
export function formToVersionFields(data: FormValues, opts: FieldOptions): Record<string, unknown> {
  const asOf = blankToNull(data.as_of) ?? todayIso();
  const title = blankToNull(data.title) ?? data.goal;
  const shortName = blankToNull(data.short_name) ?? data.name.replace(/^\s*\[([^\]]+)\]\s*/, "$1 ").trim();

  if (opts.role === "marketing_editor") {
    const copy: Record<string, unknown> = { title, short_name: shortName, goal: data.goal };
    const note = blankToNull(data.change_note);
    if (note) copy.change_note = note;
    return copy;
  }

  const inputs = data.algorithm_inputs ?? {};
  const asset = data.asset.trim().toUpperCase();
  const run = runWindow(data.algorithm, inputs);
  const chartEnd = blankToNull(data.test_end_chart);

  const fields: Record<string, unknown> = {
    name: data.name,
    asset,
    asset_class: data.asset_class,
    algorithm: data.algorithm,
    strategy_type: opts.strategyType,
    time_horizon: data.time_horizon,
    focus: data.focus,
    time_frame: data.time_frame ?? null,
    goal: data.goal,
    title,
    short_name: shortName,
    listed_public: data.listed_public ?? true,
    as_of: asOf,
    starting_capital: data.initial_capital ?? null,
    net_profit_usd: firstNumber(data.net_profit),
    net_profit_text: blankToNull(data.net_profit),
    cash_profit_usd: data.cash_profit ?? null,
    asset_qty: firstNumber(data.asset_accumulated),
    asset_accumulated_text: blankToNull(data.asset_accumulated),
    asset_unit: asset,
    backtesting_period_text: blankToNull(data.backtesting_period),
    buy_hold_pnl_pct: opts.buyHoldPnlPct,
    dca_pnl_pct: opts.dcaPnlPct,
    benchmark_shown: benchmarkShownFor(data.algorithm, inputs, opts.buyHoldPnlPct, opts.dcaPnlPct),
    max_drawdown_pct: data.max_drawdown_pct ?? null,
    entry_trade: data.entry_trade ?? null,
    exit_trade: data.exit_trade ?? null,
    sell_above_cost_basis: data.sell_above_cost_basis ?? null,
    exit_to_entry_proportion: data.exit_to_entry_proportion ?? null,
    algorithm_inputs: inputs,
  };
  if (run.start) fields.test_start = run.start;
  // The test end is the last bar on the chart when the run end is a
  // far-future setting (D10, A16); otherwise it is the run end.
  if (chartEnd) {
    fields.test_end = chartEnd;
    fields.test_end_source = "chart_last_bar";
  } else if (run.end) {
    fields.test_end = run.end;
    fields.test_end_source = "settings";
  }
  const slug = blankToNull(data.slug);
  if (slug) fields.slug = slug;
  const note = blankToNull(data.change_note);
  if (note) fields.change_note = note;
  if (opts.extractionId) fields.extraction_id = opts.extractionId;

  for (const key of Object.keys(fields)) {
    if (!(EDITABLE_FIELDS as readonly string[]).includes(key)) delete fields[key];
  }
  return fields;
}

/** Old → new for the review diff (A6). */
export function diffVersions(
  published: AdminVersion | null,
  draft: AdminVersion,
): Array<{ field: string; before: unknown; after: unknown }> {
  const out: Array<{ field: string; before: unknown; after: unknown }> = [];
  for (const field of DIFF_FIELDS) {
    const before = published ? (published as unknown as Record<string, unknown>)[field] : undefined;
    const after = (draft as unknown as Record<string, unknown>)[field];
    if (JSON.stringify(before ?? null) !== JSON.stringify(after ?? null)) {
      out.push({ field, before, after });
    }
  }
  return out;
}

/** The strategy a version belongs to (a new strategy's id after its first save). */
export async function strategyIdForVersion(versionId: string): Promise<string> {
  const supabase = await client();
  const { data, error } = await supabase
    .from("admin_strategy_versions")
    .select("strategy_id")
    .eq("id", versionId)
    .single();
  if (error) throw error;
  return (data as { strategy_id: string }).strategy_id;
}
