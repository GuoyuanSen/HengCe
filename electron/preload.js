const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("hengce", {
  platform: process.platform,
  quote: (code) => ipcRenderer.invoke("market:quote", code),
  klines: (code, limit = 1300) =>
    ipcRenderer.invoke("market:klines", code, limit),
  indices: () => ipcRenderer.invoke("market:indices"),
  openExternal: (url) => ipcRenderer.invoke("system:open-external", url)
});
