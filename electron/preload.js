const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("hengce", {
  platform: process.platform,
  quote: (code) => ipcRenderer.invoke("market:quote", code),
  search: (query) => ipcRenderer.invoke("market:search", query),
  klines: (code, limit = 1300) =>
    ipcRenderer.invoke("market:klines", code, limit),
  indices: () => ipcRenderer.invoke("market:indices"),
  valuation: (code) => ipcRenderer.invoke("market:valuation", code),
  hotspots: () => ipcRenderer.invoke("market:hotspots"),
  boardMembers: (boardCode) => ipcRenderer.invoke("market:board-members", boardCode),
  intraday: (code) => ipcRenderer.invoke("market:intraday", code),
  recommendations: () => ipcRenderer.invoke("market:recommendations"),
  overnight: () => ipcRenderer.invoke("market:overnight"),
  profile: (code) => ipcRenderer.invoke("market:profile", code),
  notify: (title, body) => ipcRenderer.invoke("system:notify", title, body),
  openExternal: (url) => ipcRenderer.invoke("system:open-external", url)
});
