// Generated from packages/core/src/extraction.ts by npm run build:reader. Do not edit by hand.

// packages/core/src/naming.ts
var TIME_FRAME_WORDS = {
  "1 Week": "Weekly chart",
  "1 Day": "Daily chart",
  "6 Hours": "6-hour chart",
  "4 Hours": "4-hour chart",
  "1 Hour": "Hourly chart"
};
function timeFrameLabel(timeFrame) {
  const tf = timeFrame?.trim();
  if (!tf) return null;
  return TIME_FRAME_WORDS[tf] ?? `${tf} chart`;
}
function timeFrameAdjective(timeFrame) {
  const label = timeFrameLabel(timeFrame);
  return label ? label.replace(/ chart$/, "").replace(/^([A-Z])/, (c) => c.toLowerCase()) : null;
}

// packages/core/src/extraction.ts
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
var CORE_SCREENSHOT_KINDS = ["chart", "settings", "stats"];
var RECIPE_SCREENSHOT_KINDS = [...CORE_SCREENSHOT_KINDS, "dca"];
var RECIPE_SCREENSHOT_LABELS = {
  chart: "Chart",
  settings: "Settings",
  stats: "Stats",
  dca: "DCA"
};
var MIN_IMPORT_SCREENSHOT_COUNT = CORE_SCREENSHOT_KINDS.length;
var MAX_IMPORT_SCREENSHOT_COUNT = RECIPE_SCREENSHOT_KINDS.length;
var REQUIRED_SCREENSHOT_COUNT = MAX_IMPORT_SCREENSHOT_COUNT;
function isImportableScreenshotCount(count) {
  return count >= MIN_IMPORT_SCREENSHOT_COUNT && count <= MAX_IMPORT_SCREENSHOT_COUNT;
}
var PROMPT_VERSION = "2026-11-11.1";
var NUMBER_FIELDS = (names) => names.split(/\s+/).filter(Boolean).map((n) => [n, "number"]);
var BOOLEAN_FIELDS = (names) => names.split(/\s+/).filter(Boolean).map((n) => [n, "boolean"]);
var SETTINGS_FIELDS = [
  ...NUMBER_FIELDS(`startingCash startingQty longThresholdPercent exitThresholdPercent entryShares exitShares
    entryFixed exitFixed entryPercent exitPercent scope sellBuffer buyBuffer staticSellAbove staticBuyBelow
    startYear startMonth startDay startHour startMinute endYear endMonth endDay`),
  ...BOOLEAN_FIELDS(`longThresholdEnabled exitThresholdEnabled sharesEnabled fixedEnabled percentEnabled
    roundDownWholeShares onlySellAbove onlyBuyBelow staticSellAboveEnabled staticBuyBelowEnabled buyInDownTrend
    buyInUpTrend sellInDownTrend sellInUpTrend buyOnUpTrend sellOnDownTrend exitFullOnLastBar showDcaBenchmark`),
  ["dcaInterval", "string"]
];
var STATS_FIELDS = NUMBER_FIELDS(`initialCashBalance initialShares currentShares currentSharesValue
  currentCashBalance totalBaseCost avgCostBasis unrealizedProfit realizedProfit totalPnl buyHoldRoiPercent
  strategyRoiPercent strategyPortfolioValue`);
var DCA_FIELDS = [
  ...NUMBER_FIELDS("dcaBenchmarkRoiPercent dcaPortfolioValue"),
  ["showDcaBenchmark", "boolean"]
];
var TOP_OPTIONAL_STRINGS = ["assetName", "timeFrame", "chartIndicatorParameters", "ribbonColorScheme", "dcaInterval"];
var ASSET_CLASSES = ["Equities", "ETFs", "Crypto"];
var isObject = (v) => typeof v === "object" && v !== null && !Array.isArray(v);
function kindProblem(value, kind) {
  if (value === null || value === void 0) return null;
  if (kind === "number") return typeof value === "number" && Number.isFinite(value) ? null : `expected a number, got ${JSON.stringify(value)}`;
  if (kind === "boolean") return typeof value === "boolean" ? null : `expected true or false, got ${JSON.stringify(value)}`;
  return typeof value === "string" ? null : `expected text, got ${JSON.stringify(value)}`;
}
function checkGroup(out, path, group, fields, required) {
  if (group === void 0 && !required) return;
  if (!isObject(group)) {
    out.push(`${path}: expected an object`);
    return;
  }
  for (const [name, kind] of fields) {
    const problem = kindProblem(group[name], kind);
    if (problem) out.push(`${path}.${name}: ${problem}`);
  }
}
function validateExtractionShape(raw) {
  if (!isObject(raw)) return ["(root): expected an object"];
  const out = [];
  const kinds = raw.imageKinds;
  if (!Array.isArray(kinds)) {
    out.push("imageKinds: expected a list");
  } else {
    kinds.forEach((k, i) => {
      if (!RECIPE_SCREENSHOT_KINDS.includes(k)) {
        out.push(`imageKinds.${i}: expected one of ${RECIPE_SCREENSHOT_KINDS.join(", ")}, got ${JSON.stringify(k)}`);
      }
    });
  }
  if (typeof raw.ticker !== "string" || raw.ticker.trim() === "") out.push("ticker: expected the chart symbol");
  for (const name of TOP_OPTIONAL_STRINGS) {
    const problem = kindProblem(raw[name], "string");
    if (problem) out.push(`${name}: ${problem}`);
  }
  if (raw.assetClass !== null && raw.assetClass !== void 0 && !ASSET_CLASSES.includes(raw.assetClass)) {
    out.push(`assetClass: expected one of ${ASSET_CLASSES.join(", ")}, got ${JSON.stringify(raw.assetClass)}`);
  }
  const lastPrice = kindProblem(raw.lastPrice, "number");
  if (lastPrice) out.push(`lastPrice: ${lastPrice}`);
  if (raw.lastBarDate !== null && raw.lastBarDate !== void 0 && !(typeof raw.lastBarDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(raw.lastBarDate))) {
    out.push(`lastBarDate: must be YYYY-MM-DD, got ${JSON.stringify(raw.lastBarDate)}`);
  }
  checkGroup(out, "settings", raw.settings, SETTINGS_FIELDS, true);
  checkGroup(out, "stats", raw.stats, STATS_FIELDS, true);
  checkGroup(out, "dca", raw.dca, DCA_FIELDS, false);
  return out;
}
function crossCheckChartAgainstSettings(extraction) {
  const chart = parseMarketWaveChartParams(extraction.chartIndicatorParameters ?? "");
  if (!chart) return [];
  const settings = extraction.settings ?? {};
  const pairs = [
    ["startingCash", chart.userInitialCapital?.startingCash, settings.startingCash],
    ["startingQty", chart.userInitialCapital?.startingQty, settings.startingQty],
    ["longThresholdPercent", chart.longThreshold?.percent, settings.longThresholdPercent],
    ["exitThresholdPercent", chart.exitThreshold?.percent, settings.exitThresholdPercent],
    ["entryShares", chart.tradeSize?.entryShares, settings.entryShares],
    ["exitShares", chart.tradeSize?.exitShares, settings.exitShares],
    ["entryFixed", chart.tradeSize?.entryFixed, settings.entryFixed],
    ["exitFixed", chart.tradeSize?.exitFixed, settings.exitFixed],
    ["entryPercent", chart.tradeSize?.entryPercent, settings.entryPercent],
    ["exitPercent", chart.tradeSize?.exitPercent, settings.exitPercent],
    ["scope", chart.marketWave?.scope, settings.scope],
    ["sellBuffer", chart.marketWave?.sellBuffer, settings.sellBuffer],
    ["buyBuffer", chart.marketWave?.buyBuffer, settings.buyBuffer],
    ["staticSellAbove", chart.staticPriceFilter?.sellAbove, settings.staticSellAbove],
    ["staticBuyBelow", chart.staticPriceFilter?.buyBelow, settings.staticBuyBelow],
    ["startYear", chart.dates?.start?.year, settings.startYear],
    ["startMonth", chart.dates?.start?.month, settings.startMonth],
    ["startDay", chart.dates?.start?.day, settings.startDay],
    ["startHour", chart.dates?.start?.hour, settings.startHour],
    ["startMinute", chart.dates?.start?.minute, settings.startMinute],
    ["endYear", chart.dates?.end?.year, settings.endYear],
    ["endMonth", chart.dates?.end?.month, settings.endMonth],
    ["endDay", chart.dates?.end?.day, settings.endDay]
  ];
  const out = [];
  for (const [field, a, b] of pairs) {
    const chartValue = asFinite(a);
    const panelValue = asFinite(b);
    if (chartValue === null || panelValue === null) continue;
    if (Math.abs(chartValue - panelValue) > 1e-9) {
      out.push({ field, chart: chartValue, panel: panelValue });
    }
  }
  return out;
}
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
function inferHorizon(timeFrame) {
  return timeFrame === "1 Week" ? "LTH" : "STH";
}
function defaultTitle(ticker, timeFrame) {
  return `${ticker} on the ${timeFrameAdjective(timeFrame) ?? "daily"} chart`;
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
    if (n[0] >= 1e3 && startYear >= 2e3 && startYear <= 2100 && endYear >= 2e3 && endYear <= 3e3 && startMonth >= 1 && startMonth <= 12 && endMonth >= 1 && endMonth <= 12) {
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
  if (!isImportableScreenshotCount(filenames.length)) return null;
  const kinds = filenames.map((name) => {
    const lower = name.toLowerCase();
    if (lower.includes("dca")) return "dca";
    if (lower.includes("setting") || lower.includes("input")) return "settings";
    if (lower.includes("chart") || lower.includes("graph")) return "chart";
    if (lower.includes("stat")) return "stats";
    return null;
  });
  if (!kinds.every(Boolean)) return null;
  const unique = new Set(kinds);
  if (unique.size !== kinds.length) return null;
  if (CORE_SCREENSHOT_KINDS.some((kind) => !unique.has(kind))) return null;
  if (filenames.length === MIN_IMPORT_SCREENSHOT_COUNT && unique.has("dca")) return null;
  if (filenames.length === MAX_IMPORT_SCREENSHOT_COUNT && !unique.has("dca")) return null;
  return kinds;
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
var RECIPE_SCREENSHOT_EXTRACTION_PROMPT = `You extract Arch Public Market Wave recipe fields from 3 or 4 screenshots. Chart, settings, and stats are required. DCA is optional. Images may arrive in any order. Classify each image, then read every visible number and checkbox.

Screenshot kinds:
- chart: TradingView candlestick chart. Header has ticker, timeframe (e.g. 1h), and an indicator line like "ARCH: Market Wave Equities" followed by a long numeric parameter list, color scheme, and DCA interval (e.g. Monthly).
- settings: TradingView indicator settings panel (USER INITIAL CAPITAL, ORDER ENTRY & EXIT RULES, TRADE SIZE, MARKET WAVE, STATIC MARKET PRICE FILTER, TREND FILTER, START DATE / TIME, END DATE, BACKTESTING, DCA Benchmark). Checkboxes matter. A green/checked box is true; empty is false. Only one or more of Shares / Fixed / Percentage Trade Size may be checked.
- stats: DATA WINDOW - CORE PORTFOLIO and BENCHMARKS (Initial Cash, Current Shares, Realized/Unrealized/Total P&L, Buy & Hold ROI %, Strategy ROI %, etc.).
- dca (optional): DATA WINDOW with DCA Benchmark ROI %, Strategy vs DCA %, DCA pot/slice metrics. Omit this kind when no DCA screenshot is in the set.

Chart numeric parameter order after the indicator name (ignore commas in thousands):
startingCash, startingQty, longThreshold%, exitThreshold%, entryShares, exitShares, entryFixed$, exitFixed$, entryPercent, exitPercent, scope, sellBuffer%, buyBuffer%, staticSellAbove, staticBuyBelow, startYear, startMonth, startDay, startHour, startMinute, endYear, endMonth, endDay.
Then optional text: ribbon colors and DCA interval.

Return ONLY JSON with this shape:
{
  "imageKinds": ["chart"|"settings"|"stats"|"dca", ... one per input image, in the SAME order as the input images],
  "ticker": "IREN",
  "assetName": "IREN LIMITED",
  "assetClass": "Equities"|"ETFs"|"Crypto",
  "timeFrame": "1h",
  "chartIndicatorParameters": "full numeric parameter string from the chart indicator title if present",
  "ribbonColorScheme": "Neon Pink / Neon Green",
  "dcaInterval": "Monthly"|null,
  "lastPrice": 37.92,
  "lastBarDate": "2026-08-25",
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
- imageKinds MUST have one entry per input image, in that same order. Always include chart, settings, and stats exactly once. Include dca only when a DCA screenshot is present.
- If there is no DCA screenshot, set "dca" to {} and dcaInterval to null.
- Prefer the settings panel for checkbox truth. Prefer the chart parameter string for the numeric series if settings are blurry.
- If a checkbox is not visible, use false.
- Ticker is the chart symbol (IREN, AAPL, SPY), not the company long name.
- assetClass: Crypto only for BTC/ETH/SOL/XRP/SUI; ETFs for funds like SPY/QQQ; otherwise Equities.
- lastBarDate: the end year in the settings is often far in the future (for example 2030 or 2999) so TradingView unlocks the symbol. When the settings end date is later than the last candle on the chart, read the date of the last (right-most) candle from the chart's time axis, using the date gridline labels, and return it as "YYYY-MM-DD". Otherwise return null. Never return the settings end date here.`;
function buildRecipeFromExtraction(extraction, warnings = []) {
  const ticker = (extraction.ticker || "").trim().toUpperCase();
  if (!ticker) {
    throw new Error("Could not read a ticker from the chart screenshot");
  }
  const kinds = extraction.imageKinds ?? [];
  const uniqueKinds = new Set(kinds);
  if (!isImportableScreenshotCount(kinds.length) || uniqueKinds.size !== kinds.length || CORE_SCREENSHOT_KINDS.some((kind) => !uniqueKinds.has(kind))) {
    throw new Error("Could not classify the screenshots as chart, settings, and stats");
  }
  const hasDcaScreenshot = uniqueKinds.has("dca");
  const settings = extraction.settings ?? {};
  const stats = extraction.stats ?? {};
  const dca = extraction.dca ?? {};
  const chartParams = parseMarketWaveChartParams(extraction.chartIndicatorParameters ?? "");
  if (!chartParams) {
    warnings.push("Chart indicator parameter string was missing or incomplete; using settings panel numbers.");
  }
  const timeFrame = normalizeTimeFrame(extraction.timeFrame);
  const horizon = inferHorizon(timeFrame);
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
  const showDca = hasDcaScreenshot && (asBool(settings.showDcaBenchmark, false) || asBool(dca.showDcaBenchmark, false) || dca.dcaBenchmarkRoiPercent != null);
  if (!hasDcaScreenshot) {
    warnings.push("No DCA screenshot; DCA benchmark left blank.");
  }
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
  const currentShares = pickNumber(stats.currentShares);
  const totalPnl = pickNumber(stats.totalPnl);
  const realized = pickNumber(stats.realizedProfit);
  const asset_accumulated = currentShares != null ? `${currentShares} ${ticker}` : void 0;
  const recipe = {
    title: defaultTitle(ticker, timeFrame),
    asset_class: assetClass,
    asset: ticker,
    time_horizon: horizon,
    focus,
    goal: `Trade ${ticker} on the ${timeFrameAdjective(timeFrame) ?? "daily"} chart.`,
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
  const crossCheck = crossCheckChartAgainstSettings(extraction);
  for (const entry of crossCheck) {
    warnings.push(`Chart header and settings panel disagree on ${entry.field}: chart ${entry.chart}, panel ${entry.panel}.`);
  }
  const lastBarDate = typeof extraction.lastBarDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(extraction.lastBarDate) ? extraction.lastBarDate : null;
  return { recipe, orderedKinds: kinds, warnings, crossCheck, lastBarDate };
}
function orderFilesByKinds(items, kinds) {
  return RECIPE_SCREENSHOT_KINDS.filter((kind) => kinds.includes(kind)).map((kind) => {
    const index = kinds.indexOf(kind);
    if (index < 0) throw new Error(`Missing ${kind} screenshot`);
    return items[index];
  });
}
export {
  CORE_SCREENSHOT_KINDS,
  MAX_IMPORT_SCREENSHOT_COUNT,
  MIN_IMPORT_SCREENSHOT_COUNT,
  PROMPT_VERSION,
  RECIPE_SCREENSHOT_EXTRACTION_PROMPT,
  RECIPE_SCREENSHOT_KINDS,
  RECIPE_SCREENSHOT_LABELS,
  REQUIRED_SCREENSHOT_COUNT,
  buildRecipeFromExtraction,
  classifyKindsFromFilenames,
  crossCheckChartAgainstSettings,
  defaultTitle,
  inferAssetClass,
  isImportableScreenshotCount,
  normalizeTimeFrame,
  orderFilesByKinds,
  parseMarketWaveChartParams,
  validateExtractionShape
};
