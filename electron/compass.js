const GLOBAL_MARKETS = Object.freeze([
  Object.freeze({ symbol: "usINX", code: ".INX", name: "标普500", group: "美股", weight: 0.25 }),
  Object.freeze({ symbol: "usIXIC", code: ".IXIC", name: "纳斯达克", group: "美股", weight: 0.35 }),
  Object.freeze({ symbol: "usDJI", code: ".DJI", name: "道琼斯", group: "美股", weight: 0.15 }),
  Object.freeze({ symbol: "hkHSI", code: "HSI", name: "恒生指数", group: "港股", weight: 0.1 }),
  Object.freeze({ symbol: "hkHSTECH", code: "HSTECH", name: "恒生科技", group: "港股", weight: 0.15 }),
  Object.freeze({ symbol: "usHXC", code: ".HXC", name: "中概股", group: "中概", weight: 0.05 })
]);

const ASIA_MARKETS = Object.freeze([
  Object.freeze({ secid: "100.N225", symbol: "jpN225", code: "N225", name: "日经225", group: "日本", weight: 0.1 }),
  Object.freeze({ secid: "100.KS11", symbol: "krKOSPI", code: "KS11", name: "韩国KOSPI", group: "韩国", weight: 0.12 }),
  Object.freeze({ secid: "100.TWII", symbol: "twTWII", code: "TWII", name: "台湾加权", group: "中国台湾", weight: 0.1 })
]);

const SEMICONDUCTOR_MARKETS = Object.freeze([
  Object.freeze({ secid: "251.SOX", symbol: "usSOX", code: "SOX", name: "费城半导体指数", group: "美国", chainRole: "全球风险偏好" }),
  Object.freeze({ secid: "177.005930", symbol: "krSamsung", code: "005930", name: "三星电子", group: "韩国", chainRole: "存储与消费电子" }),
  Object.freeze({ secid: "177.000660", symbol: "krHynix", code: "000660", name: "SK海力士", group: "韩国", chainRole: "HBM与存储周期" }),
  Object.freeze({ secid: "176.8035", symbol: "jpTEL", code: "8035", name: "Tokyo Electron", group: "日本", chainRole: "半导体设备" }),
  Object.freeze({ secid: "176.6857", symbol: "jpAdvantest", code: "6857", name: "爱德万测试", group: "日本", chainRole: "测试设备" }),
  Object.freeze({ secid: "106.TSM", symbol: "usTSM", code: "TSM", name: "台积电ADR", group: "中国台湾", chainRole: "先进制程代工" })
]);

const STYLE_INDEX_DEFINITIONS = Object.freeze([
  Object.freeze({ code: "000300", name: "沪深300", style: "大盘核心", componentType: "1", secid: "1.000300", tencentSymbol: "sh000300" }),
  Object.freeze({ code: "000016", name: "上证50", style: "大盘价值", componentType: "2", secid: "1.000016", tencentSymbol: "sh000016" }),
  Object.freeze({ code: "000905", name: "中证500", style: "中盘", componentType: "3", secid: "1.000905", tencentSymbol: "sh000905" }),
  Object.freeze({ code: "000852", name: "中证1000", style: "小盘", componentType: "7", secid: "1.000852", tencentSymbol: "sh000852" }),
  Object.freeze({ code: "000688", name: "科创50", style: "科技成长", componentType: "4", secid: "1.000688", tencentSymbol: "sh000688" })
]);

function finite(value) {
  if (value == null || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function parseTencentGlobalQuotes(text, definitions = GLOBAL_MARKETS) {
  const bySymbol = new Map(definitions.map((item) => [item.symbol, item]));
  const quotes = [];
  for (const match of String(text || "").matchAll(/v_([A-Za-z0-9_]+)="([^"]*)";/g)) {
    const definition = bySymbol.get(match[1]);
    if (!definition) continue;
    const fields = match[2].split("~");
    const price = finite(fields[3]);
    const previousClose = finite(fields[4]);
    const reportedChange = finite(fields[32]);
    const percentChange = reportedChange ?? (
      price != null && previousClose > 0 ? (price / previousClose - 1) * 100 : null
    );
    if (price == null || percentChange == null) continue;
    quotes.push({
      ...definition,
      price,
      previousClose,
      percentChange,
      timestamp: String(fields[30] || "").trim(),
      currency: String(fields[35] || "").trim(),
      source: "腾讯行情"
    });
  }
  return quotes;
}

function parseEastmoneyGlobalQuotes(payload, definitions = [...ASIA_MARKETS, ...SEMICONDUCTOR_MARKETS]) {
  const bySecid = new Map(definitions.map((item) => [item.secid, item]));
  const rows = payload?.data?.diff;
  if (!Array.isArray(rows)) return [];
  return rows.map((item) => {
    const definition = bySecid.get(`${item.f13}.${item.f12}`);
    const price = finite(item.f2);
    const previousClose = finite(item.f18);
    const percentChange = finite(item.f3);
    if (!definition || price == null || percentChange == null) return null;
    return {
      ...definition,
      price: price / 100,
      previousClose: previousClose == null ? null : previousClose / 100,
      percentChange: percentChange / 100,
      timestamp: finite(item.f124) > 0 ? new Date(Number(item.f124) * 1000).toISOString() : "最近交易时段",
      source: "东方财富全球行情"
    };
  }).filter(Boolean);
}

function weightedChange(markets) {
  const usable = markets.filter((item) => Number.isFinite(item.percentChange));
  const weight = usable.reduce((sum, item) => sum + (item.weight || 1), 0);
  return weight
    ? usable.reduce((sum, item) => sum + item.percentChange * (item.weight || 1), 0) / weight
    : null;
}

function buildCompassSnapshot({ globalMarkets = [], domesticMarkets = [], styleMarkets = [], semiconductorMarkets = [], asOf, sourceStatus = {} } = {}) {
  const globalChange = weightedChange(globalMarkets);
  const domesticChange = domesticMarkets.length
    ? domesticMarkets.reduce((sum, item) => sum + Number(item.percentChange || 0), 0) / domesticMarkets.length
    : null;
  const combined =
    globalChange == null
      ? domesticChange
      : domesticChange == null
        ? globalChange
        : globalChange * 0.45 + domesticChange * 0.55;
  const regime = combined >= 0.8
    ? { key: "risk-on", label: "偏进攻", tone: "positive" }
    : combined <= -0.8
      ? { key: "risk-off", label: "偏防守", tone: "negative" }
      : { key: "balanced", label: "均衡观察", tone: "neutral" };
  const signals = [];
  const nasdaq = globalMarkets.find((item) => item.symbol === "usIXIC");
  const hstech = globalMarkets.find((item) => item.symbol === "hkHSTECH");
  const kospi = globalMarkets.find((item) => item.symbol === "krKOSPI");
  if (nasdaq) {
    signals.push(nasdaq.percentChange >= 0.8
      ? "美股科技风险偏好回暖"
      : nasdaq.percentChange <= -0.8
        ? "美股科技方向承压"
        : "美股科技方向震荡");
  }
  if (hstech) {
    signals.push(hstech.percentChange >= 0.8
      ? "港股科技情绪偏强"
      : hstech.percentChange <= -0.8
        ? "港股科技情绪偏弱"
        : "港股科技情绪中性");
  }
  if (kospi) {
    signals.push(kospi.percentChange >= 0.8
      ? "韩国市场偏强，存储与半导体链风险偏好回暖"
      : kospi.percentChange <= -0.8
        ? "韩国市场承压，A股半导体需提高确认门槛"
        : "韩国市场震荡，半导体链暂未形成强方向");
  }
  const semiconductorChange = weightedChange(semiconductorMarkets);
  if (semiconductorChange != null) {
    signals.push(semiconductorChange >= 1
      ? "全球半导体链多数走强，仍需A股成交与板块广度确认"
      : semiconductorChange <= -1
        ? "全球半导体链多数走弱，注意A股设备、存储与算力方向承压"
        : "全球半导体链整体震荡，避免仅凭单一海外股票追涨杀跌");
  }
  if (domesticChange != null) {
    signals.push(domesticChange >= 0.6
      ? "A股主要指数形成正向共振"
      : domesticChange <= -0.6
        ? "A股主要指数整体偏弱"
        : "A股主要指数分化或震荡");
  }
  if (styleMarkets.length >= 2) {
    const orderedStyles = [...styleMarkets].sort((left, right) => right.percentChange - left.percentChange);
    signals.push(`${orderedStyles[0].style || orderedStyles[0].name}相对占优，${orderedStyles.at(-1).style || orderedStyles.at(-1).name}偏弱`);
  }
  const coverage = globalMarkets.length + domesticMarkets.length + styleMarkets.length + semiconductorMarkets.length;
  const expected = GLOBAL_MARKETS.length + ASIA_MARKETS.length + SEMICONDUCTOR_MARKETS.length + STYLE_INDEX_DEFINITIONS.length + 3;
  const coverageRatio = coverage / expected;
  return {
    asOf: asOf || new Date().toISOString(),
    regime: {
      ...regime,
      score: combined == null ? null : Math.round(combined * 100) / 100,
      confidence: coverageRatio >= 0.85 ? "较高" : coverageRatio >= 0.6 ? "中等" : "偏低"
    },
    globalMarkets,
    domesticMarkets,
    styleMarkets,
    semiconductorMarkets,
    semiconductorPulse: {
      change: semiconductorChange,
      label: semiconductorChange == null ? "数据不足" : semiconductorChange >= 1 ? "偏强" : semiconductorChange <= -1 ? "偏弱" : "震荡",
      coverage: semiconductorMarkets.length,
      expected: SEMICONDUCTOR_MARKETS.length
    },
    signals: signals.slice(0, 6),
    sourceStatus: {
      ...sourceStatus,
      loaded: coverage,
      expected,
      partial: coverage < expected
    },
    note: "风向标描述市场环境，不预测单只股票，也不构成交易建议。"
  };
}

module.exports = {
  ASIA_MARKETS,
  GLOBAL_MARKETS,
  SEMICONDUCTOR_MARKETS,
  STYLE_INDEX_DEFINITIONS,
  buildCompassSnapshot,
  parseEastmoneyGlobalQuotes,
  parseTencentGlobalQuotes,
  weightedChange
};
