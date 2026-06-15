const SPOTIFY_AUTH = "https://accounts.spotify.com/authorize";
const SPOTIFY_TOKEN = "https://accounts.spotify.com/api/token";
const SPOTIFY_CURRENT = "https://api.spotify.com/v1/me/player/currently-playing";
const SPOTIFY_SCOPES = "user-read-currently-playing user-read-playback-state";

const state = {
  token: null,
  tokenExpiresAt: 0,
  refreshToken: null,
  trackKey: "",
  track: null,
  lyrics: [],
  activeIndex: -1,
  progressMs: 0,
  isPlaying: false,
  lastSyncAt: 0,
  isDesktop: Boolean(window.desktopApi),
  translateCache: loadJson("translateCache", {}),
  settings: loadJson("settings", {})
};

const els = {
  trackTitle: document.querySelector("#trackTitle"),
  trackMeta: document.querySelector("#trackMeta"),
  playState: document.querySelector("#playState"),
  pinToggle: document.querySelector("#pinToggle"),
  lyricsList: document.querySelector("#lyricsList"),
  lyricsViewport: document.querySelector("#lyricsViewport"),
  clientId: document.querySelector("#clientId"),
  redirectUri: document.querySelector("#redirectUri"),
  connectBtn: document.querySelector("#connectBtn"),
  disconnectBtn: document.querySelector("#disconnectBtn"),
  fetchLyricsBtn: document.querySelector("#fetchLyricsBtn"),
  translateBtn: document.querySelector("#translateBtn"),
  manualLrc: document.querySelector("#manualLrc"),
  loadManualBtn: document.querySelector("#loadManualBtn"),
  statusText: document.querySelector("#statusText"),
  translator: document.querySelector("#translator"),
  libreUrl: document.querySelector("#libreUrl"),
  libreUrlWrap: document.querySelector("#libreUrlWrap"),
  openAtLogin: document.querySelector("#openAtLogin"),
  openAtLoginWrap: document.querySelector("#openAtLoginWrap"),
  fontSize: document.querySelector("#fontSize"),
  opacity: document.querySelector("#opacity"),
  showOriginal: document.querySelector("#showOriginal"),
  compactMode: document.querySelector("#compactMode")
};

init();

function init() {
  els.redirectUri.textContent = redirectUri();
  els.clientId.value = state.settings.clientId || "";
  els.translator.value = state.settings.translator || "mymemory";
  els.libreUrl.value = state.settings.libreUrl || "";
  els.fontSize.value = state.settings.fontSize || 28;
  els.opacity.value = state.settings.opacity || 92;
  els.showOriginal.checked = state.settings.showOriginal !== false;
  els.compactMode.checked = Boolean(state.settings.compactMode);
  applyStyleSettings();
  bindEvents();
  initDesktop();
  restoreToken();
  handleSpotifyCallback();
  pollSpotify();
  setInterval(pollSpotify, 2500);
  setInterval(tickProgress, 250);
}

function bindEvents() {
  document.querySelectorAll(".tab").forEach((tab) => {
    tab.addEventListener("click", () => {
      document.querySelectorAll(".tab").forEach((item) => item.classList.remove("active"));
      document.querySelectorAll(".panel-page").forEach((item) => item.classList.remove("active"));
      tab.classList.add("active");
      document.querySelector(`#tab-${tab.dataset.tab}`).classList.add("active");
    });
  });

  els.connectBtn.addEventListener("click", connectSpotify);
  els.disconnectBtn.addEventListener("click", disconnectSpotify);
  els.fetchLyricsBtn.addEventListener("click", () => fetchLyricsForTrack(true));
  els.translateBtn.addEventListener("click", translateVisibleLyrics);
  els.loadManualBtn.addEventListener("click", loadManualLyrics);
  els.pinToggle.addEventListener("click", toggleAlwaysOnTop);
  els.openAtLogin.addEventListener("change", toggleOpenAtLogin);

  [els.clientId, els.translator, els.libreUrl, els.fontSize, els.opacity, els.showOriginal, els.compactMode].forEach((el) => {
    el.addEventListener("input", saveSettings);
    el.addEventListener("change", saveSettings);
  });
}

function loadJson(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(key)) ?? fallback;
  } catch {
    return fallback;
  }
}

function saveJson(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function saveSettings() {
  state.settings = {
    clientId: els.clientId.value.trim(),
    translator: els.translator.value,
    libreUrl: els.libreUrl.value.trim(),
    fontSize: Number(els.fontSize.value),
    opacity: Number(els.opacity.value),
    showOriginal: els.showOriginal.checked,
    compactMode: els.compactMode.checked
  };
  saveJson("settings", state.settings);
  applyStyleSettings();
}

function applyStyleSettings() {
  document.documentElement.style.setProperty("--font-size", `${els.fontSize.value}px`);
  document.documentElement.style.setProperty("--alpha", String(Number(els.opacity.value) / 100));
  document.body.classList.toggle("compact", els.compactMode.checked);
  els.libreUrlWrap.classList.toggle("hidden", els.translator.value !== "libre");
  renderLyrics();
}

function redirectUri() {
  return `${location.origin}/index.html`;
}

async function initDesktop() {
  if (!window.desktopApi) return;
  try {
    const desktopState = await window.desktopApi.getDesktopState();
    state.isDesktop = Boolean(desktopState.isDesktop);
    els.pinToggle.classList.remove("hidden");
    els.pinToggle.classList.toggle("active", Boolean(desktopState.alwaysOnTop));
    els.openAtLoginWrap.classList.remove("hidden");
    els.openAtLogin.checked = Boolean(desktopState.openAtLogin);
  } catch {
    state.isDesktop = false;
  }
}

async function toggleAlwaysOnTop() {
  if (!window.desktopApi) return;
  const next = !els.pinToggle.classList.contains("active");
  const actual = await window.desktopApi.setAlwaysOnTop(next);
  els.pinToggle.classList.toggle("active", Boolean(actual));
}

async function toggleOpenAtLogin() {
  if (!window.desktopApi) return;
  const actual = await window.desktopApi.setOpenAtLogin(els.openAtLogin.checked);
  els.openAtLogin.checked = Boolean(actual);
}

async function connectSpotify() {
  saveSettings();
  const clientId = state.settings.clientId;
  if (!clientId) {
    setStatus("先填写 Spotify Client ID。", true);
    return;
  }
  const verifier = randomString(64);
  sessionStorage.setItem("spotifyVerifier", verifier);
  const challenge = await sha256Base64Url(verifier);
  const url = new URL(SPOTIFY_AUTH);
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("redirect_uri", redirectUri());
  url.searchParams.set("scope", SPOTIFY_SCOPES);
  url.searchParams.set("code_challenge_method", "S256");
  url.searchParams.set("code_challenge", challenge);
  location.href = url.toString();
}

async function handleSpotifyCallback() {
  const params = new URLSearchParams(location.search);
  const code = params.get("code");
  if (!code) return;

  const verifier = sessionStorage.getItem("spotifyVerifier");
  if (!verifier) {
    setStatus("Spotify 回调缺少 verifier，请重新连接。", true);
    return;
  }

  try {
    const body = new URLSearchParams({
      client_id: state.settings.clientId,
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri(),
      code_verifier: verifier
    });
    const res = await fetch(SPOTIFY_TOKEN, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body
    });
    if (!res.ok) throw new Error(await res.text());
    const data = await res.json();
    setToken(data);
    history.replaceState(null, "", redirectUri());
    setStatus("Spotify 已连接。");
    pollSpotify();
  } catch (error) {
    setStatus(`Spotify 连接失败：${error.message}`, true);
  }
}

function setToken(data) {
  state.token = data.access_token;
  state.refreshToken = data.refresh_token || state.refreshToken;
  state.tokenExpiresAt = Date.now() + (data.expires_in || 3600) * 1000 - 60000;
  saveJson("spotifyToken", {
    token: state.token,
    refreshToken: state.refreshToken,
    tokenExpiresAt: state.tokenExpiresAt
  });
}

function restoreToken() {
  const saved = loadJson("spotifyToken", null);
  if (!saved) return;
  state.token = saved.token;
  state.refreshToken = saved.refreshToken;
  state.tokenExpiresAt = saved.tokenExpiresAt;
}

async function ensureToken() {
  if (!state.token) return false;
  if (Date.now() < state.tokenExpiresAt) return true;
  if (!state.refreshToken || !state.settings.clientId) return false;

  const body = new URLSearchParams({
    client_id: state.settings.clientId,
    grant_type: "refresh_token",
    refresh_token: state.refreshToken
  });
  const res = await fetch(SPOTIFY_TOKEN, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body
  });
  if (!res.ok) return false;
  setToken(await res.json());
  return true;
}

function disconnectSpotify() {
  localStorage.removeItem("spotifyToken");
  state.token = null;
  state.track = null;
  state.trackKey = "";
  state.progressMs = 0;
  state.isPlaying = false;
  renderTrack();
  setStatus("已断开 Spotify。");
}

async function pollSpotify() {
  if (!(await ensureToken())) return;
  try {
    const res = await fetch(SPOTIFY_CURRENT, {
      headers: { Authorization: `Bearer ${state.token}` }
    });
    if (res.status === 204) {
      state.isPlaying = false;
      renderTrack();
      return;
    }
    if (!res.ok) throw new Error(await res.text());
    const data = await res.json();
    const item = data.item;
    if (!item) return;
    const artists = item.artists.map((artist) => artist.name).join(", ");
    const track = {
      title: item.name,
      artist: artists,
      album: item.album?.name || "",
      durationMs: item.duration_ms,
      progressMs: data.progress_ms || 0
    };
    const nextKey = `${track.artist}::${track.title}`;
    state.track = track;
    state.progressMs = track.progressMs;
    state.isPlaying = Boolean(data.is_playing);
    state.lastSyncAt = Date.now();
    renderTrack();
    if (nextKey !== state.trackKey) {
      state.trackKey = nextKey;
      state.lyrics = [];
      state.activeIndex = -1;
      renderLyrics();
      loadLyricsForCurrentTrack();
    }
  } catch (error) {
    setStatus(`Spotify 读取失败：${error.message}`, true);
  }
}

function tickProgress() {
  if (state.isPlaying && state.lastSyncAt) {
    state.progressMs += Date.now() - state.lastSyncAt;
    state.lastSyncAt = Date.now();
    updateActiveLine();
  }
}

function renderTrack() {
  if (!state.track) {
    els.trackTitle.textContent = state.token ? "等待 Spotify 播放" : "未连接 Spotify";
    els.trackMeta.textContent = state.token ? "播放歌曲后会自动显示" : "连接后会自动同步当前播放";
  } else {
    els.trackTitle.textContent = state.track.title;
    els.trackMeta.textContent = `${state.track.artist}${state.track.album ? ` · ${state.track.album}` : ""}`;
  }
  els.playState.classList.toggle("playing", state.isPlaying);
}

async function fetchLyricsForTrack(manual) {
  if (!state.track) {
    setStatus("还没有当前歌曲。", true);
    return;
  }
  setStatus("正在查找同步歌词...");
  const params = new URLSearchParams({
    artist_name: state.track.artist,
    track_name: state.track.title,
    album_name: state.track.album,
    duration: String(Math.round(state.track.durationMs / 1000))
  });
  try {
    let res = await fetch(`https://lrclib.net/api/get?${params}`);
    if (res.status === 404) {
      const search = new URLSearchParams({ q: `${state.track.artist} ${state.track.title}` });
      res = await fetch(`https://lrclib.net/api/search?${search}`);
      if (!res.ok) throw new Error(await res.text());
      const list = await res.json();
      const best = list.find((item) => item.syncedLyrics) || list[0];
      if (!best?.syncedLyrics) throw new Error("没有找到同步歌词");
      state.lyrics = parseLrc(best.syncedLyrics);
    } else {
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      if (!data.syncedLyrics) throw new Error("找到了歌曲，但没有同步歌词");
      state.lyrics = parseLrc(data.syncedLyrics);
    }
    renderLyrics();
    setStatus(`已载入 ${state.lyrics.length} 行歌词，开始翻译...`);
    await saveCurrentSongCache("lyrics");
    translateVisibleLyrics();
  } catch (error) {
    setStatus(`歌词查找失败：${error.message}${manual ? "" : "。可以手动粘贴 LRC。"}`, true);
  }
}

async function loadLyricsForCurrentTrack() {
  const cached = await loadCurrentSongCache();
  if (cached?.lyrics?.length) {
    state.lyrics = cached.lyrics;
    renderLyrics();
    const translated = state.lyrics.filter((line) => line.translation).length;
    setStatus(`已从本地缓存载入 ${state.lyrics.length} 行歌词，${translated} 行已翻译。`);
    if (translated < state.lyrics.length && els.translator.value !== "off") {
      translateVisibleLyrics();
    }
    return;
  }
  fetchLyricsForTrack(false);
}

function loadManualLyrics() {
  const text = els.manualLrc.value.trim();
  if (!text) {
    setStatus("请先粘贴 LRC 歌词。", true);
    return;
  }
  const parsed = parseLrc(text);
  if (!parsed.length) {
    setStatus("没有识别到 LRC 时间轴。", true);
    return;
  }
  state.lyrics = parsed;
  renderLyrics();
  setStatus(`已载入 ${parsed.length} 行手动歌词。`);
  saveCurrentSongCache("manual");
  translateVisibleLyrics();
}

function parseLrc(text) {
  const lines = [];
  text.split(/\r?\n/).forEach((raw) => {
    const matches = [...raw.matchAll(/\[(\d{1,2}):(\d{2})(?:\.(\d{1,3}))?\]/g)];
    if (!matches.length) return;
    const lyric = raw.replace(/\[[^\]]+\]/g, "").trim();
    if (!lyric) return;
    matches.forEach((match) => {
      const minutes = Number(match[1]);
      const seconds = Number(match[2]);
      const fraction = Number((match[3] || "0").padEnd(3, "0"));
      lines.push({ timeMs: minutes * 60000 + seconds * 1000 + fraction, original: lyric, translation: "" });
    });
  });
  return lines.sort((a, b) => a.timeMs - b.timeMs);
}

function renderLyrics() {
  if (!state.lyrics.length) {
    els.lyricsList.innerHTML = '<div class="empty-state">连接 Spotify，或粘贴 LRC 歌词开始。</div>';
    return;
  }
  els.lyricsList.innerHTML = state.lyrics.map((line, index) => {
    const original = escapeHtml(line.original);
    const translation = escapeHtml(line.translation || line.original);
    const originalHtml = els.showOriginal.checked ? `<div class="original">${original}</div>` : "";
    return `<div class="lyric-line" data-index="${index}">${originalHtml}<div class="translation">${translation}</div></div>`;
  }).join("");
  updateActiveLine(true);
}

function updateActiveLine(force = false) {
  if (!state.lyrics.length) return;
  let index = 0;
  for (let i = 0; i < state.lyrics.length; i += 1) {
    if (state.lyrics[i].timeMs <= state.progressMs + 250) index = i;
    else break;
  }
  if (!force && index === state.activeIndex) return;
  state.activeIndex = index;
  document.querySelectorAll(".lyric-line").forEach((line) => {
    line.classList.toggle("active", Number(line.dataset.index) === index);
  });
  const active = document.querySelector(`.lyric-line[data-index="${index}"]`);
  if (active) {
    const target = active.offsetTop - els.lyricsViewport.clientHeight * 0.42;
    els.lyricsList.style.transform = `translateY(${-Math.max(0, target)}px)`;
  }
}

async function translateVisibleLyrics() {
  if (!state.lyrics.length) {
    setStatus("没有可翻译的歌词。", true);
    return;
  }
  if (els.translator.value === "off") {
    setStatus("自动翻译已关闭。");
    return;
  }
  setStatus("正在翻译歌词...");
  let done = 0;
  for (const line of state.lyrics) {
    if (line.translation) continue;
    line.translation = await translateText(line.original);
    done += 1;
    if (done % 4 === 0) renderLyrics();
  }
  renderLyrics();
  saveJson("translateCache", state.translateCache);
  await saveCurrentSongCache("translated");
  setStatus("翻译完成。");
}

function songKey(track = state.track) {
  if (!track) return "";
  return [
    normalizeKeyPart(track.artist),
    normalizeKeyPart(track.title),
    normalizeKeyPart(track.album),
    Math.round((track.durationMs || 0) / 1000)
  ].join("__");
}

function normalizeKeyPart(value) {
  return String(value || "unknown")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\u4e00-\u9fff가-힣ぁ-んァ-ン]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "unknown";
}

async function loadCurrentSongCache() {
  if (!state.track) return null;
  const key = songKey();
  const local = loadJson(`song:${key}`, null);
  if (local?.lyrics?.length) return local;
  if (!window.desktopApi) return null;
  try {
    return await window.desktopApi.loadSongCache(key);
  } catch {
    return null;
  }
}

async function saveCurrentSongCache(source) {
  if (!state.track || !state.lyrics.length) return;
  const payload = {
    songKey: songKey(),
    source,
    track: {
      title: state.track.title,
      artist: state.track.artist,
      album: state.track.album,
      durationMs: state.track.durationMs
    },
    lyrics: state.lyrics.map((line) => ({
      timeMs: line.timeMs,
      original: line.original,
      translation: line.translation || ""
    }))
  };
  saveJson(`song:${payload.songKey}`, payload);
  if (!window.desktopApi) return;
  try {
    await window.desktopApi.saveSongCache(payload);
  } catch {
    setStatus("歌词已存到浏览器缓存，但桌面文件缓存写入失败。", true);
  }
}

async function translateText(text) {
  const key = `${els.translator.value}:zh:${text}`;
  if (state.translateCache[key]) return state.translateCache[key];
  try {
    let translated = text;
    if (els.translator.value === "libre") {
      translated = await translateLibre(text);
    } else {
      translated = await translateMyMemory(text);
    }
    state.translateCache[key] = translated || text;
    return state.translateCache[key];
  } catch {
    return text;
  }
}

async function translateMyMemory(text) {
  const url = new URL("https://api.mymemory.translated.net/get");
  url.searchParams.set("q", text);
  url.searchParams.set("langpair", "auto|zh-CN");
  const res = await fetch(url);
  if (!res.ok) throw new Error("translation failed");
  const data = await res.json();
  return data.responseData?.translatedText || text;
}

async function translateLibre(text) {
  const url = els.libreUrl.value.trim();
  if (!url) return text;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ q: text, source: "auto", target: "zh", format: "text" })
  });
  if (!res.ok) throw new Error("translation failed");
  const data = await res.json();
  return data.translatedText || text;
}

function setStatus(message, isError = false) {
  els.statusText.textContent = message;
  els.statusText.classList.toggle("error", isError);
}

function randomString(length) {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~";
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  return [...bytes].map((byte) => chars[byte % chars.length]).join("");
}

async function sha256Base64Url(text) {
  const bytes = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return btoa(String.fromCharCode(...new Uint8Array(digest)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function escapeHtml(text) {
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
