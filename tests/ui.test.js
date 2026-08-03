const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const html = fs.readFileSync(path.join(root, "src", "index.html"), "utf8");
const renderer = fs.readFileSync(path.join(root, "src", "renderer.js"), "utf8");
const styles = fs.readFileSync(path.join(root, "src", "styles.css"), "utf8");
const preload = fs.readFileSync(path.join(root, "electron", "preload.js"), "utf8");
const main = fs.readFileSync(path.join(root, "electron", "main.js"), "utf8");

test("stock code input stays outside the draggable titlebar", () => {
  assert.match(
    styles,
    /\.titlebar\s*\{[\s\S]*?inset:\s*0 auto auto 0;[\s\S]*?width:\s*188px;/
  );
  assert.match(
    styles,
    /\.toolbar\s*\{[\s\S]*?-webkit-app-region:\s*drag;/
  );
  assert.match(
    styles,
    /\.search-box,\s*\.toolbar button,[\s\S]*?-webkit-app-region:\s*no-drag;/
  );
});

test("stock code input replaces the default and accepts six digits", () => {
  assert.match(html, /id="stock-code"[\s\S]*?maxlength="6"/);
  assert.match(renderer, /stockCodeInput\.addEventListener\("focus"/);
  assert.match(renderer, /replace\(\/\\D\/g, ""\)\.slice\(0, 6\)/);
});

test("demo quotes are limited to browser previews", () => {
  assert.match(
    renderer,
    /const isBrowserPreview = \["http:", "https:"\]\.includes\(window\.location\.protocol\)/
  );
  assert.match(renderer, /if \(!window\.hengce && isBrowserPreview\)/);
  assert.match(renderer, /应用接口初始化失败/);
});

test("market failures are reduced to a friendly message", () => {
  assert.match(renderer, /function friendlyMarketError/);
  assert.match(renderer, /Error invoking remote method/);
  assert.match(renderer, /行情服务暂时无响应，请检查网络后重试/);
  assert.match(renderer, /window\.hengce\.indices\(\)\.catch\(\(\) => \[\]\)/);
});

test("valuation is isolated from the primary quote request", () => {
  assert.match(preload, /valuation:\s*\(code\)/);
  assert.match(main, /ipcMain\.handle\("market:valuation"/);
  assert.match(renderer, /const valuationRequest = window\.hengce/);
  assert.match(renderer, /\.valuation\(normalized\)/);
  assert.match(html, /id="valuation-content"/);
  assert.match(html, /合理区间是情景估算，不是目标价/);
});

test("daily hotspots are a standalone lazy-loaded view", () => {
  assert.match(preload, /hotspots:\s*\(\)/);
  assert.match(main, /ipcMain\.handle\("market:hotspots"/);
  assert.match(html, /data-view="hotspots"/);
  assert.match(html, /id="hotspots-view"/);
  assert.match(html, /data-hotspot-mode="threeDayFlow"/);
  assert.match(renderer, /if \(view === "hotspots"\) loadHotspots\(\)/);
  assert.match(renderer, /window\.hengce\.hotspots\(\)/);
  assert.match(renderer, /不等同于真实机构持仓变化/);
});

test("A-share recommendations are a standalone lazy-loaded view", () => {
  assert.match(preload, /recommendations:\s*\(\)/);
  assert.match(main, /ipcMain\.handle\("market:recommendations"/);
  assert.match(html, /data-view="recommendations"/);
  assert.match(html, /id="recommendations-view"/);
  assert.match(html, /A股优选/);
  assert.match(renderer, /if \(view === "recommendations"\) loadRecommendations\(\)/);
  assert.match(renderer, /window\.hengce\.recommendations\(\)/);
  assert.match(renderer, /不构成投资建议/);
});

test("watchlist alerts and portfolio risk are connected to live market data", () => {
  assert.match(html, /data-view="watchlist"/);
  assert.match(html, /id="watchlist-view"/);
  assert.match(html, /id="portfolio-risk-content"/);
  assert.match(html, /src="portfolio\.js"/);
  assert.match(preload, /profile:\s*\(code\)/);
  assert.match(preload, /notify:\s*\(title, body\)/);
  assert.match(main, /ipcMain\.handle\("market:profile"/);
  assert.match(main, /ipcMain\.handle\("system:notify"/);
  assert.match(renderer, /function loadWatchlist/);
  assert.match(renderer, /function updatePortfolioRisk/);
});

test("market views expose provenance and stale-data protection", () => {
  assert.match(html, /id="dashboard-data-status"/);
  assert.match(html, /id="recommendations-stale"/);
  assert.match(renderer, /function freshness/);
  assert.match(renderer, /已超过30分钟/);
  assert.match(renderer, /candidateSource/);
  assert.match(main, /candidateSource:\s*"东方财富成交额榜"/);
  assert.match(main, /source:\s*"腾讯行情"/);
});

test("charts wait for visible bounds and observe container resizing", () => {
  assert.match(renderer, /if \(width < 1 \|\| height < 1\) return null/);
  assert.match(renderer, /function schedulePriceChart/);
  assert.match(renderer, /new ResizeObserver/);
});

test("Windows uses its native titlebar and compact sidebar spacing", () => {
  assert.match(preload, /platform:\s*process\.platform/);
  assert.match(renderer, /document\.documentElement\.dataset\.platform/);
  assert.match(main, /const isMac = process\.platform === "darwin"/);
  assert.match(main, /autoHideMenuBar:\s*true/);
  assert.match(main, /window\.setMenuBarVisibility\(false\)/);
  assert.match(styles, /html\[data-platform="win32"\] \.titlebar[\s\S]*?display:\s*none/);
  assert.match(styles, /html\[data-platform="win32"\] \.sidebar[\s\S]*?padding-top:\s*8px/);
  assert.match(styles, /html\[data-platform="win32"\] \.toolbar[\s\S]*?-webkit-app-region:\s*no-drag/);
});
