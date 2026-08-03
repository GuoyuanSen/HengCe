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
    profile: async (code) => ({
      code,
      name: code === "603039" ? "泛微网络" : "演示标的",
      industry: code === "603039" ? "软件开发" : "未分类",
      asOf: new Date().toISOString()
    }),
    notify: async () => true,
    openExternal: async (url) => window.open(url, "_blank")
  };
}

if (!window.hengce) {
  const unavailable = async () => {
    throw new Error("应用接口初始化失败，请重新启动或重新安装衡策。");
  };
  window.hengce = {
    quote: unavailable,
    klines: unavailable,
    indices: unavailable,
    valuation: unavailable,
    hotspots: unavailable,
    recommendations: unavailable,
    profile: unavailable,
    notify: async () => false,
    openExternal: unavailable
  };
}

document.documentElement.dataset.platform =
  window.hengce.platform ||
  new URLSearchParams(window.location.search).get("platform") ||
  "browser";

const { analyze, runBacktest } = window.HengCeEngine;

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

const state = {
  code: "603039",
  quote: null,
  bars: [],
  indices: [],
  valuation: null,
  valuationLoading: true,
  hotspots: null,
  hotspotsLoading: false,
  hotspotsError: "",
  hotspotMode: "composite",
  recommendations: null,
  recommendationsLoading: false,
  recommendationsError: "",
  recommendationFilters: {
    market: "all",
    industry: "all",
    risk: "all",
    minScore: 55
  },
  watchlist: readJSON("hengce.watchlist.v1", []),
  watchlistData: new Map(),
  watchlistLoading: false,
  watchlistError: "",
  analysis: null,
  chartRange: 120,
  strategy: "movingAverage",
  backtestYears: 3,
  holdings: readJSON("hengce.holdings.v2", []),
  quotes: new Map(),
  holdingHistories: new Map(),
  profiles: new Map(),
  portfolioRisk: null,
  portfolioRiskLoading: false,
  settings: { ...DEFAULT_SETTINGS, ...readJSON("hengce.settings.v1", {}) },
  loading: false
};

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

async function loadMarketData(code = $("#stock-code").value) {
  const normalized = String(code).trim().toLowerCase().replace(/^sh|^sz/, "");
  if (!/^\d{6}$/.test(normalized)) {
    showError("请输入6位A股代码。");
    return;
  }

  state.code = normalized;
  state.valuation = null;
  state.valuationLoading = true;
  $("#stock-code").value = normalized;
  setLoading(true);
  showError("");
  renderValuation();
  try {
    const indicesRequest = window.hengce.indices().catch(() => []);
    const valuationRequest = window.hengce
      .valuation(normalized)
      .catch((error) => ({ error: friendlyMarketError(error) }));
    const [quote, bars] = await Promise.all([
      window.hengce.quote(normalized),
      window.hengce.klines(normalized, 1300)
    ]);
    state.quote = quote;
    state.bars = bars;
    state.indices = [];
    state.analysis = analyze(bars);
    state.quotes.set(quote.code, quote);
    renderDashboard();
    renderBacktest();
    renderIndices();
    renderHoldings();
    indicesRequest.then((indices) => {
      state.indices = indices;
      renderIndices();
    });
    valuationRequest.then((valuation) => {
      if (state.code !== normalized) return;
      state.valuation = valuation;
      state.valuationLoading = false;
      renderValuation();
    });
    $("#update-time").textContent = `更新 ${new Date().toLocaleTimeString("zh-CN", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit"
    })}`;
  } catch (error) {
    showError(friendlyMarketError(error));
  } finally {
    setLoading(false);
    schedulePriceChart();
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
          return `
            <tr>
              <td>${index + 1}</td>
              <td>
                <div class="hotspot-board">
                  <strong>${escapeHTML(item.name)}</strong>
                  <small>${escapeHTML(item.code)}</small>
                </div>
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
                <div class="hotspot-leader">
                  <strong>${escapeHTML(item.leaderName || "--")}</strong>
                  <small class="${directionClass(item.leaderChangePercent)}">${percent(item.leaderChangePercent)}</small>
                </div>
              </td>
            </tr>
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
    state.hotspots = await window.hengce.hotspots();
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
            <tr>
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
                  <button class="secondary-button analyze-recommendation" data-code="${escapeHTML(item.code)}">分析</button>
                  <button class="table-action watch-recommendation" data-code="${escapeHTML(item.code)}" title="加入观察" ${dataFreshness.stale || state.watchlist.some((entry) => entry.code === item.code) ? "disabled" : ""}>
                    <i data-lucide="bell-plus"></i>
                  </button>
                </div>
              </td>
            </tr>
          `;
        })
        .join("")
    : '<tr><td colspan="8" class="muted">当前筛选条件下没有可用标的</td></tr>';
  $$(".analyze-recommendation").forEach((button) =>
    button.addEventListener("click", () => {
      const code = button.dataset.code;
      $("#stock-code").value = code;
      switchView("dashboard");
      loadMarketData(code);
    })
  );
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
        <tr>
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

async function loadRecommendations({ force = false } = {}) {
  if (state.recommendations && !force) {
    renderRecommendations();
    return;
  }
  state.recommendationsLoading = true;
  state.recommendationsError = "";
  renderRecommendations();
  try {
    state.recommendations = await window.hengce.recommendations();
  } catch (error) {
    state.recommendationsError = friendlyMarketError(error);
  } finally {
    state.recommendationsLoading = false;
    renderRecommendations();
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
  $("#chart-caption").textContent =
    `前复权日线 · ${state.bars.at(-1)?.date || "--"}`;
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
    context.fillText(points[index].date.slice(5), xFor(index), height - 20);
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
  return { xFor, yFor, points, pad, width, height };
}

function drawPriceChart() {
  const selected = state.bars.slice(-state.chartRange);
  const geometry = drawLineChart(
    $("#price-chart"),
    selected.map((bar) => ({ date: bar.date, value: bar.close, bar })),
    {
      support: state.analysis?.support,
      pressure: state.analysis?.pressure,
      color: "#e23d3d",
      fill: "rgba(226,61,61,0.16)"
    }
  );
  $("#price-chart")._geometry = geometry;
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
            <button class="table-action delete-holding" data-code="${holding.code}" title="删除">
              <i data-lucide="trash-2"></i>
            </button>
          </td>
        </tr>
      `;
    })
    .join("");
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

function populateSettings() {
  const form = $("#settings-form");
  Object.entries(state.settings).forEach(([key, value]) => {
    if (form.elements[key]) form.elements[key].value = value;
  });
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

function switchView(view) {
  $$(".nav-item").forEach((button) =>
    button.classList.toggle("active", button.dataset.view === view)
  );
  $$(".view").forEach((section) =>
    section.classList.toggle("active", section.id === `${view}-view`)
  );
  if (view === "backtest") requestAnimationFrame(renderBacktest);
  if (view === "hotspots") loadHotspots();
  if (view === "recommendations") loadRecommendations();
  if (view === "watchlist") loadWatchlist();
  if (view === "holdings") updateHoldingQuotes();
  if (view === "dashboard") schedulePriceChart();
}

function bindEvents() {
  $$(".nav-item").forEach((button) =>
    button.addEventListener("click", () => switchView(button.dataset.view))
  );
  $("#analyze-button").addEventListener("click", () => loadMarketData());
  $("#refresh-button").addEventListener("click", () => loadMarketData(state.code));
  $("#refresh-hotspots").addEventListener("click", () =>
    loadHotspots({ force: true })
  );
  $("#refresh-recommendations").addEventListener("click", () =>
    loadRecommendations({ force: true })
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
      renderHotspots();
    })
  );
  const stockCodeInput = $("#stock-code");
  stockCodeInput.addEventListener("focus", (event) => {
    event.currentTarget.select();
  });
  stockCodeInput.addEventListener("input", (event) => {
    const digits = event.currentTarget.value.replace(/\D/g, "").slice(0, 6);
    if (event.currentTarget.value !== digits) {
      event.currentTarget.value = digits;
    }
    showError("");
  });
  stockCodeInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") loadMarketData();
  });
  $$("[data-range]").forEach((button) =>
    button.addEventListener("click", () => {
      $$("[data-range]").forEach((item) => item.classList.remove("active"));
      button.classList.add("active");
      state.chartRange = Number(button.dataset.range);
      schedulePriceChart();
    })
  );
  $$("[data-strategy]").forEach((button) =>
    button.addEventListener("click", () => {
      $$("[data-strategy]").forEach((item) => item.classList.remove("active"));
      button.classList.add("active");
      state.strategy = button.dataset.strategy;
      renderBacktest();
    })
  );
  $("#backtest-years").addEventListener("change", (event) => {
    state.backtestYears = Number(event.target.value);
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
  $$(".source-links button").forEach((button) =>
    button.addEventListener("click", () =>
      window.hengce.openExternal(button.dataset.url)
    )
  );

  const dialog = $("#holding-dialog");
  $("#add-holding").addEventListener("click", () => {
    $("#holding-form").reset();
    dialog.showModal();
  });
  $("#close-dialog").addEventListener("click", () => dialog.close());
  $("#holding-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const code = String(form.elements.code.value).trim();
    const shares = Number(form.elements.shares.value);
    const cost = Number(form.elements.cost.value);
    if (!/^\d{6}$/.test(code) || shares <= 0 || cost <= 0) {
      showToast("请检查股票代码、股数和成本");
      return;
    }
    let name = String(form.elements.name.value).trim();
    if (!name) {
      try {
        const quote = await window.hengce.quote(code);
        name = quote.name;
        state.quotes.set(code, quote);
      } catch {
        name = code;
      }
    }
    const holding = { code, name, shares: Math.floor(shares), cost };
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
    if (!point?.bar) return;
    const tooltip = $("#chart-tooltip");
    tooltip.innerHTML = `
      <strong>${point.bar.date}</strong><br>
      开 ${number(point.bar.open)}　收 ${number(point.bar.close)}<br>
      高 ${number(point.bar.high)}　低 ${number(point.bar.low)}
    `;
    tooltip.style.left = `${Math.min(bounds.width - 145, Math.max(6, x + 12))}px`;
    tooltip.style.top = `${Math.max(8, event.clientY - bounds.top - 60)}px`;
    tooltip.classList.remove("hidden");
  });
  priceCanvas.addEventListener("mouseleave", () =>
    $("#chart-tooltip").classList.add("hidden")
  );
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
bindEvents();
renderHoldings();
renderWatchlist();
renderPortfolioRisk();
refreshIcons();
loadMarketData(state.code);
