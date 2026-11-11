"use client";
// The account-size view (S4): every dollar figure on the page follows the
// amount the visitor enters, by the shared scaling rule (D3).
import { useEffect, useRef } from "react";
import { track } from "@/lib/analytics";
import { writeVisitor } from "@/lib/visitor";
import { MoneyInput } from "./ui";
import { useVisitor } from "./useVisitor";

export function AccountSize({ strategy, compact = false }: { strategy?: string; compact?: boolean }) {
  const v = useVisitor();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);
  return (
    <div className={compact ? "flex items-center gap-2" : "space-y-1"}>
      <label htmlFor={`size-${strategy ?? "list"}`} className={compact ? "whitespace-nowrap text-xs font-bold" : "text-xs font-bold"}>
        Your account size
      </label>
      <div className={compact ? "w-36" : "max-w-xs"}>
        <MoneyInput
          id={`size-${strategy ?? "list"}`}
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
