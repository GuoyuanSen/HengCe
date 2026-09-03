const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("hengce", {
  platform: process.platform,
  quote: (code, options = {}) => ipcRenderer.invoke("market:quote", code, options),
  search: (query) => ipcRenderer.invoke("market:search", query),
  klines: (code, limit = 1300, options = {}) =>
    ipcRenderer.invoke("market:klines", code, limit, options),
  indices: (options = {}) => ipcRenderer.invoke("market:indices", options),
  compass: (options = {}) => ipcRenderer.invoke("market:compass", options),
  valuation: (code, options = {}) => ipcRenderer.invoke("market:valuation", code, options),
  hotspots: (options = {}) => ipcRenderer.invoke("market:hotspots", options),
  boardMembers: (boardCode, options = {}) => ipcRenderer.invoke("market:board-members", boardCode, options),
  intraday: (code, options = {}) => ipcRenderer.invoke("market:intraday", code, options),
  recommendations: (options = {}) => ipcRenderer.invoke("market:recommendations", options),
  overnight: (options = {}) => ipcRenderer.invoke("market:overnight", options),
  profile: (code, options = {}) => ipcRenderer.invoke("market:profile", code, options),
  notify: (title, body) => ipcRenderer.invoke("system:notify", title, body),
  openExternal: (url) => ipcRenderer.invoke("system:open-external", url),
  checkForUpdate: () => ipcRenderer.invoke("system:update-check"),
  appVersion: () => ipcRenderer.invoke("system:app-version"),
  downloadUpdate: () => ipcRenderer.invoke("system:update-download"),
  installUpdate: () => ipcRenderer.invoke("system:update-install"),
  onUpdateProgress: (callback) => {
    const listener = (_event, progress) => callback(progress);
    ipcRenderer.on("system:update-progress", listener);
    return () => ipcRenderer.removeListener("system:update-progress", listener);
  }
});
