const { app, BrowserWindow, ipcMain, net, shell } = require("electron");
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
    timestamp: new Date().toISOString()
  };
}

async function fetchTencentQuote(code, symbol, nameOverride) {
  const text = await requestData(`https://qt.gtimg.cn/q=${symbol}`, {
    encoding: "gb18030",
    headers: TENCENT_HEADERS
  });
  return parseTencentQuote(text, code, nameOverride);
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

function createWindow() {
  const window = new BrowserWindow({
    width: 1360,
    height: 860,
    minWidth: 1080,
    minHeight: 680,
    title: "衡策",
    titleBarStyle: "hiddenInset",
    backgroundColor: "#f4f6f8",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
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
  ipcMain.handle("market:klines", (_, code, limit) => fetchKLines(code, limit));
  ipcMain.handle("market:indices", () => fetchIndices());
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
