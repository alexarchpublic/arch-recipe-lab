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

/** Navy-100 chip fill; decorative per-asset brand colors are not used. */
export const ASSET_CHIP_COLOR = "#DDE2F2";
export const ASSET_CHIP_FOREGROUND = "#0B1656";

export const ASSET_CLASS_COLORS: Record<string, string> = {
  Equities: ASSET_CHIP_COLOR,
  ETFs: ASSET_CHIP_COLOR,
};

export const CRYPTO_ASSET_COLORS: Record<string, string> = {
  BTC: ASSET_CHIP_COLOR,
  ETH: ASSET_CHIP_COLOR,
  SOL: ASSET_CHIP_COLOR,
  XRP: ASSET_CHIP_COLOR,
  SUI: ASSET_CHIP_COLOR,
};

export const getAlgorithmLabel = (algorithm: string) =>
  LEGACY_ALGORITHMS.includes(algorithm) ? `${algorithm} (Legacy)` : algorithm;

export const isLegacyAlgorithm = (algorithm?: string | null) =>
  !!algorithm && LEGACY_ALGORITHMS.includes(algorithm);

export const getAssetBadgeColor = (_asset?: string, _assetClass?: string | null): string =>
  ASSET_CHIP_COLOR;

export const isEquitiesOrEtfClass = (assetClass?: string | null) =>
  assetClass === "Equities" || assetClass === "ETFs";
