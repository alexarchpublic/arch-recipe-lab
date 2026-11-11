// The disclosure components both front ends import (PRD C1, C2, S8, P5).
//
// Every results block carries the basis label and a disclaimer slot. The
// slot's wording is stored in the database and set in the admin console, so
// counsel's text goes live without a deploy (C2). Until it loads, or if it
// cannot be read, the slot shows DEFAULT_DISCLAIMER.
import type { ReactNode } from "react";
import { type PublicStrategy, basisLabel, formatDate } from "./strategy";

/** Where a disclaimer is shown. One row per key in public.disclosures. */
export type DisclosureKey = "results";

/** Shown until counsel's wording is set in the admin console. Taken from the site footer live in November 2026. */
export const DEFAULT_DISCLAIMER = "Past and backtested performance does not guarantee future results.";

export const DISCLOSURE_KEYS: Array<{ key: DisclosureKey; label: string; help: string }> = [
  {
    key: "results",
    label: "Results disclaimer",
    help: "Shown beside every results block in Strategy Lab Pro and, from Phase 3, Strategy Lab.",
  },
];

function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}

/** "Backtested results" or "Live results" (C1). */
export function BasisLabel({ basis, className }: { basis: PublicStrategy["basis"]; className?: string }) {
  return (
    <span
      data-disclosure="basis"
      data-basis={basis}
      className={cx(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-bold uppercase tracking-[0.06em]",
        basis === "live" ? "border-gain/40 text-gain" : "border-warn/50 text-[hsl(37_80%_32%)] dark:text-warn",
        className,
      )}
    >
      {basisLabel({ basis })}
    </span>
  );
}

/** The slot counsel's wording drops into (C2). */
export function DisclaimerSlot({ text, className }: { text?: string | null; className?: string }) {
  return (
    <p data-disclosure="disclaimer" className={cx("text-xs leading-relaxed text-muted-foreground", className)}>
      {text?.trim() || DEFAULT_DISCLAIMER}
    </p>
  );
}

/**
 * The line that travels with every results block: basis, test window and
 * starting capital (C1, C3), then the disclaimer slot (C2).
 */
export function ResultsDisclosure({
  strategy,
  disclaimer,
  compact = false,
  children,
  className,
}: {
  strategy: Pick<PublicStrategy, "basis" | "as_of">;
  disclaimer?: string | null;
  compact?: boolean;
  /** Assumptions shown between the label and the disclaimer, e.g. the test window. */
  children?: ReactNode;
  className?: string;
}) {
  return (
    <div data-disclosure="results" className={cx(compact ? "space-y-1" : "space-y-2", className)}>
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
        <BasisLabel basis={strategy.basis} />
        {children}
        {!compact && strategy.as_of && <span>As of {formatDate(strategy.as_of)}</span>}
      </div>
      <DisclaimerSlot text={disclaimer} className={compact ? "line-clamp-2 text-[11px]" : undefined} />
    </div>
  );
}
