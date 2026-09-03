const isBrowserPreview = ["http:", "https:"].includes(window.location.protocol);

if (!window.hengce && isBrowserPreview) {
  const demoBars = Array.from({ length: 520 }, (_, index) => {
    const date = new Date("2024-08-01T00:00:00");
    date.setDate(date.getDate() + index);
    const trend = 36 - index * 0.012;
    const cycle = Math.sin(index / 15) * 3.2;
    const close = Math.max(18, trend + cycle);
    return {
      date: date.toISOString().slice(0, 10),
      open: close - Math.sin(index / 5) * 0.45,
      close,
      high: close + 0.75,
      low: close - 0.72,
      volume: 780000 + Math.cos(index / 9) * 230000,
      amount: close * 1000000,
      percentChange: 0
    };
  });
  const last = demoBars.at(-1);
  const demoHotspotRows = [
    ["白酒", "行业", 82, 4.62, 38.4e8, 91.6e8, 28, 3, "舍得酒业", 9.98],
    ["机器人", "概念", 78, 3.15, 27.2e8, 73.1e8, 46, 12, "鸣志电器", 7.42],
    ["软件开发", "行业", 72, 2.36, 21.8e8, 55.3e8, 83, 48, "泛微网络", 3.31],
    ["商业航天", "概念", 68, 2.12, 18.9e8, 43.7e8, 35, 17, "航天发展", 6.18],
    ["汽车整车", "行业", 63, 1.76, 15.6e8, 39.2e8, 18, 8, "赛力斯", 4.21],
    ["创新药", "概念", 58, 1.28, 12.1e8, 31.4e8, 41, 29, "海思科", 5.03],
    ["消费电子", "行业", 53, 0.91, 8.7e8, 24.9e8, 52, 37, "立讯精密", 2.84],
    ["光伏设备", "行业", 47, 0.35, 4.3e8, 17.6e8, 39, 31, "晶澳科技", 3.12]
  ].map(
    (
      [
        name,
        type,
        score,
        changePercent,
        todayNetFlow,
        netFlow3Day,
        upCount,
        downCount,
        leaderName,
        leaderChangePercent
      ],
      index
    ) => ({
      code: `BK${String(7000 + index)}`,
      name,
      sourceName: name,
      type,
      score,
      strength:
        score >= 75 ? "强势" : score >= 60 ? "活跃" : score >= 45 ? "观察" : "退潮",
      changePercent,
      todayNetFlow,
      todayFlowRate: todayNetFlow / 1e9,
      netFlow3Day,
      flowRate3Day: netFlow3Day / 2e9,
      upCount,
      downCount,
      leaderName,
      leaderChangePercent
    })
  );
  window.hengce = {
    search: async (query) => [
      { code: "603039", name: "泛微网络", market: "沪A" },
      { code: "002475", name: "立讯精密", market: "深A" },
      { code: "600570", name: "恒生电子", market: "沪A" }
    ].filter((item) => item.code.includes(query) || item.name.includes(query)),
    quote: async (code) => ({
      code,
      name: code === "603039" ? "泛微网络" : "演示标的",
      price: last.close,
      previousClose: demoBars.at(-2).close,
      open: last.open,
      high: last.high,
      low: last.low,
      percentChange: (last.close / demoBars.at(-2).close - 1) * 100,
      volume: last.volume,
      amount: last.amount,
      timestamp: new Date().toISOString(),
      source: "浏览器演示数据"
    }),
    klines: async () => demoBars,
    indices: async () => [
      { code: "000001", name: "上证指数", price: 3584.21, percentChange: 0.42 },
      { code: "399001", name: "深证成指", price: 10921.66, percentChange: -0.18 },
      { code: "399006", name: "创业板指", price: 2248.53, percentChange: 0.67 }
    ],
    compass: async () => ({
      asOf: new Date().toISOString(),
      regime: { key: "balanced", label: "均衡观察", tone: "neutral", score: 0.38, confidence: "较高" },
      globalMarkets: [
        { symbol: "usINX", name: "标普500", price: 6460.12, percentChange: 0.35, timestamp: "最近交易时段", source: "浏览器演示数据" },
        { symbol: "usIXIC", name: "纳斯达克", price: 21410.72, percentChange: 0.62, timestamp: "最近交易时段", source: "浏览器演示数据" },
        { symbol: "usDJI", name: "道琼斯", price: 45201.35, percentChange: 0.18, timestamp: "最近交易时段", source: "浏览器演示数据" },
        { symbol: "hkHSI", name: "恒生指数", price: 25120.4, percentChange: -0.2, timestamp: "当前交易时段", source: "浏览器演示数据" },
        { symbol: "hkHSTECH", name: "恒生科技", price: 4488.3, percentChange: 0.15, timestamp: "当前交易时段", source: "浏览器演示数据" },
        { symbol: "usHXC", name: "中概股", price: 6051.33, percentChange: -0.05, timestamp: "最近交易时段", source: "浏览器演示数据" }
      ],
      domesticMarkets: [
        { code: "000001", name: "上证指数", price: 3584.21, percentChange: 0.42 },
        { code: "399001", name: "深证成指", price: 10921.66, percentChange: -0.18 },
        { code: "399006", name: "创业板指", price: 2248.53, percentChange: 0.67 }
      ],
      styleMarkets: [
        { code: "000300", name: "沪深300", style: "大盘核心", price: 4573.02, percentChange: 0.55 },
        { code: "000016", name: "上证50", style: "大盘价值", price: 2930.4, percentChange: 0.55 },
        { code: "000905", name: "中证500", style: "中盘", price: 7761.83, percentChange: 0.42 },
        { code: "000852", name: "中证1000", style: "小盘", price: 7599.87, percentChange: 0.21 },
        { code: "000688", name: "科创50", style: "科技成长", price: 1615.03, percentChange: -0.16 }
      ],
      signals: ["美股科技方向温和回暖", "港股科技情绪中性", "A股主要指数维持震荡", "大盘核心相对占优，科技成长偏弱"],
      sourceStatus: { globalSource: "浏览器演示数据", domesticSource: "浏览器演示数据", styleSource: "浏览器演示数据", loaded: 14, expected: 14, partial: false },
      note: "风向标描述市场环境，不预测单只股票，也不构成交易建议。"
    }),
    valuation: async (code) => ({
      code,
      name: code === "603039" ? "泛微网络" : "演示标的",
      asOf: new Date().toISOString(),
      applicable: true,
      method: "预期EPS × 目标PE",
      current: {
        price: last.close,
        peTtm: 30.57,
        peStatic: 34.39,
        peDynamic: 39.95,
        pb: 3.78,
        forwardPe: 23.22
      },
      earnings: {
        expectedEps: 1.39,
        expectedGrowth: 0.22,
        expectationSource: "5家机构一致预期",
        nextEstimate: { year: 2027, eps: 1.65 },
        latestReport: {
          reportDate: "2026-03-31",
          reportType: "2026年一季报",
          revenueGrowth: 1.29,
          profitGrowth: 137.91,
          roe: 2.42
        },
        guidance: {
          reportDate: "2026-06-30",
          type: "预增",
          growthLow: 52.22,
          growthHigh: 82.66
        },
        analystForecast: {
          institutionCount: 5,
          targetPriceLow: 46.91,
          targetPriceHigh: 68
        }
      },
      industry: {
        name: "软件开发",
        peQ25: 38.48,
        peMedian: 85.61,
        sampleSize: 134,
        profitableSampleSize: 34,
        upCount: 83,
        downCount: 48,
        netFlow3Day: 770289456,
        temperature: "偏暖",
        temperatureScore: 62
      },
      scenarios: [
        { label: "保守", eps: 1.25, targetPe: 24.5, price: 30.63 },
        { label: "基准", eps: 1.39, targetPe: 31.4, price: 43.65 },
        { label: "乐观", eps: 1.6, targetPe: 39.25, price: 62.8 }
      ],
      fairRange: { low: 30.63, base: 43.65, high: 62.8 },
      confidence: { score: 100, label: "较高" }
    }),
    hotspots: async () => ({
      asOf: new Date().toISOString(),
      sourceStatus: { loaded: 6, requested: 6, partial: false },
      summary: {
        totalBoards: 164,
        strongCount: 4,
        positive3DayCount: 79,
        leadingTheme: "白酒",
        marketTone: "结构轮动"
      },
      composite: demoHotspotRows,
      todayFlow: [...demoHotspotRows].sort(
        (left, right) => right.todayNetFlow - left.todayNetFlow
      ),
      threeDayFlow: [...demoHotspotRows].sort(
        (left, right) => right.netFlow3Day - left.netFlow3Day
      )
    }),
    boardMembers: async (boardCode) => ({
      boardCode,
      asOf: new Date().toISOString(),
      members: [
        ["603039", "泛微网络", 4.72, 3.31, 4.8e8, 6.2, 1.45, 6.7e7],
        ["002475", "立讯精密", 43.18, 2.84, 18.6e8, 3.8, 1.21, 1.9e8],
        ["600570", "恒生电子", 31.26, 2.16, 12.2e8, 4.1, 1.18, 9.4e7]
      ].map(([code, name, price, changePercent, amount, turnoverRate, volumeRatio, todayNetFlow]) => ({
        code, name, price, changePercent, amount, turnoverRate, volumeRatio, todayNetFlow
      }))
    }),
    intraday: async () => Array.from({ length: 48 }, (_, index) => {
      const minutes = 30 + index * 5;
      const hour = 9 + Math.floor(minutes / 60);
      const minute = minutes % 60;
      const price = last.open + Math.sin(index / 5) * 0.45 + index * 0.012;
      return {
        time: `${last.date} ${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`,
        price,
        averagePrice: last.open + index * 0.006
      };
    }),
    recommendations: async () => ({
      asOf: new Date().toISOString(),
      summary: {
        candidatePool: 86,
        scannedCount: 30,
        qualifiedCount: 8,
        leadingStock: "泛微网络"
      },
      sourceStatus: {
        candidateSource: "东方财富成交额榜",
        historySource: "腾讯行情优先，东方财富降级",
        loaded: 30,
        requested: 30,
        partial: false
      },
      recommendations: [
        {
          code: "603039",
          name: "泛微网络",
          score: 82,
          technicalScore: 78,
          price: last.close,
          changePercent: 3.31,
          industry: "软件开发",
          momentum20: 0.094,
          risk: "中等",
          pressure: 31.8,
          riskLine: 27.9,
          factors: { trend: 88, momentum: 82, volume: 76, liquidity: 71, risk: 64, valuation: 59 },
          validation: {
            signalCount: 8,
            fiveDay: { averageReturn: 0.031, hitRate: 0.625, sampleCount: 8 },
            twentyDay: { averageReturn: 0.084, hitRate: 0.75, sampleCount: 8 }
          },
          reasons: ["价格位于20日均线上方", "MACD动能转正", "近5日量能高于20日均量"]
        },
        {
          code: "002475",
          name: "立讯精密",
          score: 76,
          technicalScore: 74,
          price: 43.18,
          changePercent: 2.84,
          industry: "消费电子",
          momentum20: 0.071,
          risk: "较低",
          pressure: 45.2,
          riskLine: 39.6,
          factors: { trend: 84, momentum: 74, volume: 68, liquidity: 88, risk: 81, valuation: 63 },
          validation: {
            signalCount: 7,
            fiveDay: { averageReturn: 0.018, hitRate: 0.571, sampleCount: 7 },
            twentyDay: { averageReturn: 0.046, hitRate: 0.714, sampleCount: 7 }
          },
          reasons: ["短期均线多头排列", "价格站上60日均线", "RSI处于健康强势区"]
        }
      ]
    }),
    overnight: async () => ({
      asOf: new Date().toISOString(),
      window: {
        state: "scanning",
        label: "动态扫描中",
        canScan: true,
        locked: false
      },
      summary: {
        poolSize: 5231,
        prefilteredCount: 7,
        checkedCount: 7,
        qualifiedCount: 2,
        funnel: {
          raw: 612,
          eligible: 584,
          change: 136,
          volumeRatio: 72,
          turnover: 24,
          marketCap: 7,
          checked: 7,
          recentLimitUp: 4,
          intradayAndLimitUp: 2
        }
      },
      sourceStatus: {
        candidateSource: "浏览器演示实时行情",
        intradaySource: "浏览器演示分时均价",
        loaded: 7,
        requested: 7,
        partial: false
      },
      picks: [
        {
          code: "603039",
          name: "泛微网络",
          industry: "软件开发",
          score: 86,
          changePercent: 4.12,
          volumeRatio: 1.46,
          turnoverRate: 7.18,
          floatMarketCap: 26.8e9,
          limitUp: { found: true, date: "2026-07-24", sessionsAgo: 6 },
          intraday: { passes: true, aboveRatio: 0.98, currentAveragePrice: 40.28 },
          validation: { sampleCount: 5, averageReturn: 0.012, hitRate: 0.6, worstReturn: -0.027 }
        },
        {
          code: "002475",
          name: "立讯精密",
          industry: "消费电子",
          score: 79,
          changePercent: 3.64,
          volumeRatio: 1.22,
          turnoverRate: 6.43,
          floatMarketCap: 29.4e9,
          limitUp: { found: true, date: "2026-07-29", sessionsAgo: 3 },
          intraday: { passes: true, aboveRatio: 0.96, currentAveragePrice: 42.66 },
          validation: { sampleCount: 4, averageReturn: 0.007, hitRate: 0.5, worstReturn: -0.031 }
        }
      ],
      nearMisses: [
        { code: "600570", name: "恒生电子", failedRules: ["均价线上方91%"] }
      ]
    }),
    profile: async (code) => ({
      code,
      name: code === "603039" ? "泛微网络" : "演示标的",
      industry: code === "603039" ? "软件开发" : "未分类",
      asOf: new Date().toISOString()
    }),
    notify: async () => true,
    openExternal: async (url) => window.open(url, "_blank"),
    checkForUpdate: async () => ({
      currentVersion: "0.4.0",
      latestVersion: "0.4.0",
      tagName: "v0.4.0",
      releaseName: "衡策 v0.4.0",
      releaseNotes: "新增应用内更新检查、下载进度和 SHA-256 完整性校验。",
      assetName: "HengCe-Apple-Silicon.dmg",
      assetSize: 136e6,
      supported: true,
      downloadable: true,
      available: false
    }),
    appVersion: async () => "0.4.0",
    downloadUpdate: async () => ({ downloaded: true, fileName: "HengCe-Apple-Silicon.dmg" }),
    installUpdate: async () => ({ opened: true, willQuit: false }),
    onUpdateProgress: () => () => {}
  };
}

if (!window.hengce) {
  const unavailable = async () => {
    throw new Error("应用接口初始化失败，请重新启动或重新安装衡策。");
  };
  window.hengce = {
    search: unavailable,
    quote: unavailable,
    klines: unavailable,
    indices: unavailable,
    compass: unavailable,
    valuation: unavailable,
    hotspots: unavailable,
    boardMembers: unavailable,
    intraday: unavailable,
    recommendations: unavailable,
    overnight: unavailable,
    profile: unavailable,
    notify: async () => false,
    openExternal: unavailable,
    checkForUpdate: unavailable,
    appVersion: unavailable,
    downloadUpdate: unavailable,
    installUpdate: unavailable,
    onUpdateProgress: () => () => {}
  };
}

document.documentElement.dataset.platform =
  window.hengce.platform ||
  new URLSearchParams(window.location.search).get("platform") ||
  "browser";

const { analyze, runBacktest } = window.HengCeEngine;
const {
  initialCodeCandidates,
  normalizeCode,
  resolveInitialCode,
  setPrimaryHolding
} = window.HengCePreferences;
const { buildObservationPlan } = window.HengCeTradePlan;

const DEFAULT_SETTINGS = {
  initialCapital: 100000,
  commissionRate: 0.00025,
  stampDutyRate: 0.0005,
  slippageRate: 0.0005,
  fastPeriod: 10,
  slowPeriod: 30,
  breakoutPeriod: 20,
  stopLossPercent: 8
};

const storedWatchlist = readJSON("hengce.watchlist.v1", []);
const storedHoldings = readJSON("hengce.holdings.v2", []);
const storedUi = readJSON("hengce.ui.v1", {});
const storedDefaultCode = normalizeCode(readJSON("hengce.defaultStock.v1", null));
const storedLastCode = normalizeCode(readJSON("hengce.lastStock.v1", null));
const storedOvernightStreaks = readJSON("hengce.overnight.streaks.v1", null);
const VIEW_NAMES = ["dashboard", "hotspots", "compass", "recommendations", "overnight", "watchlist", "backtest", "holdings", "settings"];
const requestedView = new URLSearchParams(window.location.search).get("view");
const startupCodeCandidates = initialCodeCandidates({
  defaultCode: storedDefaultCode,
  lastCode: storedLastCode,
  holdings: storedHoldings,
  watchlist: storedWatchlist
});

const state = {
  code: startupCodeCandidates[0] || resolveInitialCode(),
  defaultCode: storedDefaultCode,
  activeView: VIEW_NAMES.includes(requestedView)
    ? requestedView
    : VIEW_NAMES.includes(storedUi.activeView)
      ? storedUi.activeView
      : "dashboard",
  quote: null,
  bars: [],
  indices: [],
  valuation: null,
  valuationLoading: true,
  hotspots: null,
  hotspotsLoading: false,
  hotspotsError: "",
  compass: null,
  compassLoading: false,
  compassError: "",
  hotspotMode: ["composite", "todayFlow", "threeDayFlow"].includes(storedUi.hotspotMode) ? storedUi.hotspotMode : "composite",
  expandedHotspotBoard: null,
  hotspotMembers: new Map(),
  hotspotMembersLoading: new Set(),
  hotspotMembersErrors: new Map(),
  recommendations: null,
  recommendationsLoading: false,
  recommendationsError: "",
  overnight: null,
  overnightLoading: false,
  overnightError: "",
  overnightStreaks: new Map(
    storedOvernightStreaks?.date === todayKey()
      ? Object.entries(storedOvernightStreaks.values || {}).map(([code, value]) => [code, Number(value) || 0])
      : []
  ),
  recommendationFilters: {
    market: storedUi.recommendationFilters?.market || "all",
    industry: storedUi.recommendationFilters?.industry || "all",
    risk: storedUi.recommendationFilters?.risk || "all",
    minScore: Number(storedUi.recommendationFilters?.minScore || 55)
  },
  watchlist: storedWatchlist,
  watchlistData: new Map(),
  watchlistLoading: false,
  watchlistError: "",
  analysis: null,
  intraday: [],
  chartMode: storedUi.chartMode === "daily" ? "daily" : "intraday",
  chartHoverIndex: null,
  chartRange: [60, 120, 250].includes(Number(storedUi.chartRange)) ? Number(storedUi.chartRange) : 120,
  strategy: ["movingAverage", "breakout", "rsiReversal"].includes(storedUi.strategy) ? storedUi.strategy : "movingAverage",
  backtestYears: [1, 3, 5].includes(Number(storedUi.backtestYears)) ? Number(storedUi.backtestYears) : 3,
  holdings: storedHoldings,
  quotes: new Map(),
  holdingHistories: new Map(),
  profiles: new Map(),
  portfolioRisk: null,
  portfolioRiskLoading: false,
  settings: { ...DEFAULT_SETTINGS, ...readJSON("hengce.settings.v1", {}) },
  updateInfo: null,
  appVersion: "--",
  updateChecking: false,
  updateDownloading: false,
  updateDownloaded: false,
  updateProgress: null,
  updateMessage: "启动后会自动检查 GitHub Release 的正式版本",
  loading: false
};

let stockSearchTimer = 0;
let stockSearchRequest = 0;
let holdingSearchTimer = 0;
let holdingSearchRequest = 0;
let marketLoadRequest = 0;

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];

function readJSON(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(key)) ?? fallback;
  } catch {
    return fallback;
  }
}

function writeJSON(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function saveUiState() {
  if (VIEW_NAMES.includes(requestedView)) return;
  writeJSON("hengce.ui.v1", {
    activeView: state.activeView,
    hotspotMode: state.hotspotMode,
    chartMode: state.chartMode,
    chartRange: state.chartRange,
    strategy: state.strategy,
    backtestYears: state.backtestYears,
    recommendationFilters: state.recommendationFilters
  });
}

function escapeHTML(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function number(value, digits = 2) {
  if (value == null || value === "") return "--";
  return Number.isFinite(Number(value))
    ? Number(value).toLocaleString("zh-CN", {
        minimumFractionDigits: digits,
        maximumFractionDigits: digits
      })
    : "--";
}

function percent(value, ratio = false) {
  if (!Number.isFinite(Number(value))) return "--";
  const normalized = ratio ? Number(value) * 100 : Number(value);
  return `${normalized >= 0 ? "+" : ""}${number(normalized, 2)}%`;
}

function plainPercent(value, ratio = false) {
  if (!Number.isFinite(Number(value))) return "--";
  const normalized = ratio ? Number(value) * 100 : Number(value);
  return `${number(normalized, 2)}%`;
}

function compactMoney(value) {
  if (value == null || value === "") return "--";
  const absolute = Math.abs(Number(value));
  if (!Number.isFinite(absolute)) return "--";
  if (absolute >= 1e8) return `${number(value / 1e8, 2)}亿`;
  if (absolute >= 1e4) return `${number(value / 1e4, 2)}万`;
  return `¥${number(value, 2)}`;
}

function directionClass(value) {
  if (value == null || value === "" || !Number.isFinite(Number(value))) {
    return "";
  }
  return Number(value) >= 0 ? "up" : "down";
}

function freshness(asOf, maxAgeMinutes = 30) {
  const timestamp = new Date(asOf).getTime();
  if (!Number.isFinite(timestamp)) return { stale: true, ageMinutes: null };
  const ageMinutes = Math.max(0, (Date.now() - timestamp) / 60000);
  return { stale: ageMinutes > maxAgeMinutes, ageMinutes };
}

function scoreColor(score) {
  if (score >= 70) return "var(--red)";
  if (score >= 48) return "var(--amber)";
  return "var(--green)";
}

function refreshIcons() {
  if (window.lucide) {
    window.lucide.createIcons({
      attrs: { "stroke-width": 1.8 }
    });
  }
}

function showToast(message) {
  const toast = $("#toast");
  toast.textContent = message;
  toast.classList.remove("hidden");
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => toast.classList.add("hidden"), 2800);
}

function setLoading(loading) {
  state.loading = loading;
  $("#dashboard-loading").classList.toggle("hidden", !loading);
  $("#dashboard-content").classList.toggle(
    "hidden",
    loading || !state.quote
  );
  $("#analyze-button").disabled = loading;
  $("#refresh-button").disabled = loading;
  $("#refresh-button").classList.toggle("rotating", loading);
}

function showError(message) {
  const banner = $("#error-banner");
  banner.textContent = message;
  banner.classList.toggle("hidden", !message);
}

function friendlyMarketError(error) {
  const raw = String(error?.message || error || "");
  const message = raw.replace(
    /^Error invoking remote method '[^']+': Error:\s*/,
    ""
  );
  if (
    !message ||
    /ERR_|fetch failed|aborted|network|empty response|空响应/i.test(message)
  ) {
    return "行情服务暂时无响应，请检查网络后重试。";
  }
  return message;
}

function renderStockSearchResults(results) {
  const container = $("#stock-search-results");
  container.innerHTML = results.length
    ? results.map((item) => `
        <button type="button" data-search-code="${escapeHTML(item.code)}">
          <span><strong>${escapeHTML(item.name)}</strong><small>${escapeHTML(item.market || "A股")}</small></span>
          <code>${escapeHTML(item.code)}</code>
        </button>
      `).join("")
    : '<div class="stock-search-empty">未找到匹配的A股</div>';
  container.classList.remove("hidden");
  $$('[data-search-code]').forEach((button) =>
    button.addEventListener("mousedown", (event) => {
      event.preventDefault();
      analyzeStock(button.dataset.searchCode);
      container.classList.add("hidden");
    })
  );
}

function renderHoldingSearchResults(results) {
  const container = $("#holding-search-results");
  container.innerHTML = results.length
    ? results.map((item) => `
        <button type="button" data-holding-code="${escapeHTML(item.code)}" data-holding-name="${escapeHTML(item.name)}">
          <span><strong>${escapeHTML(item.name)}</strong><small>${escapeHTML(item.market || "A股")}</small></span>
          <code>${escapeHTML(item.code)}</code>
        </button>
      `).join("")
    : '<div class="stock-search-empty">未找到匹配的A股</div>';
  container.classList.remove("hidden");
  $$('[data-holding-code]').forEach((button) =>
    button.addEventListener("mousedown", (event) => {
      event.preventDefault();
      $("#holding-stock-query").value = button.dataset.holdingCode;
      $("#holding-form").elements.name.value = button.dataset.holdingName;
      container.classList.add("hidden");
    })
  );
}

async function searchHoldingNames(query, { showEmpty = true } = {}) {
  const request = ++holdingSearchRequest;
  try {
    const results = await window.hengce.search(query);
    if (request !== holdingSearchRequest) return [];
    if (results.length || showEmpty) renderHoldingSearchResults(results);
    return results;
  } catch {
    if (request === holdingSearchRequest) {
      $("#holding-search-results").classList.add("hidden");
    }
    return [];
  }
}

async function searchStockNames(query, { showEmpty = true } = {}) {
  const request = ++stockSearchRequest;
  try {
    const results = await window.hengce.search(query);
    if (request !== stockSearchRequest) return [];
    if (results.length || showEmpty) renderStockSearchResults(results);
    return results;
  } catch {
    if (request === stockSearchRequest) $("#stock-search-results").classList.add("hidden");
    return [];
  }
}

async function submitStockSearch() {
  const query = $("#stock-code").value.trim();
  if (/^\d{6}$/.test(query)) {
    loadMarketData(query);
    return;
  }
  if (!query) {
    showError("请输入股票代码或名称。");
    return;
  }
  const results = await searchStockNames(query);
  if (results[0]) analyzeStock(results[0].code);
  else showError("未找到匹配的A股，请换一个名称或输入6位代码。");
}

async function loadMarketData(code = $("#stock-code").value, { force = false } = {}) {
  const normalized = String(code).trim().toLowerCase().replace(/^sh|^sz/, "");
  if (!/^\d{6}$/.test(normalized)) {
    showError("请输入6位A股代码。");
    return false;
  }

  const request = ++marketLoadRequest;
  state.code = normalized;
  state.intraday = [];
  state.valuation = null;
  state.valuationLoading = true;
  $("#stock-code").value = normalized;
  setLoading(true);
  showError("");
  renderValuation();
  try {
    const options = { force };
    const indicesRequest = window.hengce.indices(options).catch(() => []);
    const intradayRequest = window.hengce.intraday(normalized, options).catch(() => []);
    const valuationRequest = window.hengce
      .valuation(normalized, options)
      .catch((error) => ({ error: friendlyMarketError(error) }));
    const [quote, bars] = await Promise.all([
      window.hengce.quote(normalized, options),
      window.hengce.klines(normalized, 1300, options)
    ]);
    if (request !== marketLoadRequest) return false;
    state.quote = quote;
    state.bars = bars;
    state.indices = [];
    state.analysis = analyze(bars);
    writeJSON("hengce.lastStock.v1", normalized);
    state.quotes.set(quote.code, quote);
    renderDashboard();
    renderBacktest();
    renderIndices();
    renderHoldings();
    intradayRequest.then((points) => {
      if (request !== marketLoadRequest || state.code !== normalized) return;
      state.intraday = points;
      renderDashboard();
    });
    indicesRequest.then((indices) => {
      if (request !== marketLoadRequest) return;
      state.indices = indices;
      renderIndices();
    });
    valuationRequest.then((valuation) => {
      if (request !== marketLoadRequest || state.code !== normalized) return;
      state.valuation = valuation;
      state.valuationLoading = false;
      renderValuation();
      renderObservationPlan();
    });
    $("#update-time").textContent = `更新 ${new Date().toLocaleTimeString("zh-CN", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit"
    })}`;
    return true;
  } catch (error) {
    if (request === marketLoadRequest) showError(friendlyMarketError(error));
    return false;
  } finally {
    if (request === marketLoadRequest) {
      setLoading(false);
      schedulePriceChart();
    }
  }
}

async function loadInitialMarketData() {
  for (const code of startupCodeCandidates) {
    if (await loadMarketData(code)) return;
  }
}

function valuationMetric(label, value, detail = "") {
  return `
    <div class="valuation-metric">
      <span>${escapeHTML(label)}</span>
      <strong>${escapeHTML(value)}</strong>
      <small>${escapeHTML(detail)}</small>
    </div>
  `;
}

function renderValuation() {
  const container = $("#valuation-content");
  const confidence = $("#valuation-confidence");
  if (state.valuationLoading) {
    confidence.textContent = "";
    container.innerHTML = `
      <div class="valuation-loading">
        <span class="spinner"></span>
        <span>正在读取财报与估值数据</span>
      </div>
    `;
    return;
  }
  const model = state.valuation;
  if (!model || model.error) {
    confidence.textContent = "数据暂缺";
    container.innerHTML = `
      <div class="valuation-unavailable">
        <i data-lucide="database-zap"></i>
        <div>
          <strong>估值数据暂不可用</strong>
          <span>${escapeHTML(model?.error || "不影响行情和技术分析")}</span>
        </div>
      </div>
    `;
    refreshIcons();
    return;
  }

  confidence.textContent =
    `数据完整度 ${model.confidence.score}% · ${model.confidence.label}`;
  const current = model.current;
  const earnings = model.earnings;
  const industry = model.industry;
  const latest = earnings.latestReport;
  const guidance = earnings.guidance;
  const analyst = earnings.analystForecast;
  const guidanceText = guidance
    ? `${guidance.type || "业绩预告"} ${number(guidance.growthLow)}% 至 ${number(guidance.growthHigh)}%`
    : "暂无有效业绩预告";
  const analystTarget =
    analyst?.targetPriceLow != null && analyst?.targetPriceHigh != null
      ? `${number(analyst.targetPriceLow)} - ${number(analyst.targetPriceHigh)}`
      : "--";

  const summary = `
    <div class="valuation-metrics">
      ${valuationMetric("TTM PE", number(current.peTtm), `静态 ${number(current.peStatic)}`)}
      ${valuationMetric("预期 PE", number(current.forwardPe), earnings.expectationSource || "预期EPS不足")}
      ${valuationMetric("预期 EPS", number(earnings.expectedEps, 3), earnings.nextEstimate ? `${earnings.nextEstimate.year}年 ${number(earnings.nextEstimate.eps, 3)}` : "暂无下一年度预期")}
      ${valuationMetric("行业动态PE下四分位", number(industry?.peQ25), industry ? `${industry.profitableSampleSize}个盈利样本` : "行业样本暂缺")}
    </div>
  `;

  if (!model.applicable) {
    container.innerHTML = `
      ${summary}
      <div class="valuation-warning">
        <i data-lucide="triangle-alert"></i>
        <div>
          <strong>本标的不适合直接套用PE区间</strong>
          <span>${escapeHTML(model.reason)}</span>
        </div>
      </div>
    `;
    refreshIcons();
    return;
  }

  container.innerHTML = `
    ${summary}
    <div class="fair-value-band">
      <div class="fair-value-label">
        <span>模型合理区间</span>
        <strong>${number(model.fairRange.low)} - ${number(model.fairRange.high)}</strong>
        <small>基准锚点 ${number(model.fairRange.base)}</small>
      </div>
      <div class="scenario-grid">
        ${model.scenarios
          .map(
            (scenario) => `
              <div class="scenario-item">
                <span>${escapeHTML(scenario.label)}</span>
                <strong>${number(scenario.price)}</strong>
                <small>EPS ${number(scenario.eps, 3)} × PE ${number(scenario.targetPe, 1)}</small>
              </div>
            `
          )
          .join("")}
      </div>
    </div>
    <div class="valuation-evidence">
      <div>
        <span>最新财报</span>
        <strong>${escapeHTML(latest?.reportType || "--")}</strong>
        <small>营收 ${percent(latest?.revenueGrowth)} · 净利 ${percent(latest?.profitGrowth)}</small>
      </div>
      <div>
        <span>公司业绩预告</span>
        <strong>${escapeHTML(guidanceText)}</strong>
        <small>${escapeHTML(guidance?.reportDate || "公告数据暂缺")}</small>
      </div>
      <div>
        <span>行业景气代理</span>
        <strong>${escapeHTML(industry ? `${industry.name} · ${industry.temperature}` : "--")}</strong>
        <small>${industry ? `上涨 ${industry.upCount} / 下跌 ${industry.downCount} · 近3日 ${compactMoney(industry.netFlow3Day)}` : "行业资金数据暂缺"}</small>
      </div>
      <div>
        <span>机构目标区间</span>
        <strong>${analystTarget}</strong>
        <small>${analyst ? `${analyst.institutionCount}家机构，仅作外部参照` : "无一致预期数据"}</small>
      </div>
    </div>
  `;
}

function renderIndices() {
  const strip = $("#market-strip");
  if (!state.indices.length) {
    strip.innerHTML = '<span class="muted">指数行情暂不可用</span>';
    return;
  }
  strip.innerHTML = state.indices
    .map(
      (item) => `
        <div class="market-item">
          <span>${escapeHTML(item.name)}</span>
          <strong>${number(item.price, 2)}</strong>
          <strong class="${directionClass(item.percentChange)}">
            ${percent(item.percentChange)}
          </strong>
        </div>
      `
    )
    .join("");
}

function hotspotStat(label, value, detail) {
  return `
    <div class="hotspot-stat">
      <span>${escapeHTML(label)}</span>
      <strong>${escapeHTML(value)}</strong>
      <small>${escapeHTML(detail)}</small>
    </div>
  `;
}

function renderHotspots() {
  const loading = $("#hotspots-loading");
  const content = $("#hotspots-content");
  const error = $("#hotspots-error");
  const refreshButton = $("#refresh-hotspots");
  loading.classList.toggle("hidden", !state.hotspotsLoading);
  content.classList.toggle(
    "hidden",
    state.hotspotsLoading || !state.hotspots
  );
  error.textContent = state.hotspotsError;
  error.classList.toggle("hidden", !state.hotspotsError);
  refreshButton.disabled = state.hotspotsLoading;
  refreshButton.classList.toggle("rotating", state.hotspotsLoading);
  if (!state.hotspots || state.hotspotsLoading) return;

  const snapshot = state.hotspots;
  const summary = snapshot.summary;
  const sourceStatus = snapshot.sourceStatus;
  const sourceDetail = sourceStatus.partial
    ? `${sourceStatus.loaded}/${sourceStatus.requested} 路，部分降级`
    : `${sourceStatus.loaded}/${sourceStatus.requested} 路完整`;
  $("#hotspots-summary").innerHTML = [
    hotspotStat("当前最强", summary.leadingTheme, "综合量价排名第一"),
    hotspotStat("市场状态", summary.marketTone, "观察热点扩散程度"),
    hotspotStat("强势板块", `${summary.strongCount} 个`, "强度评分不低于65"),
    hotspotStat(
      "近3日净流入",
      `${summary.positive3DayCount} 个`,
      "行业与概念去重统计"
    ),
    hotspotStat("数据覆盖", `${summary.totalBoards} 个`, sourceDetail)
  ].join("");

  const captions = {
    composite: "涨幅、资金连续性与涨跌家数综合评分",
    todayFlow: "按当日主力净流入金额排序",
    threeDayFlow: "按近3日主力净流入金额排序"
  };
  $("#hotspots-caption").textContent = captions[state.hotspotMode];
  const rows = snapshot[state.hotspotMode] || [];
  $("#hotspots-table-body").innerHTML = rows.length
    ? rows
        .map((item, index) => {
          const scoreClass =
            item.score >= 75 ? "high" : item.score < 45 ? "low" : "";
          const expanded = state.expandedHotspotBoard === item.code;
          const members = state.hotspotMembers.get(item.code);
          const loadingMembers = state.hotspotMembersLoading.has(item.code);
          const membersError = state.hotspotMembersErrors.get(item.code);
          const memberContent = loadingMembers
            ? '<div class="hotspot-members-status"><span class="spinner"></span>正在读取板块成分股</div>'
            : membersError
              ? `<div class="hotspot-members-status error-text">${escapeHTML(membersError)}</div>`
              : `<div class="hotspot-members-grid">${(members || []).map((member) => `
                  <button class="hotspot-member" data-analyze-code="${escapeHTML(member.code)}">
                    <span><strong>${escapeHTML(member.name)}</strong><small>${escapeHTML(member.code)}</small></span>
                    <span><strong class="${directionClass(member.changePercent)}">${percent(member.changePercent)}</strong><small>${number(member.price)} 元</small></span>
                    <span><small>成交额</small><strong>${compactMoney(member.amount)}</strong></span>
                    <span><small>量比 / 换手</small><strong>${number(member.volumeRatio)} / ${plainPercent(member.turnoverRate)}</strong></span>
                    <span class="member-action">查看分析 <i data-lucide="arrow-right"></i></span>
                  </button>
                `).join("")}</div>`;
          return `
            <tr class="hotspot-board-row ${expanded ? "expanded" : ""}" data-board-code="${escapeHTML(item.code)}">
              <td>${index + 1}</td>
              <td>
                <button class="hotspot-board hotspot-board-toggle" data-board-code="${escapeHTML(item.code)}" aria-expanded="${expanded}">
                  <span><strong>${escapeHTML(item.name)}</strong><small>${escapeHTML(item.code)}</small></span>
                  <i data-lucide="chevron-${expanded ? "up" : "down"}"></i>
                </button>
              </td>
              <td><span class="hotspot-type">${escapeHTML(item.type)}</span></td>
              <td>
                <div class="hotspot-score ${scoreClass}">
                  <strong>${number(item.score, 0)}</strong>
                  <span class="hotspot-score-track">
                    <span style="width:${Math.max(0, Math.min(100, item.score))}%"></span>
                  </span>
                </div>
              </td>
              <td class="${directionClass(item.changePercent)}">${percent(item.changePercent)}</td>
              <td class="${directionClass(item.todayNetFlow)}">${compactMoney(item.todayNetFlow)}</td>
              <td class="${directionClass(item.netFlow3Day)}">${compactMoney(item.netFlow3Day)}</td>
              <td>${number(item.upCount, 0)} / ${number(item.downCount, 0)}</td>
              <td>
                ${item.leaderCode && /^\d{6}$/.test(item.leaderCode) ? `<button class="hotspot-leader hotspot-leader-button" data-analyze-code="${escapeHTML(item.leaderCode)}"><strong>${escapeHTML(item.leaderName || "--")}</strong><small class="${directionClass(item.leaderChangePercent)}">${percent(item.leaderChangePercent)} · 分析</small></button>` : `<div class="hotspot-leader"><strong>${escapeHTML(item.leaderName || "--")}</strong><small class="${directionClass(item.leaderChangePercent)}">${percent(item.leaderChangePercent)}</small></div>`}
              </td>
            </tr>
            ${expanded ? `<tr class="hotspot-members-row"><td colspan="9">${memberContent}</td></tr>` : ""}
          `;
        })
        .join("")
    : '<tr><td colspan="9" class="muted">当前口径下暂无可用热点数据</td></tr>';
  const asOf = new Date(snapshot.asOf);
  const timestamp = Number.isNaN(asOf.getTime())
    ? "--"
    : asOf.toLocaleString("zh-CN", {
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit"
      });
  $("#hotspots-note").textContent =
    `数据时间 ${timestamp} · ${sourceDetail}。主力资金为公开行情口径，不等同于真实机构持仓变化，不构成买入建议。`;
  $$(".hotspot-board-toggle").forEach((button) =>
    button.addEventListener("click", () => toggleHotspotBoard(button.dataset.boardCode))
  );
  $$('[data-analyze-code]').forEach((button) =>
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      analyzeStock(button.dataset.analyzeCode);
    })
  );
  refreshIcons();
}

async function toggleHotspotBoard(boardCode) {
  if (state.expandedHotspotBoard === boardCode) {
    state.expandedHotspotBoard = null;
    renderHotspots();
    return;
  }
  state.expandedHotspotBoard = boardCode;
  renderHotspots();
  if (state.hotspotMembers.has(boardCode) || state.hotspotMembersLoading.has(boardCode)) return;
  state.hotspotMembersLoading.add(boardCode);
  state.hotspotMembersErrors.delete(boardCode);
  renderHotspots();
  try {
    const result = await window.hengce.boardMembers(boardCode);
    state.hotspotMembers.set(boardCode, result.members || []);
  } catch (error) {
    state.hotspotMembersErrors.set(boardCode, friendlyMarketError(error));
  } finally {
    state.hotspotMembersLoading.delete(boardCode);
    renderHotspots();
  }
}

function analyzeStock(code) {
  $("#stock-code").value = code;
  switchView("dashboard");
  loadMarketData(code);
}

async function loadHotspots({ force = false } = {}) {
  if (state.hotspots && !force) {
    renderHotspots();
    return;
  }
  state.hotspotsLoading = true;
  state.hotspotsError = "";
  renderHotspots();
  try {
    state.hotspots = await window.hengce.hotspots({ force });
  } catch (error) {
    state.hotspotsError = friendlyMarketError(error);
  } finally {
    state.hotspotsLoading = false;
    renderHotspots();
  }
}

function renderRecommendations() {
  const loading = $("#recommendations-loading");
  const content = $("#recommendations-content");
  const error = $("#recommendations-error");
  const refreshButton = $("#refresh-recommendations");
  loading.classList.toggle("hidden", !state.recommendationsLoading);
  content.classList.toggle(
    "hidden",
    state.recommendationsLoading || !state.recommendations
  );
  error.textContent = state.recommendationsError;
  error.classList.toggle("hidden", !state.recommendationsError);
  refreshButton.disabled = state.recommendationsLoading;
  refreshButton.classList.toggle("rotating", state.recommendationsLoading);
  if (!state.recommendations || state.recommendationsLoading) return;

  const snapshot = state.recommendations;
  const summary = snapshot.summary;
  const dataFreshness = freshness(snapshot.asOf, 30);
  const staleWarning = $("#recommendations-stale");
  staleWarning.textContent = dataFreshness.stale
    ? "这份优选结果已超过30分钟。排名仅供回看，请刷新数据后再加入观察。"
    : "";
  staleWarning.classList.toggle("hidden", !dataFreshness.stale);
  const sourceStatus = snapshot.sourceStatus || {};
  $("#recommendations-summary").innerHTML = [
    hotspotStat("当前领先", summary.leadingStock, "综合因子排名第一"),
    hotspotStat("初筛样本", `${summary.candidatePool} 只`, "成交活跃且通过基础风控"),
    hotspotStat("完成计算", `${summary.scannedCount} 只`, "读取至少60个交易日"),
    hotspotStat("达到门槛", `${summary.qualifiedCount} 只`, "综合评分不低于55"),
    hotspotStat(
      "数据状态",
      dataFreshness.stale ? "已过期" : sourceStatus.partial ? "部分降级" : "最新",
      `${sourceStatus.loaded ?? "--"}/${sourceStatus.requested ?? "--"} 只完成历史计算`
    )
  ].join("");
  const allRows = snapshot.recommendations || [];
  const industries = [...new Set(allRows.map((item) => item.industry).filter(Boolean))]
    .sort((left, right) => left.localeCompare(right, "zh-CN"));
  const industrySelect = $("#recommendation-industry");
  const currentIndustry = state.recommendationFilters.industry;
  industrySelect.innerHTML = [
    '<option value="all">全部行业</option>',
    ...industries.map(
      (industry) => `<option value="${escapeHTML(industry)}">${escapeHTML(industry)}</option>`
    )
  ].join("");
  industrySelect.value = industries.includes(currentIndustry) ? currentIndustry : "all";
  state.recommendationFilters.industry = industrySelect.value;
  const marketMatches = (code) => {
    if (state.recommendationFilters.market === "growth") return code.startsWith("30");
    if (state.recommendationFilters.market === "star") return code.startsWith("68");
    if (state.recommendationFilters.market === "main") {
      return code.startsWith("00") || code.startsWith("60");
    }
    return true;
  };
  const rows = allRows.filter(
    (item) =>
      marketMatches(item.code) &&
      (state.recommendationFilters.industry === "all" ||
        item.industry === state.recommendationFilters.industry) &&
      (state.recommendationFilters.risk === "all" ||
        item.risk === state.recommendationFilters.risk) &&
      item.score >= state.recommendationFilters.minScore
  );
  $("#recommendation-filter-count").textContent = `${rows.length} 只`;
  $("#recommendations-table-body").innerHTML = rows.length
    ? rows
        .map((item, index) => {
          const scoreClass = item.score >= 75 ? "high" : "";
          return `
            <tr class="recommendation-row" data-code="${escapeHTML(item.code)}" tabindex="0" role="button" aria-label="分析 ${escapeHTML(item.name)} ${escapeHTML(item.code)}">
              <td>${index + 1}</td>
              <td>
                <div class="stock-cell">
                  <strong>${escapeHTML(item.name)}</strong>
                  <span>${escapeHTML(item.code)} · ${escapeHTML(item.industry || "未分类")}</span>
                </div>
              </td>
              <td>
                <div class="hotspot-score ${scoreClass}">
                  <strong>${number(item.score, 0)}</strong>
                  <span class="hotspot-score-track">
                    <span style="width:${Math.max(0, Math.min(100, item.score))}%"></span>
                  </span>
                </div>
              </td>
              <td>
                <div class="factor-breakdown">
                  <span title="趋势">趋 ${number(item.factors?.trend, 0)}</span>
                  <span title="动量">动 ${number(item.factors?.momentum, 0)}</span>
                  <span title="量能">量 ${number(item.factors?.volume, 0)}</span>
                  <span title="风险控制">风 ${number(item.factors?.risk, 0)}</span>
                </div>
              </td>
              <td>
                <div class="validation-cell">
                  <strong>${item.validation?.fiveDay?.hitRate == null ? "样本不足" : `5日胜率 ${plainPercent(item.validation.fiveDay.hitRate, true)}`}</strong>
                  <small>${item.validation?.twentyDay?.averageReturn == null ? "等待更多历史信号" : `20日均值 ${percent(item.validation.twentyDay.averageReturn, true)} · ${item.validation.twentyDay.sampleCount}次`}</small>
                </div>
              </td>
              <td><span class="risk-pill risk-${item.risk === "较高" ? "high" : item.risk === "中等" ? "medium" : "low"}">${escapeHTML(item.risk)}</span></td>
              <td class="recommendation-reasons">${(item.reasons || []).map(escapeHTML).join(" · ") || "量价结构达到观察门槛"}</td>
              <td>
                <div class="table-actions">
                  <button class="table-action watch-recommendation" data-code="${escapeHTML(item.code)}" title="加入观察" ${dataFreshness.stale || state.watchlist.some((entry) => entry.code === item.code) ? "disabled" : ""}>
                    <i data-lucide="bell-plus"></i>
                  </button>
                  <i class="recommendation-enter" data-lucide="chevron-right"></i>
                </div>
              </td>
            </tr>
          `;
        })
        .join("")
    : '<tr><td colspan="8" class="muted">当前筛选条件下没有可用标的</td></tr>';
  $$(".recommendation-row").forEach((row) => {
    row.addEventListener("click", (event) => {
      if (event.target.closest("button")) return;
      analyzeStock(row.dataset.code);
    });
    row.addEventListener("keydown", (event) => {
      if (event.target.closest("button")) return;
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        analyzeStock(row.dataset.code);
      }
    });
  });
  $$(".watch-recommendation").forEach((button) =>
    button.addEventListener("click", () => {
      const item = allRows.find((entry) => entry.code === button.dataset.code);
      if (!item || state.watchlist.some((entry) => entry.code === item.code)) return;
      state.watchlist.push({
        code: item.code,
        name: item.name,
        industry: item.industry || "未分类",
        addedAt: new Date().toISOString(),
        baselineScore: item.technicalScore ?? item.score,
        pressure: item.pressure,
        riskLine: item.riskLine,
        lastAlert: ""
      });
      writeJSON("hengce.watchlist.v1", state.watchlist);
      renderRecommendations();
      renderWatchlist();
      showToast(`${item.name} 已加入观察`);
    })
  );
  const asOf = new Date(snapshot.asOf);
  const timestamp = Number.isNaN(asOf.getTime())
    ? "--"
    : asOf.toLocaleString("zh-CN", {
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit"
      });
  $("#recommendations-note").textContent =
    `数据时间 ${timestamp} · 候选池：${sourceStatus.candidateSource || "公开成交额榜"} · 历史：${sourceStatus.historySource || "公开前复权日线"}。榜单排除 ST、退市及极端波动标的；结果是量化观察池，不构成投资建议。`;
}

function watchAlert(item, data) {
  if (!data?.quote || !data?.model) return "等待行情";
  if (Number.isFinite(item.riskLine) && data.quote.price <= item.riskLine) {
    return "跌破风险线";
  }
  if (Number.isFinite(item.pressure) && data.quote.price >= item.pressure) {
    return "突破压力位";
  }
  const scoreChange = data.model.score - (item.baselineScore ?? data.model.score);
  if (scoreChange >= 10) return "评分明显提升";
  if (scoreChange <= -10) return "评分明显下降";
  return "观察中";
}

function renderWatchlist() {
  const loading = $("#watchlist-loading");
  const error = $("#watchlist-error");
  loading.classList.toggle("hidden", !state.watchlistLoading);
  error.textContent = state.watchlistError;
  error.classList.toggle("hidden", !state.watchlistError);
  $("#refresh-watchlist").disabled = state.watchlistLoading;
  $("#refresh-watchlist").classList.toggle("rotating", state.watchlistLoading);
  const rows = state.watchlist.map((item) => ({
    item,
    data: state.watchlistData.get(item.code),
    alert: watchAlert(item, state.watchlistData.get(item.code))
  }));
  const alertCount = rows.filter(({ alert }) =>
    !["观察中", "等待行情"].includes(alert)
  ).length;
  const scores = rows
    .map(({ data }) => data?.model?.score)
    .filter(Number.isFinite);
  $("#watchlist-summary").innerHTML = [
    hotspotStat("观察标的", `${rows.length} 只`, "仅保存在本机"),
    hotspotStat("触发提醒", `${alertCount} 项`, "突破、风险线或评分变化"),
    hotspotStat(
      "平均评分",
      scores.length ? number(scores.reduce((sum, value) => sum + value, 0) / scores.length, 0) : "--",
      "当前技术模型评分"
    ),
    hotspotStat("提醒方式", "应用内 + 系统", "刷新行情时检查")
  ].join("");
  $("#watchlist-badge").textContent = String(alertCount);
  $("#watchlist-badge").classList.toggle("hidden", alertCount === 0);
  $("#watchlist-empty").classList.toggle("hidden", rows.length > 0);
  $("#watchlist-table-body").innerHTML = rows
    .map(({ item, data, alert }) => {
      const addedAt = new Date(item.addedAt);
      const alertClass = alert === "观察中" ? "" : alert === "等待行情" ? "muted" : "alert-active";
      return `
        <tr class="holding-row" data-code="${holding.code}" tabindex="0" role="button" aria-label="分析 ${escapeHTML(holding.name || holding.code)}">
          <td><div class="stock-cell"><strong>${escapeHTML(item.name)}</strong><span>${escapeHTML(item.code)} · ${escapeHTML(item.industry)}</span></div></td>
          <td class="${directionClass(data?.quote?.percentChange)}"><strong>${number(data?.quote?.price)}</strong><small>${percent(data?.quote?.percentChange)}</small></td>
          <td><strong>${number(data?.model?.score, 0)}</strong><small>${escapeHTML(data?.model?.trend || "--")}</small></td>
          <td>${number(item.pressure)} / ${number(item.riskLine)}</td>
          <td><span class="watch-alert ${alertClass}">${escapeHTML(alert)}</span></td>
          <td>${Number.isNaN(addedAt.getTime()) ? "--" : addedAt.toLocaleDateString("zh-CN")}</td>
          <td><div class="table-actions"><button class="secondary-button analyze-watch" data-code="${item.code}">分析</button><button class="table-action remove-watch" data-code="${item.code}" title="移除观察"><i data-lucide="trash-2"></i></button></div></td>
        </tr>
      `;
    })
    .join("");
  $$(".analyze-watch").forEach((button) =>
    button.addEventListener("click", () => {
      $("#stock-code").value = button.dataset.code;
      switchView("dashboard");
      loadMarketData(button.dataset.code);
    })
  );
  $$(".remove-watch").forEach((button) =>
    button.addEventListener("click", () => {
      state.watchlist = state.watchlist.filter((item) => item.code !== button.dataset.code);
      state.watchlistData.delete(button.dataset.code);
      writeJSON("hengce.watchlist.v1", state.watchlist);
      renderWatchlist();
      if (state.recommendations) renderRecommendations();
      showToast("已移出观察列表");
    })
  );
  refreshIcons();
}

async function loadWatchlist({ force = false } = {}) {
  if (state.watchlistLoading || (!force && state.watchlist.length && state.watchlistData.size === state.watchlist.length)) {
    renderWatchlist();
    return;
  }
  state.watchlistLoading = true;
  state.watchlistError = "";
  renderWatchlist();
  const settled = await Promise.allSettled(
    state.watchlist.map(async (item) => {
      const [quote, bars] = await Promise.all([
        window.hengce.quote(item.code),
        window.hengce.klines(item.code, 130)
      ]);
      return { item, quote, bars, model: analyze(bars) };
    })
  );
  let failureCount = 0;
  for (const result of settled) {
    if (result.status !== "fulfilled") {
      failureCount += 1;
      continue;
    }
    const { item, ...data } = result.value;
    state.watchlistData.set(item.code, data);
    const alert = watchAlert(item, data);
    if (!["观察中", "等待行情"].includes(alert) && alert !== item.lastAlert) {
      window.hengce.notify("衡策观察提醒", `${item.name}：${alert}`);
      item.lastAlert = alert;
    } else if (alert === "观察中") {
      item.lastAlert = "";
    }
  }
  writeJSON("hengce.watchlist.v1", state.watchlist);
  if (failureCount) state.watchlistError = `${failureCount} 只标的暂未取得完整行情，其余结果已更新。`;
  state.watchlistLoading = false;
  renderWatchlist();
}

function marketTimestamp(value) {
  const raw = String(value || "").trim();
  const compact = raw.match(/^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})$/);
  if (compact) return `${compact[1]}-${compact[2]}-${compact[3]} ${compact[4]}:${compact[5]}`;
  return raw || "当前数据";
}

function compassMarketCard(item) {
  const timestamp = marketTimestamp(item.timestamp);
  return `
    <div class="compass-market-card">
      <span>${escapeHTML(item.name)}</span>
      <strong>${number(item.price)} <em class="${directionClass(item.percentChange)}">${percent(item.percentChange)}</em></strong>
      <small>${escapeHTML(timestamp)} · ${escapeHTML(item.source || "公开行情")}</small>
    </div>
  `;
}

function renderCompass() {
  const loading = $("#compass-loading");
  const content = $("#compass-content");
  const error = $("#compass-error");
  const refreshButton = $("#refresh-compass");
  loading.classList.toggle("hidden", !state.compassLoading);
  content.classList.toggle("hidden", state.compassLoading || !state.compass);
  error.textContent = state.compassError;
  error.classList.toggle("hidden", !state.compassError);
  refreshButton.disabled = state.compassLoading;
  refreshButton.classList.toggle("rotating", state.compassLoading);
  if (!state.compass || state.compassLoading) return;
  const snapshot = state.compass;
  const regime = snapshot.regime || {};
  $("#compass-regime").className = `compass-regime ${regime.tone || "neutral"}`;
  $("#compass-regime").innerHTML = `
    <div><span>当前市场环境</span><strong>${escapeHTML(regime.label || "等待判断")}</strong></div>
    <div><span>使用方式</span><p>先判断环境，再决定是否提高追涨门槛、降低集中度或保持等待。</p></div>
    <div class="regime-score"><span>指数合成变化</span><strong>${regime.score == null ? "--" : percent(regime.score)}</strong><small>数据可信度 ${escapeHTML(regime.confidence || "偏低")}</small></div>
  `;
  $("#compass-global").innerHTML = (snapshot.globalMarkets || []).map(compassMarketCard).join("") || '<span class="muted">全球指数暂不可用</span>';
  $("#compass-domestic").innerHTML = (snapshot.domesticMarkets || []).map(compassMarketCard).join("") || '<span class="muted">A股指数暂不可用</span>';
  $("#compass-styles").innerHTML = (snapshot.styleMarkets || []).map((item) => `
    <div class="compass-style-card">
      <span>${escapeHTML(item.style || item.name)}</span>
      <strong>${escapeHTML(item.name)} <em class="${directionClass(item.percentChange)}">${percent(item.percentChange)}</em></strong>
      <small>${number(item.price)} · ${escapeHTML(item.source || "公开行情")}</small>
    </div>
  `).join("") || '<span class="muted">股票风格指数暂不可用</span>';
  $("#compass-signal-list").innerHTML = (snapshot.signals || []).map((signal) => `
    <div class="finding positive"><i data-lucide="navigation"></i><span>${escapeHTML(signal)}</span></div>
  `).join("");
  const asOf = new Date(snapshot.asOf);
  const timestamp = Number.isNaN(asOf.getTime()) ? "--" : asOf.toLocaleString("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  });
  $("#compass-note").textContent =
    `数据时间 ${timestamp} · 全球：${snapshot.sourceStatus?.globalSource || "暂缺"} · A股：${snapshot.sourceStatus?.domesticSource || "暂缺"} · 风格：${snapshot.sourceStatus?.styleSource || "暂缺"}${snapshot.sourceStatus?.partial ? " · 部分数据暂缺" : ""}。${snapshot.note || "风向标不构成投资建议。"}`;
  refreshIcons();
}

async function loadCompass({ force = false } = {}) {
  if (state.compass && !force) {
    renderCompass();
    return;
  }
  state.compassLoading = true;
  state.compassError = "";
  renderCompass();
  try {
    state.compass = await window.hengce.compass({ force });
  } catch (error) {
    state.compassError = friendlyMarketError(error);
  } finally {
    state.compassLoading = false;
    renderCompass();
  }
}

async function loadRecommendations({ force = false } = {}) {
  if (state.recommendations && !force) {
    renderRecommendations();
    return;
  }
  state.recommendationsLoading = true;
  state.recommendationsError = "";
  renderRecommendations();
  try {
    state.recommendations = await window.hengce.recommendations({ force });
  } catch (error) {
    state.recommendationsError = friendlyMarketError(error);
  } finally {
    state.recommendationsLoading = false;
    renderRecommendations();
  }
}

let overnightRefreshTimer = null;

function updateOvernightClock() {
  const target = $("#overnight-clock-time");
  if (!target) return;
  target.textContent = new Date().toLocaleTimeString("zh-CN", {
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
  });
}

function scheduleOvernightRefresh() {
  clearTimeout(overnightRefreshTimer);
  overnightRefreshTimer = null;
  const windowState = localOvernightWindow().state;
  if (!["waiting", "scanning"].includes(windowState)) return;
  if (windowState === "scanning" && !state.overnight && !state.overnightLoading && !state.overnightError) {
    loadOvernight({ force: true });
    return;
  }
  overnightRefreshTimer = setTimeout(() => {
    if (localOvernightWindow().state === "scanning") loadOvernight({ force: true });
    else scheduleOvernightRefresh();
  }, windowState === "scanning" ? 30000 : 60000);
}

function localOvernightWindow(now = new Date()) {
  const weekday = now.getDay();
  const minutes = now.getHours() * 60 + now.getMinutes();
  if (weekday === 0 || weekday === 6) return { state: "closed", label: "非交易日", locked: true };
  if (minutes < 870) return { state: "waiting", label: "14:30 开始扫描", locked: false };
  if (minutes < 890) return { state: "scanning", label: "动态扫描中", locked: false };
  if (minutes < 900) return { state: "locked", label: "最终名单已锁定", locked: true };
  return { state: "closed", label: "今日扫描已结束", locked: true };
}

function todayKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function confirmOvernightPicks(snapshot) {
  if (isBrowserPreview) return snapshot;
  const currentCodes = new Set((snapshot.picks || []).map((item) => item.code));
  for (const code of state.overnightStreaks.keys()) {
    if (!currentCodes.has(code)) state.overnightStreaks.delete(code);
  }
  const picks = (snapshot.picks || [])
    .map((item) => {
      const confirmations = (state.overnightStreaks.get(item.code) || 0) + 1;
      state.overnightStreaks.set(item.code, confirmations);
      return { ...item, confirmations };
    })
    .filter((item) => item.confirmations >= 2);
  writeJSON("hengce.overnight.streaks.v1", {
    date: todayKey(),
    values: Object.fromEntries(state.overnightStreaks)
  });
  return {
    ...snapshot,
    summary: { ...snapshot.summary, rawQualifiedCount: snapshot.picks?.length || 0 },
    picks
  };
}

function renderOvernight() {
  const loading = $("#overnight-loading");
  const content = $("#overnight-content");
  const error = $("#overnight-error");
  const refreshButton = $("#refresh-overnight");
  loading.classList.toggle("hidden", !state.overnightLoading);
  content.classList.toggle("hidden", state.overnightLoading && !state.overnight);
  error.textContent = state.overnightError;
  error.classList.toggle("hidden", !state.overnightError);
  refreshButton.classList.toggle("rotating", state.overnightLoading);
  const snapshot = state.overnight;
  if (!snapshot) {
    refreshButton.disabled = state.overnightLoading;
    scheduleOvernightRefresh();
    return;
  }
  const windowState = snapshot.window || { state: "waiting", label: "等待扫描" };
  const status = $("#overnight-window-label");
  status.textContent = windowState.label;
  status.className = `window-status ${windowState.state}`;
  $("#overnight-window-detail").textContent =
    windowState.state === "scanning"
      ? "每30秒复核一次，连续两次通过后显示，14:50 锁定最终名单"
      : windowState.state === "locked"
        ? snapshot.summary?.checkedCount
          ? "名单不会因收盘前最后波动继续变化"
          : "未在14:30–14:50运行，今日没有可恢复的锁定名单"
        : windowState.state === "closed"
          ? "下一个交易日 14:30 再次开放"
          : "14:30 开始扫描，14:50 锁定最终名单";
  refreshButton.disabled = state.overnightLoading || windowState.locked;
  const summary = snapshot.summary || {};
  const picks = snapshot.picks || [];
  $("#overnight-badge").textContent = String(picks.length);
  $("#overnight-badge").classList.toggle("hidden", picks.length === 0);
  const sourceStatus = snapshot.sourceStatus || {};
  $("#overnight-summary").innerHTML = [
    hotspotStat("扫描状态", windowState.label, windowState.state === "scanning" ? "30秒自动复核" : "严格按时间窗口执行"),
    hotspotStat("基础候选", `${summary.prefilteredCount || 0} 只`, "涨幅、量比、市值与换手通过"),
    hotspotStat("完成核对", `${summary.checkedCount || 0} 只`, "近20日涨停与分时均价"),
    hotspotStat("最终信号", `${picks.length} 只`, picks.length ? "同一行业最多2只" : "没有信号就保持空仓")
  ].join("");
  const funnel = summary.funnel || {};
  const funnelStages = [
    ["行情样本", funnel.raw, "接口返回"],
    ["基础风控", funnel.eligible, "代码/名称/价格"],
    ["涨幅", funnel.change, "3%–5%"],
    ["量比", funnel.volumeRatio, "≥ 1"],
    ["换手", funnel.turnover, "5%–10%"],
    ["流通市值", funnel.marketCap, "≤ 300亿"],
    ["近20日涨停", funnel.recentLimitUp, "历史核对"],
    ["分时均价", funnel.intradayAndLimitUp, "至少95%在线上"]
  ];
  $("#overnight-funnel").innerHTML = funnelStages.map(([label, value, detail]) => `
    <div><span>${escapeHTML(label)}</span><strong>${number(value || 0, 0)}</strong><small>${escapeHTML(detail)}</small></div>
  `).join("");
  const nearMisses = snapshot.nearMisses || [];
  $("#overnight-near-misses").innerHTML = nearMisses.length
    ? `<span class="muted">只差一项：</span>${nearMisses.map((item) => `<button class="near-miss-chip" data-code="${escapeHTML(item.code)}">${escapeHTML(item.name)} · ${escapeHTML(item.failedRules.join("、"))}</button>`).join("")}`
    : '<span class="muted">当前没有只差一项的接近命中标的</span>';
  $$(".near-miss-chip").forEach((button) =>
    button.addEventListener("click", () => analyzeStock(button.dataset.code))
  );
  $("#overnight-empty").classList.toggle("hidden", picks.length > 0);
  const tableScroll = $("#overnight-table-body").closest(".table-scroll");
  tableScroll.classList.toggle("hidden", picks.length === 0);
  $("#overnight-table-body").innerHTML = picks
    .map((item) => {
      const validation = item.validation || {};
      return `
        <tr>
          <td><div class="stock-cell"><strong>${escapeHTML(item.name)}</strong><span>${escapeHTML(item.code)} · ${escapeHTML(item.industry || "未分类")}</span></div></td>
          <td><div class="hotspot-score ${item.score >= 80 ? "high" : ""}"><strong>${number(item.score, 0)}</strong><span class="hotspot-score-track"><span style="width:${Math.max(0, Math.min(100, item.score))}%"></span></span></div></td>
          <td><strong class="up">${percent(item.changePercent)}</strong><small>量比 ${number(item.volumeRatio, 2)}</small></td>
          <td><strong>${plainPercent(item.turnoverRate)}</strong><small>${compactMoney(item.floatMarketCap)}</small></td>
          <td><strong>${escapeHTML(item.limitUp?.date || "--")}</strong><small>${item.limitUp?.sessionsAgo ? `${item.limitUp.sessionsAgo} 个交易日前` : "近20日无记录"}</small></td>
          <td><strong>${plainPercent(item.intraday?.aboveRatio, true)}</strong><small>当前均价 ${number(item.intraday?.currentAveragePrice)}</small></td>
          <td><div class="validation-cell"><strong>${validation.hitRate == null ? "样本不足" : `胜率 ${plainPercent(validation.hitRate, true)}`}</strong><small>${validation.averageReturn == null ? "等待更多历史结构" : `均值 ${percent(validation.averageReturn, true)} · ${validation.sampleCount}次`}</small></div></td>
          <td><button class="secondary-button analyze-overnight" data-code="${escapeHTML(item.code)}">分析</button></td>
        </tr>
      `;
    })
    .join("");
  $$(".analyze-overnight").forEach((button) =>
    button.addEventListener("click", () => {
      $("#stock-code").value = button.dataset.code;
      switchView("dashboard");
      loadMarketData(button.dataset.code);
    })
  );
  const asOf = new Date(snapshot.asOf);
  const timestamp = Number.isNaN(asOf.getTime())
    ? "--"
    : asOf.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });
  $("#overnight-note").textContent =
    `数据时间 ${timestamp} · 实时：${sourceStatus.candidateSource || "公开行情"} · 分时：${sourceStatus.intradaySource || "公开分时均价"}。历史统计采用当日收盘至次日开盘的日线代理，未复刻历史量比、换手和分时条件，不构成投资建议。`;
  refreshIcons();
  scheduleOvernightRefresh();
}

async function loadOvernight({ force = false } = {}) {
  const localWindow = localOvernightWindow();
  const storedSnapshot = readJSON("hengce.overnight.snapshot.v1", null);
  if (!isBrowserPreview && storedSnapshot?.date !== todayKey()) {
    state.overnight = null;
    state.overnightStreaks.clear();
    writeJSON("hengce.overnight.streaks.v1", { date: todayKey(), values: {} });
  }
  if (!isBrowserPreview && ["locked", "closed"].includes(localWindow.state)) {
    if (storedSnapshot?.date === todayKey() && storedSnapshot.snapshot) {
      state.overnight = {
        ...storedSnapshot.snapshot,
        window: { ...localWindow, canScan: false }
      };
      state.overnightError = "";
      state.overnightLoading = false;
      renderOvernight();
      return;
    }
  }
  if (state.overnight && !force) {
    renderOvernight();
    return;
  }
  state.overnightLoading = true;
  state.overnightError = "";
  renderOvernight();
  try {
    const previousCodes = new Set((state.overnight?.picks || []).map((item) => item.code));
    const snapshot = confirmOvernightPicks(await window.hengce.overnight({ force }));
    state.overnight = snapshot;
    const newPicks = (snapshot.picks || []).filter((item) => !previousCodes.has(item.code));
    if (!isBrowserPreview && newPicks.length && !$("#overnight-view").classList.contains("active")) {
      window.hengce.notify(
        "衡策尾盘观察",
        `${newPicks.map((item) => item.name).join("、")} 已连续两次通过筛选`
      );
    }
    if (!isBrowserPreview && snapshot.window?.state === "scanning") {
      writeJSON("hengce.overnight.snapshot.v1", {
        date: todayKey(),
        snapshot
      });
    }
  } catch (error) {
    state.overnightError = friendlyMarketError(error);
  } finally {
    state.overnightLoading = false;
    renderOvernight();
  }
}

function metricCell(title, value, detail, className = "") {
  return `
    <div class="metric-cell">
      <span>${escapeHTML(title)}</span>
      <strong class="${className}">${escapeHTML(value)}</strong>
      <small>${escapeHTML(detail)}</small>
    </div>
  `;
}

function renderDefaultStockButton() {
  const button = $("#toggle-default-stock");
  if (!button) return;
  const active = state.defaultCode === state.code;
  button.classList.toggle("active", active);
  button.title = active ? "取消默认标的" : "设为默认标的";
  button.setAttribute("aria-label", button.title);
}

function renderObservationPlan() {
  const container = $("#observation-plan");
  if (!container) return;
  const plan = buildObservationPlan({
    quote: state.quote,
    model: state.analysis,
    valuation: state.valuation
  });
  const status = $("#observation-plan-status");
  status.textContent = plan.status;
  status.className = `plan-status ${plan.available ? "ready" : "waiting"}`;
  const range = plan.pullbackRange
    ? `${number(plan.pullbackRange.low)} - ${number(plan.pullbackRange.high)}`
    : "暂未形成";
  container.innerHTML = [
    ["回踩观察区", range, "需结合量能确认"],
    ["突破触发", plan.breakout ? number(plan.breakout) : "--", "站稳后再观察"],
    ["估值约束", plan.valuationCap ? `不高于 ${number(plan.valuationCap)}` : "数据不足", plan.confidence ? `可信度 ${plan.confidence.label}` : "不强行套用"],
    ["模型失效位", plan.invalidation ? number(plan.invalidation) : "--", "触及时重新评估"]
  ].map(([label, value, detail]) => `
    <div><span>${escapeHTML(label)}</span><strong>${escapeHTML(value)}</strong><small>${escapeHTML(detail)}</small></div>
  `).join("");
  $("#observation-plan-note").textContent =
    `${plan.reason}。${plan.method || "区间仅用于研究观察，不构成买入建议。"}`;
  const watchButton = $("#watch-current-stock");
  const watched = state.quote && state.watchlist.some((item) => item.code === state.quote.code);
  watchButton.disabled = !state.quote || watched;
  watchButton.querySelector("span").textContent = watched ? "已加入观察" : "加入观察提醒";
  $("#record-current-holding").disabled = !state.quote;
}

function renderDashboard() {
  const quote = state.quote;
  const model = state.analysis;
  if (!quote || !model) return;
  const quoteFreshness = freshness(quote.timestamp, 15);
  const dataStatus = $("#dashboard-data-status");
  dataStatus.innerHTML = `
    <span class="status-dot ${quoteFreshness.stale ? "stale" : ""}"></span>
    <span>${quoteFreshness.stale ? "行情可能已过期" : "行情时间有效"}</span>
    <small>报价：${escapeHTML(quote.source || "腾讯/东方财富公开行情")} · 日线：前复权双源降级 · 财务与行业：东方财富公开数据</small>
  `;
  dataStatus.classList.remove("hidden");
  const change = quote.price - quote.previousClose;
  const holding = state.holdings.find((item) => item.code === quote.code);
  const pnl = holding ? (quote.price - holding.cost) * holding.shares : null;
  const pnlRate = holding ? quote.price / holding.cost - 1 : null;

  $("#quote-title").innerHTML = `
    <strong>${escapeHTML(quote.name)}</strong>
    <span>${escapeHTML(quote.code)}</span>
  `;
  $("#current-price").textContent = number(quote.price);
  $("#current-price").className = directionClass(quote.percentChange);
  $("#quote-change").textContent =
    `${change >= 0 ? "+" : ""}${number(change)}  ${percent(quote.percentChange)}`;
  $("#quote-change").className = directionClass(quote.percentChange);
  $("#quote-open").textContent = number(quote.open);
  $("#quote-high").textContent = number(quote.high);
  $("#quote-low").textContent = number(quote.low);
  $("#quote-amount").textContent = compactMoney(quote.amount);

  const amplitude = quote.low > 0 ? quote.high / quote.low - 1 : 0;
  $("#metric-grid").innerHTML = [
    metricCell("量化评分", String(model.score), model.trend),
    metricCell(
      "日内区间",
      `${number(quote.low)} - ${number(quote.high)}`,
      `振幅 ${percent(amplitude, true)}`
    ),
    metricCell(
      "成交额",
      compactMoney(quote.amount),
      `量能比 ${number(model.volumeRatio)}`
    ),
    metricCell(
      "支撑 / 压力",
      `${number(model.support)} / ${number(model.pressure)}`,
      `风险线 ${number(model.riskLine)}`
    ),
    metricCell(
      holding ? "持仓浮盈亏" : "持仓",
      holding ? compactMoney(pnl) : "未录入",
      holding ? percent(pnlRate, true) : "在持仓管理中添加",
      holding ? directionClass(pnl) : ""
    )
  ].join("");
  $("#metric-grid .metric-cell:first-child strong").style.color =
    scoreColor(model.score);

  $("#analysis-summary").textContent = model.summary;
  $("#analysis-signal").textContent = `信号：${model.signal}`;
  $("#analysis-signal").style.color = scoreColor(model.score);
  $("#positive-list").innerHTML = (model.positives.length
    ? model.positives
    : ["暂无突出技术优势，等待结构确认"]
  )
    .map(
      (item) => `
        <div class="finding positive">
          <i data-lucide="circle-check"></i>
          <span>${escapeHTML(item)}</span>
        </div>
      `
    )
    .join("");
  $("#risk-list").innerHTML = (model.risks.length
    ? model.risks
    : ["当前未发现突出量价风险，仍需执行风险线"]
  )
    .map(
      (item) => `
        <div class="finding negative">
          <i data-lucide="circle-x"></i>
          <span>${escapeHTML(item)}</span>
        </div>
      `
    )
    .join("");

  const indicators = [
    ["MA5", number(model.sma5)],
    ["MA10", number(model.sma10)],
    ["MA20", number(model.sma20)],
    ["MA60", number(model.sma60)],
    ["RSI14", number(model.rsi14)],
    ["MACD柱", number(model.macdHistogram, 3)],
    ["ATR14", number(model.atr14)],
    ["20日动量", percent(model.momentum20, true)],
    ["年化波动", percent(model.volatility, true)]
  ];
  $("#indicator-table").innerHTML = indicators
    .map(
      ([label, value]) => `
        <div class="indicator-item">
          <span>${label}</span>
          <strong>${value}</strong>
        </div>
      `
    )
    .join("");
  const isIntraday = state.chartMode === "intraday";
  $("#chart-caption").textContent = isIntraday
    ? `当日分时 · ${state.intraday.at(-1)?.time?.slice(0, 10) || "等待数据"}`
    : `前复权日线 · ${state.bars.at(-1)?.date || "--"}`;
  $("#kline-range").classList.toggle("hidden", isIntraday);
  $("#price-chart-wrap").classList.toggle("daily-chart", !isIntraday);
  $$("[data-chart-mode]").forEach((button) =>
    button.classList.toggle("active", button.dataset.chartMode === state.chartMode)
  );
  $("#trade-plan").innerHTML = `
    <div><span>买入观察</span><strong>放量站稳 ${number(model.pressure)}</strong><small>避免在压力位下方追高</small></div>
    <i data-lucide="arrow-right"></i>
    <div><span>持有条件</span><strong>守住 ${number(model.sma20)}</strong><small>结合量能与趋势持续确认</small></div>
    <i data-lucide="arrow-right"></i>
    <div><span>卖出 / 风控</span><strong>跌破 ${number(model.riskLine)}</strong><small>模型条件触发时优先控制风险</small></div>
  `;
  renderDefaultStockButton();
  renderObservationPlan();
  schedulePriceChart();
  refreshIcons();
}

function prepareCanvas(canvas) {
  const bounds = canvas.getBoundingClientRect();
  const ratio = Math.max(1, window.devicePixelRatio || 1);
  const width = Math.floor(bounds.width);
  const height = Math.floor(bounds.height);
  if (width < 1 || height < 1) return null;
  const pixelWidth = Math.round(width * ratio);
  const pixelHeight = Math.round(height * ratio);
  if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
    canvas.width = pixelWidth;
    canvas.height = pixelHeight;
  }
  const context = canvas.getContext("2d");
  context.setTransform(ratio, 0, 0, ratio, 0, 0);
  context.clearRect(0, 0, width, height);
  return { context, width, height };
}

function drawLineChart(canvas, points, options = {}) {
  const prepared = prepareCanvas(canvas);
  if (!prepared || !points.length) return null;
  const { context, width, height } = prepared;
  const pad = { left: 12, right: 64, top: 16, bottom: 28 };
  const rawValues = points.map((point) => point.value).filter(Number.isFinite);
  if (Array.isArray(options.secondaryPoints)) {
    rawValues.push(...options.secondaryPoints.filter(Number.isFinite));
  }
  if (Number.isFinite(options.support)) rawValues.push(options.support);
  if (Number.isFinite(options.pressure)) rawValues.push(options.pressure);
  let minimum = Math.min(...rawValues);
  let maximum = Math.max(...rawValues);
  const spread = Math.max(maximum - minimum, Math.abs(maximum) * 0.02, 1);
  minimum -= spread * 0.08;
  maximum += spread * 0.08;
  const plotWidth = width - pad.left - pad.right;
  const plotHeight = height - pad.top - pad.bottom;
  const xFor = (index) =>
    pad.left + (index / Math.max(1, points.length - 1)) * plotWidth;
  const yFor = (value) =>
    pad.top + ((maximum - value) / (maximum - minimum)) * plotHeight;

  context.font = "11px -apple-system, sans-serif";
  context.textAlign = "left";
  context.textBaseline = "middle";
  context.strokeStyle = "#e1e5e9";
  context.fillStyle = "#7b8590";
  context.lineWidth = 1;
  for (let index = 0; index <= 4; index += 1) {
    const value = minimum + ((maximum - minimum) * index) / 4;
    const y = yFor(value);
    context.beginPath();
    context.moveTo(pad.left, y);
    context.lineTo(width - pad.right, y);
    context.stroke();
    context.fillText(number(value, options.money ? 0 : 2), width - pad.right + 8, y);
  }

  const labelIndices = [0, 0.25, 0.5, 0.75, 1].map((fraction) =>
    Math.round((points.length - 1) * fraction)
  );
  context.textAlign = "center";
  context.textBaseline = "top";
  for (const index of [...new Set(labelIndices)]) {
    context.fillText(points[index].label || points[index].date.slice(5), xFor(index), height - 20);
  }

  const drawRule = (value, color, label) => {
    if (!Number.isFinite(value)) return;
    const y = yFor(value);
    context.save();
    context.setLineDash([5, 4]);
    context.strokeStyle = color;
    context.beginPath();
    context.moveTo(pad.left, y);
    context.lineTo(width - pad.right, y);
    context.stroke();
    context.restore();
    context.textAlign = "left";
    context.textBaseline = "bottom";
    context.fillStyle = color;
    context.fillText(`${label} ${number(value)}`, pad.left + 4, y - 3);
  };
  drawRule(options.support, "#0d9c73", "支撑");
  drawRule(options.pressure, "#c77d18", "压力");

  const gradient = context.createLinearGradient(0, pad.top, 0, height - pad.bottom);
  gradient.addColorStop(0, options.fill || "rgba(226,61,61,0.18)");
  gradient.addColorStop(1, "rgba(226,61,61,0.01)");
  context.beginPath();
  points.forEach((point, index) => {
    const x = xFor(index);
    const y = yFor(point.value);
    if (index === 0) context.moveTo(x, y);
    else context.lineTo(x, y);
  });
  context.lineTo(xFor(points.length - 1), height - pad.bottom);
  context.lineTo(xFor(0), height - pad.bottom);
  context.closePath();
  context.fillStyle = gradient;
  context.fill();

  context.beginPath();
  points.forEach((point, index) => {
    const x = xFor(index);
    const y = yFor(point.value);
    if (index === 0) context.moveTo(x, y);
    else context.lineTo(x, y);
  });
  context.strokeStyle = options.color || "#e23d3d";
  context.lineWidth = 2;
  context.lineJoin = "round";
  context.lineCap = "round";
  context.stroke();
  if (Array.isArray(options.secondaryPoints) && options.secondaryPoints.length === points.length) {
    context.beginPath();
    options.secondaryPoints.forEach((value, index) => {
      const x = xFor(index);
      const y = yFor(value);
      if (index === 0) context.moveTo(x, y);
      else context.lineTo(x, y);
    });
    context.strokeStyle = options.secondaryColor || "#c28a21";
    context.lineWidth = 1.25;
    context.stroke();
  }
  return { xFor, yFor, points, pad, width, height };
}

function simpleMovingAverage(values, period) {
  let sum = 0;
  return values.map((value, index) => {
    sum += value;
    if (index >= period) sum -= values[index - period];
    return index >= period - 1 ? sum / period : null;
  });
}

function exponentialMovingAverage(values, period) {
  const multiplier = 2 / (period + 1);
  let current = null;
  return values.map((value) => {
    current = current == null ? value : value * multiplier + current * (1 - multiplier);
    return current;
  });
}

function kdjSeries(bars, period = 9) {
  let k = 50;
  let d = 50;
  return bars.map((bar, index) => {
    const windowBars = bars.slice(Math.max(0, index - period + 1), index + 1);
    const lowest = Math.min(...windowBars.map((item) => item.low));
    const highest = Math.max(...windowBars.map((item) => item.high));
    const rsv = highest === lowest ? 50 : ((bar.close - lowest) / (highest - lowest)) * 100;
    k = (2 * k + rsv) / 3;
    d = (2 * d + k) / 3;
    return { k, d, j: 3 * k - 2 * d };
  });
}

function macdSeries(values) {
  const fast = exponentialMovingAverage(values, 12);
  const slow = exponentialMovingAverage(values, 26);
  const dif = values.map((_, index) => fast[index] - slow[index]);
  const dea = exponentialMovingAverage(dif, 9);
  return dif.map((value, index) => ({
    dif: value,
    dea: dea[index],
    histogram: (value - dea[index]) * 2
  }));
}

function drawKLineChart(canvas, bars, range) {
  const prepared = prepareCanvas(canvas);
  const selected = bars.slice(-range);
  if (!prepared || !selected.length) return null;
  const { context, width, height } = prepared;
  const startIndex = bars.length - selected.length;
  const pad = { left: 12, right: 64, top: 26, bottom: 28 };
  const plotWidth = width - pad.left - pad.right;
  const panels = {
    price: { top: 28, bottom: height * 0.53 },
    volume: { top: height * 0.56, bottom: height * 0.68 },
    kdj: { top: height * 0.71, bottom: height * 0.83 },
    macd: { top: height * 0.86, bottom: height - pad.bottom }
  };
  const xFor = (index) =>
    pad.left + ((index + 0.5) / selected.length) * plotWidth;
  const closes = bars.map((bar) => bar.close);
  const maDefinitions = [
    { period: 5, color: "#2767ff" },
    { period: 10, color: "#f29b18" },
    { period: 20, color: "#ec4fa4" },
    { period: 60, color: "#05aaa6" }
  ].map((item) => ({
    ...item,
    values: simpleMovingAverage(closes, item.period).slice(startIndex)
  }));
  const priceValues = selected.flatMap((bar) => [bar.low, bar.high]);
  maDefinitions.forEach((item) =>
    priceValues.push(...item.values.filter(Number.isFinite))
  );
  let priceMinimum = Math.min(...priceValues);
  let priceMaximum = Math.max(...priceValues);
  const priceSpread = Math.max(priceMaximum - priceMinimum, priceMaximum * 0.03, 1);
  priceMinimum -= priceSpread * 0.06;
  priceMaximum += priceSpread * 0.08;
  const yPrice = (value) =>
    panels.price.top +
    ((priceMaximum - value) / (priceMaximum - priceMinimum)) *
      (panels.price.bottom - panels.price.top);

  context.font = "10px -apple-system, sans-serif";
  context.lineWidth = 1;
  context.strokeStyle = "#e8ebee";
  context.fillStyle = "#7b8590";
  context.textBaseline = "middle";
  context.textAlign = "left";
  for (let index = 0; index <= 4; index += 1) {
    const value = priceMinimum + ((priceMaximum - priceMinimum) * index) / 4;
    const y = yPrice(value);
    context.beginPath();
    context.moveTo(pad.left, y);
    context.lineTo(width - pad.right, y);
    context.stroke();
    context.fillText(number(value, 2), width - pad.right + 7, y);
  }
  const dateIndices = [0, 0.25, 0.5, 0.75, 1].map((fraction) =>
    Math.min(selected.length - 1, Math.round((selected.length - 1) * fraction))
  );
  context.textAlign = "center";
  context.textBaseline = "top";
  for (const index of [...new Set(dateIndices)]) {
    const x = xFor(index);
    context.beginPath();
    context.moveTo(x, panels.price.top);
    context.lineTo(x, panels.macd.bottom);
    context.stroke();
    context.fillStyle = "#7b8590";
    context.fillText(selected[index].date.slice(5), x, height - 20);
  }

  const drawLevel = (value, color, label) => {
    if (!Number.isFinite(value)) return;
    const y = yPrice(value);
    context.save();
    context.setLineDash([4, 4]);
    context.strokeStyle = color;
    context.beginPath();
    context.moveTo(pad.left, y);
    context.lineTo(width - pad.right, y);
    context.stroke();
    context.restore();
    context.fillStyle = color;
    context.textAlign = "left";
    context.textBaseline = "bottom";
    context.fillText(`${label} ${number(value)}`, pad.left + 4, y - 2);
  };
  drawLevel(state.analysis?.support, "#0d9c73", "支撑");
  drawLevel(state.analysis?.pressure, "#c77d18", "压力");

  const candleWidth = Math.max(2, Math.min(9, (plotWidth / selected.length) * 0.62));
  selected.forEach((bar, index) => {
    const x = xFor(index);
    const rising = bar.close >= bar.open;
    const color = rising ? "#ef3f33" : "#079566";
    context.strokeStyle = color;
    context.fillStyle = color;
    context.beginPath();
    context.moveTo(x, yPrice(bar.high));
    context.lineTo(x, yPrice(bar.low));
    context.stroke();
    const bodyTop = yPrice(Math.max(bar.open, bar.close));
    const bodyBottom = yPrice(Math.min(bar.open, bar.close));
    const bodyHeight = Math.max(1, bodyBottom - bodyTop);
    context.fillRect(x - candleWidth / 2, bodyTop, candleWidth, bodyHeight);
  });

  const drawSeries = (values, yFor, color, lineWidth = 1.2) => {
    context.beginPath();
    let drawing = false;
    values.forEach((value, index) => {
      if (!Number.isFinite(value)) {
        drawing = false;
        return;
      }
      const x = xFor(index);
      const y = yFor(value);
      if (!drawing) context.moveTo(x, y);
      else context.lineTo(x, y);
      drawing = true;
    });
    context.strokeStyle = color;
    context.lineWidth = lineWidth;
    context.stroke();
  };
  maDefinitions.forEach((item) => drawSeries(item.values, yPrice, item.color));
  context.textAlign = "left";
  context.textBaseline = "top";
  context.fillStyle = "#59636e";
  context.fillText("MA", pad.left, 7);
  let legendX = pad.left + 22;
  maDefinitions.forEach((item) => {
    context.fillStyle = item.color;
    const label = `MA${item.period}:${number(item.values.at(-1), 2)}`;
    context.fillText(label, legendX, 7);
    legendX += context.measureText(label).width + 10;
  });

  const maximumVolume = Math.max(...selected.map((bar) => bar.volume), 1);
  selected.forEach((bar, index) => {
    const barHeight =
      (bar.volume / maximumVolume) * (panels.volume.bottom - panels.volume.top);
    context.fillStyle = bar.close >= bar.open ? "#ef3f33" : "#079566";
    context.fillRect(
      xFor(index) - candleWidth / 2,
      panels.volume.bottom - barHeight,
      candleWidth,
      barHeight
    );
  });
  context.fillStyle = "#59636e";
  context.textAlign = "left";
  context.textBaseline = "top";
  context.fillText(`VOL ${compactMoney(selected.at(-1).volume)}`, pad.left, panels.volume.top - 13);

  const kdj = kdjSeries(bars).slice(startIndex);
  const yKdj = (value) =>
    panels.kdj.bottom -
    ((Math.max(-20, Math.min(120, value)) + 20) / 140) *
      (panels.kdj.bottom - panels.kdj.top);
  context.strokeStyle = "#edf0f2";
  [20, 80].forEach((value) => {
    context.beginPath();
    context.moveTo(pad.left, yKdj(value));
    context.lineTo(width - pad.right, yKdj(value));
    context.stroke();
  });
  drawSeries(kdj.map((item) => item.k), yKdj, "#2767ff");
  drawSeries(kdj.map((item) => item.d), yKdj, "#f29b18");
  drawSeries(kdj.map((item) => item.j), yKdj, "#ec4fa4");
  const latestKdj = kdj.at(-1);
  context.fillStyle = "#59636e";
  context.fillText(
    `KDJ  K:${number(latestKdj.k, 1)}  D:${number(latestKdj.d, 1)}  J:${number(latestKdj.j, 1)}`,
    pad.left,
    panels.kdj.top - 13
  );

  const macd = macdSeries(closes).slice(startIndex);
  const macdLimit = Math.max(
    ...macd.flatMap((item) => [Math.abs(item.dif), Math.abs(item.dea), Math.abs(item.histogram)]),
    0.01
  );
  const yMacd = (value) =>
    panels.macd.top +
    ((macdLimit - value) / (macdLimit * 2)) *
      (panels.macd.bottom - panels.macd.top);
  context.strokeStyle = "#dfe3e7";
  context.beginPath();
  context.moveTo(pad.left, yMacd(0));
  context.lineTo(width - pad.right, yMacd(0));
  context.stroke();
  macd.forEach((item, index) => {
    const zero = yMacd(0);
    const valueY = yMacd(item.histogram);
    context.fillStyle = item.histogram >= 0 ? "#ef3f33" : "#079566";
    context.fillRect(
      xFor(index) - candleWidth / 2,
      Math.min(zero, valueY),
      candleWidth,
      Math.max(1, Math.abs(zero - valueY))
    );
  });
  drawSeries(macd.map((item) => item.dif), yMacd, "#2767ff");
  drawSeries(macd.map((item) => item.dea), yMacd, "#f29b18");
  const latestMacd = macd.at(-1);
  context.fillStyle = "#59636e";
  context.fillText(
    `MACD  DIF:${number(latestMacd.dif, 2)}  DEA:${number(latestMacd.dea, 2)}  柱:${number(latestMacd.histogram, 2)}`,
    pad.left,
    panels.macd.top - 13
  );

  const hoverIndex = state.chartHoverIndex;
  if (Number.isInteger(hoverIndex) && selected[hoverIndex]) {
    const x = xFor(hoverIndex);
    const y = yPrice(selected[hoverIndex].close);
    context.save();
    context.setLineDash([3, 3]);
    context.strokeStyle = "rgba(72,82,92,0.65)";
    context.beginPath();
    context.moveTo(x, panels.price.top);
    context.lineTo(x, panels.macd.bottom);
    context.moveTo(pad.left, y);
    context.lineTo(width - pad.right, y);
    context.stroke();
    context.restore();
    context.fillStyle = "#343c45";
    context.fillRect(width - pad.right, y - 9, pad.right, 18);
    context.fillStyle = "#fff";
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillText(number(selected[hoverIndex].close), width - pad.right / 2, y);
  }
  return {
    xFor,
    yFor: yPrice,
    points: selected.map((bar) => ({ date: bar.date, value: bar.close, bar })),
    pad,
    width,
    height,
    panels,
    daily: true
  };
}

function drawPriceChart() {
  if (state.chartMode === "intraday") {
    const points = state.intraday.map((point) => ({
      date: point.time,
      label: point.time.slice(-5),
      value: point.price,
      intraday: point
    }));
    $("#price-chart")._geometry = drawLineChart($("#price-chart"), points, {
      color: "#e23d3d",
      fill: "rgba(226,61,61,0.12)",
      secondaryPoints: state.intraday.map((point) => point.averagePrice),
      secondaryColor: "#c28a21"
    });
    return;
  }
  $("#price-chart")._geometry = drawKLineChart(
    $("#price-chart"),
    state.bars,
    state.chartRange
  );
}

let priceChartFrame = 0;

function schedulePriceChart() {
  cancelAnimationFrame(priceChartFrame);
  priceChartFrame = requestAnimationFrame(() => {
    if ($("#dashboard-view").classList.contains("active")) {
      drawPriceChart();
    }
  });
}

function filteredBacktestBars() {
  if (!state.bars.length) return [];
  const latest = new Date(`${state.bars.at(-1).date}T00:00:00`);
  const cutoff = new Date(latest);
  cutoff.setFullYear(cutoff.getFullYear() - state.backtestYears);
  return state.bars.filter(
    (bar) => new Date(`${bar.date}T00:00:00`) >= cutoff
  );
}

function renderBacktest() {
  if (!state.bars.length || !state.quote) return;
  const result = runBacktest(
    filteredBacktestBars(),
    state.strategy,
    state.settings
  );
  $("#backtest-symbol").textContent = `${state.quote.name} ${state.quote.code}`;
  $("#backtest-metrics").innerHTML = [
    metricCell("策略收益", percent(result.totalReturn, true), "期末净值"),
    metricCell("年化收益", percent(result.annualizedReturn, true), "复合年化"),
    metricCell("同期持有", percent(result.benchmarkReturn, true), "买入并持有"),
    metricCell("最大回撤", percent(-result.maxDrawdown, true), "峰谷损失", "down"),
    metricCell("夏普比率", number(result.sharpeRatio), "风险调整收益"),
    metricCell("胜率 / 次数", `${percent(result.winRate, true)} / ${result.tradeCount}`, "完整交易")
  ].join("");
  const values = [
    result.totalReturn,
    result.annualizedReturn,
    result.benchmarkReturn
  ];
  $$("#backtest-metrics .metric-cell strong")
    .slice(0, 3)
    .forEach((element, index) =>
      element.classList.add(directionClass(values[index]))
    );
  drawLineChart(
    $("#equity-chart"),
    result.equityCurve.map((point) => ({
      date: point.date,
      value: point.value
    })),
    {
      color: "#2e6de6",
      fill: "rgba(46,109,230,0.16)",
      money: true
    }
  );
  $("#trade-count-label").textContent =
    `${result.tradeCount} 笔完成${result.openPosition ? " · 1 笔持有中" : ""}`;
  const completedTradeRows = result.trades
    .slice()
    .reverse()
    .map(
      (trade) => `
            <tr>
              <td>${trade.entryDate}</td>
              <td>${trade.exitDate}</td>
              <td>${number(trade.entryPrice)}</td>
              <td>${number(trade.exitPrice)}</td>
              <td>${trade.shares.toLocaleString("zh-CN")}</td>
              <td class="${directionClass(trade.profit)}">
                ${compactMoney(trade.profit)}
                <small>${percent(trade.returnPercent, true)}</small>
              </td>
            </tr>
          `
    )
    .join("");
  const openPositionRow = result.openPosition
    ? `
        <tr>
          <td>${result.openPosition.entryDate}</td>
          <td>持有中</td>
          <td>${number(result.openPosition.entryPrice)}</td>
          <td>${number(result.openPosition.markPrice)}</td>
          <td>${result.openPosition.shares.toLocaleString("zh-CN")}</td>
          <td class="${directionClass(result.openPosition.unrealizedProfit)}">
            ${compactMoney(result.openPosition.unrealizedProfit)}
            <small>${percent(result.openPosition.returnPercent, true)} · 未实现</small>
          </td>
        </tr>
      `
    : "";
  $("#trade-table-body").innerHTML =
    openPositionRow ||
    completedTradeRows
      ? `${openPositionRow}${completedTradeRows}`
      : '<tr><td colspan="6" class="muted">当前参数没有产生交易</td></tr>';
}

async function updateHoldingQuotes() {
  const missing = state.holdings.filter((holding) => !state.quotes.has(holding.code));
  const settled = await Promise.allSettled(
    missing.map((holding) => window.hengce.quote(holding.code))
  );
  settled.forEach((item) => {
    if (item.status === "fulfilled") {
      state.quotes.set(item.value.code, item.value);
    }
  });
  renderHoldings();
  updatePortfolioRisk();
}

function renderPortfolioRisk() {
  const container = $("#portfolio-risk-content");
  if (state.portfolioRiskLoading) {
    container.innerHTML = '<div class="valuation-loading"><span class="spinner"></span><span>正在计算持仓相关性与行业暴露</span></div>';
    return;
  }
  const risk = state.portfolioRisk;
  if (!risk || !state.holdings.length) {
    container.innerHTML = '<span class="muted">添加持仓后计算组合风险</span>';
    return;
  }
  const riskClass =
    risk.riskLevel === "较高"
      ? "portfolio-risk-high"
      : risk.riskLevel === "中等"
        ? "portfolio-risk-medium"
        : "portfolio-risk-low";
  const metrics = [
    ["组合风险", risk.riskLevel, `${risk.sampleDays} 个共同交易日`, riskClass],
    ["年化波动", risk.annualizedVolatility == null ? "--" : plainPercent(risk.annualizedVolatility, true), "按日收益估算"],
    ["平均相关性", risk.averageCorrelation == null ? "--" : number(risk.averageCorrelation), "越低越分散"],
    ["最大单股占比", plainPercent(risk.maxWeight, true), risk.maxWeight > 0.4 ? "集中度偏高" : "集中度可控"],
    ["分散评分", `${risk.diversificationScore}`, "仅衡量权重分散"]
  ];
  container.innerHTML = `
    <div class="portfolio-risk-metrics">
      ${metrics.map(([label, value, detail, className = ""]) => `
        <div class="portfolio-risk-stat">
          <span>${label}</span>
          <strong class="${className}">${value}</strong>
          <small>${detail}</small>
        </div>
      `).join("")}
    </div>
    <div class="industry-exposure">
      <h3>行业暴露</h3>
      ${risk.industries.map((industry) => `
        <div class="exposure-row">
          <span>${escapeHTML(industry.name)}</span>
          <div><i style="width:${Math.min(100, industry.weight * 100)}%"></i></div>
          <strong>${plainPercent(industry.weight, true)}</strong>
        </div>
      `).join("") || '<span class="muted">行业资料暂不可用</span>'}
    </div>
  `;
  $("#portfolio-risk-caption").textContent =
    `按近120个交易日估算 · ${risk.positionCount}/${state.holdings.length} 只完成计算`;
}

async function updatePortfolioRisk() {
  if (!state.holdings.length) {
    state.portfolioRisk = null;
    renderPortfolioRisk();
    return;
  }
  state.portfolioRiskLoading = true;
  renderPortfolioRisk();
  const missingHistories = state.holdings.filter(
    (holding) => !state.holdingHistories.has(holding.code)
  );
  const missingProfiles = state.holdings.filter(
    (holding) => !state.profiles.has(holding.code)
  );
  const [historyResults, profileResults] = await Promise.all([
    Promise.allSettled(
      missingHistories.map(async (holding) => ({
        code: holding.code,
        bars: await window.hengce.klines(holding.code, 130)
      }))
    ),
    Promise.allSettled(
      missingProfiles.map(async (holding) => ({
        code: holding.code,
        profile: await window.hengce.profile(holding.code)
      }))
    )
  ]);
  historyResults.forEach((result) => {
    if (result.status === "fulfilled") {
      state.holdingHistories.set(result.value.code, result.value.bars);
    }
  });
  profileResults.forEach((result) => {
    if (result.status === "fulfilled") {
      state.profiles.set(result.value.code, result.value.profile);
    }
  });
  state.portfolioRisk = window.HengCePortfolio.buildPortfolioRisk(
    state.holdings,
    state.quotes,
    state.holdingHistories,
    state.profiles
  );
  state.portfolioRiskLoading = false;
  renderPortfolioRisk();
}

function renderHoldings() {
  const costs = state.holdings.reduce(
    (sum, item) => sum + item.cost * item.shares,
    0
  );
  let marketValue = 0;
  let quotedCost = 0;
  for (const holding of state.holdings) {
    const quote = state.quotes.get(holding.code);
    if (quote) {
      marketValue += quote.price * holding.shares;
      quotedCost += holding.cost * holding.shares;
    }
  }
  const totalPnl = marketValue - quotedCost;
  $("#holding-summary").innerHTML = [
    ["已记录成本", compactMoney(costs), `${state.holdings.length} 只股票`],
    [
      "最新市值",
      quotedCost ? compactMoney(marketValue) : "--",
      quotedCost ? "按可获得行情计算" : "等待行情"
    ],
    [
      "合计浮盈亏",
      quotedCost ? compactMoney(totalPnl) : "--",
      quotedCost ? percent(totalPnl / quotedCost, true) : "等待行情",
      quotedCost ? directionClass(totalPnl) : ""
    ]
  ]
    .map(
      ([label, value, detail, className = ""]) => `
        <div class="portfolio-stat">
          <span>${label}</span>
          <strong class="${className}">${value}</strong>
          <small class="muted">${detail}</small>
        </div>
      `
    )
    .join("");

  $("#holdings-empty").classList.toggle("hidden", state.holdings.length > 0);
  $("#holdings-table-body").innerHTML = state.holdings
    .map((holding) => {
      const quote = state.quotes.get(holding.code);
      const pnl = quote ? (quote.price - holding.cost) * holding.shares : null;
      const recovery = quote ? holding.cost / quote.price - 1 : null;
      return `
        <tr>
          <td>
            <div class="stock-cell">
              <strong>${escapeHTML(holding.name || holding.code)}</strong>
              <span>${holding.code}</span>
            </div>
          </td>
          <td>${holding.shares.toLocaleString("zh-CN")}</td>
          <td>${number(holding.cost, 3)}</td>
          <td>${quote ? number(quote.price) : "--"}</td>
          <td class="${pnl == null ? "" : directionClass(pnl)}">
            ${pnl == null ? "--" : compactMoney(pnl)}
          </td>
          <td>${recovery == null ? "--" : recovery <= 0 ? "已回本" : percent(recovery, true)}</td>
          <td>
            <div class="table-actions">
              <button class="table-action edit-holding" data-code="${holding.code}" title="记录或调整持仓"><i data-lucide="pencil"></i></button>
              <button class="table-action primary-holding ${holding.primary ? "active" : ""}" data-code="${holding.code}" title="${holding.primary ? "取消主仓" : "设为主仓"}"><i data-lucide="star"></i></button>
              <button class="table-action analyze-holding" data-code="${holding.code}" title="进入分析"><i data-lucide="arrow-up-right"></i></button>
              <button class="table-action delete-holding" data-code="${holding.code}" title="删除"><i data-lucide="trash-2"></i></button>
            </div>
          </td>
        </tr>
      `;
    })
    .join("");
  $$(".holding-row").forEach((row) => {
    row.addEventListener("click", (event) => {
      if (event.target.closest("button")) return;
      analyzeStock(row.dataset.code);
    });
    row.addEventListener("keydown", (event) => {
      if ((event.key === "Enter" || event.key === " ") && !event.target.closest("button")) {
        event.preventDefault();
        analyzeStock(row.dataset.code);
      }
    });
  });
  $$(".analyze-holding").forEach((button) =>
    button.addEventListener("click", () => analyzeStock(button.dataset.code))
  );
  $$(".edit-holding").forEach((button) =>
    button.addEventListener("click", () => {
      const holding = state.holdings.find((item) => item.code === button.dataset.code);
      if (holding) openHoldingDialog(holding);
    })
  );
  $$(".primary-holding").forEach((button) =>
    button.addEventListener("click", () => {
      const current = state.holdings.find((item) => item.code === button.dataset.code);
      state.holdings = current?.primary
        ? state.holdings.map((holding) => ({ ...holding, primary: false }))
        : setPrimaryHolding(state.holdings, button.dataset.code);
      writeJSON("hengce.holdings.v2", state.holdings);
      renderHoldings();
      showToast(current?.primary ? "已取消主仓标记" : "已设为主仓，首次启动时优先显示");
    })
  );
  $$(".delete-holding").forEach((button) =>
    button.addEventListener("click", () => {
      state.holdings = state.holdings.filter(
        (item) => item.code !== button.dataset.code
      );
      writeJSON("hengce.holdings.v2", state.holdings);
      state.holdingHistories.delete(button.dataset.code);
      state.profiles.delete(button.dataset.code);
      renderHoldings();
      updatePortfolioRisk();
      renderDashboard();
      showToast("持仓记录已删除");
    })
  );
  refreshIcons();
}

function openHoldingDialog(holding = null) {
  const dialog = $("#holding-dialog");
  const form = $("#holding-form");
  form.reset();
  $("#holding-search-results").classList.add("hidden");
  if (holding) {
    form.elements.code.value = holding.code || "";
    form.elements.name.value = holding.name || "";
    form.elements.shares.value = holding.shares || "";
    form.elements.cost.value = holding.cost || "";
  }
  dialog.showModal();
  $("#holding-stock-query").focus();
}

function addCurrentStockToWatchlist() {
  if (!state.quote || !state.analysis) {
    showToast("等待当前股票分析完成");
    return;
  }
  if (state.watchlist.some((item) => item.code === state.quote.code)) {
    showToast("当前股票已在观察提醒中");
    return;
  }
  state.watchlist.push({
    code: state.quote.code,
    name: state.quote.name,
    industry: state.valuation?.industry?.name || "未分类",
    addedAt: new Date().toISOString(),
    baselineScore: state.analysis.score,
    pressure: state.analysis.pressure,
    riskLine: state.analysis.riskLine,
    lastAlert: ""
  });
  writeJSON("hengce.watchlist.v1", state.watchlist);
  renderWatchlist();
  if (state.recommendations) renderRecommendations();
  renderObservationPlan();
  showToast(`${state.quote.name} 已加入观察提醒`);
}

function populateSettings() {
  const form = $("#settings-form");
  Object.entries(state.settings).forEach(([key, value]) => {
    if (form.elements[key]) form.elements[key].value = value;
  });
}

function restoreUiControls() {
  $("#stock-code").value = state.code;
  $("#recommendation-market").value = state.recommendationFilters.market;
  $("#recommendation-risk").value = state.recommendationFilters.risk;
  $("#recommendation-min-score").value = String(state.recommendationFilters.minScore);
  $("#backtest-years").value = String(state.backtestYears);
  $$('[data-hotspot-mode]').forEach((button) =>
    button.classList.toggle("active", button.dataset.hotspotMode === state.hotspotMode)
  );
  $$('[data-chart-mode]').forEach((button) =>
    button.classList.toggle("active", button.dataset.chartMode === state.chartMode)
  );
  $$('[data-range]').forEach((button) =>
    button.classList.toggle("active", Number(button.dataset.range) === state.chartRange)
  );
  $$('[data-strategy]').forEach((button) =>
    button.classList.toggle("active", button.dataset.strategy === state.strategy)
  );
}

function saveSettings() {
  const form = $("#settings-form");
  const values = {};
  Object.keys(DEFAULT_SETTINGS).forEach((key) => {
    values[key] = Number(form.elements[key].value);
  });
  if (values.slowPeriod <= values.fastPeriod) {
    values.slowPeriod = values.fastPeriod + 1;
    form.elements.slowPeriod.value = values.slowPeriod;
  }
  state.settings = values;
  writeJSON("hengce.settings.v1", state.settings);
  renderBacktest();
}

function fileSize(value) {
  const bytes = Number(value || 0);
  if (!bytes) return "--";
  if (bytes >= 1024 ** 3) return `${number(bytes / 1024 ** 3, 1)} GB`;
  if (bytes >= 1024 ** 2) return `${number(bytes / 1024 ** 2, 1)} MB`;
  return `${number(bytes / 1024, 1)} KB`;
}

function renderUpdate() {
  const info = state.updateInfo;
  $("#sidebar-version").textContent = `v${info?.currentVersion || state.appVersion}`;
  $("#update-nav-badge").classList.toggle("hidden", !info?.available);
  $("#sidebar-check-update").disabled = state.updateChecking || state.updateDownloading;
  $("#sidebar-check-update").textContent = info?.available
    ? "发现新版"
    : state.updateChecking
      ? "检查中…"
      : "检查更新";
  $("#update-version").textContent = info
    ? `当前 ${info.currentVersion} · 最新 ${info.latestVersion}`
    : "等待版本检查";
  $("#update-status").textContent = state.updateMessage;
  $("#check-update").disabled = state.updateChecking || state.updateDownloading;
  $("#check-update").textContent = state.updateChecking ? "检查中…" : "检查更新";
  $("#download-update").classList.toggle(
    "hidden",
    !info?.available || state.updateDownloaded
  );
  $("#download-update").disabled = state.updateDownloading;
  $("#download-update").textContent = state.updateDownloading
    ? "下载中…"
    : `下载新版${info?.assetSize ? ` · ${fileSize(info.assetSize)}` : ""}`;
  $("#install-update").classList.toggle("hidden", !state.updateDownloaded);
  const progress = $("#update-progress");
  progress.classList.toggle("hidden", !state.updateDownloading);
  const percent = state.updateProgress?.percent;
  $("#update-progress-bar").style.width = `${percent ?? 4}%`;
  $("#update-progress-label").textContent = percent == null
    ? `已下载 ${fileSize(state.updateProgress?.received)}`
    : `${percent}%`;
  const notes = $("#update-notes");
  const releaseNotes = info?.releaseNotes || "";
  notes.classList.toggle("hidden", !releaseNotes);
  $("#update-notes-content").textContent = releaseNotes;
}

async function checkForUpdates({ silent = false } = {}) {
  if (state.updateChecking || state.updateDownloading) return;
  state.updateChecking = true;
  if (!silent) state.updateMessage = "正在连接 GitHub 检查正式版本…";
  renderUpdate();
  try {
    state.updateInfo = await window.hengce.checkForUpdate();
    if (!state.updateInfo.supported) {
      state.updateMessage = "当前系统架构暂不支持应用内下载，请前往 Release 页面更新。";
    } else if (state.updateInfo.available) {
      state.updateMessage = `发现新版 ${state.updateInfo.latestVersion}，安装包将先校验 SHA-256。`;
      if (silent) showToast(`发现衡策 ${state.updateInfo.latestVersion} 新版本`);
    } else {
      state.updateMessage = "当前已经是最新正式版本。";
    }
  } catch (error) {
    state.updateMessage = `检查更新失败：${friendlyMarketError(error)}`;
  } finally {
    state.updateChecking = false;
    renderUpdate();
  }
}

async function downloadUpdate() {
  if (state.updateDownloading) return;
  state.updateDownloading = true;
  state.updateProgress = { received: 0, total: state.updateInfo?.assetSize || 0, percent: 0 };
  state.updateMessage = "正在下载新版安装包，请保持应用运行…";
  renderUpdate();
  try {
    await window.hengce.downloadUpdate();
    state.updateDownloaded = true;
    state.updateMessage = "下载与 SHA-256 校验完成，可以打开安装包。";
  } catch (error) {
    state.updateMessage = `下载失败：${friendlyMarketError(error)}`;
  } finally {
    state.updateDownloading = false;
    renderUpdate();
  }
}

async function installUpdate() {
  try {
    const result = await window.hengce.installUpdate();
    state.updateMessage = result.willQuit
      ? "安装程序已启动，应用即将退出。"
      : "新版安装映像已打开，请按系统提示完成替换。";
    renderUpdate();
  } catch (error) {
    state.updateMessage = `无法打开安装包：${friendlyMarketError(error)}`;
    renderUpdate();
  }
}

function switchView(view) {
  state.activeView = view;
  saveUiState();
  $$(".nav-item").forEach((button) =>
    button.classList.toggle("active", button.dataset.view === view)
  );
  $$(".view").forEach((section) =>
    section.classList.toggle("active", section.id === `${view}-view`)
  );
  if (view === "backtest") requestAnimationFrame(renderBacktest);
  if (view === "hotspots") loadHotspots();
  if (view === "compass") loadCompass();
  if (view === "recommendations") loadRecommendations();
  if (view === "overnight") loadOvernight();
  if (view === "watchlist") loadWatchlist();
  if (view === "holdings") updateHoldingQuotes();
  if (view === "dashboard") schedulePriceChart();
}

function bindEvents() {
  $$(".nav-item").forEach((button) =>
    button.addEventListener("click", () => switchView(button.dataset.view))
  );
  $("#analyze-button").addEventListener("click", submitStockSearch);
  $("#refresh-button").addEventListener("click", () => loadMarketData(state.code, { force: true }));
  $("#refresh-hotspots").addEventListener("click", () =>
    loadHotspots({ force: true })
  );
  $("#refresh-compass").addEventListener("click", () =>
    loadCompass({ force: true })
  );
  $("#refresh-recommendations").addEventListener("click", () =>
    loadRecommendations({ force: true })
  );
  $("#refresh-overnight").addEventListener("click", () =>
    loadOvernight({ force: true })
  );
  $("#refresh-watchlist").addEventListener("click", () =>
    loadWatchlist({ force: true })
  );
  [
    ["#recommendation-market", "market"],
    ["#recommendation-industry", "industry"],
    ["#recommendation-risk", "risk"],
    ["#recommendation-min-score", "minScore"]
  ].forEach(([selector, key]) =>
    $(selector).addEventListener("change", (event) => {
      state.recommendationFilters[key] =
        key === "minScore" ? Number(event.target.value) : event.target.value;
      saveUiState();
      renderRecommendations();
    })
  );
  $$("[data-hotspot-mode]").forEach((button) =>
    button.addEventListener("click", () => {
      $$("[data-hotspot-mode]").forEach((item) =>
        item.classList.remove("active")
      );
      button.classList.add("active");
      state.hotspotMode = button.dataset.hotspotMode;
      saveUiState();
      renderHotspots();
    })
  );
  const stockCodeInput = $("#stock-code");
  stockCodeInput.addEventListener("focus", (event) => {
    event.currentTarget.select();
  });
  stockCodeInput.addEventListener("input", (event) => {
    const query = event.currentTarget.value.trim();
    if (/^\d+$/.test(query) && query.length > 6) event.currentTarget.value = query.slice(0, 6);
    showError("");
    clearTimeout(stockSearchTimer);
    if (!query) {
      $("#stock-search-results").classList.add("hidden");
      return;
    }
    stockSearchTimer = setTimeout(() => searchStockNames(query), 180);
  });
  stockCodeInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") submitStockSearch();
  });
  stockCodeInput.addEventListener("blur", () =>
    setTimeout(() => $("#stock-search-results").classList.add("hidden"), 120)
  );
  $$("[data-chart-mode]").forEach((button) =>
    button.addEventListener("click", () => {
      state.chartMode = button.dataset.chartMode;
      state.chartHoverIndex = null;
      saveUiState();
      renderDashboard();
    })
  );
  $$("[data-range]").forEach((button) =>
    button.addEventListener("click", () => {
      $$("[data-range]").forEach((item) => item.classList.remove("active"));
      button.classList.add("active");
      state.chartRange = Number(button.dataset.range);
      state.chartHoverIndex = null;
      saveUiState();
      schedulePriceChart();
    })
  );
  $$("[data-strategy]").forEach((button) =>
    button.addEventListener("click", () => {
      $$("[data-strategy]").forEach((item) => item.classList.remove("active"));
      button.classList.add("active");
      state.strategy = button.dataset.strategy;
      saveUiState();
      renderBacktest();
    })
  );
  $("#backtest-years").addEventListener("change", (event) => {
    state.backtestYears = Number(event.target.value);
    saveUiState();
    renderBacktest();
  });
  $("#run-backtest").addEventListener("click", renderBacktest);
  $("#settings-form").addEventListener("change", saveSettings);
  $("#reset-settings").addEventListener("click", () => {
    state.settings = { ...DEFAULT_SETTINGS };
    writeJSON("hengce.settings.v1", state.settings);
    populateSettings();
    renderBacktest();
    showToast("回测参数已恢复默认");
  });
  $("#check-update").addEventListener("click", () => checkForUpdates());
  $("#download-update").addEventListener("click", downloadUpdate);
  $("#install-update").addEventListener("click", installUpdate);
  window.hengce.onUpdateProgress((progress) => {
    state.updateProgress = progress;
    renderUpdate();
  });
  $("#sidebar-check-update").addEventListener("click", () => {
    switchView("settings");
    checkForUpdates();
  });
  $("#toggle-default-stock").addEventListener("click", () => {
    if (state.defaultCode === state.code) {
      state.defaultCode = null;
      localStorage.removeItem("hengce.defaultStock.v1");
      showToast("已取消默认标的");
    } else {
      state.defaultCode = state.code;
      writeJSON("hengce.defaultStock.v1", state.code);
      showToast("已设为默认标的");
    }
    renderDefaultStockButton();
  });
  $("#watch-current-stock").addEventListener("click", addCurrentStockToWatchlist);
  $("#record-current-holding").addEventListener("click", () => {
    if (!state.quote) {
      showToast("等待当前股票行情完成");
      return;
    }
    const existing = state.holdings.find((item) => item.code === state.quote.code);
    openHoldingDialog(existing || {
      code: state.quote.code,
      name: state.quote.name,
      shares: "",
      cost: state.quote.price
    });
  });
  $$(".source-links button").forEach((button) =>
    button.addEventListener("click", () =>
      window.hengce.openExternal(button.dataset.url)
    )
  );

  const dialog = $("#holding-dialog");
  $("#add-holding").addEventListener("click", () => openHoldingDialog());
  $("#close-dialog").addEventListener("click", () => dialog.close());
  $("#holding-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const query = String(form.elements.code.value).trim();
    let code = query;
    const shares = Number(form.elements.shares.value);
    const cost = Number(form.elements.cost.value);
    let name = String(form.elements.name.value).trim();
    if (!/^\d{6}$/.test(code) && query) {
      const matches = await searchHoldingNames(query, { showEmpty: false });
      if (matches[0]) {
        code = matches[0].code;
        if (!name) name = matches[0].name;
      }
    }
    if (!/^\d{6}$/.test(code) || shares <= 0 || cost <= 0) {
      showToast("请检查股票代码、股数和成本");
      return;
    }
    if (!name) {
      try {
        const quote = await window.hengce.quote(code);
        name = quote.name;
        state.quotes.set(code, quote);
      } catch {
        name = code;
      }
    }
    const existing = state.holdings.find((item) => item.code === code);
    const holding = { code, name, shares: Math.floor(shares), cost, primary: Boolean(existing?.primary) };
    const index = state.holdings.findIndex((item) => item.code === code);
    if (index >= 0) state.holdings[index] = holding;
    else state.holdings.push(holding);
    writeJSON("hengce.holdings.v2", state.holdings);
    dialog.close();
    renderHoldings();
    renderDashboard();
    updateHoldingQuotes();
    showToast("持仓记录已保存在本机");
  });
  const holdingStockQuery = $("#holding-stock-query");
  holdingStockQuery.addEventListener("input", (event) => {
    const query = event.currentTarget.value.trim();
    clearTimeout(holdingSearchTimer);
    if (!query) {
      $("#holding-search-results").classList.add("hidden");
      return;
    }
    holdingSearchTimer = setTimeout(() => searchHoldingNames(query), 180);
  });
  holdingStockQuery.addEventListener("blur", () =>
    setTimeout(() => $("#holding-search-results").classList.add("hidden"), 120)
  );

  const priceCanvas = $("#price-chart");
  priceCanvas.addEventListener("mousemove", (event) => {
    const geometry = priceCanvas._geometry;
    if (!geometry) return;
    const bounds = priceCanvas.getBoundingClientRect();
    const x = event.clientX - bounds.left;
    const fraction = Math.max(
      0,
      Math.min(1, (x - geometry.pad.left) /
        (geometry.width - geometry.pad.left - geometry.pad.right))
    );
    const index = Math.round(fraction * (geometry.points.length - 1));
    const point = geometry.points[index];
    if (!point?.bar && !point?.intraday) return;
    const tooltip = $("#chart-tooltip");
    tooltip.innerHTML = point.bar
      ? `<strong>${point.bar.date}</strong><br>开 ${number(point.bar.open)}　收 ${number(point.bar.close)}<br>高 ${number(point.bar.high)}　低 ${number(point.bar.low)}<br>涨跌 ${percent(point.bar.percentChange)}　量 ${compactMoney(point.bar.volume)}`
      : `<strong>${escapeHTML(point.intraday.time)}</strong><br>价格 ${number(point.intraday.price)}<br>均价 ${number(point.intraday.averagePrice)}`;
    if (geometry.daily) {
      state.chartHoverIndex = index;
      schedulePriceChart();
    }
    tooltip.style.left = `${Math.min(bounds.width - 145, Math.max(6, x + 12))}px`;
    tooltip.style.top = `${Math.max(8, event.clientY - bounds.top - 60)}px`;
    tooltip.classList.remove("hidden");
  });
  priceCanvas.addEventListener("mouseleave", () => {
    $("#chart-tooltip").classList.add("hidden");
    if (state.chartHoverIndex != null) {
      state.chartHoverIndex = null;
      schedulePriceChart();
    }
  });
  const chartResizeObserver = new ResizeObserver((entries) => {
    if (entries.some((entry) => entry.target.contains(priceCanvas))) {
      schedulePriceChart();
    }
    if (
      entries.some((entry) => entry.target.contains($("#equity-chart"))) &&
      $("#backtest-view").classList.contains("active")
    ) {
      requestAnimationFrame(renderBacktest);
    }
  });
  $$(".chart-wrap").forEach((wrapper) => chartResizeObserver.observe(wrapper));
}

populateSettings();
restoreUiControls();
bindEvents();
switchView(state.activeView);
renderUpdate();
window.hengce.appVersion().then((version) => {
  state.appVersion = version;
  renderUpdate();
}).catch(() => {});
renderHoldings();
renderWatchlist();
renderPortfolioRisk();
refreshIcons();
updateOvernightClock();
setInterval(updateOvernightClock, 1000);
scheduleOvernightRefresh();
loadInitialMarketData();
checkForUpdates({ silent: true });
