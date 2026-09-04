(function exposeDataHealth(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.HengCeDataHealth = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function createDataHealth() {
  function timestamp(value) {
    const raw = String(value || "").trim();
    const compact = raw.match(/^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})$/);
    const normalized = compact
      ? `${compact[1]}-${compact[2]}-${compact[3]}T${compact[4]}:${compact[5]}:${compact[6]}+08:00`
      : raw.length === 16 && /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(raw)
        ? `${raw.replace(" ", "T")}:00+08:00`
        : raw;
    const parsed = Date.parse(normalized);
    return Number.isFinite(parsed) ? parsed : null;
  }

  function evaluateSource(source = {}, now = new Date()) {
    if (!source.loaded) return { ...source, status: "idle", statusLabel: "尚未使用", ageMinutes: null };
    if (!source.available) return { ...source, status: "unavailable", statusLabel: "不可用", ageMinutes: null };
    const parsed = timestamp(source.asOf);
    const ageMinutes = parsed == null ? null : Math.max(0, (now.getTime() - parsed) / 60000);
    if (source.partial) return { ...source, status: "degraded", statusLabel: "部分降级", ageMinutes };
    if (ageMinutes != null && source.staleAfterMinutes && ageMinutes > source.staleAfterMinutes) {
      return { ...source, status: "stale", statusLabel: "数据偏旧", ageMinutes };
    }
    return { ...source, status: "healthy", statusLabel: "正常", ageMinutes };
  }

  function buildDataHealth(sources = [], options = {}) {
    const now = options.now instanceof Date ? options.now : new Date(options.now || Date.now());
    const items = sources.map((source) => evaluateSource(source, now));
    const active = items.filter((item) => item.status !== "idle");
    const points = { healthy: 100, degraded: 65, stale: 40, unavailable: 0 };
    const score = active.length
      ? Math.round(active.reduce((sum, item) => sum + points[item.status], 0) / active.length)
      : null;
    return {
      asOf: now.toISOString(),
      score,
      level: score == null ? "等待使用" : score >= 85 ? "良好" : score >= 60 ? "注意降级" : "需要检查",
      items,
      summary: {
        healthy: items.filter((item) => item.status === "healthy").length,
        degraded: items.filter((item) => item.status === "degraded").length,
        stale: items.filter((item) => item.status === "stale").length,
        unavailable: items.filter((item) => item.status === "unavailable").length,
        idle: items.filter((item) => item.status === "idle").length
      }
    };
  }

  return { buildDataHealth, evaluateSource, timestamp };
});
