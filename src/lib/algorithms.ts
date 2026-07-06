export const ASSET_CLASSES = ["Equities", "ETFs", "Crypto"] as const;
export const ASSET_CLASS_ORDER: Record<string, number> = { Equities: 0, ETFs: 1, Crypto: 2 };
export const DEFAULT_ASSET_CLASSES = ["Equities", "ETFs"];
export const CRYPTO_ASSETS = ["BTC", "ETH", "SOL", "XRP", "SUI"];
export const LEGACY_ALGORITHMS = ["Oracle Protocol"];

export const getAlgorithmLabel = (algorithm: string) =>
  LEGACY_ALGORITHMS.includes(algorithm) ? `${algorithm} (Legacy)` : algorithm;
