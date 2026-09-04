const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("hengce", {
  platform: process.platform,
  quote: (code, options = {}) => ipcRenderer.invoke("market:quote", code, options),
  search: (query) => ipcRenderer.invoke("market:search", query),
  klines: (code, limit = 1300, options = {}) =>
    ipcRenderer.invoke("market:klines", code, limit, options),
  indexKlines: (benchmark, limit = 260, options = {}) =>
    ipcRenderer.invoke("market:index-klines", benchmark, limit, options),
  indices: (options = {}) => ipcRenderer.invoke("market:indices", options),
  compass: (options = {}) => ipcRenderer.invoke("market:compass", options),
  valuation: (code, options = {}) => ipcRenderer.invoke("market:valuation", code, options),
  hotspots: (options = {}) => ipcRenderer.invoke("market:hotspots", options),
  breadth: (options = {}) => ipcRenderer.invoke("market:breadth", options),
  boardMembers: (boardCode, options = {}) => ipcRenderer.invoke("market:board-members", boardCode, options),
  intraday: (code, options = {}) => ipcRenderer.invoke("market:intraday", code, options),
  recommendations: (options = {}) => ipcRenderer.invoke("market:recommendations", options),
  overnight: (options = {}) => ipcRenderer.invoke("market:overnight", options),
  profile: (code, options = {}) => ipcRenderer.invoke("market:profile", code, options),
  announcements: (code, options = {}) => ipcRenderer.invoke("market:announcements", code, options),
  catalysts: (codes = [], options = {}) => ipcRenderer.invoke("market:catalysts", codes, options),
  intelligence: (options = {}) => ipcRenderer.invoke("market:intelligence", options),
  macro: (options = {}) => ipcRenderer.invoke("market:macro", options),
  notify: (title, body) => ipcRenderer.invoke("system:notify", title, body),
  openExternal: (url) => ipcRenderer.invoke("system:open-external", url),
  checkForUpdate: () => ipcRenderer.invoke("system:update-check"),
  appVersion: () => ipcRenderer.invoke("system:app-version"),
  tradingCalendar: (options = {}) => ipcRenderer.invoke("system:trading-calendar", options),
  downloadUpdate: () => ipcRenderer.invoke("system:update-download"),
  installUpdate: () => ipcRenderer.invoke("system:update-install"),
  saveBackup: (payload, password = "") => ipcRenderer.invoke("system:backup-save", payload, password),
  openBackup: (password = "") => ipcRenderer.invoke("system:backup-open", password),
  setWindowPreferences: (preferences) =>
    ipcRenderer.invoke("system:window-preferences", preferences),
  aiSettings: () => ipcRenderer.invoke("ai:settings"),
  saveAiSettings: (settings) => ipcRenderer.invoke("ai:settings-save", settings),
  deleteAiKey: () => ipcRenderer.invoke("ai:key-delete"),
  testAi: () => ipcRenderer.invoke("ai:test"),
  trackWithAi: (payload) => ipcRenderer.invoke("ai:track", payload),
  interpretEvent: (payload) => ipcRenderer.invoke("ai:intelligence", payload),
  askAssistant: (payload) => ipcRenderer.invoke("ai:assistant", payload),
  onWindowPreferences: (callback) => {
    const listener = (_event, preferences) => callback(preferences);
    ipcRenderer.on("system:window-preferences", listener);
    return () => ipcRenderer.removeListener("system:window-preferences", listener);
  },
  onUpdateProgress: (callback) => {
    const listener = (_event, progress) => callback(progress);
    ipcRenderer.on("system:update-progress", listener);
    return () => ipcRenderer.removeListener("system:update-progress", listener);
  }
});
