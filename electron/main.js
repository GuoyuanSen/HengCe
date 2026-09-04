const { app, BrowserWindow, ipcMain, Menu, nativeImage, net, Notification, safeStorage, shell, Tray } = require("electron");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const {
  INDEX_DEFINITIONS,
  parseTencentKLines,
  parseTencentMinutePayload,
  parseTencentQuote,
  secidFor,
  tencentSymbolFor,
  validatedCode
} = require("./market.js");
const {
  buildValuationModel,
  parseAnalystForecast,
  parseCompanyForecast,
  parseFinancialReports,
  parseIndustryMembers,
  parseValuationSnapshot
} = require("./valuation.js");
const { buildHotspotSnapshot, parseBoardMembersPayload } = require("./hotspots.js");
const { analyze } = require("../src/engine.js");
const {
  buildRecommendationSnapshot,
  isRiskName,
  parseCandidatePayload,
  validateHistoricalSignals
} = require("./recommendations.js");
const {
  analyzeOvernightCandidatePayload,
  buildOvernightSnapshot,
  intradayAverageState,
  normalizeMarketScope,
  parseIntradayTrends,
  parseOvernightCandidatePayload,
  recentLimitUp,
  scanWindow,
  validateOvernightProxy
} = require("./overnight.js");
const {
  buildUpdateModel,
  parseChecksum,
  publicUpdateModel,
  shouldQuitAfterOpeningUpdate
} = require("./updater.js");
const {
  GLOBAL_MARKETS,
  STYLE_INDEX_DEFINITIONS,
  buildCompassSnapshot,
  parseTencentGlobalQuotes
} = require("./compass.js");
const {
  TRACKING_REPORT_SCHEMA,
  buildTrackingInput,
  buildTrackingInstructions,
  normalizeTrackingReport
} = require("../src/ai_tracking.js");
const {
  DEFAULT_AI_SETTINGS,
  normalizeAiSettings,
  parseJsonResponse,
  publicAiSettings,
  responsesUrl,
  safeApiError
} = require("./ai_service.js");
const { parseCompanyOrganization, parseStockAnnouncements, profileSecucode } = require("./company.js");
const {
  GLOBAL_OFFICIAL_FEEDS,
  attachMarketConfirmation,
  buildIntelligenceSnapshot,
  parseOfficialRss,
  parseSinaRoll,
  parseWallstreetLives
} = require("./intelligence.js");
const {
  EVENT_INTERPRETATION_SCHEMA,
  eventInterpretationInput,
  eventInterpretationInstructions,
  normalizeEventInterpretation
} = require("../src/intelligence.js");
const { MACRO_SERIES, buildMacroSnapshot } = require("./macro.js");
const { buildMarketRegime } = require("../src/market_regime.js");
const {
  LIMIT_POOL_DEFINITIONS,
  mergeLimitPools,
  parseExchangeBreadthPayload,
  parseLimitPoolPayload
} = require("./breadth.js");
const {
  CONTEXT_ANSWER_SCHEMA,
  contextAssistantInput,
  contextAssistantInstructions,
  normalizeContextAnswer
} = require("../src/research_assistant.js");
const {
  calendarCoverage,
  marketParts,
  mergeOfficialCalendar
} = require("../src/trading_calendar.js");
const {
  CALENDAR_SOURCE_URL,
  normalizeCalendarPayload,
  parseSseCalendarHtml
} = require("./trading_calendar_sync.js");

const APP_ID = "com.guoyuansen.hengce";
const FRIENDLY_MARKET_ERROR = "行情服务暂时无响应，请检查网络后重试。";
const TENCENT_HEADERS = {
  Accept: "*/*",
  Referer: "https://stockapp.finance.qq.com/"
};
const RELEASE_API_URL =
  "https://api.github.com/repos/GuoyuanSen/HengCe/releases/latest";
const isolatedUserData = String(process.env.HENGCE_USER_DATA_DIR || "").trim();
if (isolatedUserData && path.isAbsolute(isolatedUserData)) {
  app.setPath("userData", isolatedUserData);
}
let downloadedUpdate = null;
let updateDownloadActive = false;
let mainWindow = null;
let tray = null;
let minimizeToTrayEnabled = true;
let trayHintShown = false;
let isQuitting = false;
let sessionAiKey = "";
const responseCache = new Map();
let calendarSyncPromise = null;

async function cachedRequest(key, ttl, loader, force = false) {
  const now = Date.now();
  const cached = responseCache.get(key);
  if (!force && cached?.value && cached.expiresAt > now) return cached.value;
  if (!force && cached?.promise) return cached.promise;
  const promise = Promise.resolve()
    .then(loader)
    .then((value) => {
      responseCache.set(key, { value, expiresAt: Date.now() + ttl });
      return value;
    })
    .catch((error) => {
      if (cached?.value) responseCache.set(key, cached);
      else responseCache.delete(key);
      throw error;
    });
  responseCache.set(key, { ...cached, promise });
  return promise;
}

function sleep(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function requestData(
  url,
  {
    encoding = "utf-8",
    headers = {},
    parse = (text) => text,
    timeoutMs = 8000,
    attempts = 2
  } = {}
) {
  let lastError;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await net.fetch(url, {
        signal: controller.signal,
        headers: {
          "Cache-Control": "no-cache",
          "User-Agent": `HengCe/${app.getVersion()}`,
          ...headers
        }
      });
      if (!response.ok) {
        throw new Error(`行情服务返回 ${response.status}`);
      }
      const bytes = Buffer.from(await response.arrayBuffer());
      if (!bytes.length) {
        throw new Error("行情服务返回空响应");
      }
      const text = new TextDecoder(encoding).decode(bytes);
      return parse(text);
    } catch (error) {
      lastError = error;
      if (attempt < attempts - 1) await sleep(250);
    } finally {
      clearTimeout(timeout);
    }
  }
  throw lastError;
}

function requestJSON(url, options = {}) {
  return requestData(url, {
    ...options,
    headers: {
      Accept: "application/json, text/plain, */*",
      ...options.headers
    },
    parse: JSON.parse
  });
}

function tradingCalendarCachePath() {
  return path.join(app.getPath("userData"), "trading-calendar.json");
}

function readTradingCalendarCache() {
  try {
    return normalizeCalendarPayload(
      JSON.parse(fs.readFileSync(tradingCalendarCachePath(), "utf8"))
    );
  } catch {
    return null;
  }
}

function writeTradingCalendarCache(calendar) {
  const destination = tradingCalendarCachePath();
  const temporary = `${destination}.tmp`;
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.writeFileSync(temporary, `${JSON.stringify(calendar, null, 2)}\n`, { mode: 0o600 });
  fs.renameSync(temporary, destination);
}

function installCachedTradingCalendar() {
  const calendar = readTradingCalendarCache();
  if (calendar) mergeOfficialCalendar(calendar);
  return calendar;
}

function publicTradingCalendarStatus(calendar, status, error = "") {
  const currentYear = marketParts().year;
  const coverage = calendarCoverage(currentYear);
  return {
    status,
    currentYear,
    covered: coverage.covered,
    coverage,
    calendar: calendar || null,
    error: String(error || "")
  };
}

async function syncTradingCalendar(options = {}) {
  const force = options.force === true;
  const cached = installCachedTradingCalendar();
  const currentYear = marketParts().year;
  const fetchedAt = new Date(cached?.fetchedAt || 0).getTime();
  const fresh = Number.isFinite(fetchedAt) && Date.now() - fetchedAt < 7 * 86400000;
  if (!force && cached?.year >= currentYear && fresh) {
    return publicTradingCalendarStatus(cached, "cached");
  }
  if (calendarSyncPromise) return calendarSyncPromise;
  calendarSyncPromise = (async () => {
    try {
      const html = await requestData(CALENDAR_SOURCE_URL, {
        headers: { Accept: "text/html,application/xhtml+xml" },
        timeoutMs: 8000,
        attempts: 2
      });
      const calendar = parseSseCalendarHtml(html);
      if (calendar.year < currentYear) {
        throw new Error(`交易所页面尚未发布 ${currentYear} 年休市安排`);
      }
      mergeOfficialCalendar(calendar);
      writeTradingCalendarCache(calendar);
      return publicTradingCalendarStatus(calendar, "online");
    } catch (error) {
      if (cached?.year >= currentYear) {
        return publicTradingCalendarStatus(cached, "stale-cache", error?.message);
      }
      const coverage = calendarCoverage(currentYear);
      return publicTradingCalendarStatus(
        null,
        coverage.covered ? "builtin" : "unavailable",
        error?.message
      );
    }
  })().finally(() => {
    calendarSyncPromise = null;
  });
  return calendarSyncPromise;
}

async function firstAvailable(label, providers) {
  const errors = [];
  for (const provider of providers) {
    try {
      return await provider();
    } catch (error) {
      errors.push(error);
    }
  }
  console.warn(
    `${label}全部失败：${errors.map((error) => error?.message).join(" | ")}`
  );
  throw new Error(FRIENDLY_MARKET_ERROR);
}

async function fetchEastmoneyQuote(code, secid, nameOverride) {
  const fields = "f43,f44,f45,f46,f47,f48,f57,f58,f60,f170";
  const params = new URLSearchParams({
    secid,
    fltt: "2",
    invt: "2",
    fields
  });
  const payload = await requestJSON(
    `https://push2.eastmoney.com/api/qt/stock/get?${params}`
  );
  const item = payload?.data;
  if (!item || typeof item.f43 !== "number") {
    throw new Error("暂未取得该股票的行情数据");
  }

  return {
    code: String(item.f57 || code),
    name: nameOverride || item.f58 || code,
    price: Number(item.f43),
    previousClose: Number(item.f60 ?? item.f43),
    open: Number(item.f46 ?? item.f43),
    high: Number(item.f44 ?? item.f43),
    low: Number(item.f45 ?? item.f43),
    percentChange: Number(item.f170 ?? 0),
    volume: Number(item.f47 ?? 0),
    amount: Number(item.f48 ?? 0),
    timestamp: new Date().toISOString(),
    source: "东方财富"
  };
}

async function fetchTencentQuote(code, symbol, nameOverride) {
  const text = await requestData(`https://qt.gtimg.cn/q=${symbol}`, {
    encoding: "gb18030",
    headers: TENCENT_HEADERS
  });
  return { ...parseTencentQuote(text, code, nameOverride), source: "腾讯行情" };
}

function fetchQuoteWithFallback(code, options = {}) {
  const symbol = options.tencentSymbol || tencentSymbolFor(code);
  const secid = options.secid || secidFor(code);
  return firstAvailable(`行情 ${code}`, [
    () => fetchTencentQuote(code, symbol, options.name),
    () => fetchEastmoneyQuote(code, secid, options.name)
  ]);
}

async function fetchQuote(rawCode) {
  const code = validatedCode(rawCode);
  return fetchQuoteWithFallback(code);
}

async function searchStocks(rawQuery) {
  const query = String(rawQuery || "").trim().slice(0, 20);
  if (!query) return [];
  const params = new URLSearchParams({
    input: query,
    type: "14",
    count: "10",
    token: "D43BF722C8E33BDC906FB84D85E326E8"
  });
  const payload = await requestJSON(
    `https://searchapi.eastmoney.com/api/suggest/get?${params}`
  );
  const rows = payload?.QuotationCodeTable?.Data || payload?.Data || payload?.data || [];
  if (!Array.isArray(rows)) return [];
  const seen = new Set();
  return rows
    .map((item) => ({
      code: String(item?.Code || item?.code || "").trim(),
      name: String(item?.Name || item?.name || "").trim(),
      market: String(item?.SecurityTypeName || item?.MktName || item?.market || "A股").trim()
    }))
    .filter((item) => {
      if (!/^\d{6}$/.test(item.code) || !item.name || seen.has(item.code)) return false;
      seen.add(item.code);
      return /^(0|3|6)/.test(item.code);
    })
    .slice(0, 8);
}

async function fetchEastmoneyKLines(code, limit) {
  const params = new URLSearchParams({
    secid: secidFor(code),
    klt: "101",
    fqt: "1",
    lmt: String(limit),
    end: "20500101",
    fields1: "f1,f2,f3,f4,f5,f6",
    fields2: "f51,f52,f53,f54,f55,f56,f57,f58,f59,f60,f61"
  });
  const payload = await requestJSON(
    `https://push2his.eastmoney.com/api/qt/stock/kline/get?${params}`
  );
  const lines = payload?.data?.klines;
  if (!Array.isArray(lines)) {
    throw new Error("历史行情暂不可用");
  }

  return lines
    .map((line) => {
      const values = line.split(",");
      if (values.length < 11) return null;
      const bar = {
        date: values[0],
        open: Number(values[1]),
        close: Number(values[2]),
        high: Number(values[3]),
        low: Number(values[4]),
        volume: Number(values[5]),
        amount: Number(values[6]),
        percentChange: Number(values[8])
      };
      return Object.values(bar).some((value) =>
        typeof value === "number" ? !Number.isFinite(value) : false
      )
        ? null
        : bar;
    })
    .filter(Boolean);
}

async function fetchTencentKLines(code, limit) {
  const symbol = tencentSymbolFor(code);
  const barsByDate = new Map();
  let endDate = "";

  while (barsByDate.size < limit) {
    const count = Math.min(640, limit - barsByDate.size);
    const params = `${symbol},day,,${endDate},${count},qfq`;
    const payload = await requestJSON(
      `https://web.ifzq.gtimg.cn/appstock/app/fqkline/get?param=${params}`,
      { headers: TENCENT_HEADERS }
    );
    const chunk = parseTencentKLines(payload, symbol);
    if (!chunk.length) break;
    chunk.forEach((bar) => barsByDate.set(bar.date, bar));

    const oldest = new Date(`${chunk[0].date}T00:00:00Z`);
    oldest.setUTCDate(oldest.getUTCDate() - 1);
    const nextEndDate = oldest.toISOString().slice(0, 10);
    if (nextEndDate === endDate || chunk.length < count) break;
    endDate = nextEndDate;
  }

  const bars = [...barsByDate.values()]
    .sort((left, right) => left.date.localeCompare(right.date))
    .slice(-limit);
  return bars.map((bar, index) => ({
    ...bar,
    percentChange:
      index > 0 && bars[index - 1].close
        ? (bar.close / bars[index - 1].close - 1) * 100
        : 0
  }));
}

async function fetchKLines(rawCode, requestedLimit = 1300) {
  const code = validatedCode(rawCode);
  const limit = Math.max(120, Math.min(Number(requestedLimit) || 1300, 2500));
  return firstAvailable(`历史行情 ${code}`, [
    () => fetchTencentKLines(code, limit),
    () => fetchEastmoneyKLines(code, limit)
  ]);
}

async function fetchIndices() {
  const settled = await Promise.allSettled(
    INDEX_DEFINITIONS.map(async ({ code, name, secid, tencentSymbol }) => {
      const quote = await fetchQuoteWithFallback(code, {
        name,
        secid,
        tencentSymbol
      });
      return {
        code,
        name,
        price: quote.price,
        percentChange: quote.percentChange,
        timestamp: quote.timestamp,
        source: quote.source
      };
    })
  );
  return settled
    .filter((item) => item.status === "fulfilled")
    .map((item) => item.value);
}

async function fetchStyleRepresentatives(componentType) {
  const params = new URLSearchParams({
    reportName: "RPT_INDEX_TS_COMPONENT",
    columns: "TYPE,SECURITY_CODE,SECURITY_NAME_ABBR,WEIGHT,FREE_CAP,CHANGE_RATE,INDUSTRY,MAXTRADEDATE",
    filter: `(TYPE="${componentType}")`,
    sortColumns: "WEIGHT,FREE_CAP",
    sortTypes: "-1,-1",
    pageNumber: "1",
    pageSize: "8",
    source: "WEB",
    client: "WEB"
  });
  const payload = await requestJSON(
    `https://datacenter-web.eastmoney.com/api/data/v1/get?${params}`
  );
  const rows = payload?.result?.data;
  if (!Array.isArray(rows)) return [];
  return rows
    .map((item) => ({
      code: String(item.SECURITY_CODE || "").trim(),
      name: String(item.SECURITY_NAME_ABBR || "").trim(),
      weight: item.WEIGHT != null && Number.isFinite(Number(item.WEIGHT)) ? Number(item.WEIGHT) : null,
      freeCap: item.FREE_CAP != null && Number.isFinite(Number(item.FREE_CAP)) ? Number(item.FREE_CAP) : null,
      percentChange: item.CHANGE_RATE != null && Number.isFinite(Number(item.CHANGE_RATE)) ? Number(item.CHANGE_RATE) : null,
      industry: String(item.INDUSTRY || "未分类").trim() || "未分类",
      asOf: String(item.MAXTRADEDATE || "").slice(0, 10)
    }))
    .filter((item) => /^\d{6}$/.test(item.code) && item.name && !isRiskName(item.name))
    .slice(0, 3);
}

async function fetchMarketCompass() {
  const symbols = GLOBAL_MARKETS.map((item) => item.symbol).join(",");
  const [globalResult, domesticResult, styleResult] = await Promise.allSettled([
    requestData(`https://qt.gtimg.cn/q=${symbols}`, {
      encoding: "gb18030",
      headers: TENCENT_HEADERS
    }).then((text) => parseTencentGlobalQuotes(text)),
    fetchIndices(),
    Promise.allSettled(
      STYLE_INDEX_DEFINITIONS.map(async ({ code, name, style, componentType, secid, tencentSymbol }) => {
        const [quote, representatives] = await Promise.all([
          fetchQuoteWithFallback(code, { name, secid, tencentSymbol }),
          fetchStyleRepresentatives(componentType).catch(() => [])
        ]);
        return {
          code,
          name,
          style,
          price: quote.price,
          percentChange: quote.percentChange,
          timestamp: quote.timestamp,
          source: quote.source,
          representatives
        };
      })
    ).then((results) => results.filter((item) => item.status === "fulfilled").map((item) => item.value))
  ]);
  const globalMarkets = globalResult.status === "fulfilled" ? globalResult.value : [];
  const domesticMarkets = domesticResult.status === "fulfilled" ? domesticResult.value : [];
  const styleMarkets = styleResult.status === "fulfilled" ? styleResult.value : [];
  if (!globalMarkets.length && !domesticMarkets.length && !styleMarkets.length) {
    throw new Error(FRIENDLY_MARKET_ERROR);
  }
  return buildCompassSnapshot({
    globalMarkets,
    domesticMarkets,
    styleMarkets,
    asOf: new Date().toISOString(),
    sourceStatus: {
      globalSource: globalMarkets.length ? "腾讯全球指数" : "全球指数暂缺",
      domesticSource: domesticMarkets.length ? "腾讯行情优先，东方财富降级" : "A股指数暂缺",
      styleSource: styleMarkets.length ? "腾讯行情优先，东方财富降级" : "A股风格指数暂缺"
    }
  });
}

function fetchDataset(reportName, code) {
  const params = new URLSearchParams({
    reportName,
    columns: "ALL",
    filter: `(SECURITY_CODE="${code}")`,
    pageNumber: "1",
    pageSize: "100",
    source: "WEB",
    client: "WEB"
  });
  return requestJSON(
    `https://datacenter-web.eastmoney.com/api/data/v1/get?${params}`
  );
}

function fetchValuationSnapshot(code) {
  const params = new URLSearchParams({
    secid: secidFor(code),
    fltt: "2",
    invt: "2",
    fields: "f43,f57,f58,f116,f117,f162,f163,f164,f167"
  });
  return firstAvailable(`估值快照 ${code}`, [
    () =>
      requestJSON(
        `https://push2delay.eastmoney.com/api/qt/stock/get?${params}`
      ),
    () =>
      requestJSON(`https://push2.eastmoney.com/api/qt/stock/get?${params}`)
  ]);
}

async function fetchIndustryMembers(industryCode) {
  if (!/^BK\d+$/.test(industryCode)) return [];
  const fields = "f12,f14,f2,f3,f9,f23,f62,f267";
  const fetchPage = (pageNumber) => {
    const params = new URLSearchParams({
      pn: String(pageNumber),
      pz: "100",
      po: "1",
      np: "1",
      fltt: "2",
      invt: "2",
      fid: "f3",
      fs: `b:${industryCode}`,
      fields
    });
    return firstAvailable(`行业成分 ${industryCode}`, [
      () =>
        requestJSON(
          `https://push2delay.eastmoney.com/api/qt/clist/get?${params}`
        ),
      () =>
        requestJSON(`https://push2.eastmoney.com/api/qt/clist/get?${params}`)
    ]);
  };
  const firstPage = await fetchPage(1);
  const total = Number(firstPage?.data?.total || 0);
  const pageCount = Math.min(5, Math.ceil(total / 100));
  if (pageCount <= 1) return [firstPage];
  const remaining = await Promise.allSettled(
    Array.from({ length: pageCount - 1 }, (_, index) => fetchPage(index + 2))
  );
  return [
    firstPage,
    ...remaining
      .filter((item) => item.status === "fulfilled")
      .map((item) => item.value)
  ];
}

async function fetchValuation(rawCode) {
  const code = validatedCode(rawCode);
  const [snapshotResult, reportsResult, forecastResult, analystResult] =
    await Promise.allSettled([
      fetchValuationSnapshot(code),
      fetchDataset("RPT_LICO_FN_CPD", code),
      fetchDataset("RPT_PUBLIC_OP_NEWPREDICT", code),
      fetchDataset("RPT_WEB_RESPREDICT", code)
    ]);
  if (snapshotResult.status !== "fulfilled") {
    throw snapshotResult.reason;
  }

  const snapshot = parseValuationSnapshot(snapshotResult.value, code);
  const reports =
    reportsResult.status === "fulfilled"
      ? parseFinancialReports(reportsResult.value)
      : [];
  const companyForecast =
    forecastResult.status === "fulfilled"
      ? parseCompanyForecast(forecastResult.value)
      : { parentProfit: null, deductedProfit: null };
  const analystForecast =
    analystResult.status === "fulfilled"
      ? parseAnalystForecast(analystResult.value)
      : null;
  const industryName =
    reports[0]?.industryName || analystForecast?.industryName || "";
  let industry = null;
  if (reports[0]?.industryCode) {
    try {
      const pages = await fetchIndustryMembers(reports[0].industryCode);
      industry = parseIndustryMembers(pages, industryName);
    } catch (error) {
      console.warn(`行业估值暂不可用：${error?.message}`);
    }
  }

  return buildValuationModel({
    snapshot,
    reports,
    companyForecast,
    analystForecast,
    industry
  });
}

async function fetchBoardRanking(type, boardFilter, sortField) {
  const params = new URLSearchParams({
    pn: "1",
    pz: "100",
    po: "1",
    np: "1",
    fltt: "2",
    invt: "2",
    fid: sortField,
    fs: boardFilter,
    fields:
      "f12,f14,f2,f3,f62,f184,f104,f105,f128,f136,f140,f141,f267,f268"
  });
  const payload = await firstAvailable(`${type}热点 ${sortField}`, [
    () =>
      requestJSON(
        `https://push2delay.eastmoney.com/api/qt/clist/get?${params}`
      ),
    () =>
      requestJSON(`https://push2.eastmoney.com/api/qt/clist/get?${params}`)
  ]);
  if (!Array.isArray(payload?.data?.diff) || !payload.data.diff.length) {
    throw new Error(`${type}热点数据为空`);
  }
  return { type, payload };
}

async function fetchHotspots() {
  const requests = [
    ["行业", "m:90+t:2"],
    ["概念", "m:90+t:3"]
  ].flatMap(([type, boardFilter]) =>
    ["f3", "f62", "f267"].map((sortField) =>
      fetchBoardRanking(type, boardFilter, sortField)
    )
  );
  const settled = await Promise.allSettled(requests);
  const sources = settled
    .filter((item) => item.status === "fulfilled")
    .map((item) => item.value);
  if (!sources.length) throw new Error(FRIENDLY_MARKET_ERROR);
  return buildHotspotSnapshot(sources, {
    asOf: new Date().toISOString(),
    requestedSources: requests.length
  });
}

function recentShanghaiWeekdays(limit = 8) {
  const current = marketParts();
  const cursor = new Date(Date.UTC(current.year, current.month - 1, current.day));
  const output = [];
  for (let offset = 0; offset < 14 && output.length < limit; offset += 1) {
    const weekday = cursor.getUTCDay();
    if (weekday !== 0 && weekday !== 6) output.push(cursor.toISOString().slice(0, 10).replaceAll("-", ""));
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }
  return output;
}

async function fetchLimitPool(definition, date) {
  const params = new URLSearchParams({
    ut: "7eea3edcaed734bea9cbfc24409ed989",
    dpt: "wz.ztzt",
    Pageindex: "0",
    pagesize: "1",
    sort: definition.sort,
    date
  });
  const payload = await requestJSON(
    `https://push2ex.eastmoney.com/${definition.endpoint}?${params}`,
    { headers: { Referer: "https://quote.eastmoney.com/" }, timeoutMs: 5500, attempts: 1 }
  );
  return parseLimitPoolPayload(payload, definition);
}

async function fetchLatestLimitPools() {
  for (const date of recentShanghaiWeekdays()) {
    try {
      const first = await fetchLimitPool(LIMIT_POOL_DEFINITIONS[0], date);
      if (!first) continue;
      const rest = await Promise.allSettled(
        LIMIT_POOL_DEFINITIONS.slice(1).map((definition) => fetchLimitPool(definition, date))
      );
      return mergeLimitPools([
        first,
        ...rest.map((result) => result.status === "fulfilled" ? result.value : null)
      ]);
    } catch {
      // Try the previous weekday. Holidays and pre-open periods may not have a pool yet.
    }
  }
  return mergeLimitPools([]);
}

async function fetchExchangeBreadth() {
  const params = new URLSearchParams({
    fltt: "2",
    invt: "2",
    fields: "f12,f14,f104,f105,f106",
    secids: "1.000001,0.399001"
  });
  const payload = await firstAvailable("沪深涨跌家数", [
    () => requestJSON(`https://push2delay.eastmoney.com/api/qt/ulist.np/get?${params}`),
    () => requestJSON(`https://push2.eastmoney.com/api/qt/ulist.np/get?${params}`)
  ]);
  const breadth = parseExchangeBreadthPayload(payload);
  if (!breadth) throw new Error("沪深涨跌家数暂不可用");
  return breadth;
}

async function fetchMarketBreadth() {
  const [hotspotsResult, compassResult, poolsResult, exchangeResult] = await Promise.allSettled([
    cachedRequest("hotspots", 120000, fetchHotspots),
    cachedRequest("market-compass", 60000, fetchMarketCompass),
    cachedRequest("limit-pools", 60000, fetchLatestLimitPools),
    cachedRequest("exchange-breadth", 30000, fetchExchangeBreadth)
  ]);
  const hotspots = hotspotsResult.status === "fulfilled" ? hotspotsResult.value : null;
  const compass = compassResult.status === "fulfilled" ? compassResult.value : null;
  const limitPools = poolsResult.status === "fulfilled" ? poolsResult.value : null;
  const exchangeBreadth = exchangeResult.status === "fulfilled" ? exchangeResult.value : null;
  const breadth = exchangeBreadth
    ? {
        ...exchangeBreadth,
        industryAdvancingRate: hotspots?.summary?.breadth?.industryAdvancingRate ?? null,
        medianBoardChange: hotspots?.summary?.breadth?.medianBoardChange ?? null,
        industryCount: hotspots?.summary?.breadth?.industryCount ?? null
      }
    : hotspots?.summary?.breadth || {};
  if (!breadth.measuredStocks && !limitPools?.date) throw new Error(FRIENDLY_MARKET_ERROR);
  return buildMarketRegime({
    asOf: new Date().toISOString(),
    breadth,
    limitPools: limitPools || {},
    hotspotSummary: hotspots?.summary || {},
    compassRegime: compass?.regime || {},
    sourceStatus: {
      partial: !exchangeBreadth || !hotspots || !compass || !limitPools?.date || limitPools.partial,
      sources: [
        { name: "东方财富沪深涨跌家数", available: Boolean(exchangeBreadth), asOf: new Date().toISOString() },
        { name: "东方财富行业扩散", available: Boolean(hotspots?.summary?.breadth), asOf: hotspots?.asOf || "" },
        { name: "东方财富涨跌停池", available: Boolean(limitPools?.date), asOf: limitPools?.date || "" },
        { name: "腾讯/东方财富指数环境", available: Boolean(compass), asOf: compass?.asOf || "" }
      ]
    }
  });
}

async function fetchBoardMembers(rawBoardCode) {
  const boardCode = String(rawBoardCode || "").trim().toUpperCase();
  if (!/^BK\d{4}$/.test(boardCode)) throw new Error("板块代码无效");
  const params = new URLSearchParams({
    pn: "1",
    pz: "12",
    po: "1",
    np: "1",
    fltt: "2",
    invt: "2",
    fid: "f3",
    fs: `b:${boardCode}`,
    fields: "f2,f3,f6,f8,f10,f12,f14,f62,f100"
  });
  const payload = await firstAvailable(`板块成分 ${boardCode}`, [
    () => requestJSON(`https://push2delay.eastmoney.com/api/qt/clist/get?${params}`),
    () => requestJSON(`https://push2.eastmoney.com/api/qt/clist/get?${params}`)
  ]);
  const members = parseBoardMembersPayload(payload);
  if (!members.length) throw new Error("板块成分股暂不可用");
  return { boardCode, asOf: new Date().toISOString(), members };
}

async function mapWithConcurrency(items, limit, mapper) {
  const results = Array(items.length);
  let nextIndex = 0;
  async function worker() {
    while (nextIndex < items.length) {
      const index = nextIndex;
      nextIndex += 1;
      try {
        results[index] = { status: "fulfilled", value: await mapper(items[index]) };
      } catch (reason) {
        results[index] = { status: "rejected", reason };
      }
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, () => worker())
  );
  return results;
}

async function fetchRecommendations() {
  const params = new URLSearchParams({
    pn: "1",
    pz: "100",
    po: "1",
    np: "1",
    fltt: "2",
    invt: "2",
    fid: "f6",
    fs: "m:0+t:6,m:0+t:80,m:1+t:2,m:1+t:23",
    fields: "f2,f3,f6,f8,f9,f12,f14,f20,f21,f23,f100"
  });
  const fetchPool = async (baseUrl) => {
    const payload = await requestJSON(`${baseUrl}?${params}`);
    if (!Array.isArray(payload?.data?.diff) || !payload.data.diff.length) {
      throw new Error("A股候选池数据为空");
    }
    return payload;
  };
  const payload = await firstAvailable("A股候选池", [
    () => fetchPool("https://push2delay.eastmoney.com/api/qt/clist/get"),
    () => fetchPool("https://push2.eastmoney.com/api/qt/clist/get")
  ]);
  const pool = parseCandidatePayload(payload);
  if (!pool.length) throw new Error(FRIENDLY_MARKET_ERROR);
  const selected = pool.slice(0, 30);
  const benchmarkPromise = Promise.allSettled([
    fetchKLines("000001", 260),
    fetchKLines("399001", 260)
  ]);
  const settled = await mapWithConcurrency(selected, 6, async (candidate) => {
    const bars = await fetchKLines(candidate.code, 260);
    return {
      candidate,
      model: analyze(bars),
      bars
    };
  });
  const benchmarkResults = await benchmarkPromise;
  const shanghaiBenchmark = benchmarkResults[0].status === "fulfilled" ? benchmarkResults[0].value : [];
  const shenzhenBenchmark = benchmarkResults[1].status === "fulfilled" ? benchmarkResults[1].value : [];
  const candidates = settled
    .filter((item) => item.status === "fulfilled")
    .map((item) => ({
      candidate: item.value.candidate,
      model: item.value.model,
      validation: validateHistoricalSignals(
        item.value.bars,
        analyze,
        item.value.candidate,
        { benchmarkBars: /^6/.test(item.value.candidate.code) ? shanghaiBenchmark : shenzhenBenchmark }
      )
    }));
  if (!candidates.length) throw new Error(FRIENDLY_MARKET_ERROR);
  const snapshot = buildRecommendationSnapshot(candidates, {
    asOf: new Date().toISOString(),
    candidatePool: pool.length
  });
  snapshot.sourceStatus = {
    candidateSource: "东方财富成交额榜",
    historySource: "腾讯前复权日线优先，东方财富降级；沪深指数作超额基准",
    loaded: candidates.length,
    requested: selected.length,
    partial: candidates.length < selected.length
  };
  return snapshot;
}

async function fetchIntradayTrends(code) {
  const params = new URLSearchParams({
    secid: secidFor(code),
    fields1: "f1,f2,f3,f4,f5,f6,f7,f8,f9,f10,f11,f12,f13",
    fields2: "f51,f52,f53,f54,f55,f56,f57,f58",
    ndays: "1",
    iscr: "0",
    iscca: "0"
  });
  const fetchTrends = async (baseUrl) => {
    const payload = await requestJSON(`${baseUrl}?${params}`, {
      timeoutMs: 4500,
      attempts: 1
    });
    const points = parseIntradayTrends(payload);
    if (!points.length) throw new Error("分时均价数据为空");
    return points.map((point) => ({ ...point, source: "东方财富" }));
  };
  const fetchTencentTrends = async () => {
    const symbol = tencentSymbolFor(code);
    const payload = await requestJSON(
      `https://web.ifzq.gtimg.cn/appstock/app/minute/query?code=${symbol}`,
      { headers: TENCENT_HEADERS, timeoutMs: 4500, attempts: 1 }
    );
    const points = parseTencentMinutePayload(payload, symbol);
    if (!points.length) throw new Error("腾讯分时行情数据为空");
    return points;
  };
  return firstAvailable(`分时行情 ${code}`, [
    fetchTencentTrends,
    () => fetchTrends("https://push2.eastmoney.com/api/qt/stock/trends2/get"),
    () => fetchTrends("https://push2delay.eastmoney.com/api/qt/stock/trends2/get"),
    () => fetchTrends("https://push2his.eastmoney.com/api/qt/stock/trends2/get")
  ]);
}

async function fetchOvernightScan(options = {}) {
  const marketScope = normalizeMarketScope(options.marketScope);
  const window = scanWindow();
  if (!window.canScan) {
    return {
      ...buildOvernightSnapshot([], { window, poolSize: 0, prefilteredCount: 0, marketScope }),
      sourceStatus: {
        candidateSource: "东方财富A股实时行情",
        intradaySource: "腾讯分时优先，东方财富多节点降级",
        historySource: "腾讯行情优先，东方财富降级",
        partial: false
      }
    };
  }
  const params = new URLSearchParams({
    pn: "1",
    pz: "100",
    po: "1",
    np: "1",
    fltt: "2",
    invt: "2",
    fid: "f3",
    fs: "m:0+t:6,m:0+t:80,m:1+t:2,m:1+t:23",
    fields: "f2,f3,f6,f8,f10,f12,f14,f20,f21,f100"
  });
  const fetchPool = async (baseUrl) => {
    const rows = [];
    let total = 0;
    for (let page = 1; page <= 25; page += 1) {
      params.set("pn", String(page));
      const payload = await requestJSON(`${baseUrl}?${params}`);
      const pageRows = payload?.data?.diff;
      if (!Array.isArray(pageRows) || !pageRows.length) break;
      total = Number(payload?.data?.total || total);
      rows.push(...pageRows);
      const lastChange = Number(pageRows.at(-1)?.f3);
      if (Number.isFinite(lastChange) && lastChange < 3) break;
    }
    if (!rows.length) throw new Error("尾盘候选池数据为空");
    return { data: { diff: rows, total } };
  };
  const payload = await firstAvailable("尾盘候选池", [
    () => fetchPool("https://push2delay.eastmoney.com/api/qt/clist/get"),
    () => fetchPool("https://push2.eastmoney.com/api/qt/clist/get")
  ]);
  const poolSize = Number(payload?.data?.total || payload?.data?.diff?.length || 0);
  const candidateAnalysis = analyzeOvernightCandidatePayload(payload, { marketScope });
  const prefiltered = candidateAnalysis.candidates;
  const selected = prefiltered.slice(0, 40);
  const settled = await mapWithConcurrency(selected, 6, async (candidate) => {
    const [bars, points] = await Promise.all([
      fetchKLines(candidate.code, 160),
      fetchIntradayTrends(candidate.code)
    ]);
    return {
      candidate,
      limitUp: recentLimitUp(bars, candidate.code),
      intraday: intradayAverageState(points),
      intradaySource: points[0]?.source || "未知分时源",
      validation: validateOvernightProxy(bars, candidate.code)
    };
  });
  const items = settled
    .filter((item) => item.status === "fulfilled")
    .map((item) => item.value);
  const snapshot = buildOvernightSnapshot(items, {
    window,
    poolSize,
    prefilteredCount: prefiltered.length,
    funnel: candidateAnalysis.funnel,
    marketScope
  });
  snapshot.sourceStatus = {
    candidateSource: "东方财富A股实时行情",
    intradaySource: [...new Set(items.map((item) => item.intradaySource).filter(Boolean))].join(" / ") || "分时数据暂缺",
    historySource: "腾讯行情优先，东方财富降级",
    loaded: items.length,
    requested: selected.length,
    partial: items.length < selected.length
  };
  return snapshot;
}

async function fetchStockProfile(rawCode) {
  const code = validatedCode(rawCode);
  const params = new URLSearchParams({
    secid: secidFor(code),
    fltt: "2",
    invt: "2",
    fields: "f57,f58,f20,f21,f100"
  });
  const fetchProfile = async (baseUrl) => {
    const payload = await requestJSON(`${baseUrl}?${params}`);
    if (!payload?.data) throw new Error("股票资料暂不可用");
    return payload.data;
  };
  const organizationParams = new URLSearchParams({
    reportName: "RPT_F10_BASIC_ORGINFO",
    columns: "ALL",
    filter: `(SECUCODE="${profileSecucode(code)}")`,
    pageNumber: "1",
    pageSize: "1",
    source: "HSF10",
    client: "PC"
  });
  const organizationRequest = requestJSON(
    `https://datacenter.eastmoney.com/securities/api/data/v1/get?${organizationParams}`
  ).catch(() => null);
  const [item, organizationPayload] = await Promise.all([
    firstAvailable(`股票资料 ${code}`, [
      () => fetchProfile("https://push2delay.eastmoney.com/api/qt/stock/get"),
      () => fetchProfile("https://push2.eastmoney.com/api/qt/stock/get")
    ]),
    organizationRequest
  ]);
  const organization = parseCompanyOrganization(organizationPayload, {
    name: String(item.f58 || code)
  });
  const rawIndustry = String(item.f100 || "").trim();
  const organizationIndustries = String(organization?.industryPath || "")
    .split(/[-/]/)
    .map((value) => value.trim())
    .filter(Boolean);
  const resolvedIndustry = rawIndustry && rawIndustry !== "-" && rawIndustry !== "未分类"
    ? rawIndustry
    : organizationIndustries.at(-2) || organizationIndustries.at(-1) || "未分类";
  return {
    code,
    name: String(item.f58 || code),
    industry: resolvedIndustry,
    totalMarketCap: Number(item.f20 || 0),
    floatMarketCap: Number(item.f21 || 0),
    asOf: new Date().toISOString(),
    organization,
    source: organization ? "东方财富公司资料" : "东方财富行业资料"
  };
}

async function fetchStockAnnouncements(rawCode) {
  const code = validatedCode(rawCode);
  const params = new URLSearchParams({
    sr: "-1",
    page_size: "10",
    page_index: "1",
    ann_type: "A",
    client_source: "web",
    stock_list: code,
    f_node: "0",
    s_node: "0"
  });
  const payload = await requestJSON(
    `https://np-anotice-stock.eastmoney.com/api/security/ann?${params}`,
    { headers: { Referer: "https://data.eastmoney.com/" } }
  );
  return {
    code,
    asOf: new Date().toISOString(),
    source: "东方财富公开公告",
    announcements: parseStockAnnouncements(payload, code)
  };
}

async function fetchIntelligenceEvents() {
  const requests = await Promise.allSettled([
    requestJSON(
      "https://api-one.wallstcn.com/apiv1/content/lives?channel=global-channel&client=pc&limit=60",
      {
        headers: { Referer: "https://wallstreetcn.com/" },
        timeoutMs: 6500,
        attempts: 2
      }
    ),
    requestJSON(
      "https://feed.mix.sina.com.cn/api/roll/get?pageid=153&lid=2516&k=&num=50&page=1",
      {
        headers: { Referer: "https://finance.sina.com.cn/" },
        timeoutMs: 6500,
        attempts: 2
      }
    ),
    ...GLOBAL_OFFICIAL_FEEDS.map((source) => cachedRequest(
      `official-intelligence:${source.key}`,
      5 * 60000,
      () => requestData(source.url, {
        encoding: source.encoding,
        headers: {
          Accept: "application/rss+xml, application/xml, text/xml, */*"
        },
        parse: (text) => parseOfficialRss(text, source),
        timeoutMs: 6500,
        attempts: 1
      })
    ))
  ]);
  const wallstreet = requests[0].status === "fulfilled"
    ? parseWallstreetLives(requests[0].value)
    : [];
  const sina = requests[1].status === "fulfilled"
    ? parseSinaRoll(requests[1].value)
    : [];
  const officialFeeds = GLOBAL_OFFICIAL_FEEDS.map((source, index) => ({
    source,
    events: requests[index + 2]?.status === "fulfilled" ? requests[index + 2].value : []
  }));
  const officialEvents = officialFeeds.flatMap((item) => item.events);
  if (!wallstreet.length && !sina.length && !officialEvents.length) throw new Error(FRIENDLY_MARKET_ERROR);
  return {
    events: [...wallstreet, ...sina, ...officialEvents],
    sourceStatus: {
      sources: [
        { name: "华尔街见闻7×24", available: wallstreet.length > 0, count: wallstreet.length },
        { name: "新浪财经公开资讯", available: sina.length > 0, count: sina.length },
        ...officialFeeds.map(({ source, events }) => ({
          name: source.name,
          available: events.length > 0,
          count: events.length,
          official: true,
          sourceCode: source.key
        }))
      ],
      partial: !wallstreet.length || !sina.length || officialFeeds.some((item) => !item.events.length),
      officialCount: officialEvents.length,
      note: "全球雷达只读取官方RSS标题、摘要、原始发布时间和链接；不抓取或转载彭博、路透等付费正文"
    }
  };
}

async function fetchMarketIntelligence(options = {}) {
  const [feed, hotspots] = await Promise.all([
    cachedRequest(
      "market-intelligence-events",
      60000,
      fetchIntelligenceEvents,
      options.force
    ),
    cachedRequest("hotspots", 120000, () => fetchHotspots(), options.force).catch(() => null)
  ]);
  const snapshot = buildIntelligenceSnapshot(feed.events, {
    asOf: new Date().toISOString(),
    previousThemes: Array.isArray(options.previousThemes)
      ? options.previousThemes.slice(0, 20)
      : [],
    sourceStatus: feed.sourceStatus
  });
  return attachMarketConfirmation(snapshot, hotspots);
}

async function fetchMacroData() {
  const reportNames = [...new Set(MACRO_SERIES.map((item) => item.reportName))];
  const settled = await Promise.allSettled(reportNames.map(async (reportName) => {
    const params = new URLSearchParams({
      reportName,
      columns: "ALL",
      sortColumns: reportName === "RPTA_WEB_RATE" ? "TRADE_DATE" : reportName === "RPT_IMP_INTRESTRATEN" ? "REPORT_DATE,INDICATOR_ID" : "REPORT_DATE",
      sortTypes: reportName === "RPT_IMP_INTRESTRATEN" ? "-1,1" : "-1",
      pageSize: reportName === "RPT_IMP_INTRESTRATEN" ? "80" : "24",
      pageNumber: "1"
    });
    const payload = await requestJSON(
      `https://datacenter-web.eastmoney.com/api/data/v1/get?${params}`,
      { headers: { Referer: "https://data.eastmoney.com/" }, timeoutMs: 8000 }
    );
    if (!payload?.success || !Array.isArray(payload?.result?.data)) {
      throw new Error(`宏观数据 ${reportName} 暂不可用`);
    }
    return [reportName, payload];
  }));
  const payloads = Object.fromEntries(
    settled.filter((item) => item.status === "fulfilled").map((item) => item.value)
  );
  if (!Object.keys(payloads).length) throw new Error(FRIENDLY_MARKET_ERROR);
  return buildMacroSnapshot(payloads);
}

function aiSettingsPath() {
  return path.join(app.getPath("userData"), "ai-settings.json");
}

function readAiSettingsRecord() {
  try {
    return JSON.parse(fs.readFileSync(aiSettingsPath(), "utf8"));
  } catch {
    return {};
  }
}

function secureAiStorageAvailable() {
  try {
    return safeStorage.isEncryptionAvailable();
  } catch {
    return false;
  }
}

function readAiApiKey(record = readAiSettingsRecord()) {
  if (sessionAiKey) return sessionAiKey;
  if (!record.apiKeyCipher || !secureAiStorageAvailable()) return "";
  try {
    return safeStorage.decryptString(Buffer.from(record.apiKeyCipher, "base64"));
  } catch {
    return "";
  }
}

function writeAiSettingsRecord(record) {
  const destination = aiSettingsPath();
  const temporary = `${destination}.tmp`;
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.writeFileSync(temporary, `${JSON.stringify(record, null, 2)}\n`, { mode: 0o600 });
  fs.renameSync(temporary, destination);
}

function getPublicAiSettings() {
  const record = readAiSettingsRecord();
  return publicAiSettings(record.settings || DEFAULT_AI_SETTINGS, {
    hasApiKey: Boolean(readAiApiKey(record)),
    secureStorage: secureAiStorageAvailable()
  });
}

function saveAiSettings(value = {}) {
  const record = readAiSettingsRecord();
  const settings = normalizeAiSettings(value);
  const apiKey = String(value.apiKey || "").trim();
  if (apiKey) {
    if (apiKey.length < 8 || apiKey.length > 512) throw new Error("API Key 长度不正确");
    if (secureAiStorageAvailable()) {
      record.apiKeyCipher = safeStorage.encryptString(apiKey).toString("base64");
      sessionAiKey = "";
    } else {
      delete record.apiKeyCipher;
      sessionAiKey = apiKey;
    }
  }
  record.settings = settings;
  writeAiSettingsRecord(record);
  return getPublicAiSettings();
}

function deleteAiApiKey() {
  const record = readAiSettingsRecord();
  delete record.apiKeyCipher;
  sessionAiKey = "";
  record.settings = normalizeAiSettings(record.settings || DEFAULT_AI_SETTINGS);
  writeAiSettingsRecord(record);
  return getPublicAiSettings();
}

function sanitizedAiPayload(payload, includePosition) {
  const clone = JSON.parse(JSON.stringify(payload || {}));
  if (clone.facts && !includePosition) delete clone.facts.position;
  if (clone.previousSnapshot?.facts && !includePosition) {
    delete clone.previousSnapshot.facts.position;
  }
  if (clone.previousSnapshot && !includePosition) {
    delete clone.previousSnapshot.report;
  }
  if (JSON.stringify(clone).length > 40000) {
    throw new Error("追踪事实包过大，请减少历史内容后重试");
  }
  return clone;
}

async function postAiResponse(settings, apiKey, body, timeoutMs = 45000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await net.fetch(responsesUrl(settings.baseUrl), {
      method: "POST",
      signal: controller.signal,
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "User-Agent": `HengCe/${app.getVersion()}`
      },
      body: JSON.stringify(body)
    });
    const raw = await response.text();
    let payload = {};
    try {
      payload = raw ? JSON.parse(raw) : {};
    } catch {
      payload = {};
    }
    if (!response.ok) throw new Error(safeApiError(response.status, payload));
    return payload;
  } catch (error) {
    if (error?.name === "AbortError") throw new Error("AI 分析超时，请检查网络或稍后重试");
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

async function testAiConnection() {
  const record = readAiSettingsRecord();
  const settings = normalizeAiSettings(record.settings || DEFAULT_AI_SETTINGS);
  const apiKey = readAiApiKey(record);
  if (!apiKey) throw new Error("请先填写并保存 API Key");
  await postAiResponse(settings, apiKey, {
    model: settings.model,
    store: false,
    max_output_tokens: 32,
    instructions: "这是连接测试。请只回复：连接成功。",
    input: "测试衡策 AI 追踪连接"
  });
  return { ok: true, model: settings.model, endpoint: new URL(settings.baseUrl).host };
}

async function runAiTracking(value = {}) {
  const record = readAiSettingsRecord();
  const settings = normalizeAiSettings(record.settings || DEFAULT_AI_SETTINGS);
  const apiKey = readAiApiKey(record);
  if (!apiKey) throw new Error("尚未配置 API Key，可先使用本地量化追踪摘要");
  const clean = sanitizedAiPayload(value, settings.sendHoldings);
  if (!/^\d{6}$/.test(String(clean.facts?.code || ""))) {
    throw new Error("追踪标的格式不正确");
  }
  const response = await postAiResponse(settings, apiKey, {
    model: settings.model,
    store: false,
    max_output_tokens: 1800,
    instructions: buildTrackingInstructions(),
    input: buildTrackingInput(clean.facts, clean.previousSnapshot || null),
    text: {
      format: {
        type: "json_schema",
        name: "hengce_tracking_report",
        strict: true,
        schema: TRACKING_REPORT_SCHEMA
      }
    }
  });
  return {
    source: "ai",
    model: settings.model,
    report: normalizeTrackingReport(parseJsonResponse(response))
  };
}

async function runAiIntelligence(value = {}) {
  const record = readAiSettingsRecord();
  const settings = normalizeAiSettings(record.settings || DEFAULT_AI_SETTINGS);
  const apiKey = readAiApiKey(record);
  if (!apiKey) throw new Error("尚未配置 API Key，可先使用本地事件解读");
  const clean = JSON.parse(JSON.stringify(value || {}));
  if (!settings.sendHoldings) delete clean.portfolioImpact;
  if (!clean.event?.title || !clean.event?.publishedAt || !clean.event?.source) {
    throw new Error("事件事实不完整，无法生成 AI 解读");
  }
  if (JSON.stringify(clean).length > 30000) throw new Error("事件事实包过大，请稍后重试");
  const response = await postAiResponse(settings, apiKey, {
    model: settings.model,
    store: false,
    max_output_tokens: 1600,
    instructions: eventInterpretationInstructions(),
    input: eventInterpretationInput(
      clean.event,
      clean.theme || null,
      clean.marketContext || null,
      clean.portfolioImpact || []
    ),
    text: {
      format: {
        type: "json_schema",
        name: "hengce_event_interpretation",
        strict: true,
        schema: EVENT_INTERPRETATION_SCHEMA
      }
    }
  });
  return {
    source: "ai",
    model: settings.model,
    report: normalizeEventInterpretation(parseJsonResponse(response))
  };
}

async function runAiContextAssistant(value = {}) {
  const record = readAiSettingsRecord();
  const settings = normalizeAiSettings(record.settings || DEFAULT_AI_SETTINGS);
  const apiKey = readAiApiKey(record);
  if (!apiKey) throw new Error("尚未配置 API Key，可先使用本地上下文回答");
  const clean = JSON.parse(JSON.stringify(value || {}));
  if (!settings.sendHoldings) {
    delete clean.context?.holdings;
    delete clean.context?.portfolioRisk?.positions;
    delete clean.context?.portfolioRisk?.returnContributions;
    delete clean.context?.portfolioRisk?.equityCurve;
    delete clean.context?.portfolioRisk?.totalValue;
    delete clean.context?.portfolioRisk?.totalCurrentPnl;
    if (Array.isArray(clean.context?.portfolioRisk?.industries)) {
      clean.context.portfolioRisk.industries = clean.context.portfolioRisk.industries.map((item) => ({
        name: item.name,
        weight: item.weight,
        returnContribution: item.returnContribution
      }));
    }
    if (clean.context?.stockFacts) delete clean.context.stockFacts.position;
  }
  const question = String(clean.question || "").trim();
  if (question.length < 2 || question.length > 600) throw new Error("请输入2至600字的问题");
  if (JSON.stringify(clean).length > 60000) throw new Error("问答事实包过大，请减少上下文后重试");
  const response = await postAiResponse(settings, apiKey, {
    model: settings.model,
    store: false,
    max_output_tokens: 1800,
    instructions: contextAssistantInstructions(),
    input: contextAssistantInput(question, clean.context || {}),
    text: {
      format: {
        type: "json_schema",
        name: "hengce_context_answer",
        strict: true,
        schema: CONTEXT_ANSWER_SCHEMA
      }
    }
  });
  const answer = normalizeContextAnswer(parseJsonResponse(response));
  const allowedSources = new Set([
    ...(clean.context?.stockFacts?.sources || []),
    clean.context?.stockFacts?.quote?.source,
    ...(clean.context?.intelligence?.events || []).map((item) => item.source),
    ...(clean.context?.macro?.indicators || []).flatMap((item) => [item.originalSource, item.aggregator]),
    ...(clean.context?.marketBreadth?.sourceStatus?.sources || []).map((item) => item.name)
  ].map((item) => String(item || "").trim()).filter(Boolean));
  answer.sourceLabels = answer.sourceLabels.filter((item) => allowedSources.has(item));
  if (!answer.sourceLabels.length) answer.sourceLabels = [...allowedSources].slice(0, 8);
  return {
    source: "ai",
    model: settings.model,
    answer
  };
}

async function latestUpdateModel() {
  const release = await requestJSON(RELEASE_API_URL, {
    headers: {
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28"
    }
  });
  return buildUpdateModel(
    release,
    app.getVersion(),
    process.platform,
    process.arch
  );
}

async function checkForUpdate() {
  return publicUpdateModel(await latestUpdateModel());
}

async function sha256File(file) {
  const hash = crypto.createHash("sha256");
  await new Promise((resolve, reject) => {
    const input = fs.createReadStream(file);
    input.on("data", (chunk) => hash.update(chunk));
    input.on("error", reject);
    input.on("end", resolve);
  });
  return hash.digest("hex");
}

async function downloadResponse(response, destination, sender) {
  if (!response.ok || !response.body) {
    throw new Error(`更新下载失败（${response.status}）`);
  }
  const temporary = `${destination}.part`;
  fs.rmSync(temporary, { force: true });
  const file = await fs.promises.open(temporary, "w");
  const reader = response.body.getReader();
  const total = Number(response.headers.get("content-length") || 0);
  let received = 0;
  let failure = null;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const chunk = Buffer.from(value);
      let offset = 0;
      while (offset < chunk.length) {
        const { bytesWritten } = await file.write(
          chunk,
          offset,
          chunk.length - offset
        );
        if (!bytesWritten) throw new Error("新版安装包写入中断");
        offset += bytesWritten;
      }
      received += chunk.length;
      if (!sender.isDestroyed()) {
        sender.send("system:update-progress", {
          received,
          total,
          percent: total ? Math.min(100, Math.round((received / total) * 100)) : null
        });
      }
    }
  } catch (error) {
    failure = error;
  } finally {
    await file.close();
  }
  if (failure) {
    fs.rmSync(temporary, { force: true });
    throw failure;
  }
  fs.rmSync(destination, { force: true });
  await fs.promises.rename(temporary, destination);
}

async function downloadLatestUpdate(sender) {
  if (updateDownloadActive) throw new Error("新版安装包正在下载");
  updateDownloadActive = true;
  try {
    const model = await latestUpdateModel();
    if (!model.available) throw new Error("当前没有可下载的新版本");
    const checksumText = await requestData(model._checksumUrl, {
      headers: { Accept: "text/plain" }
    });
    const expectedChecksum = parseChecksum(checksumText, model.assetName);
    if (!expectedChecksum) throw new Error("新版安装包校验文件无效");

    const directory = path.join(
      app.getPath("downloads"),
      "HengCe Updates",
      model.tagName
    );
    fs.mkdirSync(directory, { recursive: true });
    const destination = path.join(directory, path.basename(model.assetName));
    const response = await net.fetch(model._assetUrl, {
      headers: { Accept: "application/octet-stream" }
    });
    await downloadResponse(response, destination, sender);
    const actualChecksum = await sha256File(destination);
    if (actualChecksum !== expectedChecksum) {
      fs.rmSync(destination, { force: true });
      throw new Error("新版安装包完整性校验失败，文件已删除");
    }
    downloadedUpdate = { path: destination, model };
    return {
      ...publicUpdateModel(model),
      downloaded: true,
      fileName: path.basename(destination)
    };
  } finally {
    updateDownloadActive = false;
  }
}

async function installDownloadedUpdate() {
  if (!downloadedUpdate || !fs.existsSync(downloadedUpdate.path)) {
    throw new Error("请先下载并校验新版安装包");
  }
  const error = await shell.openPath(downloadedUpdate.path);
  if (error) throw new Error(`无法打开新版安装包：${error}`);
  const willQuit = shouldQuitAfterOpeningUpdate(process.platform);
  if (willQuit) {
    isQuitting = true;
    setTimeout(() => app.quit(), 1500);
  }
  return { opened: true, willQuit, platform: process.platform };
}

function showMainWindow() {
  if (!mainWindow || mainWindow.isDestroyed()) {
    createWindow();
    return;
  }
  mainWindow.setSkipTaskbar(false);
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show();
  mainWindow.focus();
}

function hideMainWindow() {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  mainWindow.hide();
  mainWindow.setSkipTaskbar(true);
}

function updateTrayMenu() {
  if (!tray) return;
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: "打开衡策", click: showMainWindow },
    { label: "隐藏窗口", click: hideMainWindow },
    { type: "separator" },
    {
      label: "最小化到系统托盘",
      type: "checkbox",
      checked: minimizeToTrayEnabled,
      click: (item) => {
        minimizeToTrayEnabled = item.checked;
        mainWindow?.webContents.send("system:window-preferences", {
          minimizeToTray: minimizeToTrayEnabled
        });
        updateTrayMenu();
      }
    },
    { type: "separator" },
    {
      label: "退出衡策",
      click: () => {
        isQuitting = true;
        app.quit();
      }
    }
  ]));
}

function createWindowsTray() {
  if (process.platform !== "win32" || tray) return;
  const icon = nativeImage.createFromPath(
    path.join(__dirname, "..", "Resources", "AppIcon.png")
  ).resize({ width: 18, height: 18 });
  tray = new Tray(icon);
  tray.setToolTip("衡策 HengCe");
  tray.on("click", showMainWindow);
  tray.on("double-click", showMainWindow);
  updateTrayMenu();
}

function createWindow() {
  const isMac = process.platform === "darwin";
  const captureTheme = String(process.env.HENGCE_CAPTURE_THEME || "").trim();
  const window = new BrowserWindow({
    width: 1360,
    height: 860,
    minWidth: 1080,
    minHeight: 680,
    title: "衡策",
    ...(isMac
      ? { titleBarStyle: "hiddenInset" }
      : {
          autoHideMenuBar: true,
          icon: path.join(__dirname, "..", "Resources", "AppIcon.png")
        }),
    backgroundColor: captureTheme === "dark" ? "#0e141a" : "#f4f6f8",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });
  mainWindow = window;
  if (!isMac) window.setMenuBarVisibility(false);
  if (process.platform === "win32") {
    window.on("minimize", (event) => {
      if (!minimizeToTrayEnabled || isQuitting) return;
      event.preventDefault();
      hideMainWindow();
      if (!trayHintShown && tray?.displayBalloon) {
        tray.displayBalloon({
          title: "衡策仍在后台运行",
          content: "尾盘扫描和观察提醒会继续工作；点击托盘图标可恢复窗口。"
        });
        trayHintShown = true;
      }
    });
  }
  window.on("closed", () => {
    if (mainWindow === window) mainWindow = null;
  });

  window.webContents.on("will-navigate", (event, url) => {
    if (!url.startsWith("file://")) event.preventDefault();
  });
  window.webContents.session.setPermissionCheckHandler(() => false);
  window.webContents.session.setPermissionRequestHandler(
    (_webContents, _permission, callback) => callback(false)
  );
  if (process.env.HENGCE_CAPTURE_PATH) {
    window.webContents.once("did-finish-load", () => {
      setTimeout(async () => {
        const image = await window.webContents.capturePage();
        fs.writeFileSync(process.env.HENGCE_CAPTURE_PATH, image.toPNG());
        console.log(`Captured: ${process.env.HENGCE_CAPTURE_PATH}`);
        if (process.platform === "win32" && process.env.HENGCE_TRAY_SMOKE_PATH) {
          window.minimize();
          setTimeout(() => {
            fs.writeFileSync(
              process.env.HENGCE_TRAY_SMOKE_PATH,
              JSON.stringify({
                trayCreated: Boolean(tray),
                windowVisible: window.isVisible(),
                processAlive: !window.isDestroyed()
              })
            );
            console.log(`Tray smoke: ${process.env.HENGCE_TRAY_SMOKE_PATH}`);
            app.quit();
          }, 750);
          return;
        }
        app.quit();
      }, 7000);
    });
  }
  window.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https:\/\//.test(url)) shell.openExternal(url);
    return { action: "deny" };
  });
  const captureView = String(process.env.HENGCE_CAPTURE_VIEW || "").trim();
  const capturePlatform = String(process.env.HENGCE_CAPTURE_PLATFORM || "").trim();
  const captureStock = String(process.env.HENGCE_CAPTURE_STOCK || "").trim();
  const requestedCaptureTheme = String(process.env.HENGCE_CAPTURE_THEME || "").trim();
  const captureQuery = {};
  if (captureView) captureQuery.view = captureView;
  if (capturePlatform) captureQuery.platform = capturePlatform;
  if (/^\d{6}$/.test(captureStock)) captureQuery.stock = captureStock;
  if (["light", "dark"].includes(requestedCaptureTheme)) captureQuery.theme = requestedCaptureTheme;
  window.loadFile(path.join(__dirname, "..", "src", "index.html"), {
    query: Object.keys(captureQuery).length ? captureQuery : undefined
  });
}

app.setAppUserModelId(APP_ID);
const captureMode = Boolean(process.env.HENGCE_CAPTURE_PATH);
const hasSingleInstanceLock = captureMode || app.requestSingleInstanceLock();
if (!hasSingleInstanceLock) {
  app.quit();
} else {
  app.on("second-instance", showMainWindow);
}
app.on("before-quit", () => {
  isQuitting = true;
});
if (hasSingleInstanceLock) app.whenReady().then(() => {
  installCachedTradingCalendar();
  ipcMain.handle("market:quote", (_, code, options = {}) =>
    cachedRequest(`quote:${code}`, 15000, () => fetchQuote(code), options.force)
  );
  ipcMain.handle("market:search", (_, query) => searchStocks(query));
  ipcMain.handle("market:klines", (_, code, limit, options = {}) =>
    cachedRequest(`klines:${code}:${limit}`, 300000, () => fetchKLines(code, limit), options.force)
  );
  ipcMain.handle("market:indices", (_, options = {}) =>
    cachedRequest("indices", 30000, () => fetchIndices(), options.force)
  );
  ipcMain.handle("market:compass", (_, options = {}) =>
    cachedRequest("market-compass", 60000, () => fetchMarketCompass(), options.force)
  );
  ipcMain.handle("market:valuation", (_, code, options = {}) =>
    cachedRequest(`valuation:${code}`, 1800000, () => fetchValuation(code), options.force)
  );
  ipcMain.handle("market:hotspots", (_, options = {}) =>
    cachedRequest("hotspots", 120000, () => fetchHotspots(), options.force)
  );
  ipcMain.handle("market:breadth", (_, options = {}) =>
    cachedRequest("market-breadth", 60000, fetchMarketBreadth, options.force)
  );
  ipcMain.handle("market:board-members", (_, boardCode, options = {}) =>
    cachedRequest(`board:${boardCode}`, 300000, () => fetchBoardMembers(boardCode), options.force)
  );
  ipcMain.handle("market:intraday", (_, code, options = {}) =>
    cachedRequest(`intraday:${code}`, 15000, () => fetchIntradayTrends(validatedCode(code)), options.force)
  );
  ipcMain.handle("market:recommendations", (_, options = {}) =>
    cachedRequest("recommendations", 600000, () => fetchRecommendations(), options.force)
  );
  ipcMain.handle("market:overnight", async (_, options = {}) => {
    await syncTradingCalendar();
    return cachedRequest(
      `overnight:${normalizeMarketScope(options.marketScope)}`,
      15000,
      () => fetchOvernightScan(options),
      options.force
    );
  });
  ipcMain.handle("market:profile", (_, code, options = {}) =>
    cachedRequest(`profile:${code}`, 1800000, () => fetchStockProfile(code), options.force)
  );
  ipcMain.handle("market:announcements", (_, code, options = {}) =>
    cachedRequest(`announcements:${code}`, 1800000, () => fetchStockAnnouncements(code), options.force)
  );
  ipcMain.handle("market:intelligence", (_, options = {}) =>
    fetchMarketIntelligence(options)
  );
  ipcMain.handle("market:macro", (_, options = {}) =>
    cachedRequest("macro-data", 6 * 3600000, fetchMacroData, options.force)
  );
  ipcMain.handle("system:notify", (_, title, body) => {
    if (!Notification.isSupported()) return false;
    new Notification({ title: String(title), body: String(body) }).show();
    return true;
  });
  ipcMain.handle("system:open-external", (_, url) => {
    if (/^https:\/\//.test(url)) return shell.openExternal(url);
    return false;
  });
  ipcMain.handle("system:update-check", () => checkForUpdate());
  ipcMain.handle("system:app-version", () => app.getVersion());
  ipcMain.handle("system:trading-calendar", (_, options = {}) =>
    syncTradingCalendar(options)
  );
  ipcMain.handle("system:update-download", (event) =>
    downloadLatestUpdate(event.sender)
  );
  ipcMain.handle("system:update-install", () => installDownloadedUpdate());
  ipcMain.handle("system:window-preferences", (_, preferences = {}) => {
    minimizeToTrayEnabled = preferences.minimizeToTray !== false;
    updateTrayMenu();
    return { minimizeToTray: minimizeToTrayEnabled };
  });
  ipcMain.handle("ai:settings", () => getPublicAiSettings());
  ipcMain.handle("ai:settings-save", (_, settings = {}) => saveAiSettings(settings));
  ipcMain.handle("ai:key-delete", () => deleteAiApiKey());
  ipcMain.handle("ai:test", () => testAiConnection());
  ipcMain.handle("ai:track", (_, payload = {}) => runAiTracking(payload));
  ipcMain.handle("ai:intelligence", (_, payload = {}) => runAiIntelligence(payload));
  ipcMain.handle("ai:assistant", (_, payload = {}) => runAiContextAssistant(payload));

  createWindow();
  syncTradingCalendar().catch(() => {});
  createWindowsTray();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
