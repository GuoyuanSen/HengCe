const MACRO_SERIES = Object.freeze([
  Object.freeze({
    key: "cpi",
    label: "居民消费价格 CPI",
    shortLabel: "CPI",
    group: "价格",
    reportName: "RPT_ECONOMY_CPI",
    dateField: "REPORT_DATE",
    valueField: "NATIONAL_SAME",
    unit: "%",
    originalSource: "国家统计局",
    sourceUrl: "https://data.stats.gov.cn/"
  }),
  Object.freeze({
    key: "ppi",
    label: "工业生产者出厂价格 PPI",
    shortLabel: "PPI",
    group: "价格",
    reportName: "RPT_ECONOMY_PPI",
    dateField: "REPORT_DATE",
    valueField: "BASE_SAME",
    unit: "%",
    originalSource: "国家统计局",
    sourceUrl: "https://data.stats.gov.cn/"
  }),
  Object.freeze({
    key: "pmi",
    label: "制造业采购经理指数 PMI",
    shortLabel: "PMI",
    group: "景气",
    reportName: "RPT_ECONOMY_PMI",
    dateField: "REPORT_DATE",
    valueField: "MAKE_INDEX",
    unit: "",
    originalSource: "国家统计局",
    sourceUrl: "https://data.stats.gov.cn/"
  }),
  Object.freeze({
    key: "m2",
    label: "广义货币 M2 同比",
    shortLabel: "M2",
    group: "流动性",
    reportName: "RPT_ECONOMY_CURRENCY_SUPPLY",
    dateField: "REPORT_DATE",
    valueField: "BASIC_CURRENCY_SAME",
    unit: "%",
    originalSource: "中国人民银行",
    sourceUrl: "https://www.pbc.gov.cn/"
  }),
  Object.freeze({
    key: "m1",
    label: "狭义货币 M1 同比",
    shortLabel: "M1",
    group: "流动性",
    reportName: "RPT_ECONOMY_CURRENCY_SUPPLY",
    dateField: "REPORT_DATE",
    valueField: "CURRENCY_SAME",
    unit: "%",
    originalSource: "中国人民银行",
    sourceUrl: "https://www.pbc.gov.cn/"
  }),
  Object.freeze({
    key: "lpr1y",
    label: "1年期贷款市场报价利率",
    shortLabel: "LPR 1Y",
    group: "利率",
    reportName: "RPTA_WEB_RATE",
    dateField: "TRADE_DATE",
    valueField: "LPR1Y",
    unit: "%",
    originalSource: "全国银行间同业拆借中心",
    sourceUrl: "https://www.chinamoney.com.cn/"
  }),
  Object.freeze({
    key: "lpr5y",
    label: "5年期以上贷款市场报价利率",
    shortLabel: "LPR 5Y",
    group: "利率",
    reportName: "RPTA_WEB_RATE",
    dateField: "TRADE_DATE",
    valueField: "LPR5Y",
    unit: "%",
    originalSource: "全国银行间同业拆借中心",
    sourceUrl: "https://www.chinamoney.com.cn/"
  }),
  Object.freeze({
    key: "shiborOn",
    label: "上海银行间同业拆放利率（隔夜）",
    shortLabel: "Shibor O/N",
    group: "利率",
    reportName: "RPT_IMP_INTRESTRATEN",
    dateField: "REPORT_DATE",
    valueField: "IR_RATE",
    rowFilters: [
      { field: "MARKET_CODE", value: "001" },
      { field: "CURRENCY_CODE", value: "CNY" },
      { field: "INDICATOR_ID", value: "001" }
    ],
    unit: "%",
    originalSource: "全国银行间同业拆借中心",
    sourceUrl: "https://www.chinamoney.com.cn/chinese/shibor/",
    maxFreshDays: 5
  })
]);

function finite(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function dateOnly(value) {
  const match = String(value || "").match(/^\d{4}-\d{2}-\d{2}/);
  return match ? match[0] : "";
}

function parseMacroPayload(definition, payload) {
  const rows = payload?.result?.data;
  if (!payload?.success || !Array.isArray(rows)) return [];
  return rows
    .filter((row) => !definition.rowFilters || definition.rowFilters.every((rule) =>
      String(row?.[rule.field]) === rule.value
    ))
    .map((row) => {
      const value = finite(row?.[definition.valueField]);
      const date = dateOnly(row?.[definition.dateField]);
      if (value == null || !date) return null;
      return { date, value };
    })
    .filter(Boolean)
    .sort((left, right) => left.date.localeCompare(right.date));
}

function freshnessLabel(date, now = new Date(), maxFreshDays = 35) {
  const parsed = Date.parse(`${date}T00:00:00+08:00`);
  if (!Number.isFinite(parsed)) return "时间未知";
  const days = Math.max(0, Math.floor((now.getTime() - parsed) / 86400000));
  if (days <= maxFreshDays) return "最新一期";
  if (days <= maxFreshDays * 2) return "待下期更新";
  return "数据偏旧";
}

function indicatorSignal(definition, latest, previous) {
  const delta = previous ? latest.value - previous.value : null;
  if (definition.key === "pmi") {
    return {
      tone: latest.value >= 50 ? "positive" : "negative",
      label: latest.value >= 50 ? "扩张区间" : "收缩区间",
      detail: delta == null ? "等待上一期" : `${delta >= 0 ? "较上期回升" : "较上期回落"} ${Math.abs(delta).toFixed(1)}`
    };
  }
  if (["lpr1y", "lpr5y"].includes(definition.key)) {
    return {
      tone: delta == null || delta === 0 ? "neutral" : delta < 0 ? "positive" : "negative",
      label: delta == null || delta === 0 ? "利率持平" : delta < 0 ? "利率下行" : "利率上行",
      detail: delta == null ? "等待上一期" : `较上期 ${delta >= 0 ? "+" : ""}${delta.toFixed(2)} 个百分点`
    };
  }
  return {
    tone: "neutral",
    label: delta == null || Math.abs(delta) < 0.05 ? "同比平稳" : delta > 0 ? "同比回升" : "同比回落",
    detail: delta == null ? "等待上一期" : `较上期 ${delta >= 0 ? "+" : ""}${delta.toFixed(1)} 个百分点`
  };
}

function buildMacroSnapshot(payloads = {}, options = {}) {
  const now = options.now instanceof Date ? options.now : new Date(options.now || Date.now());
  const indicators = MACRO_SERIES.map((definition) => {
    const points = parseMacroPayload(definition, payloads[definition.reportName]);
    const latest = points.at(-1);
    const previous = points.at(-2);
    if (!latest) return null;
    return {
      key: definition.key,
      label: definition.label,
      shortLabel: definition.shortLabel,
      group: definition.group,
      unit: definition.unit,
      value: latest.value,
      date: latest.date,
      previousValue: previous?.value ?? null,
      change: previous ? latest.value - previous.value : null,
      signal: indicatorSignal(definition, latest, previous),
      freshness: freshnessLabel(latest.date, now, definition.maxFreshDays || 35),
      series: points.slice(-18),
      aggregator: "东方财富数据中心",
      originalSource: definition.originalSource,
      sourceUrl: definition.sourceUrl
    };
  }).filter(Boolean);
  const missing = MACRO_SERIES.filter((definition) =>
    !indicators.some((indicator) => indicator.key === definition.key)
  ).map((definition) => definition.shortLabel);
  return {
    asOf: now.toISOString(),
    indicators,
    groups: [...new Set(indicators.map((item) => item.group))],
    sourceStatus: {
      partial: missing.length > 0,
      missing,
      note: "数据由东方财富公开数据中心聚合，原始发布机构与数据期次逐项标注"
    }
  };
}

module.exports = {
  MACRO_SERIES,
  buildMacroSnapshot,
  freshnessLabel,
  indicatorSignal,
  parseMacroPayload
};
