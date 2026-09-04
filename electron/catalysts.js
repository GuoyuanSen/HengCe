function compact(value, maximum = 240) {
  return String(value || "").replace(/\s+/g, " ").trim().slice(0, maximum);
}

function dateOnly(value) {
  const text = compact(value, 32);
  const match = text.match(/^\d{4}-\d{2}-\d{2}/);
  return match ? match[0] : "";
}

function finite(value) {
  if (value == null || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function allowedCode(value, codes) {
  const code = compact(value, 6);
  return /^\d{6}$/.test(code) && (!codes?.size || codes.has(code)) ? code : null;
}

function withinWindow(date, now, pastDays = 7, futureDays = 180) {
  const timestamp = Date.parse(date);
  const current = now instanceof Date ? now.getTime() : Date.parse(now);
  if (!Number.isFinite(timestamp) || !Number.isFinite(current)) return false;
  const days = (timestamp - current) / 86400000;
  return days >= -pastDays && days <= futureDays;
}

function parseReportAppointments(payload, expectedCodes = [], now = new Date()) {
  const codes = new Set(expectedCodes);
  const rows = payload?.result?.data;
  if (!Array.isArray(rows)) return [];
  return rows.map((item) => {
    const code = allowedCode(item.SECURITY_CODE, codes);
    const scheduledAt = dateOnly(item.APPOINT_PUBLISH_DATE || item.FIRST_APPOINT_DATE);
    if (!code || !scheduledAt || !withinWindow(scheduledAt, now, 10, 180)) return null;
    const reportName = compact(item.REPORT_TYPE_NAME, 80) || `${compact(item.REPORT_YEAR, 8)}年定期报告`;
    const published = String(item.IS_PUBLISH || "") === "1" || Boolean(dateOnly(item.ACTUAL_PUBLISH_DATE));
    const infoCode = compact(item.INFO_CODE, 48);
    return {
      id: `earnings-${code}-${scheduledAt}-${compact(item.QUARTER, 16)}`,
      code,
      name: compact(item.SECURITY_NAME_ABBR, 40) || code,
      type: "earnings",
      typeLabel: "财报披露",
      title: `${reportName}${published ? "已披露" : "预约披露"}`,
      scheduledAt,
      impact: "mixed",
      detail: published ? "定期报告已披露，重点核对业绩与市场预期差" : "预约日期可能调整，临近时再次核对交易所公告",
      source: "东方财富公开披露日历",
      originalSource: "沪深交易所定期报告预约",
      sourceUrl: infoCode
        ? `https://data.eastmoney.com/notices/detail/${code}/${infoCode}.html`
        : `https://data.eastmoney.com/bbsj/${scheduledAt.slice(0, 4)}.html`,
      manual: false
    };
  }).filter(Boolean);
}

function parseUnlocks(payload, expectedCodes = [], now = new Date()) {
  const codes = new Set(expectedCodes);
  const rows = payload?.result?.data;
  if (!Array.isArray(rows)) return [];
  return rows.map((item) => {
    const code = allowedCode(item.SECURITY_CODE, codes);
    const scheduledAt = dateOnly(item.FREE_DATE);
    if (!code || !scheduledAt || !withinWindow(scheduledAt, now, 3, 180)) return null;
    const ratio = finite(item.TOTAL_RATIO);
    const shares = finite(item.ABLE_FREE_SHARES || item.CURRENT_FREE_SHARES);
    return {
      id: `unlock-${code}-${scheduledAt}`,
      code,
      name: compact(item.SECURITY_NAME_ABBR, 40) || code,
      type: "unlock",
      typeLabel: "限售解禁",
      title: `${compact(item.FREE_SHARES_TYPE, 80) || "限售股份"}解禁`,
      scheduledAt,
      impact: "negative",
      detail: [
        ratio != null ? `占总股本 ${(ratio * 100).toFixed(2)}%` : "",
        shares != null ? `可解禁约 ${Math.round(shares).toLocaleString("zh-CN")} 万股` : ""
      ].filter(Boolean).join(" · ") || "解禁不等于实际减持，但可能增加供给预期",
      source: "东方财富公开解禁日历",
      originalSource: "上市公司与交易所披露",
      sourceUrl: `https://data.eastmoney.com/dxf/detail/${code}.html`,
      manual: false
    };
  }).filter(Boolean);
}

function parseDividends(payload, expectedCodes = [], now = new Date()) {
  const codes = new Set(expectedCodes);
  const rows = payload?.result?.data;
  if (!Array.isArray(rows)) return [];
  return rows.map((item) => {
    const code = allowedCode(item.SECURITY_CODE, codes);
    const exDate = dateOnly(item.EX_DIVIDEND_DATE);
    const recordDate = dateOnly(item.EQUITY_RECORD_DATE);
    const scheduledAt = exDate || recordDate;
    if (!code || !scheduledAt || !withinWindow(scheduledAt, now, 3, 180)) return null;
    return {
      id: `dividend-${code}-${scheduledAt}`,
      code,
      name: compact(item.SECURITY_NAME_ABBR, 40) || code,
      type: "dividend",
      typeLabel: "分红除权",
      title: exDate ? "现金分红除权除息" : "现金分红股权登记",
      scheduledAt,
      impact: "neutral",
      detail: [compact(item.IMPL_PLAN_PROFILE, 160), recordDate ? `登记日 ${recordDate}` : "", exDate ? `除权日 ${exDate}` : ""].filter(Boolean).join(" · "),
      source: "东方财富公开分红日历",
      originalSource: "上市公司与交易所披露",
      sourceUrl: `https://data.eastmoney.com/yjfp/detail/${code}.html`,
      manual: false
    };
  }).filter(Boolean);
}

function parseShareholderChanges(payload, expectedCodes = [], now = new Date()) {
  const codes = new Set(expectedCodes);
  const rows = payload?.result?.data;
  if (!Array.isArray(rows)) return [];
  return rows.map((item) => {
    const code = allowedCode(item.SECURITY_CODE, codes);
    const scheduledAt = dateOnly(item.NOTICE_DATE || item.END_DATE || item.TRADE_DATE);
    const direction = compact(item.DIRECTION, 12);
    if (!code || !scheduledAt || !/(?:增持|减持)/.test(direction) || !withinWindow(scheduledAt, now, 10, 3)) return null;
    const reduced = direction.includes("减");
    const shares = finite(item.CHANGE_NUM);
    const ratio = finite(item.CHANGE_FREE_RATIO ?? item.AFTER_CHANGE_RATE);
    return {
      id: `holder-change-${code}-${scheduledAt}-${compact(item.HOLDER_NAME, 80)}-${direction}`,
      code,
      name: compact(item.SECURITY_NAME_ABBR, 40) || code,
      type: "holder-change",
      typeLabel: reduced ? "股东减持" : "股东增持",
      title: `${compact(item.HOLDER_NAME, 90) || "重要股东"}${direction}`,
      scheduledAt,
      impact: reduced ? "negative" : "positive",
      detail: [
        shares != null ? `变动 ${shares.toLocaleString("zh-CN")} 万股` : "",
        ratio != null ? `约占流通股 ${ratio.toFixed(2)}%` : "",
        compact(item.MARKET, 30)
      ].filter(Boolean).join(" · "),
      source: "东方财富公开股东增减持",
      originalSource: "沪深交易所与上市公司披露",
      sourceUrl: `https://data.eastmoney.com/executive/gdzjc.html`,
      manual: false
    };
  }).filter(Boolean);
}

function buildCatalystSnapshot(payloads = {}, options = {}) {
  const codes = [...new Set((options.codes || []).map((code) => String(code)).filter((code) => /^\d{6}$/.test(code)))];
  const now = options.now || new Date();
  const events = [
    ...parseReportAppointments(payloads.appointments, codes, now),
    ...parseUnlocks(payloads.unlocks, codes, now),
    ...parseDividends(payloads.dividends, codes, now),
    ...parseShareholderChanges(payloads.shareholderChanges, codes, now)
  ];
  const unique = new Map(events.map((event) => [event.id, event]));
  return {
    asOf: now instanceof Date ? now.toISOString() : new Date(now).toISOString(),
    codes,
    events: [...unique.values()].sort((left, right) => left.scheduledAt.localeCompare(right.scheduledAt)),
    sourceStatus: options.sourceStatus || { loaded: 4, requested: 4, partial: false },
    note: "日期来自公开披露日历，预约日期可能调整；解禁不等于实际减持，除权也不等于基本面变化。"
  };
}

module.exports = {
  buildCatalystSnapshot,
  parseDividends,
  parseReportAppointments,
  parseShareholderChanges,
  parseUnlocks
};
