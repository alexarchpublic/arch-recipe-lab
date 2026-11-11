export function formatMoney(value: number): string {
  return `$${Math.round(value).toLocaleString()}`;
}

export function scaleNumber(value: number | null | undefined, scale: number): number | null {
  if (value === null || value === undefined) return null;
  if (!isFinite(scale)) return value;
  return value * scale;
}

// Scales $ amounts in a string, e.g., "$96,170 (0.92 BTC @ $104,000)"
export function scaleMoneyInText(text: string, scale: number): string {
  if (!text) return text;
  return text.replace(/\$\s*([0-9]{1,3}(?:,[0-9]{3})*(?:\.[0-9]+)?|[0-9]+(?:\.[0-9]+)?)/g, (match, p1) => {
    const numeric = Number(p1.replace(/,/g, ''));
    const scaled = numeric * scale;
    return `$${Math.round(scaled).toLocaleString()}`;
  });
}

// Scales asset quantities like "10 AAPL", "(0.92 BTC)", or "0.5 BTC @ $..."
export function scaleAssetQuantityInText(text: string, scale: number): string {
  if (!text) return text;
  // Single pass over "qty SYMBOL" so plain tickers (Equities/ETFs) and crypto forms all scale once
  return text.replace(/(\d+(?:\.\d+)?)\s+([A-Za-z]{2,10})\b/g, (_m, qty, sym) => {
    const scaledQty = Number(qty) * scale;
    return `${trimTrailingZeros(scaledQty)} ${sym}`;
  });
}

function trimTrailingZeros(n: number): string {
  const s = n.toFixed(6);
  return s.replace(/\.0+$/, '').replace(/(\.\d*?[1-9])0+$/, '$1');
}

export function scaleRecipeFreeText(text: string | null | undefined, scale: number): string | null {
  if (!text) return text ?? null;
  const withMoney = scaleMoneyInText(text, scale);
  const withAssets = scaleAssetQuantityInText(withMoney, scale);
  return withAssets;
}

export const RECIPE_BASE_CAPITAL = 100000;

/** Display scale vs authored base ($100k). Invalid/missing capital → 1 (no scale). */
export function getScale(initialCapital: number | null | undefined): number {
  if (!initialCapital || initialCapital <= 0 || !Number.isFinite(initialCapital)) return 1;
  return initialCapital / RECIPE_BASE_CAPITAL;
}

// Settings scaling lives in the shared package (PRD R3).
export { scaleAlgorithmInputs } from "@core";
