const CALENDAR_SOURCE_URL = "https://www.sse.com.cn/disclosure/dealinstruc/closed/";

function plainText(value) {
  return String(value || "")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/\s+/g, " ")
    .trim();
}

function dateKey(year, month, day) {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function expandRange(year, startMonth, startDay, endMonth, endDay) {
  const start = new Date(Date.UTC(year, startMonth - 1, startDay));
  const end = new Date(Date.UTC(year, endMonth - 1, endDay));
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) return [];
  const output = [];
  for (const cursor = new Date(start); cursor <= end && output.length <= 40; cursor.setUTCDate(cursor.getUTCDate() + 1)) {
    output.push(cursor.toISOString().slice(0, 10));
  }
  return output;
}

function normalizeCalendarPayload(value = {}) {
  const year = Number(value.year);
  const fetchedAt = String(value.fetchedAt || "");
  const closedDates = Array.isArray(value.closedDates)
    ? [...new Set(value.closedDates.map(String))].sort()
    : [];
  if (
    Number(value.version) !== 1 ||
    !Number.isInteger(year) ||
    year < 2024 ||
    year > 2100 ||
    closedDates.length < 5 ||
    closedDates.length > 80 ||
    closedDates.some((date) => !new RegExp(`^${year}-\\d{2}-\\d{2}$`).test(date)) ||
    String(value.sourceUrl || "") !== CALENDAR_SOURCE_URL ||
    !Number.isFinite(new Date(fetchedAt).getTime())
  ) {
    return null;
  }
  return {
    version: 1,
    year,
    closedDates,
    sourceName: "上海证券交易所",
    sourceUrl: CALENDAR_SOURCE_URL,
    fetchedAt
  };
}

function parseSseCalendarHtml(html, fetchedAt = new Date().toISOString()) {
  const source = String(html || "");
  if (source.length < 500 || source.length > 2_000_000 || !source.includes("上海证券交易所")) {
    throw new Error("交易所日历页面来源校验失败");
  }
  const section = source.match(/<strong[^>]*>\s*(20\d{2})年休市安排\s*<\/strong>[\s\S]*?<table[^>]*>([\s\S]*?)<\/table>/i);
  if (!section) throw new Error("交易所年度休市表格式已变化");
  const year = Number(section[1]);
  const rows = [...section[2].matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)].map((match) => plainText(match[1]));
  const closedDates = new Set();
  for (const row of rows) {
    const closure = row.split("休市")[0];
    const dates = [...closure.matchAll(/(\d{1,2})月(\d{1,2})日/g)]
      .map((match) => ({ month: Number(match[1]), day: Number(match[2]) }));
    if (!dates.length) continue;
    const start = dates[0];
    const end = dates[1] || start;
    expandRange(year, start.month, start.day, end.month, end.day)
      .forEach((date) => closedDates.add(date));
  }
  const calendar = normalizeCalendarPayload({
    version: 1,
    year,
    closedDates: [...closedDates],
    sourceUrl: CALENDAR_SOURCE_URL,
    fetchedAt
  });
  if (!calendar) throw new Error("交易所年度休市表未通过完整性校验");
  return calendar;
}

module.exports = {
  CALENDAR_SOURCE_URL,
  expandRange,
  normalizeCalendarPayload,
  parseSseCalendarHtml,
  plainText
};
