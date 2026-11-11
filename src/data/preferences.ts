// Browser preferences for Strategy Lab Pro: filters (P6), the capital figures
// are shown at, the last visit (P9), compare picks (P8) and dismissed notices.
// They stay in the browser after the login move; nothing here is account data.
// No screen reads localStorage directly (P3).
import { DEFAULT_ASSET_CLASSES } from "@/lib/algorithms";

const KEY = "strategy-lab-pro:prefs:v1";
const LEGACY_PORTFOLIO_KEY = "portfolio:v1";

export interface BrowseFilters {
  assetClasses: string[];
  assets: string[];
  focuses: string[];
  timeHorizons: string[];
  algorithms: string[];
  minCAGR: number;
}

export type SortOption =
  | "latest" | "cagr-desc" | "cagr-asc" | "cash-profit-desc" | "cash-profit-asc"
  | "asset-accumulated-desc" | "asset-accumulated-asc" | "net-profit-desc" | "net-profit-asc"
  | "pnl-desc" | "pnl-asc";

export interface Preferences {
  filters: BrowseFilters;
  sort: SortOption;
  viewCapital: number;
  /** When the client was last here before this visit; what was published after it is "new" (P9). */
  lastVisitAt: string | null;
  /** Last activity, so a reload within a visit does not start a new one. */
  lastSeenAt: string | null;
  compare: string[];
  dismissed: string[];
}

export const DEFAULT_FILTERS: BrowseFilters = {
  assetClasses: [...DEFAULT_ASSET_CLASSES],
  assets: [],
  focuses: [],
  timeHorizons: [],
  algorithms: [],
  minCAGR: 0,
};

function legacyCapital(): number | null {
  try {
    const raw = localStorage.getItem(LEGACY_PORTFOLIO_KEY);
    const n = raw ? JSON.parse(raw)?.initialCapital : null;
    return typeof n === "number" && Number.isFinite(n) && n > 0 ? n : null;
  } catch {
    return null;
  }
}

function defaults(): Preferences {
  return {
    filters: { ...DEFAULT_FILTERS, assetClasses: [...DEFAULT_FILTERS.assetClasses] },
    sort: "latest",
    // Recipe Lab shared one capital between browsing and the portfolio.
    viewCapital: legacyCapital() ?? 100000,
    lastVisitAt: null,
    lastSeenAt: null,
    compare: [],
    dismissed: [],
  };
}

export function loadPreferences(): Preferences {
  const d = defaults();
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return d;
    const p = JSON.parse(raw) as Partial<Preferences>;
    return {
      filters: { ...d.filters, ...(p.filters ?? {}) },
      sort: p.sort ?? d.sort,
      viewCapital: typeof p.viewCapital === "number" && p.viewCapital > 0 ? p.viewCapital : d.viewCapital,
      lastVisitAt: typeof p.lastVisitAt === "string" ? p.lastVisitAt : null,
      lastSeenAt: typeof p.lastSeenAt === "string" ? p.lastSeenAt : null,
      compare: Array.isArray(p.compare) ? p.compare.slice(0, 4) : [],
      dismissed: Array.isArray(p.dismissed) ? p.dismissed : [],
    };
  } catch {
    return d;
  }
}

export function savePreferences(p: Preferences): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(p));
  } catch {
    // blocked storage: preferences last for this visit only
  }
}

/** A visit ends after this long without activity. */
export const VISIT_GAP_MS = 30 * 60 * 1000;

/**
 * Starts or resumes a visit and returns the moment "new since your last
 * visit" compares against: when the client was last active before this visit.
 */
export function startVisit(now = new Date()): string | null {
  const p = loadPreferences();
  const lastSeen = p.lastSeenAt ? Date.parse(p.lastSeenAt) : NaN;
  const sameVisit = Number.isFinite(lastSeen) && now.getTime() - lastSeen < VISIT_GAP_MS;
  const previous = sameVisit ? p.lastVisitAt : p.lastSeenAt;
  savePreferences({ ...p, lastVisitAt: previous, lastSeenAt: now.toISOString() });
  return previous;
}

/** Records activity, so the visit continues. */
export function touchVisit(now = new Date()): void {
  const p = loadPreferences();
  savePreferences({ ...p, lastSeenAt: now.toISOString() });
}
