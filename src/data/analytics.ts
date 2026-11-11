// Product events for Strategy Lab Pro (PRD section 12).
//
// Events are anonymous, per browser, until the login move; then the dev team
// ties them to the client account here. They go to the Pro GA4 property that
// index.html already loads. No advertising pixels run inside Pro.

export type ProEvent =
  | "strategy_viewed"
  | "portfolio_saved"
  | "apply_started"
  | "setting_copied"
  | "strategy_marked_applied"
  | "portfolio_exported"
  | "portfolio_imported"
  | "portfolio_position_updated";

export type EventProps = Record<string, string | number | boolean | null | undefined>;

type Gtag = (command: "event", name: string, params: Record<string, unknown>) => void;

export function track(event: ProEvent, props: EventProps = {}): void {
  try {
    const gtag = (globalThis as unknown as { gtag?: Gtag }).gtag;
    const params: Record<string, unknown> = { surface: "pro" };
    for (const [k, v] of Object.entries(props)) if (v !== undefined) params[k] = v;
    if (typeof gtag === "function") gtag("event", event, params);
    if (import.meta.env?.DEV) console.debug("[pro event]", event, params);
  } catch {
    // analytics never breaks the app
  }
}

/** Capital in a coarse range, so events carry size without the exact figure. */
export function capitalRange(capital: number): string {
  if (!Number.isFinite(capital) || capital <= 0) return "unknown";
  if (capital < 10_000) return "<10k";
  if (capital < 50_000) return "10k-50k";
  if (capital < 100_000) return "50k-100k";
  if (capital < 250_000) return "100k-250k";
  if (capital < 1_000_000) return "250k-1m";
  return "1m+";
}
