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
const macro = fs.readFileSync(path.join(root, "electron", "macro.js"), "utf8");
const intelligenceBackend = fs.readFileSync(path.join(root, "electron", "intelligence.js"), "utf8");
const breadthBackend = fs.readFileSync(path.join(root, "electron", "breadth.js"), "utf8");

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

test("stock search accepts codes and fuzzy Chinese names", () => {
  assert.match(html, /id="stock-code"[\s\S]*?placeholder="输入股票代码或名称"/);
  assert.match(html, /id="stock-search-results"/);
  assert.match(preload, /search:\s*\(query\)/);
  assert.match(main, /ipcMain\.handle\("market:search"/);
  assert.match(renderer, /stockCodeInput\.addEventListener\("focus"/);
  assert.match(renderer, /function searchStockNames/);
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
  assert.match(renderer, /window\.hengce\.indices\(options\)\.catch\(\(\) => \[\]\)/);
});

test("dashboard restores a local snapshot and lazy-loads full history for backtests", () => {
  assert.match(renderer, /hengce\.dashboard\.snapshots\.v1/);
  assert.match(renderer, /function restoreDashboardSnapshot/);
  assert.match(renderer, /preserveContent:\s*showingExisting/);
  assert.match(renderer, /\.klines\(normalized, 300, options\)/);
  assert.match(renderer, /function ensureBacktestHistory/);
  assert.match(renderer, /\.klines\(code, 1300, \{ force \}\)/);
  assert.match(renderer, /显示最近快照，正在后台刷新/);
});

test("valuation is isolated from the primary quote request", () => {
  assert.match(preload, /valuation:\s*\(code, options/);
  assert.match(main, /ipcMain\.handle\("market:valuation"/);
  assert.match(renderer, /const valuationRequest = window\.hengce/);
  assert.match(renderer, /\.valuation\(normalized, options\)/);
  assert.match(html, /id="valuation-content"/);
  assert.match(html, /合理区间是情景估算，不是目标价/);
});

test("daily hotspots are a standalone lazy-loaded view", () => {
  assert.match(preload, /hotspots:\s*\(options/);
  assert.match(main, /ipcMain\.handle\("market:hotspots"/);
  assert.match(html, /data-view="hotspots"/);
  assert.match(html, /id="hotspots-view"/);
  assert.match(html, /data-hotspot-mode="threeDayFlow"/);
  assert.match(renderer, /if \(view === "hotspots"\) loadHotspots\(\)/);
  assert.match(renderer, /window\.hengce\.hotspots\(\{ force \}\)/);
  assert.match(renderer, /不等同于真实机构持仓变化/);
});

test("market intelligence combines public events, lifecycle, holdings impact and local AI fallback", () => {
  assert.match(html, /data-view="intelligence"/);
  assert.match(html, /id="intelligence-view"/);
  assert.match(html, /id="intelligence-themes"/);
  assert.match(html, /id="intelligence-events"/);
  assert.match(html, /id="intelligence-impacts"/);
  assert.match(html, /id="intelligence-briefs"/);
  assert.match(html, /id="global-radar-sources"/);
  assert.match(html, /id="global-radar-events"/);
  assert.match(html, /id="intelligence-source"/);
  assert.match(html, /value="bookmarked">我的收藏/);
  assert.match(preload, /intelligence:\s*\(options/);
  assert.match(preload, /interpretEvent:\s*\(payload\)/);
  assert.match(main, /ipcMain\.handle\("market:intelligence"/);
  assert.match(main, /ipcMain\.handle\("ai:intelligence"/);
  assert.match(main, /api-one\.wallstcn\.com/);
  assert.match(main, /feed\.mix\.sina\.com\.cn/);
  assert.match(intelligenceBackend, /federalreserve\.gov\/feeds\/press_all\.xml/);
  assert.match(intelligenceBackend, /ecb\.europa\.eu\/rss\/press\.html/);
  assert.match(intelligenceBackend, /eia\.gov\/rss\/todayinenergy\.xml/);
  assert.match(renderer, /全球事件雷达|global-radar-events/);
  assert.match(renderer, /AI中文解读/);
  assert.match(renderer, /localEventInterpretation\(event/);
  assert.match(renderer, /if \(!state\.aiConfig\?\.hasApiKey/);
  assert.match(renderer, /AI未完成，已保留本地结果/);
  assert.match(renderer, /scheduleIntelligenceRefresh/);
  assert.match(renderer, /hengce\.intelligence\.snapshot\.v1/);
  assert.match(renderer, /当前显示最近一次成功快照/);
  assert.match(renderer, /衡策情报提醒/);
  assert.match(renderer, /hengce\.intelligence\.bookmarks\.v1/);
  assert.match(styles, /\.lifecycle-phase\.warming/);
});

test("market compass is a standalone lazy-loaded global and domestic view", () => {
  assert.match(preload, /compass:\s*\(options/);
  assert.match(main, /ipcMain\.handle\("market:compass"/);
  assert.match(html, /data-view="compass"/);
  assert.match(html, /id="compass-view"/);
  assert.match(html, /id="compass-styles"/);
  assert.match(main, /RPT_INDEX_TS_COMPONENT/);
  assert.match(renderer, /style-representatives/);
  assert.match(renderer, /代表成分按公开指数权重或流通规模展示/);
  assert.match(renderer, /if \(view === "compass"\) \{[\s\S]*?loadCompass\(\);[\s\S]*?loadMacro\(\);/);
  assert.match(renderer, /window\.hengce\.compass\(\{ force \}\)/);
  assert.match(renderer, /风向标描述市场环境/);
});

test("market breadth exposes regime, position ceiling and execution breadth", () => {
  assert.match(html, /id="breadth-regime"/);
  assert.match(html, /id="breadth-metrics"/);
  assert.match(html, /市场宽度与仓位档位/);
  assert.match(preload, /breadth:\s*\(options/);
  assert.match(main, /ipcMain\.handle\("market:breadth"/);
  assert.match(main, /ulist\.np\/get/);
  assert.match(breadthBackend, /getTopicZTPool/);
  assert.match(breadthBackend, /getTopicDTPool/);
  assert.match(breadthBackend, /getTopicZBPool/);
  assert.match(renderer, /模型仓位上限参考/);
  assert.match(renderer, /hengce\.breadth\.snapshot\.v1/);
});

test("macro data center exposes period, provenance and partial-data handling", () => {
  assert.match(html, /id="macro-indicators"/);
  assert.match(html, /央行社融原表/);
  assert.match(html, /CPI、PPI、PMI、M1\/M2、LPR 与 Shibor/);
  assert.match(preload, /macro:\s*\(options/);
  assert.match(main, /ipcMain\.handle\("market:macro"/);
  assert.match(macro, /RPT_ECONOMY_CPI/);
  assert.match(renderer, /function renderMacro/);
  assert.match(renderer, /原始发布/);
  assert.match(renderer, /pbc\.gov\.cn\/diaochatongjisi/);
});

test("hotspot boards expand inline and stocks open the analysis view", () => {
  assert.match(preload, /boardMembers:\s*\(boardCode, options/);
  assert.match(main, /ipcMain\.handle\("market:board-members"/);
  assert.match(renderer, /function toggleHotspotBoard/);
  assert.match(renderer, /class="hotspot-members-row"/);
  assert.match(renderer, /function analyzeStock/);
});

test("analysis supports intraday and daily chart modes", () => {
  assert.match(preload, /intraday:\s*\(code, options/);
  assert.match(main, /ipcMain\.handle\("market:intraday"/);
  assert.match(main, /web\.ifzq\.gtimg\.cn\/appstock\/app\/minute\/query/);
  assert.match(main, /push2\.eastmoney\.com\/api\/qt\/stock\/trends2\/get/);
  assert.match(html, /data-chart-mode="intraday"/);
  assert.match(html, /id="intraday-warning"/);
  assert.match(html, /id="trade-plan"/);
  assert.match(html, /id="observation-plan"/);
  assert.match(renderer, /buildObservationPlan/);
  assert.match(html, /id="quote-industry-badge"/);
  assert.match(html, /class="company-profile-section"/);
  assert.match(renderer, /function renderCompanyProfile/);
  assert.match(main, /RPT_F10_BASIC_ORGINFO/);
  assert.match(main, /parseCompanyOrganization/);
  assert.match(preload, /announcements:\s*\(code, options/);
  assert.match(main, /ipcMain\.handle\("market:announcements"/);
  assert.match(html, /id="company-announcements"/);
  assert.match(renderer, /function renderCompanyAnnouncements/);
});

test("A-share recommendations are a standalone lazy-loaded view", () => {
  assert.match(preload, /recommendations:\s*\(options/);
  assert.match(main, /ipcMain\.handle\("market:recommendations"/);
  assert.match(html, /data-view="recommendations"/);
  assert.match(html, /id="recommendations-view"/);
  assert.match(html, /A股优选/);
  assert.match(renderer, /if \(view === "recommendations"\) loadRecommendations\(\)/);
  assert.match(renderer, /window\.hengce\.recommendations\(\{ force \}\)/);
  assert.match(renderer, /不构成投资建议/);
});

test("overnight tail scan is a standalone timed view", () => {
  assert.match(preload, /overnight:\s*\(options/);
  assert.match(main, /ipcMain\.handle\("market:overnight"/);
  assert.match(html, /data-view="overnight"/);
  assert.match(html, /id="overnight-view"/);
  assert.match(html, /14:30–14:50/);
  assert.match(html, /id="overnight-market-scope"/);
  assert.match(html, /value="main" selected>仅沪深主板/);
  assert.match(renderer, /if \(view === "overnight"\) \{[\s\S]*?loadOvernight\(\)/);
  assert.match(renderer, /window\.hengce\.overnight\(\{[\s\S]*?marketScope:\s*state\.overnightMarketScope/);
  assert.match(renderer, /没有信号就保持空仓/);
  assert.match(html, /id="overnight-funnel"/);
  assert.match(html, /id="overnight-badge"/);
  assert.match(renderer, /只差一项/);
  assert.match(renderer, /scheduleOvernightRefresh\(\)/);
  assert.doesNotMatch(renderer, /if \(!\$\("#overnight-view"\)\.classList\.contains\("active"\)\) return/);
});

test("watchlist alerts and portfolio risk are connected to live market data", () => {
  assert.match(html, /data-view="watchlist"/);
  assert.match(html, /id="watchlist-view"/);
  assert.match(html, /id="portfolio-risk-content"/);
  assert.match(html, /src="portfolio\.js"/);
  assert.match(preload, /profile:\s*\(code, options/);
  assert.match(preload, /notify:\s*\(title, body\)/);
  assert.match(main, /ipcMain\.handle\("market:profile"/);
  assert.match(main, /ipcMain\.handle\("system:notify"/);
  assert.match(renderer, /function loadWatchlist/);
  assert.match(renderer, /function updatePortfolioRisk/);
});

test("portfolio risk includes a proxy curve and contribution attribution", () => {
  assert.match(html, /id="portfolio-equity-chart"/);
  assert.match(html, /id="portfolio-contributions"/);
  assert.match(renderer, /区间收益代理/);
  assert.match(renderer, /returnContributions/);
  assert.match(renderer, /class="holding-row"/);
});

test("AI tracking uses encrypted main-process settings and keeps a local fallback", () => {
  assert.match(html, /data-view="ai"/);
  assert.match(html, /id="ai-view"/);
  assert.match(html, /id="ai-api-key"[\s\S]*?type="password"/);
  assert.match(html, /src="ai_tracking\.js"/);
  assert.match(preload, /aiSettings:\s*\(\)/);
  assert.match(preload, /trackWithAi:\s*\(payload\)/);
  assert.match(main, /\bsafeStorage\b/);
  assert.match(main, /safeStorage\.encryptString/);
  assert.match(main, /ipcMain\.handle\("ai:settings"/);
  assert.match(main, /ipcMain\.handle\("ai:track"/);
  assert.match(main, /delete clone\.facts\.position/);
  assert.match(renderer, /buildLocalTrackingReport/);
  assert.match(renderer, /hengce\.aiTracking\.v1/);
  assert.match(renderer, /AI 解释未完成[\s\S]*已保留本地量化摘要/);
  assert.doesNotMatch(renderer, /localStorage\.setItem\([^\n]*apiKey/i);
});

test("AI workspace includes contextual questions with verified source labels", () => {
  assert.match(html, /id="assistant-question"/);
  assert.match(preload, /askAssistant:\s*\(payload\)/);
  assert.match(main, /ipcMain\.handle\("ai:assistant"/);
  assert.match(main, /store:\s*false/);
  assert.match(main, /allowedSources/);
  assert.match(main, /delete clean\.context\?\.portfolioRisk\?\.totalValue/);
  assert.match(renderer, /localContextAnswer/);
  assert.doesNotMatch(main, /research:select-file|file_data/);
});

test("intelligence reminders support search, keywords and quiet hours", () => {
  assert.match(html, /id="intelligence-search"/);
  assert.match(html, /id="alerts-enabled"/);
  assert.match(html, /id="alert-keywords"/);
  assert.match(html, /id="alert-quiet-start"/);
  assert.match(renderer, /hengce\.alertPreferences\.v1/);
  assert.match(renderer, /selectAlertEvent/);
  assert.match(renderer, /衡策情报提醒/);
});

test("settings summarize provenance, staleness and degraded data health", () => {
  assert.match(html, /id="data-health-summary"/);
  assert.match(html, /id="data-health-list"/);
  assert.match(html, /src="data_health\.js"/);
  assert.match(renderer, /function dataHealthSources/);
  assert.match(renderer, /function renderDataHealth/);
  assert.match(html, /尚未使用.*不是接口故障/);
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
  assert.match(styles, /\.desktop-preferences\.windows-only\s*\{\s*display:\s*none/);
  assert.match(styles, /html\[data-platform="win32"\] \.desktop-preferences\.windows-only\s*\{\s*display:\s*flex/);
});

test("Windows can minimize to tray while keeping background work alive", () => {
  assert.match(main, /\bTray\b/);
  assert.match(main, /function createWindowsTray/);
  assert.match(main, /window\.on\("minimize"/);
  assert.match(main, /event\.preventDefault\(\)/);
  assert.match(main, /setSkipTaskbar\(true\)/);
  assert.match(main, /尾盘扫描和观察提醒会继续工作/);
  assert.match(main, /ipcMain\.handle\("system:window-preferences"/);
  assert.match(main, /HENGCE_CAPTURE_PLATFORM/);
  assert.match(main, /HENGCE_USER_DATA_DIR/);
  assert.match(main, /HENGCE_TRAY_SMOKE_PATH/);
  assert.match(main, /requestSingleInstanceLock/);
  assert.match(main, /captureMode \|\| app\.requestSingleInstanceLock/);
  assert.match(main, /app\.on\("second-instance", showMainWindow\)/);
  assert.match(preload, /setWindowPreferences/);
  assert.match(html, /id="minimize-to-tray"/);
  assert.match(renderer, /hengce\.windowPreferences\.v1/);
});

test("settings expose verified in-app release updates", () => {
  assert.match(html, /id="check-update"/);
  assert.match(html, /id="download-update"/);
  assert.match(html, /id="install-update"/);
  assert.match(preload, /checkForUpdate:\s*\(\)/);
  assert.match(preload, /onUpdateProgress/);
  assert.match(main, /ipcMain\.handle\("system:update-check"/);
  assert.match(main, /ipcMain\.handle\("system:update-download"/);
  assert.match(main, /parseChecksum/);
  assert.match(main, /shouldQuitAfterOpeningUpdate/);
  assert.match(renderer, /打开 DMG 并退出/);
  assert.match(renderer, /checkForUpdates\(\{ silent: true \}\)/);
});

test("recommendation rows open analysis without requiring the trailing button", () => {
  assert.match(renderer, /class="recommendation-row"/);
  assert.match(renderer, /row\.addEventListener\("click"/);
  assert.match(renderer, /analyzeStock\(row\.dataset\.code\)/);
  assert.doesNotMatch(renderer, /class="secondary-button analyze-recommendation"/);
});

test("smart startup, default stock and holdings analysis remain local", () => {
  assert.match(html, /src="preferences\.js"/);
  assert.match(html, /id="toggle-default-stock"/);
  assert.match(renderer, /resolveInitialCode/);
  assert.match(renderer, /hengce\.lastStock\.v1/);
  assert.match(renderer, /marketLoadRequest/);
  assert.match(renderer, /class="holding-row"/);
  assert.match(renderer, /primary-holding/);
  assert.match(renderer, /edit-holding/);
  assert.match(html, /id="watch-current-stock"/);
  assert.match(html, /id="record-current-holding"/);
  assert.match(renderer, /hengce\.ui\.v1/);
});

test("daily chart renders candlesticks and technical sub-panels", () => {
  assert.match(renderer, /function drawKLineChart/);
  assert.match(renderer, /function kdjSeries/);
  assert.match(renderer, /function macdSeries/);
  assert.match(renderer, /fillRect\(x - candleWidth \/ 2/);
  assert.match(styles, /\.chart-wrap\.daily-chart/);
  assert.match(html, /id="strategy-observation-card"/);
  assert.match(renderer, /validationLength/);
  assert.match(renderer, /后段验证/);
  assert.match(renderer, /后段仅作时间切分验证/);
});

test("appearance supports system light and dark themes", () => {
  assert.match(html, /id="theme-preference"/);
  assert.match(html, /value="system">跟随系统/);
  assert.match(html, /src="theme_bootstrap\.js"/);
  assert.match(styles, /html\[data-theme="dark"\]/);
  assert.match(renderer, /function applyThemePreference/);
});

test("trading calendar sync is official, cached, visible and fail-closed", () => {
  assert.match(preload, /tradingCalendar:\s*\(options/);
  assert.match(main, /system:trading-calendar/);
  assert.match(main, /syncTradingCalendar/);
  assert.match(html, /id="trading-calendar-status"/);
  assert.match(html, /id="refresh-trading-calendar"/);
  assert.match(renderer, /mergeOfficialCalendar/);
  assert.match(styles, /\.desktop-preferences\s*\{[\s\S]*?display:\s*flex/);
});

test("sidebar exposes version and updates while holdings accept name search", () => {
  assert.match(html, /id="sidebar-version"/);
  assert.match(html, /id="sidebar-check-update"/);
  assert.match(preload, /appVersion:\s*\(\)/);
  assert.match(main, /ipcMain\.handle\("system:app-version"/);
  assert.match(html, /id="holding-stock-query"/);
  assert.match(renderer, /function searchHoldingNames/);
  assert.match(renderer, /data-holding-code/);
});
