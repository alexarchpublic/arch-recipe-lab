import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

export type StatTone = "default" | "gain" | "loss";

type StatTileProps = {
  label: string;
  value: ReactNode;
  tone?: StatTone;
  fullWidth?: boolean;
};

export function signedTone(value: number | null | undefined): StatTone {
  if (value == null || value >= 0) return "default";
  return "loss";
}

export function deltaTone(value: number | null | undefined): StatTone {
  if (value == null || value === 0) return "default";
  return value > 0 ? "gain" : "loss";
}

export function StatTile({ label, value, tone = "default", fullWidth }: StatTileProps) {
  return (
    <div
      className={cn(
        "rounded-md border border-tile-border bg-muted px-2.5 py-2",
        fullWidth && "col-span-2",
      )}
    >
      <p className="eyebrow">{label}</p>
      <div
        className={cn(
          "mt-0.5 font-mono text-sm font-semibold tabular-nums text-foreground",
          tone === "gain" && "text-gain",
          tone === "loss" && "text-destructive",
        )}
      >
        {value}
      </div>
    </div>
  );
}
