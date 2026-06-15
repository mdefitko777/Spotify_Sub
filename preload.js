const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("desktopApi", {
  getDesktopState: () => ipcRenderer.invoke("app:getDesktopState"),
  loadSongCache: (songKey) => ipcRenderer.invoke("cache:load", songKey),
  saveSongCache: (payload) => ipcRenderer.invoke("cache:save", payload),
  translateWithOpenAI: (payload) => ipcRenderer.invoke("openai:translate", payload),
  setAlwaysOnTop: (enabled) => ipcRenderer.invoke("window:setAlwaysOnTop", enabled),
  setOpenAtLogin: (enabled) => ipcRenderer.invoke("app:setOpenAtLogin", enabled)
});
