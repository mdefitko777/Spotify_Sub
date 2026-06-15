const { app, BrowserWindow, Menu, Tray, nativeImage, ipcMain, shell } = require("electron");
const fs = require("fs/promises");
const path = require("path");
const { listen } = require("./server");

let mainWindow;
let tray;
let localServer;

const isWindows = process.platform === "win32";

async function createWindow() {
  localServer = await startLocalServer();

  mainWindow = new BrowserWindow({
    width: 980,
    height: 360,
    minWidth: 520,
    minHeight: 160,
    frame: false,
    transparent: true,
    backgroundColor: "#00000000",
    alwaysOnTop: true,
    skipTaskbar: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  mainWindow.setMenuBarVisibility(false);
  mainWindow.setAlwaysOnTop(true, "screen-saver");
  await mainWindow.loadURL(`${localServer.url}/index.html`);
  createTray();
}

async function startLocalServer() {
  try {
    return await listen(Number(process.env.PORT || 8765));
  } catch (error) {
    if (error.code === "EADDRINUSE") {
      return listen(0);
    }
    throw error;
  }
}

function createTray() {
  const svg = encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">
      <rect width="32" height="32" rx="8" fill="#1ed760"/>
      <path d="M9 12c4.8-1.5 10.5-1.1 14.4 1" fill="none" stroke="#07110b" stroke-width="2.5" stroke-linecap="round"/>
      <path d="M10 16c3.9-1 8.3-.8 11.6.8" fill="none" stroke="#07110b" stroke-width="2.2" stroke-linecap="round"/>
      <path d="M11 20c2.9-.6 6.1-.4 8.5.7" fill="none" stroke="#07110b" stroke-width="2" stroke-linecap="round"/>
    </svg>
  `);
  tray = new Tray(nativeImage.createFromDataURL(`data:image/svg+xml,${svg}`));
  tray.setToolTip("Spotify 中文字幕窗口");
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: "显示窗口", click: () => mainWindow.show() },
    { label: "隐藏窗口", click: () => mainWindow.hide() },
    {
      label: "永远置顶",
      type: "checkbox",
      checked: true,
      click: (item) => mainWindow.setAlwaysOnTop(item.checked, "screen-saver")
    },
    {
      label: "开机自启",
      type: "checkbox",
      checked: app.getLoginItemSettings().openAtLogin,
      click: (item) => setOpenAtLogin(item.checked)
    },
    { type: "separator" },
    { label: "打开缓存目录", click: () => shell.openPath(cacheDir()) },
    { label: "退出", click: () => app.quit() }
  ]));
  tray.on("double-click", () => mainWindow.show());
}

function setOpenAtLogin(enabled) {
  app.setLoginItemSettings({
    openAtLogin: enabled,
    path: isWindows ? process.execPath : undefined
  });
}

function cacheDir() {
  return path.join(app.getPath("userData"), "song-cache");
}

function safeFileName(input) {
  return input.replace(/[<>:"/\\|?*\x00-\x1F]/g, "_").slice(0, 160);
}

function cachePath(songKey) {
  return path.join(cacheDir(), `${safeFileName(songKey)}.json`);
}

ipcMain.handle("cache:load", async (_event, songKey) => {
  try {
    const text = await fs.readFile(cachePath(songKey), "utf8");
    return JSON.parse(text);
  } catch {
    return null;
  }
});

ipcMain.handle("cache:save", async (_event, payload) => {
  await fs.mkdir(cacheDir(), { recursive: true });
  const data = {
    ...payload,
    savedAt: new Date().toISOString()
  };
  await fs.writeFile(cachePath(payload.songKey), JSON.stringify(data, null, 2), "utf8");
  return true;
});

ipcMain.handle("window:setAlwaysOnTop", (_event, enabled) => {
  mainWindow.setAlwaysOnTop(Boolean(enabled), "screen-saver");
  return mainWindow.isAlwaysOnTop();
});

ipcMain.handle("app:setOpenAtLogin", (_event, enabled) => {
  setOpenAtLogin(Boolean(enabled));
  return app.getLoginItemSettings().openAtLogin;
});

ipcMain.handle("app:getDesktopState", () => ({
  isDesktop: true,
  alwaysOnTop: mainWindow.isAlwaysOnTop(),
  openAtLogin: app.getLoginItemSettings().openAtLogin
}));

app.whenReady().then(createWindow);

app.on("window-all-closed", (event) => {
  event.preventDefault();
  if (mainWindow) mainWindow.hide();
});

app.on("before-quit", () => {
  if (localServer?.server) localServer.server.close();
});
