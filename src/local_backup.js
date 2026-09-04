(function exposeLocalBackup(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.HengCeLocalBackup = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function createLocalBackup() {
  const DURABLE_STORAGE_KEYS = [
    "hengce.settings.v1",
    "hengce.watchlist.v1",
    "hengce.holdings.v2",
    "hengce.ui.v1",
    "hengce.defaultStock.v1",
    "hengce.lastStock.v1",
    "hengce.windowPreferences.v1",
    "hengce.appearance.v1",
    "hengce.alertPreferences.v1",
    "hengce.intelligence.bookmarks.v1",
    "hengce.overnight.forward.v1",
    "hengce.aiTracking.v1",
    "hengce.aiAssistant.v1",
    "hengce.tradeJournal.v1",
    "hengce.tradePlans.v1",
    "hengce.manualCatalysts.v1",
    "hengce.signalJournal.v1"
  ];
  const ALLOWED_KEYS = new Set(DURABLE_STORAGE_KEYS);

  function collectBackup(storage, now = new Date()) {
    const entries = {};
    DURABLE_STORAGE_KEYS.forEach((key) => {
      const value = storage.getItem(key);
      if (typeof value === "string" && value.length <= 2_000_000) entries[key] = value;
    });
    return {
      app: "HengCe",
      schemaVersion: 1,
      exportedAt: now.toISOString(),
      entries
    };
  }

  function validateBackup(payload) {
    if (payload?.app !== "HengCe" || payload?.schemaVersion !== 1 || !payload.entries || typeof payload.entries !== "object" || Array.isArray(payload.entries)) {
      throw new Error("不是可识别的衡策备份文件");
    }
    const entries = {};
    Object.entries(payload.entries).forEach(([key, value]) => {
      if (!ALLOWED_KEYS.has(key) || typeof value !== "string" || value.length > 2_000_000) return;
      try {
        JSON.parse(value);
        entries[key] = value;
      } catch {
        // Ignore malformed records instead of poisoning local storage.
      }
    });
    if (!Object.keys(entries).length) throw new Error("备份中没有可恢复的个人数据");
    return {
      app: "HengCe",
      schemaVersion: 1,
      exportedAt: String(payload.exportedAt || ""),
      entries
    };
  }

  function restoreBackup(storage, payload) {
    const safe = validateBackup(payload);
    DURABLE_STORAGE_KEYS.forEach((key) => storage.removeItem(key));
    Object.entries(safe.entries).forEach(([key, value]) => storage.setItem(key, value));
    return { restoredKeys: Object.keys(safe.entries), exportedAt: safe.exportedAt };
  }

  return { DURABLE_STORAGE_KEYS, collectBackup, restoreBackup, validateBackup };
});
