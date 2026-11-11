// One figure, carrying its store field and raw value in the markup so the
// parity check can read it back (R5, D8, section 12).
import type { ReactNode } from "react";

export function Figure({
  label,
  field,
  raw,
  value,
  tone,
  sub,
  className = "",
}: {
  label: string;
  field: string;
  raw: number | string | null;
  value: ReactNode;
  tone?: "gain" | "loss" | null;
  sub?: ReactNode;
  className?: string;
}) {
  const color = tone === "gain" ? "text-gain" : tone === "loss" ? "text-loss" : "text-foreground";
  return (
    <div className={`rounded-md border border-border bg-card px-3 py-2.5 ${className}`}>
      <p className="eyebrow">{label}</p>
      <p className={`mt-1 font-mono text-lg font-semibold tabular-nums ${color}`} data-field={field} data-raw={raw ?? ""}>
        {value}
      </p>
      {sub && <p className="mt-0.5 text-[11px] text-muted-foreground">{sub}</p>}
    </div>
  );
}

export const signedTone = (n: number | null | undefined): "gain" | "loss" | null =>
  n === null || n === undefined ? null : n > 0 ? "gain" : n < 0 ? "loss" : null;
