(function exposeAlerts(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.HengCeAlerts = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function createAlerts() {
  const DEFAULT_ALERT_PREFERENCES = Object.freeze({
    enabled: true,
    minimumImportance: 70,
    portfolioOnly: true,
    keywords: [],
    quietStart: "22:30",
    quietEnd: "08:00"
  });

  function timeValue(value, fallback) {
    const text = String(value || "");
    return /^([01]\d|2[0-3]):[0-5]\d$/.test(text) ? text : fallback;
  }

  function normalizeAlertPreferences(value = {}) {
    const keywords = Array.isArray(value.keywords)
      ? value.keywords
      : String(value.keywords || "").split(/[，,\n]/);
    return {
      enabled: value.enabled !== false,
      minimumImportance: Math.max(0, Math.min(100, Number(value.minimumImportance) || 70)),
      portfolioOnly: value.portfolioOnly !== false,
      keywords: [...new Set(keywords.map((item) => String(item).trim()).filter(Boolean))].slice(0, 20),
      quietStart: timeValue(value.quietStart, DEFAULT_ALERT_PREFERENCES.quietStart),
      quietEnd: timeValue(value.quietEnd, DEFAULT_ALERT_PREFERENCES.quietEnd)
    };
  }

  function minuteOfDay(value) {
    const [hour, minute] = String(value).split(":").map(Number);
    return hour * 60 + minute;
  }

  function isQuietTime(preferences, now = new Date()) {
    const normalized = normalizeAlertPreferences(preferences);
    const current = now.getHours() * 60 + now.getMinutes();
    const start = minuteOfDay(normalized.quietStart);
    const end = minuteOfDay(normalized.quietEnd);
    if (start === end) return false;
    return start < end
      ? current >= start && current < end
      : current >= start || current < end;
  }

  function eventMatches(event, impacts = [], preferences = {}, now = new Date()) {
    const normalized = normalizeAlertPreferences(preferences);
    if (!normalized.enabled || isQuietTime(normalized, now)) return false;
    if (Number(event?.importance || 0) < normalized.minimumImportance) return false;
    const hasPortfolioImpact = impacts.some((impact) => impact.themeKey === event?.themeKey);
    const haystack = [event?.title, event?.summary, event?.theme, ...(event?.tags || [])]
      .join(" ")
      .toLowerCase();
    const hasKeyword = normalized.keywords.some((keyword) =>
      haystack.includes(keyword.toLowerCase())
    );
    if (normalized.portfolioOnly) return hasPortfolioImpact || hasKeyword;
    return true;
  }

  function selectAlertEvent(events = [], impacts = [], preferences = {}, now = new Date()) {
    return events
      .filter((event) => eventMatches(event, impacts, preferences, now))
      .sort((left, right) => Number(right.importance || 0) - Number(left.importance || 0))[0] || null;
  }

  return {
    DEFAULT_ALERT_PREFERENCES,
    eventMatches,
    isQuietTime,
    normalizeAlertPreferences,
    selectAlertEvent
  };
});
