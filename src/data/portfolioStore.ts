// The only module that stores portfolios and applied records (PRD P3, P10, P11, P17).
//
// Portfolios live in this browser until the login move. The interface is
// asynchronous on purpose: at the move the dev team swaps `portfolioStorage`
// for account storage and offers to import what `browserPortfolioStorage`
// holds. No screen touches localStorage for portfolios.
import type { PortfolioRecipeSummary } from "@/lib/portfolio";

export const STORE_KEY = "strategy-lab-pro:portfolios:v2";
/** Where Recipe Lab kept its one portfolio. Read once, never written or removed, so a rollback still finds it. */
export const LEGACY_KEY = "portfolio:v1";
export const EXPORT_FORMAT = "strategy-lab-pro.portfolio";
export const DEFAULT_CAPITAL = 100000;

export interface AppliedRecord {
  /** The version the client applied (P17). Absent only for versions from before Phase 1. */
  versionId?: string;
  versionNumber?: number;
  /** ISO timestamp. */
  at: string;
  capitalAllocated: number;
}

export interface Position {
  strategyId: string;
  allocationPct: number;
  /** The version this position is pinned to (P12). */
  snapshot: PortfolioRecipeSummary;
  addedAt?: string;
  applied?: AppliedRecord | null;
}

export interface Portfolio {
  id: string;
  name: string;
  capital: number;
  positions: Position[];
  createdAt: string;
  updatedAt: string;
}

export interface PortfolioBook {
  schema: 2;
  activeId: string;
  portfolios: Portfolio[];
}

export interface PortfolioStorage {
  load(): Promise<PortfolioBook>;
  save(book: PortfolioBook): Promise<void>;
}

// ---------------------------------------------------------------------------
// Pure helpers
// ---------------------------------------------------------------------------

export function newId(): string {
  try {
    if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  } catch {
    // fall through
  }
  return `p-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function emptyPortfolio(name = "My portfolio", capital = DEFAULT_CAPITAL, now = new Date().toISOString()): Portfolio {
  return { id: newId(), name, capital, positions: [], createdAt: now, updatedAt: now };
}

export function emptyBook(): PortfolioBook {
  const p = emptyPortfolio();
  return { schema: 2, activeId: p.id, portfolios: [p] };
}

const finite = (n: unknown): n is number => typeof n === "number" && Number.isFinite(n);

/**
 * Recipe Lab's saved portfolio, opened unchanged (P11): same strategies, same
 * allocations, same capital, same snapshot of each strategy.
 */
export function migrateV1(raw: string | null, now = new Date().toISOString()): Portfolio | null {
  if (!raw) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== "object") return null;
  const v1 = parsed as {
    positions?: Record<string, { recipeId?: string; allocationPct?: number }>;
    initialCapital?: number;
    recipes?: Record<string, PortfolioRecipeSummary>;
  };
  const recipes = v1.recipes ?? {};
  const positions: Position[] = [];
  for (const [key, pos] of Object.entries(v1.positions ?? {})) {
    const id = pos?.recipeId ?? key;
    const snapshot = recipes[id];
    if (!snapshot) continue;
    positions.push({
      strategyId: id,
      allocationPct: finite(pos?.allocationPct) ? pos.allocationPct : 0,
      snapshot: { ...snapshot, recipeId: id },
    });
  }
  const capital = finite(v1.initialCapital) && v1.initialCapital > 0 ? v1.initialCapital : DEFAULT_CAPITAL;
  if (positions.length === 0 && capital === DEFAULT_CAPITAL) return null;
  return { id: newId(), name: "My portfolio", capital, positions, createdAt: now, updatedAt: now };
}

function sanitizePortfolio(p: unknown): Portfolio | null {
  if (!p || typeof p !== "object") return null;
  const o = p as Partial<Portfolio>;
  if (typeof o.id !== "string" || !Array.isArray(o.positions)) return null;
  const positions = o.positions
    .filter((x): x is Position => !!x && typeof x === "object" && typeof (x as Position).strategyId === "string" && !!(x as Position).snapshot)
    .map((x) => ({ ...x, allocationPct: finite(x.allocationPct) ? Math.max(0, Math.min(100, x.allocationPct)) : 0 }));
  const now = new Date().toISOString();
  return {
    id: o.id,
    name: typeof o.name === "string" && o.name.trim() ? o.name.trim() : "Untitled portfolio",
    capital: finite(o.capital) && o.capital > 0 ? o.capital : DEFAULT_CAPITAL,
    positions,
    createdAt: typeof o.createdAt === "string" ? o.createdAt : now,
    updatedAt: typeof o.updatedAt === "string" ? o.updatedAt : now,
  };
}

/** Reads a stored book; falls back to the Recipe Lab portfolio, then to an empty book. */
export function parseBook(stored: string | null, legacy: string | null): PortfolioBook {
  if (stored) {
    try {
      const parsed = JSON.parse(stored) as Partial<PortfolioBook>;
      if (parsed && parsed.schema === 2 && Array.isArray(parsed.portfolios)) {
        const portfolios = parsed.portfolios.map(sanitizePortfolio).filter((p): p is Portfolio => !!p);
        if (portfolios.length > 0) {
          const activeId = portfolios.some((p) => p.id === parsed.activeId) ? (parsed.activeId as string) : portfolios[0].id;
          return { schema: 2, activeId, portfolios };
        }
        // Every portfolio deleted: start a fresh one, never re-import Recipe Lab's.
        return emptyBook();
      }
    } catch {
      // fall through to the legacy portfolio
    }
  }
  const migrated = migrateV1(legacy);
  if (migrated) return { schema: 2, activeId: migrated.id, portfolios: [migrated] };
  return emptyBook();
}

// ---------------------------------------------------------------------------
// Export and import, to open a portfolio on another device (P10)
// ---------------------------------------------------------------------------

export function exportPortfolio(p: Portfolio, now = new Date().toISOString()): string {
  return JSON.stringify({ format: EXPORT_FORMAT, version: 2, exportedAt: now, portfolio: p }, null, 2);
}

export function exportFileName(p: Portfolio): string {
  const slug = p.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "portfolio";
  return `${slug}.strategy-lab-pro.json`;
}

/** A portfolio from an exported file, with a new id so it never overwrites one already here. */
export function parseImport(text: string, now = new Date().toISOString()): Portfolio {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error("This file is not a Strategy Lab Pro portfolio.");
  }
  const o = parsed as { format?: string; portfolio?: unknown; positions?: unknown };
  if (o?.format === EXPORT_FORMAT) {
    const p = sanitizePortfolio(o.portfolio);
    if (!p) throw new Error("The portfolio in this file could not be read.");
    return { ...p, id: newId(), updatedAt: now };
  }
  // A Recipe Lab portfolio pasted from its storage also opens.
  const legacy = migrateV1(text, now);
  if (legacy) return legacy;
  throw new Error("This file is not a Strategy Lab Pro portfolio.");
}

// ---------------------------------------------------------------------------
// Browser storage
// ---------------------------------------------------------------------------

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

export const browserPortfolioStorage: PortfolioStorage = {
  async load() {
    return parseBook(read(STORE_KEY), read(LEGACY_KEY));
  },
  async save(book) {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(book));
    } catch {
      // Storage full or blocked: the session keeps working in memory.
    }
  },
};

/** The storage the app uses. The login move points this at account storage. */
export const portfolioStorage: PortfolioStorage = browserPortfolioStorage;
