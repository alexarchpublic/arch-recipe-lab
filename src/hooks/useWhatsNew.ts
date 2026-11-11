// New and updated since the client's last visit (P9).
import { useMemo } from "react";
import type { ProStrategy } from "@core";
import { browsable, useProStrategies } from "@/data/proStrategies";
import { usePreferences } from "@/hooks/usePreferences";

/** A version a client would want to hear about: not the Phase 1 baseline copy of what was already live. */
export function isAnnounceable(s: ProStrategy): boolean {
  return s.change_type !== "baseline";
}

export function isNewSince(s: ProStrategy, since: string | null): boolean {
  if (!since || !s.published_at) return false;
  return isAnnounceable(s) && s.published_at > since;
}

export function useWhatsNew() {
  const { data } = useProStrategies();
  const { previousVisitAt } = usePreferences();
  return useMemo(() => {
    const sinceLast = browsable(data).filter((s) => isNewSince(s, previousVisitAt));
    return { sinceLast, count: sinceLast.length, previousVisitAt };
  }, [data, previousVisitAt]);
}
