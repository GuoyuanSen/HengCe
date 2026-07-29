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
      timestamp: new Date().toISOString()
    }),
    klines: async () => demoBars,
    indices: async () => [
      { code: "000001", name: "上证指数", price: 3584.21, percentChange: 0.42 },
      { code: "399001", name: "深证成指", price: 10921.66, percentChange: -0.18 },
      { code: "399006", name: "创业板指", price: 2248.53, percentChange: 0.67 }
    ],
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
    openExternal: unavailable
  };
}

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
  analysis: null,
  chartRange: 120,
  strategy: "movingAverage",
  backtestYears: 3,
  holdings: readJSON("hengce.holdings.v2", []),
  quotes: new Map(),
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

function compactMoney(value) {
  const absolute = Math.abs(Number(value));
  if (!Number.isFinite(absolute)) return "--";
  if (absolute >= 1e8) return `${number(value / 1e8, 2)}亿`;
  if (absolute >= 1e4) return `${number(value / 1e4, 2)}万`;
  return `¥${number(value, 2)}`;
}

function directionClass(value) {
  return Number(value) >= 0 ? "up" : "down";
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

async function loadMarketData(code = $("#stock-code").value) {
  const normalized = String(code).trim().toLowerCase().replace(/^sh|^sz/, "");
  if (!/^\d{6}$/.test(normalized)) {
    showError("请输入6位A股代码。");
    return;
  }

  state.code = normalized;
  $("#stock-code").value = normalized;
  setLoading(true);
  showError("");
  try {
    const [quote, bars, indices] = await Promise.all([
      window.hengce.quote(normalized),
      window.hengce.klines(normalized, 1300),
      window.hengce.indices()
    ]);
    state.quote = quote;
    state.bars = bars;
    state.indices = indices;
    state.analysis = analyze(bars);
    state.quotes.set(quote.code, quote);
    renderDashboard();
    renderBacktest();
    renderIndices();
    renderHoldings();
    $("#update-time").textContent = `更新 ${new Date().toLocaleTimeString("zh-CN", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit"
    })}`;
  } catch (error) {
    showError(error?.message || "行情加载失败，请稍后重试。");
  } finally {
    setLoading(false);
  }
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
  drawPriceChart();
  refreshIcons();
}

function prepareCanvas(canvas) {
  const bounds = canvas.getBoundingClientRect();
  const ratio = Math.max(1, window.devicePixelRatio || 1);
  const width = Math.max(300, Math.floor(bounds.width));
  const height = Math.max(180, Math.floor(bounds.height));
  if (canvas.width !== width * ratio || canvas.height !== height * ratio) {
    canvas.width = width * ratio;
    canvas.height = height * ratio;
  }
  const context = canvas.getContext("2d");
  context.setTransform(ratio, 0, 0, ratio, 0, 0);
  context.clearRect(0, 0, width, height);
  return { context, width, height };
}

function drawLineChart(canvas, points, options = {}) {
  const { context, width, height } = prepareCanvas(canvas);
  if (!points.length) return null;
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
      renderHoldings();
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
  if (view === "holdings") updateHoldingQuotes();
  if (view === "dashboard") requestAnimationFrame(drawPriceChart);
}

function bindEvents() {
  $$(".nav-item").forEach((button) =>
    button.addEventListener("click", () => switchView(button.dataset.view))
  );
  $("#analyze-button").addEventListener("click", () => loadMarketData());
  $("#refresh-button").addEventListener("click", () => loadMarketData(state.code));
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
      drawPriceChart();
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
  window.addEventListener("resize", () => {
    drawPriceChart();
    renderBacktest();
  });
}

populateSettings();
bindEvents();
renderHoldings();
refreshIcons();
loadMarketData(state.code);
