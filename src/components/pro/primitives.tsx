import { useEffect, useState } from "react";
import { Check, Copy } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

/** A dollar amount typed by the client; reports only positive numbers. */
export function CapitalInput({
  value,
  onChange,
  id,
  className,
  "aria-label": ariaLabel,
}: {
  value: number;
  onChange: (n: number) => void;
  id?: string;
  className?: string;
  "aria-label"?: string;
}) {
  const fmt = (n: number) => (Number.isFinite(n) && n > 0 ? Math.round(n).toLocaleString("en-US") : "");
  const [text, setText] = useState(fmt(value));
  useEffect(() => setText(fmt(value)), [value]);
  return (
    <div className={cn("relative", className)}>
      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 font-mono text-sm text-muted-foreground">$</span>
      <Input
        id={id}
        aria-label={ariaLabel}
        inputMode="numeric"
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          const n = parseFloat(e.target.value.replace(/[^0-9.]/g, ""));
          if (Number.isFinite(n) && n > 0) onChange(n);
        }}
        onBlur={() => setText(fmt(value))}
        placeholder="100,000"
        className="pl-7 font-mono tabular-nums"
      />
    </div>
  );
}

/** Copies a value and confirms in place (P15). */
export function CopyButton({
  value,
  label = "Copy",
  onCopied,
  className,
  size = "sm",
}: {
  value: string;
  label?: string;
  onCopied?: () => void;
  className?: string;
  size?: "sm" | "xs";
}) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      onClick={async (e) => {
        e.stopPropagation();
        try {
          await navigator.clipboard.writeText(value);
        } catch {
          // Clipboard blocked: select-and-copy still works on the value beside the button.
          return;
        }
        setDone(true);
        onCopied?.();
        setTimeout(() => setDone(false), 1400);
      }}
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 rounded-md border font-semibold transition-colors",
        size === "sm" ? "h-8 px-2.5 text-xs" : "h-7 px-2 text-[11px]",
        done
          ? "border-gain/50 bg-gain/10 text-gain"
          : "border-border bg-card text-foreground hover:border-border-strong hover:bg-secondary",
        className,
      )}
      aria-label={`${label}: ${value}`}
    >
      {done ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
      {done ? "Copied" : label}
    </button>
  );
}

export function focusPillClass(focus?: string | null): string {
  switch (focus) {
    case "Cash Yielding":
      return "bg-primary text-primary-foreground hover:bg-primary";
    case "Accumulation":
      return "bg-navy text-white hover:bg-navy";
    case "Balanced":
      return "bg-muted text-foreground border-border hover:bg-muted";
    default:
      return "bg-muted text-muted-foreground";
  }
}

export function horizonLabel(h?: string | null): string {
  return h === "STH" ? "Short term" : h === "LTH" ? "Long term" : h ?? "";
}

/** The chips that identify a strategy: number, asset, focus, horizon. */
export function StrategyChips({
  displayNumber,
  asset,
  focus,
  horizon,
  assetClass,
  className,
}: {
  displayNumber?: number | null;
  asset: string;
  focus?: string | null;
  horizon?: string | null;
  assetClass?: string | null;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-wrap items-center gap-1.5", className)}>
      {typeof displayNumber === "number" && <Badge variant="chip">#{displayNumber}</Badge>}
      <Badge variant="chip">{asset}</Badge>
      {assetClass && <Badge variant="outline">{assetClass}</Badge>}
      {focus && <Badge className={focusPillClass(focus)}>{focus}</Badge>}
      {horizon && (
        <Badge variant="outline" className="rounded-full">
          {horizonLabel(horizon)}
        </Badge>
      )}
    </div>
  );
}

export function SectionHeading({ children, className, id }: { children: React.ReactNode; className?: string; id?: string }) {
  return (
    <h2 id={id} className={cn("eyebrow mb-3 text-primary", className)}>
      {children}
    </h2>
  );
}

export function EmptyState({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-dashed border-border-strong bg-card px-6 py-10 text-center">
      <p className="text-base font-extrabold tracking-[-0.02em]">{title}</p>
      {children && <div className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">{children}</div>}
    </div>
  );
}
