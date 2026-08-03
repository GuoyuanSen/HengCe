const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("hengce", {
  platform: process.platform,
  quote: (code) => ipcRenderer.invoke("market:quote", code),
  klines: (code, limit = 1300) =>
    ipcRenderer.invoke("market:klines", code, limit),
  indices: () => ipcRenderer.invoke("market:indices"),
  valuation: (code) => ipcRenderer.invoke("market:valuation", code),
  hotspots: () => ipcRenderer.invoke("market:hotspots"),
  recommendations: () => ipcRenderer.invoke("market:recommendations"),
  profile: (code) => ipcRenderer.invoke("market:profile", code),
  notify: (title, body) => ipcRenderer.invoke("system:notify", title, body),
  openExternal: (url) => ipcRenderer.invoke("system:open-external", url)
});
