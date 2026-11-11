// Settings rows in TradingView panel order (P7, P15).
import type { SettingRow } from "@core";
import { cn } from "@/lib/utils";
import { CopyButton } from "./primitives";

export function SettingsList({
  rows,
  copyable = false,
  onCopy,
  className,
}: {
  rows: SettingRow[];
  copyable?: boolean;
  onCopy?: (row: SettingRow) => void;
  className?: string;
}) {
  if (rows.length === 0) {
    return <p className="text-sm text-muted-foreground">No settings recorded for this strategy.</p>;
  }
  const groups: Array<{ section: string; rows: SettingRow[] }> = [];
  for (const r of rows) {
    const last = groups[groups.length - 1];
    if (last && last.section === r.section) last.rows.push(r);
    else groups.push({ section: r.section, rows: [r] });
  }
  return (
    <div className={cn("space-y-5", className)}>
      {groups.map((g, gi) => (
        <div key={`${g.section}-${gi}`}>
          <h3 className="eyebrow mb-2">{g.section}</h3>
          <dl className="divide-y divide-tile-border overflow-hidden rounded-md border border-tile-border bg-card">
            {g.rows.map((r) => (
              <div key={r.key} data-setting={r.key} className="flex items-center gap-3 px-3 py-2">
                <dt className="min-w-0 flex-1 text-sm text-muted-foreground">{r.label}</dt>
                <dd
                  className={cn(
                    "text-right font-mono text-sm font-semibold tabular-nums",
                    r.copy === null && !r.checkbox && "font-sans font-medium text-muted-foreground",
                  )}
                >
                  {r.checkbox ? (
                    <span className="inline-flex items-center gap-1.5 font-sans">
                      <span className="inline-block h-3.5 w-3.5 rounded-[3px] border-2 border-primary bg-primary" aria-hidden />
                      Tick
                    </span>
                  ) : (
                    r.value
                  )}
                  {r.prefilled && <span className="ml-2 font-sans text-[11px] font-semibold text-primary">today</span>}
                </dd>
                {copyable && (
                  <div className="w-[84px] shrink-0 text-right">
                    {r.copy !== null && <CopyButton value={r.copy} size="xs" onCopied={() => onCopy?.(r)} />}
                  </div>
                )}
              </div>
            ))}
          </dl>
        </div>
      ))}
    </div>
  );
}
