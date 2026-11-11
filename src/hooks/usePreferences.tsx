import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import {
  type BrowseFilters,
  type Preferences,
  type SortOption,
  DEFAULT_FILTERS,
  loadPreferences,
  savePreferences,
  startVisit,
} from "@/data/preferences";

interface PreferencesContextValue extends Preferences {
  /** When the previous visit started, read once as this visit began (P9). */
  previousVisitAt: string | null;
  setFilters: (f: BrowseFilters) => void;
  resetFilters: () => void;
  setSort: (s: SortOption) => void;
  setViewCapital: (n: number) => void;
  toggleCompare: (strategyId: string) => void;
  clearCompare: () => void;
  dismiss: (noticeId: string) => void;
  isDismissed: (noticeId: string) => boolean;
}

const Ctx = createContext<PreferencesContextValue | undefined>(undefined);

export const MAX_COMPARE = 4;

export function PreferencesProvider({ children }: { children: React.ReactNode }) {
  const [previousVisitAt] = useState<string | null>(() => startVisit());
  const [prefs, setPrefs] = useState<Preferences>(() => loadPreferences());

  useEffect(() => {
    // Visit stamps belong to startVisit and touchVisit; everything else comes from state.
    const stored = loadPreferences();
    savePreferences({ ...prefs, lastVisitAt: stored.lastVisitAt, lastSeenAt: stored.lastSeenAt });
  }, [prefs]);

  const setFilters = useCallback((filters: BrowseFilters) => setPrefs((p) => ({ ...p, filters })), []);
  const resetFilters = useCallback(
    () => setPrefs((p) => ({ ...p, filters: { ...DEFAULT_FILTERS, assetClasses: [...DEFAULT_FILTERS.assetClasses] } })),
    [],
  );
  const setSort = useCallback((sort: SortOption) => setPrefs((p) => ({ ...p, sort })), []);
  const setViewCapital = useCallback(
    (n: number) => setPrefs((p) => (Number.isFinite(n) && n > 0 ? { ...p, viewCapital: n } : p)),
    [],
  );
  const toggleCompare = useCallback(
    (id: string) =>
      setPrefs((p) => {
        if (p.compare.includes(id)) return { ...p, compare: p.compare.filter((x) => x !== id) };
        if (p.compare.length >= MAX_COMPARE) return p;
        return { ...p, compare: [...p.compare, id] };
      }),
    [],
  );
  const clearCompare = useCallback(() => setPrefs((p) => ({ ...p, compare: [] })), []);
  const dismiss = useCallback(
    (id: string) => setPrefs((p) => (p.dismissed.includes(id) ? p : { ...p, dismissed: [...p.dismissed, id] })),
    [],
  );
  const isDismissed = useCallback((id: string) => prefs.dismissed.includes(id), [prefs.dismissed]);

  const value = useMemo(
    () => ({
      ...prefs,
      previousVisitAt,
      setFilters,
      resetFilters,
      setSort,
      setViewCapital,
      toggleCompare,
      clearCompare,
      dismiss,
      isDismissed,
    }),
    [prefs, previousVisitAt, setFilters, resetFilters, setSort, setViewCapital, toggleCompare, clearCompare, dismiss, isDismissed],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function usePreferences(): PreferencesContextValue {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("usePreferences must be used within a PreferencesProvider");
  return ctx;
}
