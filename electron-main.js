const { app, BrowserWindow, Menu, Tray, nativeImage, ipcMain, shell } = require("electron");
const fs = require("fs/promises");
const path = require("path");
const { listen } = require("./server");

let mainWindow;
let tray;
let localServer;
let normalBounds = null;
let miniBounds = null;
let isMiniMode = false;

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

function configPath() {
  return path.join(app.getPath("userData"), "config.json");
}

async function readConfig() {
  try {
    return JSON.parse(await fs.readFile(configPath(), "utf8"));
  } catch {
    return {};
  }
}

async function writeConfig(config) {
  await fs.mkdir(app.getPath("userData"), { recursive: true });
  await fs.writeFile(configPath(), JSON.stringify(config, null, 2), "utf8");
  return config;
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

ipcMain.handle("window:setMiniMode", (_event, enabled) => {
  if (enabled) {
    if (!isMiniMode) normalBounds = mainWindow.getBounds();
    mainWindow.setMinimumSize(420, 80);
    const targetBounds = miniBounds || {
      ...normalBounds,
      width: Math.max(normalBounds.width, 700),
      height: 128
    };
    mainWindow.setBounds(targetBounds, true);
    mainWindow.setAlwaysOnTop(true, "screen-saver");
    isMiniMode = true;
  } else if (normalBounds) {
    miniBounds = mainWindow.getBounds();
    mainWindow.setMinimumSize(520, 160);
    mainWindow.setBounds(normalBounds, true);
    isMiniMode = false;
  }
  return Boolean(enabled);
});

ipcMain.handle("window:getBounds", () => mainWindow.getBounds());

ipcMain.handle("window:setBounds", (_event, bounds) => {
  if (!bounds || typeof bounds.x !== "number" || typeof bounds.y !== "number") {
    return mainWindow.getBounds();
  }
  const current = mainWindow.getBounds();
  mainWindow.setBounds({
    x: Math.round(bounds.x),
    y: Math.round(bounds.y),
    width: Math.max(420, Math.round(bounds.width || current.width)),
    height: Math.max(80, Math.round(bounds.height || current.height))
  }, false);
  return mainWindow.getBounds();
});

ipcMain.handle("app:setOpenAtLogin", (_event, enabled) => {
  setOpenAtLogin(Boolean(enabled));
  return app.getLoginItemSettings().openAtLogin;
});

ipcMain.handle("app:getDesktopState", async () => {
  const config = await readConfig();
  return {
    isDesktop: true,
    alwaysOnTop: mainWindow.isAlwaysOnTop(),
    openAtLogin: app.getLoginItemSettings().openAtLogin,
    openAiAvailable: Boolean(config.openAiKey || process.env.OPENAI_API_KEY),
    config
  };
});

ipcMain.handle("app:saveConfig", async (_event, partialConfig) => {
  const current = await readConfig();
  const next = {
    ...current,
    ...partialConfig,
    settings: {
      ...(current.settings || {}),
      ...(partialConfig.settings || {})
    }
  };
  await writeConfig(next);
  return {
    openAiAvailable: Boolean(next.openAiKey || process.env.OPENAI_API_KEY),
    config: next
  };
});

ipcMain.handle("spotify:saveToken", async (_event, token) => {
  const current = await readConfig();
  current.spotifyToken = token;
  await writeConfig(current);
  return true;
});

ipcMain.handle("spotify:clearToken", async () => {
  const current = await readConfig();
  delete current.spotifyToken;
  await writeConfig(current);
  return true;
});

ipcMain.handle("openai:translate", async (_event, payload) => {
  const config = await readConfig();
  const apiKey = config.openAiKey || process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("请先在连接页保存 OpenAI API Key。");
  }

  const lines = Array.isArray(payload.lines) ? payload.lines : [];
  if (!lines.length) return [];

  const model = payload.model || process.env.OPENAI_TRANSLATE_MODEL || "gpt-4.1-mini";
  const track = payload.track || {};
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model,
      input: [
        {
          role: "developer",
          content: [
            {
              type: "input_text",
              text: "Translate song lyrics into natural Simplified Chinese. Preserve meaning, tone, line count, and order. Return only JSON with a translations array."
            }
          ]
        },
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: JSON.stringify({
                track,
                lines
              })
            }
          ]
        }
      ],
      text: {
        format: {
          type: "json_schema",
          name: "lyrics_translation",
          strict: true,
          schema: {
            type: "object",
            additionalProperties: false,
            properties: {
              translations: {
                type: "array",
                items: { type: "string" }
              }
            },
            required: ["translations"]
          }
        }
      }
    })
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error?.message || "OpenAI translation failed");
  }

  const text = extractOpenAIText(data);
  const parsed = JSON.parse(text);
  if (!Array.isArray(parsed.translations)) {
    throw new Error("OpenAI response did not include translations");
  }
  return parsed.translations.slice(0, lines.length);
});

function extractOpenAIText(data) {
  if (typeof data.output_text === "string") return data.output_text;
  const parts = [];
  for (const item of data.output || []) {
    for (const content of item.content || []) {
      if (content.type === "output_text" && typeof content.text === "string") {
        parts.push(content.text);
      }
    }
  }
  return parts.join("");
}

app.whenReady().then(createWindow);

app.on("window-all-closed", (event) => {
  event.preventDefault();
  if (mainWindow) mainWindow.hide();
});

app.on("before-quit", () => {
  if (localServer?.server) localServer.server.close();
});
