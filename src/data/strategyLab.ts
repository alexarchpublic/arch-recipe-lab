// The admin console's link to the public Strategy Lab (PRD R4, R5, A8, S12).
//
// After a publish, an archive or a content change, the console asks Strategy
// Lab to refresh its pages at once, then reads the public page back and
// compares every figure with the version it just published. The result is
// recorded with the parity checks. Strategy Lab also refreshes on its own at
// least every two minutes, so a failed call here delays a page, never loses it.
import { comparePageToStore, parsePageFigures, type PageBlock, type PageProblem } from "@core";

/** Strategy Lab's address, with its /strategy-lab path. Unset: the console skips these steps. */
export const STRATEGY_LAB_URL = ((import.meta.env.VITE_STRATEGY_LAB_URL as string | undefined) ?? "").replace(/\/+$/, "");

async function token(): Promise<string | null> {
  const { supabase } = await import("@/integrations/supabase/client");
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

export async function refreshStrategyLab(scope: "strategies" | "content" | "all" = "all"): Promise<{ ok: boolean; detail: string }> {
  if (!STRATEGY_LAB_URL) return { ok: false, detail: "Strategy Lab's address is not set (VITE_STRATEGY_LAB_URL)." };
  const t = await token();
  if (!t) return { ok: false, detail: "Not signed in." };
  try {
    const res = await fetch(`${STRATEGY_LAB_URL}/api/revalidate`, {
      method: "POST",
      headers: { Authorization: `Bearer ${t}`, "Content-Type": "application/json" },
      body: JSON.stringify({ scope }),
    });
    const body = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
    return res.ok && body.ok ? { ok: true, detail: "Refreshed." } : { ok: false, detail: body.error ?? `HTTP ${res.status}` };
  } catch (e) {
    return { ok: false, detail: e instanceof Error ? e.message : String(e) };
  }
}

export interface PublishedRow {
  strategy_id: string;
  display_number: number | null;
  version_number: number;
  slug: string;
  [field: string]: unknown;
}

export interface PageCheck {
  ok: boolean;
  attempts: number;
  status: number;
  problems: PageProblem[];
  skipped?: string;
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Reads the strategy's public page until it shows the published version, then compares every figure. */
export async function checkPublicPage(row: PublishedRow, { tries = 5, delayMs = 4000 } = {}): Promise<PageCheck> {
  if (!STRATEGY_LAB_URL) return { ok: false, attempts: 0, status: 0, problems: [], skipped: "Strategy Lab's address is not set." };
  const storeRow = { ...row, id: row.strategy_id };
  let last: PageCheck = { ok: false, attempts: 0, status: 0, problems: [] };
  for (let i = 1; i <= tries; i++) {
    try {
      const res = await fetch(`${STRATEGY_LAB_URL}/api/page-check?slug=${encodeURIComponent(row.slug)}`, { cache: "no-store" });
      const body = (await res.json()) as { status: number; blocks: PageBlock[] };
      const blocks = (body.blocks ?? []).filter((b) => b.strategy === row.strategy_id);
      const problems = body.status === 200 ? comparePageToStore(blocks, [storeRow], [row.strategy_id]) : [];
      last = { ok: body.status === 200 && problems.length === 0, attempts: i, status: body.status, problems };
      if (last.ok) return last;
    } catch (e) {
      last = { ok: false, attempts: i, status: 0, problems: [{ check: "page_missing_strategy", strategy: row.display_number, page: String(e) }] };
    }
    if (i < tries) await wait(delayMs);
  }
  return last;
}

export async function recordPageCheck(trigger: string, row: PublishedRow, result: PageCheck): Promise<void> {
  if (result.skipped) return;
  const { supabase } = await import("@/integrations/supabase/client");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase as any).rpc("admin_record_page_parity", {
    p_trigger: trigger,
    p_ok: result.ok,
    p_counts: { strategy: row.display_number, version: row.version_number, page_status: result.status, attempts: result.attempts },
    p_problems: result.problems,
  });
}

/** Everything after a publish: refresh, read back, record. Returns a line for the publisher. */
export async function afterPublish(row: PublishedRow, listedPublic: boolean): Promise<{ ok: boolean; message: string }> {
  if (!STRATEGY_LAB_URL) return { ok: true, message: "Strategy Lab's address is not set here, so the public page was not checked." };
  const refreshed = await refreshStrategyLab("strategies");
  if (!listedPublic) {
    return { ok: refreshed.ok, message: refreshed.ok ? "Strategy Lab refreshed. This strategy is not on the public list." : `Strategy Lab did not refresh: ${refreshed.detail}` };
  }
  const result = await checkPublicPage(row);
  await recordPageCheck("publish", row, result).catch(() => undefined);
  if (result.ok) return { ok: true, message: `Public page shows version ${row.version_number}, every figure matches.` };
  const first = result.problems[0];
  const why = result.status && result.status !== 200 ? `the page returned HTTP ${result.status}` : first ? `${first.check}${first.field ? ` (${first.field})` : ""}` : "no answer";
  return { ok: false, message: `Public page not confirmed after ${result.attempts} tries: ${why}. It refreshes on its own within two minutes; check again from the strategy's menu.` };
}
