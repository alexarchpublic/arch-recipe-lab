"use client";
// The account-size view (S4): every dollar figure on the page follows the
// amount the visitor enters, by the shared scaling rule (D3).
import { useEffect, useRef } from "react";
import { track } from "@/lib/analytics";
import { writeVisitor } from "@/lib/visitor";
import { MoneyInput } from "./ui";
import { useVisitor } from "./useVisitor";

export function AccountSize({
  strategy,
  compact = false,
  variant,
}: {
  strategy?: string;
  compact?: boolean;
  /** large: the home "your numbers" card; stacked: label over a 240px field (strategy page). */
  variant?: "compact" | "large" | "stacked";
}) {
  const v = useVisitor();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);
  const mode = variant ?? (compact ? "compact" : "stacked");
  const id = `size-${strategy ?? "list"}-${mode}`;
  return (
    <div className={mode === "compact" ? "flex items-center gap-2" : ""}>
      <label htmlFor={id} className={`block font-bold text-navy ${mode === "compact" ? "whitespace-nowrap text-[13px]" : "text-[13px]"}`}>
        Your account size
      </label>
      <div className={mode === "compact" ? "w-40" : mode === "large" ? "mt-2" : "mt-1.5 w-full sm:w-60"}>
        <MoneyInput
          id={id}
          large={mode === "large"}
          label="Your account size in dollars"
          value={v?.accountSize ?? null}
          onChange={(n) => {
            writeVisitor({ accountSize: n });
            if (timer.current) clearTimeout(timer.current);
            if (n) timer.current = setTimeout(() => track("account_size_used", { strategy: strategy ?? null, amount: Math.round(n) }), 1200);
          }}
        />
      </div>
    </div>
  );
}
