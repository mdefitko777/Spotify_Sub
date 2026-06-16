const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("desktopApi", {
  getDesktopState: () => ipcRenderer.invoke("app:getDesktopState"),
  saveAppConfig: (payload) => ipcRenderer.invoke("app:saveConfig", payload),
  saveSpotifyToken: (payload) => ipcRenderer.invoke("spotify:saveToken", payload),
  clearSpotifyToken: () => ipcRenderer.invoke("spotify:clearToken"),
  loadSongCache: (songKey) => ipcRenderer.invoke("cache:load", songKey),
  saveSongCache: (payload) => ipcRenderer.invoke("cache:save", payload),
  translateWithOpenAI: (payload) => ipcRenderer.invoke("openai:translate", payload),
  setMiniMode: (enabled) => ipcRenderer.invoke("window:setMiniMode", enabled),
  getWindowBounds: () => ipcRenderer.invoke("window:getBounds"),
  setWindowBounds: (bounds) => ipcRenderer.invoke("window:setBounds", bounds),
  setAlwaysOnTop: (enabled) => ipcRenderer.invoke("window:setAlwaysOnTop", enabled),
  setOpenAtLogin: (enabled) => ipcRenderer.invoke("app:setOpenAtLogin", enabled)
});
