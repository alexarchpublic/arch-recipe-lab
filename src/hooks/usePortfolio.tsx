// Portfolios for the screens (PRD P10 to P17). State lives here; storage goes
// through src/data/portfolioStore (P3), never localStorage directly.
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import {
  type PortfolioAggregates,
  type PortfolioRecipeSummary,
  type ScaledRecipeMetrics,
  computePortfolioAggregates,
  computeScaledMetricsForRecipe,
  normalizeAllocations,
  remainingAllocationPercent,
} from "@/lib/portfolio";
import {
  type AppliedRecord,
  type Portfolio,
  type PortfolioBook,
  type Position,
  emptyBook,
  emptyPortfolio,
  exportPortfolio as serializePortfolio,
  parseImport,
  portfolioStorage,
} from "@/data/portfolioStore";
import { capitalRange, track } from "@/data/analytics";

interface PortfolioContextValue {
  ready: boolean;
  portfolios: Portfolio[];
  active: Portfolio;
  activeId: string;

  // derived for the active portfolio
  rows: ScaledRecipeMetrics[];
  aggregates: PortfolioAggregates;
  remainingPct: number;

  // portfolio list
  setActive: (id: string) => void;
  createPortfolio: (name?: string) => string;
  renamePortfolio: (id: string, name: string) => void;
  duplicatePortfolio: (id: string) => string;
  deletePortfolio: (id: string) => void;
  exportPortfolio: (id: string) => string;
  importPortfolio: (text: string) => Portfolio;

  // the active portfolio
  setCapital: (value: number) => void;
  isInPortfolio: (strategyId: string) => boolean;
  addStrategy: (summary: PortfolioRecipeSummary) => void;
  toggleStrategy: (summary: PortfolioRecipeSummary) => void;
  removeStrategy: (strategyId: string) => void;
  setAllocation: (strategyId: string, pct: number) => void;
  splitEvenly: () => void;
  normalize: () => void;
  clearPositions: () => void;
  /** Re-pins a position to the current version (P12). Keeps the allocation and the applied record. */
  updatePosition: (strategyId: string, summary: PortfolioRecipeSummary) => void;
  markApplied: (strategyId: string, record: Omit<AppliedRecord, "at"> & { at?: string }) => void;
  clearApplied: (strategyId: string) => void;
  positionsOf: (portfolioId?: string) => Position[];
}

const PortfolioContext = createContext<PortfolioContextValue | undefined>(undefined);

const now = () => new Date().toISOString();

export function PortfolioProvider({ children }: { children: React.ReactNode }) {
  const [book, setBook] = useState<PortfolioBook>(() => emptyBook());
  const [ready, setReady] = useState(false);
  const loaded = useRef(false);

  useEffect(() => {
    let cancelled = false;
    portfolioStorage.load().then((b) => {
      if (cancelled) return;
      loaded.current = true;
      setBook(b);
      setReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (loaded.current) void portfolioStorage.save(book);
  }, [book]);

  const active = useMemo(
    () => book.portfolios.find((p) => p.id === book.activeId) ?? book.portfolios[0],
    [book],
  );

  /** Applies a change to one portfolio and stamps it. */
  const updatePortfolio = useCallback((id: string, fn: (p: Portfolio) => Portfolio) => {
    setBook((prev) => ({
      ...prev,
      portfolios: prev.portfolios.map((p) => (p.id === id ? { ...fn(p), updatedAt: now() } : p)),
    }));
  }, []);

  const updateActive = useCallback(
    (fn: (p: Portfolio) => Portfolio) => {
      setBook((prev) => {
        const id = prev.portfolios.some((p) => p.id === prev.activeId) ? prev.activeId : prev.portfolios[0]?.id;
        return { ...prev, portfolios: prev.portfolios.map((p) => (p.id === id ? { ...fn(p), updatedAt: now() } : p)) };
      });
    },
    [],
  );

  // A save event per portfolio change, debounced, carrying versions and allocations (section 12).
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const firstRender = useRef(true);
  useEffect(() => {
    if (!ready) return;
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      if (!active || active.positions.length === 0) return;
      track("portfolio_saved", {
        portfolio_id: active.id,
        positions: active.positions.length,
        strategies: active.positions.map((p) => `${p.snapshot.display_number ?? p.strategyId}@v${p.snapshot.versionNumber ?? "?"}`).join(","),
        allocations: active.positions.map((p) => Math.round(p.allocationPct)).join(","),
        capital_range: capitalRange(active.capital),
      });
    }, 1500);
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [active, ready]);

  const setActive = useCallback((id: string) => {
    setBook((prev) => (prev.portfolios.some((p) => p.id === id) ? { ...prev, activeId: id } : prev));
  }, []);

  const createPortfolio = useCallback((name?: string) => {
    let id = "";
    setBook((prev) => {
      const p = emptyPortfolio(name?.trim() || `Portfolio ${prev.portfolios.length + 1}`);
      id = p.id;
      return { ...prev, activeId: p.id, portfolios: [...prev.portfolios, p] };
    });
    return id;
  }, []);

  const renamePortfolio = useCallback(
    (id: string, name: string) => updatePortfolio(id, (p) => ({ ...p, name: name.trim() || p.name })),
    [updatePortfolio],
  );

  const duplicatePortfolio = useCallback((id: string) => {
    let newIdValue = "";
    setBook((prev) => {
      const src = prev.portfolios.find((p) => p.id === id);
      if (!src) return prev;
      const copy = emptyPortfolio(`${src.name} (copy)`, src.capital);
      copy.positions = src.positions.map((pos) => ({ ...pos, applied: null }));
      newIdValue = copy.id;
      return { ...prev, activeId: copy.id, portfolios: [...prev.portfolios, copy] };
    });
    return newIdValue;
  }, []);

  const deletePortfolio = useCallback((id: string) => {
    setBook((prev) => {
      const rest = prev.portfolios.filter((p) => p.id !== id);
      if (rest.length === 0) {
        const fresh = emptyPortfolio();
        return { ...prev, activeId: fresh.id, portfolios: [fresh] };
      }
      return { ...prev, activeId: prev.activeId === id ? rest[0].id : prev.activeId, portfolios: rest };
    });
  }, []);

  const exportPortfolio = useCallback(
    (id: string) => {
      const p = book.portfolios.find((x) => x.id === id);
      if (!p) throw new Error("Portfolio not found.");
      track("portfolio_exported", { portfolio_id: p.id, positions: p.positions.length });
      return serializePortfolio(p);
    },
    [book],
  );

  const importPortfolio = useCallback((text: string) => {
    const p = parseImport(text);
    setBook((prev) => {
      const taken = new Set(prev.portfolios.map((x) => x.name));
      const name = taken.has(p.name) ? `${p.name} (imported)` : p.name;
      return { ...prev, activeId: p.id, portfolios: [...prev.portfolios, { ...p, name }] };
    });
    track("portfolio_imported", { positions: p.positions.length });
    return p;
  }, []);

  const setCapital = useCallback(
    (value: number) => {
      if (!Number.isFinite(value) || value <= 0) return;
      updateActive((p) => ({ ...p, capital: value }));
    },
    [updateActive],
  );

  const isInPortfolio = useCallback(
    (strategyId: string) => !!active?.positions.some((p) => p.strategyId === strategyId),
    [active],
  );

  const addStrategy = useCallback(
    (summary: PortfolioRecipeSummary) =>
      updateActive((p) =>
        p.positions.some((x) => x.strategyId === summary.recipeId)
          ? p
          : { ...p, positions: [...p.positions, { strategyId: summary.recipeId, allocationPct: 0, snapshot: summary, addedAt: now() }] },
      ),
    [updateActive],
  );

  const removeStrategy = useCallback(
    (strategyId: string) => updateActive((p) => ({ ...p, positions: p.positions.filter((x) => x.strategyId !== strategyId) })),
    [updateActive],
  );

  const toggleStrategy = useCallback(
    (summary: PortfolioRecipeSummary) => {
      if (isInPortfolio(summary.recipeId)) removeStrategy(summary.recipeId);
      else addStrategy(summary);
    },
    [isInPortfolio, addStrategy, removeStrategy],
  );

  const setAllocation = useCallback(
    (strategyId: string, pct: number) =>
      updateActive((p) => {
        const requested = Math.max(0, Math.min(100, Number.isFinite(pct) ? pct : 0));
        const others = p.positions.filter((x) => x.strategyId !== strategyId).reduce((a, x) => a + (x.allocationPct || 0), 0);
        const next = Math.min(requested, Math.max(0, 100 - others));
        return { ...p, positions: p.positions.map((x) => (x.strategyId === strategyId ? { ...x, allocationPct: +next.toFixed(4) } : x)) };
      }),
    [updateActive],
  );

  const splitEvenly = useCallback(
    () =>
      updateActive((p) => {
        const n = p.positions.length;
        if (n === 0) return p;
        const each = Math.floor((100 / n) * 100) / 100;
        return { ...p, positions: p.positions.map((x, i) => ({ ...x, allocationPct: i === n - 1 ? +(100 - each * (n - 1)).toFixed(2) : each })) };
      }),
    [updateActive],
  );

  const normalize = useCallback(
    () =>
      updateActive((p) => {
        const map = Object.fromEntries(p.positions.map((x) => [x.strategyId, { recipeId: x.strategyId, allocationPct: x.allocationPct }]));
        const n = normalizeAllocations(map);
        return { ...p, positions: p.positions.map((x) => ({ ...x, allocationPct: n[x.strategyId]?.allocationPct ?? x.allocationPct })) };
      }),
    [updateActive],
  );

  const clearPositions = useCallback(() => updateActive((p) => ({ ...p, positions: [] })), [updateActive]);

  const updatePosition = useCallback(
    (strategyId: string, summary: PortfolioRecipeSummary) =>
      updateActive((p) => ({
        ...p,
        positions: p.positions.map((x) =>
          x.strategyId === strategyId
            ? {
                ...x,
                snapshot: summary,
                // The applied record keeps the version that was applied (P17), so
                // the screen can say the pinned version has not been applied yet.
                applied: x.applied ?? null,
              }
            : x,
        ),
      })),
    [updateActive],
  );

  const markApplied = useCallback(
    (strategyId: string, record: Omit<AppliedRecord, "at"> & { at?: string }) =>
      updateActive((p) => ({
        ...p,
        positions: p.positions.map((x) => (x.strategyId === strategyId ? { ...x, applied: { ...record, at: record.at ?? now() } } : x)),
      })),
    [updateActive],
  );

  const clearApplied = useCallback(
    (strategyId: string) =>
      updateActive((p) => ({ ...p, positions: p.positions.map((x) => (x.strategyId === strategyId ? { ...x, applied: null } : x)) })),
    [updateActive],
  );

  const positionsOf = useCallback(
    (portfolioId?: string) => (book.portfolios.find((p) => p.id === (portfolioId ?? book.activeId)) ?? active)?.positions ?? [],
    [book, active],
  );

  const rows = useMemo(
    () =>
      (active?.positions ?? []).map((pos) =>
        computeScaledMetricsForRecipe(active.capital, { recipeId: pos.strategyId, allocationPct: pos.allocationPct }, pos.snapshot),
      ),
    [active],
  );
  const aggregates = useMemo(() => computePortfolioAggregates(rows), [rows]);
  const remainingPct = useMemo(
    () =>
      remainingAllocationPercent(
        Object.fromEntries((active?.positions ?? []).map((x) => [x.strategyId, { recipeId: x.strategyId, allocationPct: x.allocationPct }])),
      ),
    [active],
  );

  const value: PortfolioContextValue = {
    ready,
    portfolios: book.portfolios,
    active,
    activeId: active?.id,
    rows,
    aggregates,
    remainingPct,
    setActive,
    createPortfolio,
    renamePortfolio,
    duplicatePortfolio,
    deletePortfolio,
    exportPortfolio,
    importPortfolio,
    setCapital,
    isInPortfolio,
    addStrategy,
    toggleStrategy,
    removeStrategy,
    setAllocation,
    splitEvenly,
    normalize,
    clearPositions,
    updatePosition,
    markApplied,
    clearApplied,
    positionsOf,
  };

  return <PortfolioContext.Provider value={value}>{children}</PortfolioContext.Provider>;
}

export function usePortfolio(): PortfolioContextValue {
  const ctx = useContext(PortfolioContext);
  if (!ctx) throw new Error("usePortfolio must be used within a PortfolioProvider");
  return ctx;
}
