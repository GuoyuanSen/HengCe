const { app, BrowserWindow, ipcMain, net, shell } = require("electron");
const fs = require("fs");
const path = require("path");
const {
  INDEX_DEFINITIONS,
  secidFor,
  validatedCode
} = require("./market.js");

const APP_ID = "com.guoyuansen.hengce";

async function requestJSON(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await net.fetch(url, {
      signal: controller.signal,
      headers: {
        Accept: "application/json, text/plain, */*",
        "User-Agent": `HengCe/${app.getVersion()}`
      }
    });
    if (!response.ok) {
      throw new Error(`行情服务返回 ${response.status}`);
    }
    return await response.json();
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchQuoteBySecid(code, secid, nameOverride) {
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

async function fetchQuote(rawCode) {
  const code = validatedCode(rawCode);
  return fetchQuoteBySecid(code, secidFor(code));
}

async function fetchKLines(rawCode, requestedLimit = 1300) {
  const code = validatedCode(rawCode);

  const limit = Math.max(120, Math.min(Number(requestedLimit) || 1300, 2500));
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

async function fetchIndices() {
  const settled = await Promise.allSettled(
    INDEX_DEFINITIONS.map(async ({ code, name, secid }) => {
      const quote = await fetchQuoteBySecid(code, secid, name);
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
