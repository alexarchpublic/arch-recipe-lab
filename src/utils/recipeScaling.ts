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

// Scales asset quantities like "(0.92 BTC @ $104,000)" or "(0.92 BTC)"
export function scaleAssetQuantityInText(text: string, scale: number): string {
  if (!text) return text;
  // Inside parentheses with optional price part
  let updated = text.replace(/\(([^)]*)\)/g, (full, inner) => {
    const replacedInner = inner.replace(/(\d+(?:\.\d+)?)\s([A-Za-z]{2,10})(?=(?:\s*@)|$)/g, (m, qty, sym) => {
      const scaledQty = Number(qty) * scale;
      return `${trimTrailingZeros(scaledQty)} ${sym}`;
    });
    return `(${replacedInner})`;
  });
  // Also handle cases without parentheses, e.g., "0.5 BTC @ $..."
  updated = updated.replace(/(\d+(?:\.\d+)?)\s([A-Za-z]{2,10})\s*@/g, (m, qty, sym) => {
    const scaledQty = Number(qty) * scale;
    return `${trimTrailingZeros(scaledQty)} ${sym} @`;
  });
  return updated;
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

export function getScale(initialCapital: number | null | undefined): number {
  const base = 100000;
  if (!initialCapital || initialCapital <= 0) return 0;
  return initialCapital / base;
}

/**
 * Scales dollar amounts in algorithm_inputs based on portfolio allocation.
 * Only scales dollar values; preserves percentages, dates, and other non-dollar values.
 * 
 * @param algorithm_inputs - The algorithm inputs object to scale
 * @param scaleFactor - The scaling factor (portfolio allocation capital / recipe base initial capital)
 * @param algorithm - Optional algorithm type to apply algorithm-specific scaling rules
 * @returns A new object with scaled dollar values
 */
export function scaleAlgorithmInputs(algorithm_inputs: any, scaleFactor: number, algorithm?: string): any {
  if (!algorithm_inputs || typeof algorithm_inputs !== 'object') return algorithm_inputs;
  if (!isFinite(scaleFactor) || scaleFactor <= 0) return algorithm_inputs;

  // Deep clone to avoid mutating the original
  const scaled = JSON.parse(JSON.stringify(algorithm_inputs));

  // Arbitrage Algorithm: scale tradeSize.entry and tradeSize.exit
  if (typeof scaled.tradeSize === 'object' && scaled.tradeSize !== null) {
    if (typeof scaled.tradeSize.entry === 'number') {
      scaled.tradeSize.entry = Math.round(scaled.tradeSize.entry * scaleFactor);
    }
    if (typeof scaled.tradeSize.exit === 'number') {
      scaled.tradeSize.exit = Math.round(scaled.tradeSize.exit * scaleFactor);
    }
  }

  // Oracle Protocol: scale tradeSize.entryFixed, tradeSize.exitFixed, and properties.initialCapital
  if (typeof scaled.tradeSize === 'object' && scaled.tradeSize !== null) {
    if (typeof scaled.tradeSize.entryFixed === 'number') {
      scaled.tradeSize.entryFixed = Math.round(scaled.tradeSize.entryFixed * scaleFactor);
    }
    if (typeof scaled.tradeSize.exitFixed === 'number') {
      scaled.tradeSize.exitFixed = Math.round(scaled.tradeSize.exitFixed * scaleFactor);
    }
  }

  // Market Wave: scale userInitialCapital dollar/quantity fields. Static price filter
  // levels are absolute market prices and intentionally are NOT scaled.
  if (typeof scaled.userInitialCapital === 'object' && scaled.userInitialCapital !== null) {
    if (typeof scaled.userInitialCapital.startingCash === 'number') {
      scaled.userInitialCapital.startingCash = Math.round(scaled.userInitialCapital.startingCash * scaleFactor);
    }
    if (typeof scaled.userInitialCapital.startingCryptoQty === 'number') {
      scaled.userInitialCapital.startingCryptoQty = scaled.userInitialCapital.startingCryptoQty * scaleFactor;
    }
  }

  // Scale properties.initialCapital and properties.orderSize (for Intelligence Algorithm and Oracle Protocol)
  if (typeof scaled.properties === 'object' && scaled.properties !== null) {
    if (typeof scaled.properties.initialCapital === 'number') {
      scaled.properties.initialCapital = Math.round(scaled.properties.initialCapital * scaleFactor);
    }
    
    // Scale orderSize.value
    // For Intelligence Algorithm: always scale if value is numeric (order size is always dollar-based)
    // For Oracle Protocol: only scale if type indicates currency (may have percentage-based order sizes)
    if (typeof scaled.properties.orderSize === 'object' && scaled.properties.orderSize !== null) {
      const isIntelligenceAlgorithm = algorithm === 'Intelligence Algorithm';
      
      if (isIntelligenceAlgorithm) {
        // Intelligence Algorithm: always scale orderSize.value if it's a number
        if (typeof scaled.properties.orderSize.value === 'number') {
          scaled.properties.orderSize.value = Math.round(scaled.properties.orderSize.value * scaleFactor);
        }
      } else {
        // Oracle Protocol and others: scale only if type indicates currency
        const orderSizeType = String(scaled.properties.orderSize.type || '').trim();
        const isCurrencyType = orderSizeType === 'Currency' || 
                              orderSizeType === 'Dollars' || 
                              orderSizeType === 'USD' || 
                              orderSizeType === '$' ||
                              orderSizeType.toLowerCase() === 'currency';
        if (typeof scaled.properties.orderSize.value === 'number' && isCurrencyType) {
          scaled.properties.orderSize.value = Math.round(scaled.properties.orderSize.value * scaleFactor);
        }
      }
    }
  }

  return scaled;
}

