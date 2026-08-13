export const ASSET_CLASSES = ["Equities", "ETFs", "Crypto"] as const;
export const ASSET_CLASS_ORDER: Record<string, number> = { Equities: 0, ETFs: 1, Crypto: 2 };
export const DEFAULT_ASSET_CLASSES = ["Equities", "ETFs"];
export const CRYPTO_ASSETS = ["BTC", "ETH", "SOL", "XRP", "SUI"] as const;
export const ETF_TICKERS = [
  "SPY", "QQQ", "QQQM", "IWM", "DIA", "VTI", "VOO", "VTV", "VUG", "VEA", "VWO",
  "VGT", "VYM", "SCHD", "SCHX", "IVV", "IWF", "IWD", "IJH", "IJR", "IEFA", "IEMG",
  "EFA", "EEM", "AGG", "BND", "TLT", "IEF", "SHY", "LQD", "HYG", "JNK", "GLD",
  "IAU", "SLV", "USO", "TQQQ", "SQQQ", "SOXL", "SOXS", "SPXL", "SPXS", "UPRO",
  "SPXU", "QLD", "QID", "UVXY", "VXX", "BITO", "IBIT", "FBTC", "ARKK", "ARKW",
  "ARKF", "ARKG", "ARKQ", "XLF", "XLK", "XLE", "XLV", "XLI", "XLY", "XLP", "XLB",
  "XLU", "XLRE", "XLC", "SMH", "SOXX", "XBI", "KWEB", "XHB", "XRT", "XOP", "KRE",
  "VNQ", "VNQI",
] as const;
export const LEGACY_ALGORITHMS = ["Oracle Protocol"];

export const ASSET_CLASS_COLORS: Record<string, string> = {
  Equities: "#0f766e",
  ETFs: "#7c3aed",
};

export const CRYPTO_ASSET_COLORS: Record<string, string> = {
  BTC: "#f7931a",
  ETH: "#627eea",
  SOL: "#14f195",
  XRP: "#23292f",
  SUI: "#2F80ED",
};

export const getAlgorithmLabel = (algorithm: string) =>
  LEGACY_ALGORITHMS.includes(algorithm) ? `${algorithm} (Legacy)` : algorithm;

export const isLegacyAlgorithm = (algorithm?: string | null) =>
  !!algorithm && LEGACY_ALGORITHMS.includes(algorithm);

export const getAssetBadgeColor = (asset: string, assetClass?: string | null): string => {
  if (CRYPTO_ASSET_COLORS[asset]) return CRYPTO_ASSET_COLORS[asset];
  if (assetClass && ASSET_CLASS_COLORS[assetClass]) return ASSET_CLASS_COLORS[assetClass];
  return "#6b7280";
};

export const isEquitiesOrEtfClass = (assetClass?: string | null) =>
  assetClass === "Equities" || assetClass === "ETFs";
