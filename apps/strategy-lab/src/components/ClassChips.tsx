"use client";
// Asset-class chips with live counts ("All 62", "Stocks 39", ...). On the home
// page they are links to the filtered list; on the list page they filter in
// place. Either way a click is a market_filter_used event (redesign PRD 8).
import Link from "@/components/Link";
import { track } from "@/lib/analytics";
import type { ClassCount } from "@/lib/strategies";

const chip = (on: boolean) =>
  `inline-flex min-h-[44px] items-center rounded-full border px-4 text-sm font-bold transition ${
    on ? "border-navy bg-navy text-white" : "border-line-strong bg-card text-navy hover:border-navy"
  }`;

export function ClassChips({ counts, page, active, onSelect }: { counts: ClassCount[]; page: string; active?: string; onSelect?: (value: string) => void }) {
  if (onSelect) {
    return (
      <div className="flex flex-wrap gap-2" role="group" aria-label="Filter by asset class">
        {counts.map((c) => (
          <button
            key={c.value || "all"}
            type="button"
            aria-pressed={(active ?? "") === c.value}
            className={chip((active ?? "") === c.value)}
            onClick={() => {
              track("market_filter_used", { value: c.value || "all", page });
              onSelect(c.value);
            }}
          >
            {c.label} {c.count}
          </button>
        ))}
      </div>
    );
  }
  return (
    <nav className="flex flex-wrap gap-2" aria-label="Strategies by asset class">
      {counts.map((c) => (
        <Link
          key={c.value || "all"}
          href={c.value ? `/strategies?class=${c.value}` : "/strategies"}
          className={chip(false)}
          onClick={() => track("market_filter_used", { value: c.value || "all", page })}
        >
          {c.label} {c.count}
        </Link>
      ))}
    </nav>
  );
}
