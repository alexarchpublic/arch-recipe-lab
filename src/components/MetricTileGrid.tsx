import { Children, isValidElement, type ReactNode } from "react";
import { cn } from "@/lib/utils";

type MetricTileGridProps = {
  children: ReactNode;
  className?: string;
};

function isFullWidthTile(child: ReactNode): boolean {
  if (!isValidElement(child)) return false;
  const className = child.props?.className;
  return typeof className === "string" && className.includes("col-span-2");
}

/** Pairs half-width metric tiles; orphans and col-span-2 tiles get a full-width row. */
export function MetricTileGrid({ children, className }: MetricTileGridProps) {
  const items = Children.toArray(children).filter(Boolean);
  const rows: ReactNode[][] = [];
  let row: ReactNode[] = [];

  const flushRow = () => {
    if (row.length) {
      rows.push(row);
      row = [];
    }
  };

  for (const item of items) {
    if (isFullWidthTile(item)) {
      flushRow();
      rows.push([item]);
    } else {
      row.push(item);
      if (row.length === 2) flushRow();
    }
  }
  flushRow();

  return (
    <div className={cn("space-y-3", className)}>
      {rows.map((rowItems, index) => (
        <div
          key={index}
          className={cn("grid gap-3", rowItems.length === 2 ? "grid-cols-2" : "grid-cols-1")}
        >
          {rowItems}
        </div>
      ))}
    </div>
  );
}
