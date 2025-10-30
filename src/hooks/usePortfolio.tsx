import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import {
  DEFAULT_BASE_CAPITAL,
  PORTFOLIO_STORAGE_KEY,
  PortfolioPosition,
  PortfolioState,
  PortfolioRecipeSummary,
  ScaledRecipeMetrics,
  computePortfolioAggregates,
  computeScaledMetricsForRecipe,
  normalizeAllocations,
  remainingAllocationPercent,
  OptimizeObjective,
  perDollarYield,
} from "@/lib/portfolio";

type RecipesMap = Record<string, PortfolioRecipeSummary>;

interface PersistedData {
  positions: Record<string, PortfolioPosition>;
  initialCapital: number;
  recipes: RecipesMap;
}

interface PortfolioContextValue {
  // state
  positions: Record<string, PortfolioPosition>;
  initialCapital: number;
  recipes: RecipesMap;

  // derived
  rows: ScaledRecipeMetrics[];
  aggregates: ReturnType<typeof computePortfolioAggregates>;
  remainingPct: number;

  // actions
  setInitialCapital: (value: number) => void;
  toggleRecipe: (recipe: PortfolioRecipeSummary) => void;
  removeRecipe: (recipeId: string) => void;
  isInPortfolio: (recipeId: string) => boolean;
  setAllocation: (recipeId: string, pct: number) => void;
  normalize: () => void;
  clear: () => void;

  // UI hook: called on first add to prompt opening the drawer
  setOnFirstAdd: (cb: (() => void) | null) => void;

  // optimization
  optimizeAllocations: (objective: OptimizeObjective, assetSymbol?: string) => void;
}

const PortfolioContext = createContext<PortfolioContextValue | undefined>(undefined);

function loadPersisted(): PersistedData {
  try {
    const raw = localStorage.getItem(PORTFOLIO_STORAGE_KEY);
    if (!raw) {
      return { positions: {}, initialCapital: 10000, recipes: {} };
    }
    const parsed = JSON.parse(raw);
    return {
      positions: parsed.positions || {},
      initialCapital: Number.isFinite(parsed.initialCapital) ? parsed.initialCapital : 10000,
      recipes: parsed.recipes || {},
    };
  } catch {
    return { positions: {}, initialCapital: 10000, recipes: {} };
  }
}

function persist(data: PersistedData) {
  try {
    localStorage.setItem(PORTFOLIO_STORAGE_KEY, JSON.stringify(data));
  } catch {
    // ignore
  }
}

export function PortfolioProvider({ children }: { children: React.ReactNode }) {
  const [{ positions, initialCapital, recipes }, setState] = useState<PersistedData>(() => loadPersisted());
  const firstAddCallbackRef = useRef<(() => void) | null>(null);

  // persist on change (debounced with microtask batching by React setState)
  useEffect(() => {
    persist({ positions, initialCapital, recipes });
  }, [positions, initialCapital, recipes]);

  const isInPortfolio = useCallback(
    (recipeId: string) => {
      return !!positions[recipeId];
    },
    [positions]
  );

  const toggleRecipe = useCallback(
    (recipe: PortfolioRecipeSummary) => {
      setState(prev => {
        const exists = !!prev.positions[recipe.recipeId];
        if (exists) {
          const { [recipe.recipeId]: _removed, ...rest } = prev.positions;
          const { [recipe.recipeId]: _r, ...restRecipes } = prev.recipes;
          return { ...prev, positions: rest, recipes: restRecipes };
        }
        const nextPositions = {
          ...prev.positions,
          [recipe.recipeId]: { recipeId: recipe.recipeId, allocationPct: 0 },
        };
        const nextRecipes = { ...prev.recipes, [recipe.recipeId]: recipe };

        // Fire first-add callback if transitioning from empty -> 1
        const wasEmpty = Object.keys(prev.positions).length === 0;
        if (wasEmpty && firstAddCallbackRef.current) {
          // invoke after state commit
          queueMicrotask(() => firstAddCallbackRef.current && firstAddCallbackRef.current());
        }

        return { ...prev, positions: nextPositions, recipes: nextRecipes };
      });
    },
    []
  );

  const removeRecipe = useCallback((recipeId: string) => {
    setState(prev => {
      const { [recipeId]: _removed, ...rest } = prev.positions;
      const { [recipeId]: _r, ...restRecipes } = prev.recipes;
      return { ...prev, positions: rest, recipes: restRecipes };
    });
  }, []);

  const setAllocation = useCallback((recipeId: string, pct: number) => {
    setState(prev => {
      const pos = prev.positions[recipeId];
      if (!pos) return prev;
      const requested = Number.isFinite(pct) ? pct : 0;
      const boundedRequested = Math.max(0, Math.min(100, requested));
      // Enforce portfolio-level cap: others + new <= 100
      const othersSum = Object.values(prev.positions)
        .filter(p => p.recipeId !== recipeId)
        .reduce((acc, p) => acc + (Number.isFinite(p.allocationPct) ? p.allocationPct : 0), 0);
      const maxAllowedForThis = Math.max(0, Math.min(100, 100 - othersSum));
      const nextPct = Math.min(boundedRequested, maxAllowedForThis);
      if (nextPct === pos.allocationPct) return prev;
      return {
        ...prev,
        positions: {
          ...prev.positions,
          [recipeId]: { ...pos, allocationPct: nextPct },
        },
      };
    });
  }, []);

  const setInitialCapital = useCallback((value: number) => {
    setState(prev => ({ ...prev, initialCapital: Number.isFinite(value) && value >= 0 ? value : prev.initialCapital }));
  }, []);

  const normalize = useCallback(() => {
    setState(prev => ({ ...prev, positions: normalizeAllocations(prev.positions) }));
  }, []);

  const clear = useCallback(() => {
    setState({ positions: {}, initialCapital: 10000, recipes: {} });
  }, []);

  const setOnFirstAdd = useCallback((cb: (() => void) | null) => {
    firstAddCallbackRef.current = cb;
  }, []);

  const rows: ScaledRecipeMetrics[] = useMemo(() => {
    return Object.values(positions)
      .map(pos => {
        const r = recipes[pos.recipeId];
        return r ? computeScaledMetricsForRecipe(initialCapital, pos, r) : null;
      })
      .filter((x): x is ScaledRecipeMetrics => !!x);
  }, [positions, recipes, initialCapital]);

  const optimizeAllocations = useCallback((objective: OptimizeObjective, assetSymbol?: string) => {
    // Compute yields per row relative to current initialCapital (rows already scaled by allocations)
    // To get per-dollar yield independent of current allocation, temporarily compute using 1% equivalent:
    // But since yields are linear, we can divide current metrics by current capitalAllocated when > 0.
    const candidates = rows
      .map(r => ({ r, y: perDollarYield(r, objective, assetSymbol) }))
      .filter(x => Number.isFinite(x.y));

    if (candidates.length === 0) return;
    // Sort by yield desc, tie-breaker by title then id for determinism
    candidates.sort((a, b) => {
      if (b.y !== a.y) return b.y - a.y;
      if (a.r.title !== b.r.title) return a.r.title.localeCompare(b.r.title);
      return a.r.recipeId.localeCompare(b.r.recipeId);
    });

    const best = candidates[0];
    if (!best || best.y <= 0) return;

    setState(prev => {
      const newPositions: Record<string, PortfolioPosition> = {};
      for (const key of Object.keys(prev.positions)) {
        newPositions[key] = { recipeId: key, allocationPct: key === best.r.recipeId ? 100 : 0 };
      }
      return { ...prev, positions: newPositions };
    });
  }, [rows]);

  const aggregates = useMemo(() => computePortfolioAggregates(rows), [rows]);
  const remainingPct = useMemo(() => remainingAllocationPercent(positions), [positions]);

  const value: PortfolioContextValue = {
    positions,
    initialCapital,
    recipes,
    rows,
    aggregates,
    remainingPct,
    setInitialCapital,
    toggleRecipe,
    removeRecipe,
    isInPortfolio,
    setAllocation,
    normalize,
    clear,
    setOnFirstAdd,
    optimizeAllocations,
  };

  return <PortfolioContext.Provider value={value}>{children}</PortfolioContext.Provider>;
}

export function usePortfolio(): PortfolioContextValue {
  const ctx = useContext(PortfolioContext);
  if (!ctx) throw new Error("usePortfolio must be used within a PortfolioProvider");
  return ctx;
}


