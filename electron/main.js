const { app, BrowserWindow, ipcMain, net, Notification, shell } = require("electron");
const fs = require("fs");
const path = require("path");
const {
  INDEX_DEFINITIONS,
  parseTencentKLines,
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
  parseCandidatePayload,
  validateHistoricalSignals
} = require("./recommendations.js");
const {
  buildOvernightSnapshot,
  intradayAverageState,
  parseIntradayTrends,
  parseOvernightCandidatePayload,
  recentLimitUp,
  scanWindow,
  validateOvernightProxy
} = require("./overnight.js");

const APP_ID = "com.guoyuansen.hengce";
const FRIENDLY_MARKET_ERROR = "行情服务暂时无响应，请检查网络后重试。";
const TENCENT_HEADERS = {
  Accept: "*/*",
  Referer: "https://stockapp.finance.qq.com/"
};

function sleep(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function requestData(
  url,
  { encoding = "utf-8", headers = {}, parse = (text) => text } = {}
) {
  let lastError;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
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
      if (attempt === 0) await sleep(250);
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
        percentChange: quote.percentChange
      };
    })
  );
  return settled
    .filter((item) => item.status === "fulfilled")
    .map((item) => item.value);
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
  const settled = await mapWithConcurrency(selected, 6, async (candidate) => {
    const bars = await fetchKLines(candidate.code, 130);
    return {
      candidate,
      model: analyze(bars),
      validation: validateHistoricalSignals(bars, analyze)
    };
  });
  const candidates = settled
    .filter((item) => item.status === "fulfilled")
    .map((item) => item.value);
  if (!candidates.length) throw new Error(FRIENDLY_MARKET_ERROR);
  const snapshot = buildRecommendationSnapshot(candidates, {
    asOf: new Date().toISOString(),
    candidatePool: pool.length
  });
  snapshot.sourceStatus = {
    candidateSource: "东方财富成交额榜",
    historySource: "腾讯行情优先，东方财富降级",
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
  const payload = await requestJSON(
    `https://push2his.eastmoney.com/api/qt/stock/trends2/get?${params}`
  );
  const points = parseIntradayTrends(payload);
  if (!points.length) throw new Error("分时均价数据为空");
  return points;
}

async function fetchOvernightScan() {
  const window = scanWindow();
  if (!window.canScan) {
    return {
      ...buildOvernightSnapshot([], { window, poolSize: 0, prefilteredCount: 0 }),
      sourceStatus: {
        candidateSource: "东方财富A股实时行情",
        intradaySource: "东方财富分时均价",
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
  const prefiltered = parseOvernightCandidatePayload(payload);
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
      validation: validateOvernightProxy(bars, candidate.code)
    };
  });
  const items = settled
    .filter((item) => item.status === "fulfilled")
    .map((item) => item.value);
  const snapshot = buildOvernightSnapshot(items, {
    window,
    poolSize,
    prefilteredCount: prefiltered.length
  });
  snapshot.sourceStatus = {
    candidateSource: "东方财富A股实时行情",
    intradaySource: "东方财富分时均价",
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
  const item = await firstAvailable(`股票资料 ${code}`, [
    () => fetchProfile("https://push2delay.eastmoney.com/api/qt/stock/get"),
    () => fetchProfile("https://push2.eastmoney.com/api/qt/stock/get")
  ]);
  return {
    code,
    name: String(item.f58 || code),
    industry: String(item.f100 || "未分类"),
    totalMarketCap: Number(item.f20 || 0),
    floatMarketCap: Number(item.f21 || 0),
    asOf: new Date().toISOString()
  };
}

function createWindow() {
  const isMac = process.platform === "darwin";
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
    backgroundColor: "#f4f6f8",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });
  if (!isMac) window.setMenuBarVisibility(false);

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
        app.quit();
      }, 7000);
    });
  }
  window.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https:\/\//.test(url)) shell.openExternal(url);
    return { action: "deny" };
  });
  window.loadFile(path.join(__dirname, "..", "src", "index.html"));
}

app.setAppUserModelId(APP_ID);
app.whenReady().then(() => {
  ipcMain.handle("market:quote", (_, code) => fetchQuote(code));
  ipcMain.handle("market:search", (_, query) => searchStocks(query));
  ipcMain.handle("market:klines", (_, code, limit) => fetchKLines(code, limit));
  ipcMain.handle("market:indices", () => fetchIndices());
  ipcMain.handle("market:valuation", (_, code) => fetchValuation(code));
  ipcMain.handle("market:hotspots", () => fetchHotspots());
  ipcMain.handle("market:board-members", (_, boardCode) => fetchBoardMembers(boardCode));
  ipcMain.handle("market:intraday", (_, code) => fetchIntradayTrends(validatedCode(code)));
  ipcMain.handle("market:recommendations", () => fetchRecommendations());
  ipcMain.handle("market:overnight", () => fetchOvernightScan());
  ipcMain.handle("market:profile", (_, code) => fetchStockProfile(code));
  ipcMain.handle("system:notify", (_, title, body) => {
    if (!Notification.isSupported()) return false;
    new Notification({ title: String(title), body: String(body) }).show();
    return true;
  });
  ipcMain.handle("system:open-external", (_, url) => {
    if (/^https:\/\//.test(url)) return shell.openExternal(url);
    return false;
  });

  createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
