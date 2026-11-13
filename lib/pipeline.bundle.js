// Generated from packages/core/src/pipeline.ts by npm run build:pipeline. Do not edit by hand.

// packages/core/src/naming.ts
var TITLE_MAX_LENGTH = 48;
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
function strategyLine(s) {
  return [
    typeof s.display_number === "number" ? `Strategy #${s.display_number}` : null,
    s.asset,
    timeFrameLabel(s.time_frame),
    s.algorithm
  ].filter((part) => !!part && part.trim() !== "").join(" \xB7 ");
}
var CODE_PATTERNS = [
  [/\b(STH|LTH)\b/i, "STH or LTH"],
  [/\bscalp(s|ing|er)?\b/i, "Scalp"],
  [/\barb\b/i, "Arb"],
  [/\bYTD\b/i, "YTD"],
  [/\b\d+\s?(m|min|h|hr|d|w|wk|mo)\b/i, "a time frame code such as 1H or 1W"],
  [/\b(\d+|one|four|six)[- ]?(minute|hour|day|week)s?\b|\b(hourly|daily|weekly) chart\b/i, "the chart's time frame (it shows as its own label)"],
  [/[[\]]/, "brackets"],
  [/\b(market wave|intelligence algorithm|arbitrage algorithm|oracle protocol)\b/i, "the algorithm name"]
];
var FIGURE_PATTERN = /[$%]|\b\d+(\.\d+)?\s?(x|percent)\b/i;
var PROMISE_PATTERN = /\b(best|guaranteed?|risk[- ]free|can'?t lose|never lose|sure[- ]fire|explosive|massive|huge|unbeatable|top[- ]performing|beats? the market)\b/i;
function titleProblems(title, opts = {}) {
  const t = (title ?? "").trim();
  if (!t) return ["The title is empty."];
  const out = [];
  if (t.length > TITLE_MAX_LENGTH) {
    out.push(`The title is ${t.length} characters; the limit is ${TITLE_MAX_LENGTH}.`);
  }
  for (const [re, label] of CODE_PATTERNS) {
    if (re.test(t)) out.push(`Leave ${label} out of the title.`);
  }
  if (FIGURE_PATTERN.test(t)) out.push("Leave return figures out of the title.");
  if (PROMISE_PATTERN.test(t)) out.push("Leave promises and superlatives out of the title.");
  if (opts.otherTitles) {
    const key = t.toLowerCase().replace(/\s+/g, " ");
    for (const other of opts.otherTitles) {
      if (other && other.trim().toLowerCase().replace(/\s+/g, " ") === key) {
        out.push("Another live strategy has this title.");
        break;
      }
    }
  }
  return out;
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

// packages/core/src/pipeline.ts
var PIPELINE_VERSION = "2026-11-12.1";
var NAMING_PROMPT_VERSION = "2026-11-12.2";
var SUMMARY_MAX_LENGTH = 110;
var DESCRIPTION_MAX_LENGTH = 320;
var SOURCE_FILES = {
  chart: "chart.png",
  settings: "settings.png",
  stats: "data-window.png",
  dca: "dca.png"
};
var REQUIRED_SOURCE_KINDS = ["chart", "settings", "stats"];
function sourceKind(filename) {
  const base = filename.toLowerCase().replace(/\.(png|jpe?g|webp)$/, "");
  for (const [kind, file] of Object.entries(SOURCE_FILES)) {
    if (file.replace(/\.png$/, "") === base) return kind;
  }
  return null;
}
function parseFigure(text) {
  if (text === null || text === void 0) return null;
  const t = String(text).replace(/[−–—]/g, "-").replace(/\s+/g, " ");
  const m = t.match(/(-)?\s*\+?\$?\s*(-)?\s*([0-9][0-9,]*(?:\.[0-9]+)?)/);
  if (!m) return null;
  const n = Number(m[3].replace(/,/g, ""));
  if (!Number.isFinite(n)) return null;
  return m[1] || m[2] ? -n : n;
}
var MONTHS2 = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
function isoDate(y, m, d) {
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}
function parseWindow(text) {
  if (!text) return { start: null, end: null };
  const parts = String(text).split(/\s+(?:to|through|until|–|-)\s+/i);
  if (parts.length !== 2) return { start: null, end: null };
  const read = (s) => {
    const m = s.trim().match(/^([A-Za-z]+)\.?\s*(\d{1,2})?(?:,)?\s*(\d{4})?$/);
    if (!m) return null;
    const month = MONTHS2.indexOf(m[1].slice(0, 3).toLowerCase()) + 1;
    if (month < 1) return null;
    return { month, day: m[2] ? Number(m[2]) : null, year: m[3] ? Number(m[3]) : null };
  };
  const a = read(parts[0]);
  const b = read(parts[1].replace(/^(.*?\b\d{4})\b.*$/, "$1"));
  if (!a || !b || !b.year) return { start: null, end: null };
  const startYear = a.year ?? b.year;
  return {
    start: isoDate(startYear, a.month, a.day ?? 1),
    end: b.day ? isoDate(b.year, b.month, b.day) : null,
    ...b.day ? {} : { endMonth: isoDate(b.year, b.month, 1).slice(0, 7) }
  };
}
function chartLabelTimeFrame(text) {
  const t = (text ?? "").toLowerCase();
  if (/\bweekly\b|\b1[- ]?week\b/.test(t)) return "1 Week";
  if (/\bdaily\b|\b1[- ]?day\b/.test(t)) return "1 Day";
  if (/\b(6|six)[- ]?hour/.test(t)) return "6 Hours";
  if (/\b(4|four)[- ]?hour/.test(t)) return "4 Hours";
  if (/\bhourly\b|\b(1|one)[- ]?hour/.test(t)) return "1 Hour";
  return null;
}
function statValue(stats, test) {
  for (const s of stats ?? []) {
    const label = (s?.label ?? "").toLowerCase();
    if (label && test(label)) return s?.value ?? null;
  }
  return null;
}
function scenarioFigures(scenario) {
  const bench = (test) => {
    const b = (scenario.benchmarks ?? []).find((x) => test((x?.name ?? "").toLowerCase()));
    return b ? parseFigure(b.value) : null;
  };
  const shares = statValue(scenario.stats, (l) => /^(shares|coins|units)( held| at)/.test(l) || l === "shares held");
  const avg = shares?.match(/at\s+\$\s*([0-9][0-9,]*(?:\.[0-9]+)?)\s*avg/i);
  const window = parseWindow(scenario.window);
  return {
    returnPct: parseFigure(scenario.strategyReturn),
    buyHoldPct: bench((n) => n === "buy and hold"),
    dcaPct: bench((n) => n === "dca" || n === "monthly dollar-cost averaging"),
    endingValue: parseFigure(statValue(scenario.stats, (l) => /^(strategy )?(ending|final|portfolio) value$/.test(l))),
    initialCapital: parseFigure(statValue(scenario.stats, (l) => l === "initial capital")),
    realizedProfit: parseFigure(statValue(scenario.stats, (l) => /^realized( profit)?/.test(l) && !/loss/.test(l))),
    unrealizedProfit: parseFigure(statValue(scenario.stats, (l) => /^unrealized/.test(l))),
    totalProfit: parseFigure(statValue(scenario.stats, (l) => l === "profit and loss" || l === "total profit and loss")),
    sharesHeld: shares ? parseFigure(shares) : null,
    avgCost: avg ? Number(avg[1].replace(/,/g, "")) : parseFigure(statValue(scenario.stats, (l) => /^(avg|average) cost/.test(l))),
    cash: parseFigure(statValue(scenario.stats, (l) => /^(cash|cash on hand|current cash)$/.test(l))),
    windowStart: window.start,
    windowEnd: window.end,
    windowEndMonth: window.endMonth ?? null,
    timeFrame: chartLabelTimeFrame(scenario.chart)
  };
}
function scenarioTicker(study, scenario) {
  const only = Array.isArray(study.tickers) && study.tickers.length === 1 ? study.tickers[0]?.ticker : null;
  const t = (scenario.ticker ?? study.ticker ?? only ?? "").trim().toUpperCase();
  return t || null;
}
function scenarioCompany(study, scenario) {
  const t = scenarioTicker(study, scenario);
  const listed = (study.tickers ?? []).find((x) => (x?.ticker ?? "").toUpperCase() === t)?.company;
  return (listed ?? study.company ?? null) || null;
}
function scenarioIsMarketWave(study, scenario) {
  const named = (scenario.algorithm ?? study.product ?? "").toLowerCase();
  if (!named.includes("market wave")) return false;
  const others = /intelligence algorithm|oracle protocol|arbitrage algorithm|tax-loss/.test(named);
  return !others || /market wave/i.test(String(scenario.algorithm ?? ""));
}
function fingerprintInput(scenario, fileHashes) {
  const figures = {
    title: scenario.title ?? null,
    window: scenario.window ?? null,
    chart: scenario.chart ?? null,
    strategyReturn: scenario.strategyReturn ?? null,
    benchmarks: scenario.benchmarks ?? [],
    stats: scenario.stats ?? [],
    public: scenario.public ?? true
  };
  const files = Object.keys(fileHashes).sort().map((k) => [k, fileHashes[k]]);
  return JSON.stringify({ figures, files });
}
function planScenario(opts) {
  const { study, scenario } = opts;
  const base = {
    slug: study.slug,
    key: String(scenario.key ?? ""),
    title: String(scenario.title ?? ""),
    strategyNumber: typeof scenario.strategyNumber === "number" ? scenario.strategyNumber : null
  };
  if (study.status === "draft") return { ...base, action: "draft-study", reason: "The case study is a draft (TR5)." };
  if (!base.key) return { ...base, action: "skip", reason: "The scenario has no permanent key (NO7)." };
  if (!opts.hasSources) {
    return { ...base, action: "skip", reason: "No source screenshots in sources/" + base.key + " (TR2, Q5)." };
  }
  if (base.strategyNumber === null) return { ...base, action: "new", reason: "No strategy number yet." };
  if (!opts.storedHash && opts.baselineUnrecorded) {
    return { ...base, action: "baseline", reason: "Already a strategy; its hash is recorded as the baseline, nothing is written (BF2)." };
  }
  if (opts.storedHash && opts.storedHash === opts.hash) {
    return { ...base, action: "unchanged", reason: "Figures and screenshots match the last run (TR4)." };
  }
  return {
    ...base,
    action: "update",
    reason: opts.storedHash ? "Figures or screenshots changed since the last run." : "No baseline recorded yet (BF2)."
  };
}
var REL_TOLERANCE = 5e-3;
var PCT_TOLERANCE = 0.11;
function differs(a, b, kind) {
  if (a === null || a === void 0 || b === null || b === void 0) return false;
  if (kind === "pct") return Math.abs(a - b) > PCT_TOLERANCE;
  if (kind === "count") return Math.abs(a - b) >= 1;
  return Math.abs(a - b) > Math.max(1.01, Math.abs(b) * REL_TOLERANCE);
}
function checkScenario(opts) {
  const { study, scenario, extraction, result } = opts;
  const out = [];
  const hold = (code, message) => out.push({ level: "hold", code, message });
  const warn = (code, message) => out.push({ level: "warning", code, message });
  const note = (code, message) => out.push({ level: "note", code, message });
  for (const kind of REQUIRED_SOURCE_KINDS) {
    if (!opts.sourceKinds.includes(kind)) hold("missing_screenshot", `The ${SOURCE_FILES[kind]} screenshot is missing.`);
  }
  if (!scenarioIsMarketWave(study, scenario)) {
    hold("algorithm", "The scenario is not on Market Wave, which is the only algorithm the reader covers (A13).");
  }
  if (opts.readError) hold("unreadable", `Claude could not read the screenshots: ${opts.readError}`);
  if (!extraction || !result) return out;
  if (opts.schemaErrors.length) {
    hold("schema", `The reading does not match the extraction schema: ${opts.schemaErrors.slice(0, 3).join("; ")}.`);
  }
  for (const c of result.crossCheck ?? []) {
    hold("chart_vs_panel", `Chart header and settings panel disagree on ${c.field}: chart ${c.chart}, panel ${c.panel} (A9).`);
  }
  if (!(extraction.chartIndicatorParameters ?? "").trim()) {
    warn("no_chart_parameters", "The chart header's parameter list could not be read; the settings panel alone gave the settings.");
  }
  const ticker = scenarioTicker(study, scenario);
  const read = (extraction.ticker ?? "").trim().toUpperCase();
  if (ticker && read && ticker !== read) {
    const company = scenarioCompany(study, scenario);
    if (sameCompany(extraction.assetName, company)) {
      note("ticker_from_name", `The chart names ${extraction.assetName}, the case study's company; Claude read its symbol as ${read}, so the case study's ticker ${ticker} is stored.`);
    } else {
      hold("ticker", `The screenshots show ${read}; the case study says ${ticker}.`);
    }
  }
  if (extraction.timeFrame && !isStoredTimeFrame(extraction.timeFrame)) {
    hold("time_frame_unsupported", `The chart is on ${extraction.timeFrame}, a time frame the store does not have (1W, 1D, 6H, 4H, 1H).`);
  }
  const figures = scenarioFigures(scenario);
  if (figures.timeFrame && result.recipe.time_frame !== figures.timeFrame) {
    hold("time_frame", `The chart is on ${result.recipe.time_frame}; the case study says ${figures.timeFrame}.`);
  }
  if (!figures.timeFrame) note("time_frame_unstated", `The case study's chart label "${scenario.chart ?? ""}" names no time frame; the chart's is used.`);
  const stats = extraction.stats ?? {};
  const dca = extraction.dca ?? {};
  const pairs = [
    ["strategy return", stats.strategyRoiPercent, figures.returnPct, "pct"],
    ["buy and hold", stats.buyHoldRoiPercent, figures.buyHoldPct, "pct"],
    ["DCA", dca.dcaBenchmarkRoiPercent, figures.dcaPct, "pct"],
    ["ending value", stats.strategyPortfolioValue, figures.endingValue, "money"],
    ["realized profit", stats.realizedProfit, figures.realizedProfit, "money"],
    ["unrealized profit", stats.unrealizedProfit, figures.unrealizedProfit, "money"],
    ["shares held", stats.currentShares, figures.sharesHeld, "count"],
    ["cash", stats.currentCashBalance, figures.cash, "money"]
  ];
  for (const [label, screen, published, kind] of pairs) {
    if (differs(screen, published, kind)) {
      warn("figure_differs", `The data window shows ${label} ${screen}; the case study publishes ${published}. The case study's figure is stored.`);
    }
  }
  if (figures.returnPct === null) warn("no_return", "The case study states no strategy return for this scenario; the data window's is stored.");
  const run = runEnd(result.recipe.algorithm_inputs);
  const today = opts.today ?? (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
  const asOf = study.published && study.published < today ? study.published : today;
  if (run && run > asOf) {
    const bar = result.lastBarDate;
    if (figures.windowEnd) {
      note("future_end", `The settings run to ${run}, past the case study's date (${asOf}); the test end stored is its window end, ${figures.windowEnd}.`);
      if (bar && Math.abs(daysBetween(bar, figures.windowEnd)) > 7) {
        warn("end_vs_window", `Claude read the chart's last bar as ${bar}, more than a week from the case study's window end (${figures.windowEnd}); the case study's date is stored.`);
      }
    } else if (bar) {
      note("future_end", `The settings run to ${run}; the case study gives no end day, so the test end is the chart's last bar as read, ${bar} (A16).`);
      if (figures.windowEndMonth && bar.slice(0, 7) !== figures.windowEndMonth) {
        hold("end_vs_window", `Claude read the chart's last bar as ${bar}, outside the case study's end month (${figures.windowEndMonth}), and the case study states no end day (EX6).`);
      }
    } else {
      hold("no_end_date", `The settings run to ${run}, the case study states no end date and the chart's last bar could not be read, so the test end is unknown (EX6).`);
    }
  }
  const start = runStart(result.recipe.algorithm_inputs);
  if (start && figures.windowStart && Math.abs(daysBetween(start, figures.windowStart)) > 7) {
    warn("start_vs_window", `The settings start on ${start}; the case study's window starts on ${figures.windowStart}.`);
  }
  return out;
}
function holds(findings) {
  return findings.filter((f) => f.level === "hold");
}
function daysBetween(a, b) {
  return (Date.parse(a) - Date.parse(b)) / 864e5;
}
function partsIso(p) {
  if (!p?.year || !p?.month || !p?.day) return null;
  return isoDate(p.year, p.month, p.day);
}
function runStart(inputs) {
  return partsIso(inputs?.dates?.start);
}
function runEnd(inputs) {
  return partsIso(inputs?.dates?.end);
}
var NAMING_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["title", "summary", "description", "marketTag"],
  properties: {
    title: { type: "string" },
    summary: { type: "string" },
    description: { type: "string" },
    marketTag: { type: "string", enum: ["falling", "sideways", "rising", "volatile"] }
  }
};
var NAMING_INSTRUCTIONS = `You name one Arch Public trading strategy for its card in Strategy Lab. Write in plain English for an investor, not a trader.

Return JSON with:
- title: at most ${TITLE_MAX_LENGTH} characters, in sentence case (capital on the first word and on names only). Name the asset the way people say it (Microsoft, Gold, Bitcoin, Alphabet; not MSFT, GLD, BTC, GOOGL), and say what the strategy does or the market it was tested in. Carry the same idea as the case study scenario's title, so the two read as one thing. No codes or abbreviations: no STH, LTH, Scalp, Arb, YTD, 1H, 4H, 1W, no brackets, no algorithm names (Market Wave, Intelligence Algorithm, Oracle Protocol). No return figures, percentages, dollar amounts, promises or superlatives (best, guaranteed, massive). It must differ from every title in the list of live titles.
- summary: one sentence, at most ${SUMMARY_MAX_LENGTH} characters, saying what the strategy is for. No figures.
- description: at most ${DESCRIPTION_MAX_LENGTH} characters on how it trades: when it buys, when it sells, what it does with cash. Use only what the case study and the settings state. No figures and no promises.
- marketTag: the market in the test window, from the case study's account of it: falling, sideways, rising or volatile.

Everywhere: no em or en dashes (use a comma, colon or full stop), no exclamation marks, no promises such as "never sells at a loss". Say "only sells above its average cost" instead. An ETF that tracks something keeps its fund's name or ticker (IBIT is "Bitcoin ETF" or "IBIT", not "Bitcoin").

Reply with the JSON object only.`;
function namingPrompt(input) {
  const lines = [
    NAMING_INSTRUCTIONS,
    "",
    `Asset: ${input.assetName ? `${input.assetName} (${input.asset})` : input.asset}`,
    `Chart: ${timeFrameLabel(input.timeFrame) ?? input.timeFrame}`,
    `Case study: ${input.studyTitle}`,
    `Scenario title: ${input.scenarioTitle}`,
    input.window ? `Test window: ${input.window}` : null,
    `How the settings trade: ${input.settingsSummary}`,
    "",
    "What the case study says about this scenario:",
    ...input.context.map((c) => `- ${c}`),
    input.numberToRead ? `- ${input.numberToRead}` : null,
    "",
    "Live titles (yours must differ from all of them):",
    ...input.otherTitles.map((t) => `- ${t}`)
  ];
  if (input.previousProblems?.length) {
    lines.push("", "Your last answer broke these rules; fix them:", ...input.previousProblems.map((p) => `- ${p}`));
  }
  return lines.filter((l) => l !== null).join("\n");
}
function namingProblems(reply, otherTitles) {
  if (!reply) return ["No answer."];
  const out = [...titleProblems(reply.title, { otherTitles })];
  const summary = (reply.summary ?? "").trim();
  const description = (reply.description ?? "").trim();
  if (!summary) out.push("The summary is empty.");
  if (summary.length > SUMMARY_MAX_LENGTH) out.push(`The summary is ${summary.length} characters; the limit is ${SUMMARY_MAX_LENGTH}.`);
  if (!description) out.push("The description is empty.");
  if (description.length > DESCRIPTION_MAX_LENGTH) {
    out.push(`The description is ${description.length} characters; the limit is ${DESCRIPTION_MAX_LENGTH}.`);
  }
  if (/[%$]/.test(summary) || /[%$]/.test(description)) out.push("Leave figures out of the summary and description.");
  if ([reply.title, summary, description].some((t) => /[–—]/.test(t ?? ""))) {
    out.push("Use no em or en dashes; use a comma, colon or full stop.");
  }
  if ([summary, description].some((t) => COPY_PROMISE.test(t))) {
    out.push("Leave promises out of the summary and description: no guarantees, nothing it never or always does with a loss.");
  }
  if (/[!]/.test(`${reply.title} ${summary} ${description}`)) out.push("Use no exclamation marks.");
  return out;
}
var COPY_PROMISE = /\b(guarantee[sd]?|risk[- ]free|can'?t lose|never (lose|loses|locks? in a loss|sells? at a loss|takes? a loss)|always (wins?|profits?)|sure[- ]fire)\b/i;
function fallbackTitle(assetName, scenarioTitle) {
  const t = `${assetName}: ${scenarioTitle.replace(/^the\s+/i, "")}`.trim();
  if (t.length <= TITLE_MAX_LENGTH) return t;
  const cut = t.slice(0, TITLE_MAX_LENGTH + 1);
  return cut.slice(0, Math.max(cut.lastIndexOf(" "), TITLE_MAX_LENGTH - 10)).replace(/[\s,:;-]+$/, "");
}
function isStoredTimeFrame(raw) {
  const t = raw.trim().toLowerCase().replace(/\s+/g, " ");
  return /^(1 ?w|1 week|weekly|w|1 ?d|1 day|daily|d|6 ?h|6 hours?|360|4 ?h|4 hours?|240|1 ?h|1 hour|hourly|60|60 ?m)$/.test(t);
}
function sameCompany(read, company) {
  const norm = (x) => plainAssetName(x, "").toLowerCase().replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();
  const a = norm(read);
  const b = norm(company);
  return a.length >= 3 && b.length >= 3 && a === b;
}
function plainAssetName(name, ticker) {
  const n = (name ?? "").trim();
  if (!n) return ticker;
  return n.replace(/\b(corp(oration)?|inc|incorporated|ltd|limited|plc|co|company|holdings?|class [a-z]|common stock|trust|etf|shares?)\b\.?/gi, "").replace(/[,.]+\s*$/, "").replace(/\s{2,}/g, " ").trim() || ticker;
}
function settingsSummary(inputs) {
  const ts = inputs.tradeSize ?? {};
  const mw = inputs.marketWave ?? {};
  const parts = [];
  if (ts.percentEnabled) parts.push(`buys with ${ts.entryPercent}% of cash and sells ${ts.exitPercent}% of the position per signal`);
  else if (ts.fixedEnabled) parts.push(`buys $${ts.entryFixed} and sells $${ts.exitFixed} per signal`);
  else if (ts.sharesEnabled) parts.push(`buys ${ts.entryShares} and sells ${ts.exitShares} shares per signal`);
  if (mw.onlyBuyBelow) parts.push("only buys below its cost basis");
  if (mw.onlySellAbove) parts.push("only sells above its cost basis");
  return parts.join("; ") || "Market Wave bands";
}
function preferScreen(published, screen, kind) {
  if (published === null) return null;
  for (const v of screen) {
    if (typeof v === "number" && Number.isFinite(v) && !differs(v, published, kind)) return v;
  }
  return published;
}
function draftFields(opts) {
  const { study, scenario, result, naming } = opts;
  const r = result.recipe;
  const figures = scenarioFigures(scenario);
  const ai = r.algorithm_inputs;
  const startingCash = Number(ai.userInitialCapital?.startingCash ?? r.initial_capital ?? 1e5);
  const st = opts.extraction?.stats ?? {};
  const dw = opts.extraction?.dca ?? {};
  const screenProfits = [
    typeof st.strategyPortfolioValue === "number" ? round2(st.strategyPortfolioValue - startingCash) : null,
    st.totalPnl
  ];
  const returnMatch = figures.returnPct === null ? null : screenProfits.find((v) => typeof v === "number" && !differs(v / startingCash * 100, figures.returnPct, "pct"));
  const net = figures.returnPct !== null ? typeof returnMatch === "number" ? returnMatch : round2(figures.returnPct / 100 * startingCash) : figures.totalProfit ?? st.totalPnl ?? firstNum(r.net_profit);
  const buyHold = figures.buyHoldPct !== null ? preferScreen(figures.buyHoldPct, [st.buyHoldRoiPercent], "pct") : numOrNull(ai.buyHoldPnlPercent);
  const dca = figures.dcaPct !== null ? preferScreen(figures.dcaPct, [dw.dcaBenchmarkRoiPercent], "pct") : numOrNull(ai.dcaPnlPercent);
  const listed = (scenario.benchmarks ?? []).length > 0;
  const settingsDca = ai.benchmark?.showDca === true || ai.showDcaBenchmark === true;
  const showBuyHold = (listed ? figures.buyHoldPct !== null : true) && buyHold !== null;
  const showDca = (listed ? figures.dcaPct !== null : settingsDca) && dca !== null;
  const benchmark = showBuyHold && showDca ? "both" : showBuyHold ? "buy_hold" : showDca ? "dca" : "none";
  const start = runStart(ai);
  const end = runEnd(ai);
  const today = opts.asOf ?? (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
  const asOfDate = study.published && study.published < today ? study.published : today;
  const futureEnd = !!end && end > asOfDate;
  const asset = scenarioTicker(study, scenario) ?? r.asset;
  const fields = {
    asset,
    asset_class: r.asset_class,
    algorithm: "Market Wave",
    strategy_type: "Market Wave",
    time_horizon: r.time_horizon,
    focus: r.focus,
    time_frame: r.time_frame,
    title: naming.title.trim(),
    goal: naming.summary.trim(),
    how_it_trades: naming.description.trim(),
    listed_public: scenario.public !== false,
    as_of: study.published ?? today,
    starting_capital: startingCash,
    net_profit_usd: net,
    cash_profit_usd: figures.realizedProfit !== null ? preferScreen(figures.realizedProfit, [st.realizedProfit], "money") : r.cash_profit ?? null,
    asset_qty: figures.sharesHeld !== null ? preferScreen(figures.sharesHeld, [st.currentShares], "count") : firstNum(r.asset_accumulated),
    asset_unit: asset,
    buy_hold_pnl_pct: buyHold,
    dca_pnl_pct: dca,
    benchmark_shown: benchmark,
    entry_trade: r.entry_trade,
    exit_trade: r.exit_trade,
    sell_above_cost_basis: r.sell_above_cost_basis,
    exit_to_entry_proportion: r.exit_to_entry_proportion,
    algorithm_inputs: {
      ...ai,
      buyHoldPnlPercent: buyHold,
      dcaPnlPercent: dca,
      benchmark: { ...ai.benchmark ?? {}, showBuyHold, showDca },
      showDcaBenchmark: showDca
    },
    change_note: `From the case study "${study.title ?? study.slug}", scenario "${scenario.title ?? scenario.key}".`
  };
  if (start) fields.test_start = start;
  const chartEnd = figures.windowEnd ?? result.lastBarDate ?? null;
  if (futureEnd && chartEnd) {
    fields.test_end = chartEnd;
    fields.test_end_source = "chart_last_bar";
  } else if (end && !futureEnd) {
    fields.test_end = end;
    fields.test_end_source = "settings";
  }
  if (opts.extractionId) fields.extraction_id = opts.extractionId;
  return fields;
}
function round2(n) {
  return Math.round(n * 100) / 100;
}
function numOrNull(v) {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}
function firstNum(t) {
  if (typeof t === "number") return t;
  return parseFigure(t ?? null);
}
var COMPARED_SETTINGS = [
  "userInitialCapital.startingCash",
  "userInitialCapital.startingQty",
  "longThreshold.enabled",
  "longThreshold.percent",
  "exitThreshold.enabled",
  "exitThreshold.percent",
  "tradeSize.sharesEnabled",
  "tradeSize.entryShares",
  "tradeSize.exitShares",
  "tradeSize.fixedEnabled",
  "tradeSize.entryFixed",
  "tradeSize.exitFixed",
  "tradeSize.percentEnabled",
  "tradeSize.entryPercent",
  "tradeSize.exitPercent",
  "tradeSize.roundDownWholeShares",
  "marketWave.scope",
  "marketWave.onlySellAbove",
  "marketWave.onlyBuyBelow",
  "marketWave.sellBuffer",
  "marketWave.buyBuffer",
  "staticPriceFilter.sellAboveEnabled",
  "staticPriceFilter.sellAbove",
  "staticPriceFilter.buyBelowEnabled",
  "staticPriceFilter.buyBelow",
  "trendFilter.buyInDownTrend",
  "trendFilter.buyInUpTrend",
  "trendFilter.sellInDownTrend",
  "trendFilter.sellInUpTrend",
  "trendFilter.buyOnUpTrend",
  "trendFilter.sellOnDownTrend",
  "dates.start.year",
  "dates.start.month",
  "dates.start.day",
  "dates.start.hour",
  "dates.start.minute",
  "dates.end.year",
  "dates.end.month",
  "dates.end.day",
  "backtest.exitFullOnLastBar"
];
function at(obj, path) {
  return path.split(".").reduce((o, k) => o && typeof o === "object" ? o[k] : void 0, obj);
}
function same(a, b) {
  if (typeof a === "number" && typeof b === "number") return Math.abs(a - b) < 1e-9;
  if ((a === void 0 || a === null) && b === false) return true;
  if ((b === void 0 || b === null) && a === false) return true;
  return JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
}
function compareSettings(read, stored) {
  const out = [];
  for (const path of COMPARED_SETTINGS) {
    const a = at(read, path);
    const b = at(stored, path);
    if (!same(a, b)) out.push({ path, read: a ?? null, stored: b ?? null });
  }
  return out;
}
export {
  COMPARED_SETTINGS,
  CORE_SCREENSHOT_KINDS,
  DESCRIPTION_MAX_LENGTH,
  MAX_IMPORT_SCREENSHOT_COUNT,
  MIN_IMPORT_SCREENSHOT_COUNT,
  NAMING_INSTRUCTIONS,
  NAMING_JSON_SCHEMA,
  NAMING_PROMPT_VERSION,
  PIPELINE_VERSION,
  PROMPT_VERSION,
  RECIPE_SCREENSHOT_EXTRACTION_PROMPT,
  RECIPE_SCREENSHOT_KINDS,
  RECIPE_SCREENSHOT_LABELS,
  REQUIRED_SCREENSHOT_COUNT,
  REQUIRED_SOURCE_KINDS,
  SOURCE_FILES,
  SUMMARY_MAX_LENGTH,
  TITLE_MAX_LENGTH,
  buildRecipeFromExtraction,
  chartLabelTimeFrame,
  checkScenario,
  classifyKindsFromFilenames,
  compareSettings,
  crossCheckChartAgainstSettings,
  defaultTitle,
  draftFields,
  fallbackTitle,
  fingerprintInput,
  holds,
  inferAssetClass,
  isImportableScreenshotCount,
  isStoredTimeFrame,
  namingProblems,
  namingPrompt,
  normalizeTimeFrame,
  orderFilesByKinds,
  parseFigure,
  parseMarketWaveChartParams,
  parseWindow,
  plainAssetName,
  planScenario,
  runEnd,
  runStart,
  sameCompany,
  scenarioCompany,
  scenarioFigures,
  scenarioIsMarketWave,
  scenarioTicker,
  settingsSummary,
  sourceKind,
  strategyLine,
  timeFrameAdjective,
  timeFrameLabel,
  titleProblems,
  validateExtractionShape
};
