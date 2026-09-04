(function exposeTradingCalendar(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.HengCeTradingCalendar = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function createTradingCalendar() {
  const MARKET_TIME_ZONE = "Asia/Shanghai";
  const KNOWN_YEARS = new Set([2025, 2026]);
  const DYNAMIC_DATES_BY_YEAR = new Map();
  const CALENDAR_METADATA = new Map([
    [2025, { source: "内置交易所年度休市安排", synced: false }],
    [2026, { source: "内置交易所年度休市安排", synced: false }]
  ]);
  const CLOSED_DATES = new Set([
    // 2025 沪深交易所年度休市安排（仅列工作日休市日期）
    "2025-01-01",
    "2025-01-28", "2025-01-29", "2025-01-30", "2025-01-31",
    "2025-02-03", "2025-02-04",
    "2025-04-04",
    "2025-05-01", "2025-05-02", "2025-05-05",
    "2025-06-02",
    "2025-10-01", "2025-10-02", "2025-10-03", "2025-10-06",
    "2025-10-07", "2025-10-08",
    // 2026 沪深交易所年度休市安排（仅列工作日休市日期）
    "2026-01-01", "2026-01-02",
    "2026-02-16", "2026-02-17", "2026-02-18", "2026-02-19",
    "2026-02-20", "2026-02-23",
    "2026-04-06",
    "2026-05-01", "2026-05-04", "2026-05-05",
    "2026-06-19",
    "2026-09-25",
    "2026-10-01", "2026-10-02", "2026-10-05", "2026-10-06", "2026-10-07"
  ]);

  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: MARKET_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23"
  });

  function marketParts(value = new Date()) {
    const date = value instanceof Date ? value : new Date(value);
    const parts = Object.fromEntries(
      formatter.formatToParts(date)
        .filter((item) => item.type !== "literal")
        .map((item) => [item.type, item.value])
    );
    const year = Number(parts.year);
    const month = Number(parts.month);
    const day = Number(parts.day);
    return {
      year,
      month,
      day,
      hour: Number(parts.hour),
      minute: Number(parts.minute),
      dateKey: `${parts.year}-${parts.month}-${parts.day}`,
      weekday: new Date(Date.UTC(year, month - 1, day)).getUTCDay()
    };
  }

  function mergeOfficialCalendar(calendar = {}) {
    const year = Number(calendar.year);
    const dates = Array.isArray(calendar.closedDates)
      ? [...new Set(calendar.closedDates.map(String))]
      : [];
    if (
      !Number.isInteger(year) ||
      year < 2024 ||
      year > 2100 ||
      dates.length < 5 ||
      dates.length > 80 ||
      dates.some((date) => !new RegExp(`^${year}-\\d{2}-\\d{2}$`).test(date))
    ) {
      return false;
    }
    for (const date of [...CLOSED_DATES]) {
      if (date.startsWith(`${year}-`)) CLOSED_DATES.delete(date);
    }
    dates.forEach((date) => CLOSED_DATES.add(date));
    DYNAMIC_DATES_BY_YEAR.set(year, new Set(dates));
    KNOWN_YEARS.add(year);
    CALENDAR_METADATA.set(year, {
      source: String(calendar.sourceName || calendar.source || "交易所官方休市安排"),
      sourceUrl: String(calendar.sourceUrl || ""),
      fetchedAt: String(calendar.fetchedAt || ""),
      synced: true
    });
    return true;
  }

  function calendarCoverage(year) {
    const normalized = Number(year);
    return {
      year: normalized,
      covered: KNOWN_YEARS.has(normalized),
      ...(CALENDAR_METADATA.get(normalized) || { source: "尚未取得官方日历", synced: false })
    };
  }

  function tradingDayStatus(value = new Date()) {
    const parts = marketParts(value);
    const confidence = KNOWN_YEARS.has(parts.year) ? "official" : "unverified";
    if (parts.weekday === 0 || parts.weekday === 6) {
      return { ...parts, isTradingDay: false, reason: "weekend", label: "周末休市", confidence };
    }
    if (CLOSED_DATES.has(parts.dateKey)) {
      return { ...parts, isTradingDay: false, reason: "holiday", label: "交易所休市", confidence: "official" };
    }
    if (!KNOWN_YEARS.has(parts.year)) {
      return {
        ...parts,
        isTradingDay: false,
        reason: "calendar-unverified",
        label: "交易日历待同步",
        confidence
      };
    }
    return {
      ...parts,
      isTradingDay: true,
      reason: "open",
      label: "交易日",
      confidence
    };
  }

  function nextTradingDateKey(value = new Date()) {
    const parts = marketParts(value);
    const cursor = new Date(Date.UTC(parts.year, parts.month - 1, parts.day));
    for (let offset = 1; offset <= 20; offset += 1) {
      cursor.setUTCDate(cursor.getUTCDate() + 1);
      const dateKey = cursor.toISOString().slice(0, 10);
      const weekday = cursor.getUTCDay();
      if (!KNOWN_YEARS.has(cursor.getUTCFullYear())) return null;
      if (weekday !== 0 && weekday !== 6 && !CLOSED_DATES.has(dateKey)) return dateKey;
    }
    return null;
  }

  return {
    CALENDAR_METADATA,
    CLOSED_DATES,
    KNOWN_YEARS,
    MARKET_TIME_ZONE,
    calendarCoverage,
    marketParts,
    mergeOfficialCalendar,
    nextTradingDateKey,
    tradingDayStatus
  };
});
