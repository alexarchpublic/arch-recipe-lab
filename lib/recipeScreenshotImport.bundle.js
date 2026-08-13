// Generated from lib/recipeScreenshotImport.ts. Do not edit by hand.
// lib/recipeScreenshotImport.ts
var CRYPTO_ASSETS = ["BTC", "ETH", "SOL", "XRP", "SUI"];
var ETF_TICKERS = [
  "SPY",
  "QQQ",
  "QQQM",
  "IWM",
  "DIA",
  "VTI",
  "VOO",
  "VTV",
  "VUG",
  "VEA",
  "VWO",
  "VGT",
  "VYM",
  "SCHD",
  "SCHX",
  "IVV",
  "IWF",
  "IWD",
  "IJH",
  "IJR",
  "IEFA",
  "IEMG",
  "EFA",
  "EEM",
  "AGG",
  "BND",
  "TLT",
  "IEF",
  "SHY",
  "LQD",
  "HYG",
  "JNK",
  "GLD",
  "IAU",
  "SLV",
  "USO",
  "TQQQ",
  "SQQQ",
  "SOXL",
  "SOXS",
  "SPXL",
  "SPXS",
  "UPRO",
  "SPXU",
  "QLD",
  "QID",
  "UVXY",
  "VXX",
  "BITO",
  "IBIT",
  "FBTC",
  "ARKK",
  "ARKW",
  "ARKF",
  "ARKG",
  "ARKQ",
  "XLF",
  "XLK",
  "XLE",
  "XLV",
  "XLI",
  "XLY",
  "XLP",
  "XLB",
  "XLU",
  "XLRE",
  "XLC",
  "SMH",
  "SOXX",
  "XBI",
  "KWEB",
  "XHB",
  "XRT",
  "XOP",
  "KRE",
  "VNQ",
  "VNQI"
];
var RECIPE_SCREENSHOT_KINDS = ["chart", "settings", "stats", "dca"];
var RECIPE_SCREENSHOT_LABELS = {
  chart: "Chart",
  settings: "Settings",
  stats: "Stats",
  dca: "DCA"
};
var REQUIRED_SCREENSHOT_COUNT = RECIPE_SCREENSHOT_KINDS.length;
var NUMBER_TOKEN_RE = /-?\d{1,3}(?:,\d{3})+(?:\.\d+)?|-?\d+(?:\.\d+)?/g;
var MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
function asFinite(value) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = parseFloat(value.replace(/,/g, "").replace(/[—–]/g, "-"));
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}
function asBool(value, fallback = false) {
  if (typeof value === "boolean") return value;
  return fallback;
}
function pickNumber(...values) {
  for (const value of values) {
    const parsed = asFinite(value);
    if (parsed !== null) return parsed;
  }
  return void 0;
}
function formatUsd(value, digits = 0) {
  return `$${value.toLocaleString("en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits
  })}`;
}
function formatMonthYear(year, month) {
  if (!year || !month || month < 1 || month > 12) return null;
  return `${MONTHS[month - 1]} ${year}`;
}
function inferAssetClass(ticker, hinted) {
  const symbol = ticker.trim().toUpperCase();
  if (hinted === "Crypto" || CRYPTO_ASSETS.includes(symbol)) {
    return "Crypto";
  }
  if (hinted === "ETFs" || ETF_TICKERS.includes(symbol)) {
    return "ETFs";
  }
  return "Equities";
}
function normalizeTimeFrame(raw) {
  const text = (raw ?? "").trim().toLowerCase().replace(/\s+/g, " ");
  if (/(1\s*w|weekly|1 week)/.test(text)) return "1 Week";
  if (/(1\s*d|daily|1 day)/.test(text)) return "1 Day";
  if (/(6\s*h|6 hour)/.test(text)) return "6 Hours";
  if (/(4\s*h|4 hour)/.test(text)) return "4 Hours";
  if (/(1\s*h|60m|1 hour)/.test(text)) return "1 Hour";
  return "1 Hour";
}
function timeFrameShort(timeFrame) {
  switch (timeFrame) {
    case "1 Week":
      return "1W";
    case "1 Day":
      return "1D";
    case "6 Hours":
      return "6H";
    case "4 Hours":
      return "4H";
    case "1 Hour":
      return "1H";
  }
}
function inferHorizonAndStyle(timeFrame) {
  if (timeFrame === "1 Week") return { horizon: "LTH", style: "Position" };
  if (timeFrame === "1 Day") return { horizon: "STH", style: "Swing" };
  return { horizon: "STH", style: "Scalp" };
}
function inferFocus(stats) {
  const portfolio = pickNumber(stats.strategyPortfolioValue) ?? pickNumber(stats.currentSharesValue, 0) + pickNumber(stats.currentCashBalance, 0);
  const shareValue = pickNumber(stats.currentSharesValue) ?? 0;
  const cash = pickNumber(stats.currentCashBalance) ?? 0;
  if (portfolio > 0 && shareValue / portfolio >= 0.65) return "Accumulation";
  if (portfolio > 0 && cash / portfolio >= 0.65) return "Cash Yielding";
  return "Balanced";
}
function parseMarketWaveChartParams(text) {
  if (!text) return null;
  const idx = text.search(/Market Wave/i);
  const slice = idx >= 0 ? text.slice(idx) : text;
  const tokens = slice.match(NUMBER_TOKEN_RE) ?? [];
  const nums = tokens.map((token) => parseFloat(token.replace(/,/g, ""))).filter((n) => Number.isFinite(n));
  for (let i = 0; i <= nums.length - 23; i++) {
    const n = nums.slice(i, i + 23);
    const startYear = n[15];
    const startMonth = n[16];
    const endYear = n[20];
    const endMonth = n[21];
    if (n[0] >= 1e3 && startYear >= 2e3 && startYear <= 2100 && endYear >= 2e3 && endYear <= 2100 && startMonth >= 1 && startMonth <= 12 && endMonth >= 1 && endMonth <= 12) {
      return {
        userInitialCapital: {
          startingCash: n[0],
          startingQty: n[1]
        },
        longThreshold: { percent: n[2] },
        exitThreshold: { percent: n[3] },
        tradeSize: {
          entryShares: n[4],
          exitShares: n[5],
          entryFixed: n[6],
          exitFixed: n[7],
          entryPercent: n[8],
          exitPercent: n[9]
        },
        marketWave: {
          scope: n[10],
          sellBuffer: n[11],
          buyBuffer: n[12]
        },
        staticPriceFilter: {
          sellAbove: n[13],
          buyBelow: n[14]
        },
        dates: {
          start: {
            year: n[15],
            month: n[16],
            day: n[17],
            hour: n[18],
            minute: n[19]
          },
          end: {
            year: n[20],
            month: n[21],
            day: n[22]
          }
        }
      };
    }
  }
  return null;
}
function classifyKindsFromFilenames(filenames) {
  if (filenames.length !== REQUIRED_SCREENSHOT_COUNT) return null;
  const kinds = filenames.map((name) => {
    const lower = name.toLowerCase();
    if (lower.includes("dca")) return "dca";
    if (lower.includes("setting") || lower.includes("input")) return "settings";
    if (lower.includes("chart") || lower.includes("graph")) return "chart";
    if (lower.includes("stat")) return "stats";
    return null;
  });
  const unique = new Set(kinds);
  if (kinds.every(Boolean) && unique.size === REQUIRED_SCREENSHOT_COUNT) {
    return kinds;
  }
  return null;
}
function tradeLabels(inputs) {
  const tradeSize = inputs.tradeSize ?? {};
  if (tradeSize.percentEnabled) {
    const entry = pickNumber(tradeSize.entryPercent) ?? 0;
    const exit = pickNumber(tradeSize.exitPercent) ?? 0;
    return {
      entry: `${entry}% of capital`,
      exit: `${exit}% of capital`,
      proportion: entry > 0 ? exit / entry : 0
    };
  }
  if (tradeSize.sharesEnabled) {
    const entry = pickNumber(tradeSize.entryShares) ?? 0;
    const exit = pickNumber(tradeSize.exitShares) ?? 0;
    return {
      entry: `${entry} shares`,
      exit: `${exit} shares`,
      proportion: entry > 0 ? exit / entry : 0
    };
  }
  if (tradeSize.fixedEnabled) {
    const entry = pickNumber(tradeSize.entryFixed) ?? 0;
    const exit = pickNumber(tradeSize.exitFixed) ?? 0;
    return {
      entry: formatUsd(entry),
      exit: formatUsd(exit),
      proportion: entry > 0 ? exit / entry : 0
    };
  }
  return { entry: "See parameters", exit: "See parameters", proportion: 0 };
}
var RECIPE_SCREENSHOT_EXTRACTION_PROMPT = `You extract Arch Public Market Wave recipe fields from exactly 4 screenshots: chart, settings, stats, and DCA. Images may arrive in any order. Classify each image, then read every visible number and checkbox.

Screenshot kinds:
- chart: TradingView candlestick chart. Header has ticker, timeframe (e.g. 1h), and an indicator line like "ARCH: Market Wave Equities" followed by a long numeric parameter list, color scheme, and DCA interval (e.g. Monthly).
- settings: TradingView indicator settings panel (USER INITIAL CAPITAL, ORDER ENTRY & EXIT RULES, TRADE SIZE, MARKET WAVE, STATIC MARKET PRICE FILTER, TREND FILTER, START DATE / TIME, END DATE, BACKTESTING, DCA Benchmark). Checkboxes matter. A green/checked box is true; empty is false. Only one or more of Shares / Fixed / Percentage Trade Size may be checked.
- stats: DATA WINDOW - CORE PORTFOLIO and BENCHMARKS (Initial Cash, Current Shares, Realized/Unrealized/Total P&L, Buy & Hold ROI %, Strategy ROI %, etc.).
- dca: DATA WINDOW with DCA Benchmark ROI %, Strategy vs DCA %, DCA pot/slice metrics.

Chart numeric parameter order after the indicator name (ignore commas in thousands):
startingCash, startingQty, longThreshold%, exitThreshold%, entryShares, exitShares, entryFixed$, exitFixed$, entryPercent, exitPercent, scope, sellBuffer%, buyBuffer%, staticSellAbove, staticBuyBelow, startYear, startMonth, startDay, startHour, startMinute, endYear, endMonth, endDay.
Then optional text: ribbon colors and DCA interval.

Return ONLY JSON with this shape:
{
  "imageKinds": ["chart"|"settings"|"stats"|"dca", ... exactly 4, one of each, in the SAME order as the input images],
  "ticker": "IREN",
  "assetName": "IREN LIMITED",
  "assetClass": "Equities"|"ETFs"|"Crypto",
  "timeFrame": "1h",
  "chartIndicatorParameters": "full numeric parameter string from the chart indicator title if present",
  "ribbonColorScheme": "Neon Pink / Neon Green",
  "dcaInterval": "Monthly"|null,
  "lastPrice": 37.92,
  "settings": {
    "startingCash": 100000,
    "startingQty": 0,
    "longThresholdEnabled": true,
    "longThresholdPercent": -0.9,
    "exitThresholdEnabled": true,
    "exitThresholdPercent": 1.2,
    "sharesEnabled": false,
    "entryShares": 1,
    "exitShares": 1,
    "fixedEnabled": false,
    "entryFixed": 100,
    "exitFixed": 100,
    "percentEnabled": true,
    "entryPercent": 45.3,
    "exitPercent": 29,
    "roundDownWholeShares": false,
    "scope": 20,
    "onlySellAbove": false,
    "onlyBuyBelow": true,
    "sellBuffer": 6.2,
    "buyBuffer": 9.8,
    "staticSellAboveEnabled": false,
    "staticSellAbove": 0,
    "staticBuyBelowEnabled": false,
    "staticBuyBelow": 0,
    "buyInDownTrend": false,
    "buyInUpTrend": false,
    "sellInDownTrend": false,
    "sellInUpTrend": false,
    "buyOnUpTrend": false,
    "sellOnDownTrend": false,
    "startYear": 2026,
    "startMonth": 1,
    "startDay": 1,
    "startHour": 0,
    "startMinute": 30,
    "endYear": 2030,
    "endMonth": 1,
    "endDay": 28,
    "exitFullOnLastBar": false,
    "showDcaBenchmark": true,
    "dcaInterval": "Monthly"
  },
  "stats": {
    "initialCashBalance": 100000,
    "initialShares": 0,
    "currentShares": 3858,
    "currentSharesValue": 146295.36,
    "currentCashBalance": 17094.07,
    "totalBaseCost": 153171.89,
    "avgCostBasis": 39.70,
    "unrealizedProfit": -6876.53,
    "realizedProfit": 70265.96,
    "totalPnl": 63389.43,
    "buyHoldRoiPercent": -4.56,
    "strategyRoiPercent": 63.39,
    "strategyPortfolioValue": 163389.43
  },
  "dca": {
    "dcaBenchmarkRoiPercent": -2.07,
    "dcaPortfolioValue": 97933.15,
    "showDcaBenchmark": true
  }
}

Rules:
- Numbers must be JSON numbers, not strings. Preserve negatives.
- imageKinds MUST contain each of chart, settings, stats, dca exactly once.
- Prefer the settings panel for checkbox truth. Prefer the chart parameter string for the numeric series if settings are blurry.
- If a checkbox is not visible, use false.
- Ticker is the chart symbol (IREN, AAPL, SPY), not the company long name.
- assetClass: Crypto only for BTC/ETH/SOL/XRP/SUI; ETFs for funds like SPY/QQQ; otherwise Equities.`;
function buildRecipeFromExtraction(extraction, warnings = []) {
  const ticker = (extraction.ticker || "").trim().toUpperCase();
  if (!ticker) {
    throw new Error("Could not read a ticker from the chart screenshot");
  }
  const kinds = extraction.imageKinds ?? [];
  const uniqueKinds = new Set(kinds);
  if (kinds.length !== REQUIRED_SCREENSHOT_COUNT || uniqueKinds.size !== REQUIRED_SCREENSHOT_COUNT || RECIPE_SCREENSHOT_KINDS.some((kind) => !uniqueKinds.has(kind))) {
    throw new Error("Could not classify the 4 screenshots as chart, settings, stats, and DCA");
  }
  const settings = extraction.settings ?? {};
  const stats = extraction.stats ?? {};
  const dca = extraction.dca ?? {};
  const chartParams = parseMarketWaveChartParams(extraction.chartIndicatorParameters ?? "");
  if (!chartParams) {
    warnings.push("Chart indicator parameter string was missing or incomplete; using settings panel numbers.");
  }
  const timeFrame = normalizeTimeFrame(extraction.timeFrame);
  const { horizon, style } = inferHorizonAndStyle(timeFrame);
  const assetClass = inferAssetClass(ticker, extraction.assetClass);
  const focus = inferFocus(stats);
  const startingCash = pickNumber(
    chartParams?.userInitialCapital?.startingCash,
    settings.startingCash,
    stats.initialCashBalance
  ) ?? 1e5;
  const startingQty = pickNumber(
    chartParams?.userInitialCapital?.startingQty,
    settings.startingQty,
    stats.initialShares
  ) ?? 0;
  const longPercent = pickNumber(
    chartParams?.longThreshold?.percent,
    settings.longThresholdPercent
  );
  const exitPercent = pickNumber(
    chartParams?.exitThreshold?.percent,
    settings.exitThresholdPercent
  );
  const chartTrade = chartParams?.tradeSize ?? {};
  const chartWave = chartParams?.marketWave ?? {};
  const chartStatic = chartParams?.staticPriceFilter ?? {};
  const chartDates = chartParams?.dates ?? {};
  const percentEnabled = asBool(settings.percentEnabled, false);
  const sharesEnabled = asBool(settings.sharesEnabled, false);
  const fixedEnabled = asBool(settings.fixedEnabled, false);
  const showDca = asBool(settings.showDcaBenchmark, false) || asBool(dca.showDcaBenchmark, false) || dca.dcaBenchmarkRoiPercent != null;
  const algorithm_inputs = {
    userInitialCapital: {
      startingCash,
      startingQty,
      ...assetClass === "Crypto" ? { startingCryptoQty: startingQty } : {}
    },
    longThreshold: {
      enabled: asBool(settings.longThresholdEnabled, longPercent != null),
      percent: longPercent
    },
    exitThreshold: {
      enabled: asBool(settings.exitThresholdEnabled, exitPercent != null),
      percent: exitPercent
    },
    tradeSize: {
      sharesEnabled,
      entryShares: pickNumber(chartTrade.entryShares, settings.entryShares),
      exitShares: pickNumber(chartTrade.exitShares, settings.exitShares),
      fixedEnabled,
      entryFixed: pickNumber(chartTrade.entryFixed, settings.entryFixed),
      exitFixed: pickNumber(chartTrade.exitFixed, settings.exitFixed),
      percentEnabled,
      entryPercent: pickNumber(chartTrade.entryPercent, settings.entryPercent),
      exitPercent: pickNumber(chartTrade.exitPercent, settings.exitPercent),
      roundDownWholeShares: asBool(settings.roundDownWholeShares, false)
    },
    marketWave: {
      scope: pickNumber(chartWave.scope, settings.scope),
      onlySellAbove: asBool(settings.onlySellAbove, false),
      onlyBuyBelow: asBool(settings.onlyBuyBelow, false),
      sellBuffer: pickNumber(chartWave.sellBuffer, settings.sellBuffer),
      buyBuffer: pickNumber(chartWave.buyBuffer, settings.buyBuffer)
    },
    staticPriceFilter: {
      sellAboveEnabled: asBool(settings.staticSellAboveEnabled, false),
      sellAbove: pickNumber(chartStatic.sellAbove, settings.staticSellAbove) ?? 0,
      buyBelowEnabled: asBool(settings.staticBuyBelowEnabled, false),
      buyBelow: pickNumber(chartStatic.buyBelow, settings.staticBuyBelow) ?? 0
    },
    trendFilter: {
      buyInDownTrend: asBool(settings.buyInDownTrend, false),
      buyInUpTrend: asBool(settings.buyInUpTrend, false),
      sellInDownTrend: asBool(settings.sellInDownTrend, false),
      sellInUpTrend: asBool(settings.sellInUpTrend, false),
      buyOnUpTrend: asBool(settings.buyOnUpTrend, false),
      sellOnDownTrend: asBool(settings.sellOnDownTrend, false)
    },
    dates: {
      start: {
        year: pickNumber(chartDates.start?.year, settings.startYear),
        month: pickNumber(chartDates.start?.month, settings.startMonth),
        day: pickNumber(chartDates.start?.day, settings.startDay),
        hour: pickNumber(chartDates.start?.hour, settings.startHour) ?? 0,
        minute: pickNumber(chartDates.start?.minute, settings.startMinute) ?? 0
      },
      end: {
        year: pickNumber(chartDates.end?.year, settings.endYear),
        month: pickNumber(chartDates.end?.month, settings.endMonth),
        day: pickNumber(chartDates.end?.day, settings.endDay)
      }
    },
    backtest: {
      exitFullOnLastBar: asBool(settings.exitFullOnLastBar, false)
    },
    buyHoldPnlPercent: pickNumber(stats.buyHoldRoiPercent),
    dcaPnlPercent: pickNumber(dca.dcaBenchmarkRoiPercent),
    benchmark: {
      showBuyHold: true,
      showDca,
      dcaInterval: extraction.dcaInterval || settings.dcaInterval || null
    },
    showDcaBenchmark: showDca
  };
  const dates = algorithm_inputs.dates;
  const periodStart = formatMonthYear(dates.start.year, dates.start.month);
  const periodEnd = formatMonthYear(dates.end.year, dates.end.month);
  const backtesting_period = periodStart && periodEnd ? `${periodStart} \u2013 ${periodEnd}` : periodStart || periodEnd || "N/A";
  const trades = tradeLabels(algorithm_inputs);
  const tfShort = timeFrameShort(timeFrame);
  const currentShares = pickNumber(stats.currentShares);
  const totalPnl = pickNumber(stats.totalPnl);
  const realized = pickNumber(stats.realizedProfit);
  const asset_accumulated = currentShares != null ? `${currentShares} ${ticker}` : void 0;
  const recipe = {
    name: `[${ticker}] ${horizon} ${tfShort} ${style}`,
    asset_class: assetClass,
    asset: ticker,
    time_horizon: horizon,
    focus,
    goal: `${ticker} ${tfShort} Market Wave ${style.toLowerCase()}`,
    entry_trade: trades.entry,
    exit_trade: trades.exit,
    sell_above_cost_basis: true,
    exit_to_entry_proportion: Number.isFinite(trades.proportion) ? trades.proportion : 0,
    time_frame: timeFrame,
    backtesting_period,
    initial_capital: startingCash,
    cash_profit: realized,
    asset_accumulated,
    net_profit: totalPnl != null ? formatUsd(totalPnl, Math.abs(totalPnl) < 100 ? 2 : 0) : void 0,
    algorithm: "Market Wave",
    algorithm_inputs
  };
  return { recipe, orderedKinds: kinds, warnings };
}
function orderFilesByKinds(items, kinds) {
  return RECIPE_SCREENSHOT_KINDS.map((kind) => {
    const index = kinds.indexOf(kind);
    if (index < 0) throw new Error(`Missing ${kind} screenshot`);
    return items[index];
  });
}
export {
  RECIPE_SCREENSHOT_EXTRACTION_PROMPT,
  RECIPE_SCREENSHOT_KINDS,
  RECIPE_SCREENSHOT_LABELS,
  REQUIRED_SCREENSHOT_COUNT,
  buildRecipeFromExtraction,
  classifyKindsFromFilenames,
  inferAssetClass,
  normalizeTimeFrame,
  orderFilesByKinds,
  parseMarketWaveChartParams
};
