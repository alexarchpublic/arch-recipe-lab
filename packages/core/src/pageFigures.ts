// The public page check (PRD R5, D8, section 12): every figure on a public
// page carries its store field, its version and its raw value in the markup.
// These functions read that markup back and compare it with the store. The
// admin console uses them after a publish, and scripts/parity-pages.mjs runs
// the same comparison daily against the live site.

/** One results block as the page printed it. */
export interface PageBlock {
  strategy: string;
  version: string; // "v3"
  fields: Record<string, string>; // field -> raw value as printed
}

const BLOCK = /<[^>]*\bdata-results="([^"]+)"[^>]*>/g;
const FIELD = /<[^>]*\bdata-field="([a-z_]+)"[^>]*\bdata-raw="([^"]*)"[^>]*>/g;
const attr = (tag: string, name: string): string | null => {
  const m = tag.match(new RegExp(`\\b${name}="([^"]*)"`));
  return m ? m[1] : null;
};

/**
 * Splits the HTML at each results block and collects the fields printed
 * inside it, up to the next block. Blocks for the same strategy are merged.
 */
export function parsePageFigures(html: string): PageBlock[] {
  const starts: Array<{ index: number; strategy: string; version: string }> = [];
  for (const m of html.matchAll(BLOCK)) {
    const version = attr(m[0], "data-version");
    if (version) starts.push({ index: m.index ?? 0, strategy: m[1], version });
  }
  const byKey = new Map<string, PageBlock>();
  starts.forEach((s, i) => {
    const end = i + 1 < starts.length ? starts[i + 1].index : html.length;
    const chunk = html.slice(s.index, end);
    const key = `${s.strategy}@${s.version}`;
    const block = byKey.get(key) ?? { strategy: s.strategy, version: s.version, fields: {} };
    for (const f of chunk.matchAll(FIELD)) block.fields[f[1]] = f[2];
    byKey.set(key, block);
  });
  return [...byKey.values()];
}

export interface PageProblem {
  check: "page_missing_strategy" | "page_extra_strategy" | "page_version" | "page_value";
  strategy: number | string | null;
  field?: string;
  page?: string;
  store?: string;
}

interface StoreRow {
  id: string;
  display_number: number | null;
  version_number: number;
  [field: string]: unknown;
}

const same = (printed: string, stored: unknown): boolean => {
  if (stored === null || stored === undefined) return printed === "";
  const a = Number(printed);
  const b = Number(stored);
  if (printed !== "" && Number.isFinite(a) && Number.isFinite(b)) return Math.abs(a - b) <= 1e-6 * Math.max(1, Math.abs(b));
  return printed === String(stored);
};

/**
 * Compares the blocks on a page with the published rows they should show.
 * `expected` is the list of strategy ids the page must carry (a strategy page
 * carries one; the list page carries every listed strategy).
 */
export function comparePageToStore(blocks: PageBlock[], rows: StoreRow[], expected?: string[]): PageProblem[] {
  const problems: PageProblem[] = [];
  const byId = new Map(rows.map((r) => [r.id, r]));
  const seen = new Set<string>();
  for (const b of blocks) {
    const row = byId.get(b.strategy);
    if (!row) {
      problems.push({ check: "page_extra_strategy", strategy: b.strategy, page: b.version });
      continue;
    }
    seen.add(b.strategy);
    if (b.version !== `v${row.version_number}`) {
      problems.push({ check: "page_version", strategy: row.display_number, page: b.version, store: `v${row.version_number}` });
      continue;
    }
    for (const [field, printed] of Object.entries(b.fields)) {
      if (!(field in row)) continue;
      if (!same(printed, row[field])) {
        problems.push({ check: "page_value", strategy: row.display_number, field, page: printed, store: String(row[field]) });
      }
    }
  }
  for (const id of expected ?? []) {
    if (!seen.has(id)) problems.push({ check: "page_missing_strategy", strategy: byId.get(id)?.display_number ?? id });
  }
  return problems;
}
