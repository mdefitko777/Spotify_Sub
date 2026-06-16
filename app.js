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
  manualScrollOffset: 0,
  miniMode: false,
  isDesktop: Boolean(window.desktopApi),
  openAiAvailable: false,
  showSettings: false,
  desktopConfig: null,
  savedSpotifyToken: null,
  translateCache: loadJson("translateCache", {}),
  settings: loadJson("settings", {})
};

const els = {
  trackTitle: document.querySelector("#trackTitle"),
  trackBar: document.querySelector(".track-bar"),
  trackMeta: document.querySelector("#trackMeta"),
  playState: document.querySelector("#playState"),
  pinToggle: document.querySelector("#pinToggle"),
  miniToggle: document.querySelector("#miniToggle"),
  lyricsList: document.querySelector("#lyricsList"),
  lyricsViewport: document.querySelector("#lyricsViewport"),
  clientId: document.querySelector("#clientId"),
  redirectUri: document.querySelector("#redirectUri"),
  connectBtn: document.querySelector("#connectBtn"),
  disconnectBtn: document.querySelector("#disconnectBtn"),
  fetchLyricsBtn: document.querySelector("#fetchLyricsBtn"),
  translateBtn: document.querySelector("#translateBtn"),
  copyTitleBtn: document.querySelector("#copyTitleBtn"),
  lyricsifyBtn: document.querySelector("#lyricsifyBtn"),
  manualLrc: document.querySelector("#manualLrc"),
  loadManualBtn: document.querySelector("#loadManualBtn"),
  copyChatGptBtn: document.querySelector("#copyChatGptBtn"),
  importTranslationBtn: document.querySelector("#importTranslationBtn"),
  statusText: document.querySelector("#statusText"),
  translator: document.querySelector("#translator"),
  openAiModel: document.querySelector("#openAiModel"),
  openAiModelWrap: document.querySelector("#openAiModelWrap"),
  openAiKey: document.querySelector("#openAiKey"),
  openAiKeyWrap: document.querySelector("#openAiKeyWrap"),
  openAiStatus: document.querySelector("#openAiStatus"),
  saveConfigRow: document.querySelector("#saveConfigRow"),
  saveConfigBtn: document.querySelector("#saveConfigBtn"),
  testOpenAiBtn: document.querySelector("#testOpenAiBtn"),
  hideSettingsBtn: document.querySelector("#hideSettingsBtn"),
  connectedSummary: document.querySelector("#connectedSummary"),
  editSettingsBtn: document.querySelector("#editSettingsBtn"),
  libreUrl: document.querySelector("#libreUrl"),
  libreUrlWrap: document.querySelector("#libreUrlWrap"),
  openAtLogin: document.querySelector("#openAtLogin"),
  openAtLoginWrap: document.querySelector("#openAtLoginWrap"),
  originalFontSize: document.querySelector("#originalFontSize"),
  translationFontSize: document.querySelector("#translationFontSize"),
  opacity: document.querySelector("#opacity"),
  originalColor: document.querySelector("#originalColor"),
  translationColor: document.querySelector("#translationColor"),
  originalFontFamily: document.querySelector("#originalFontFamily"),
  translationFontFamily: document.querySelector("#translationFontFamily"),
  shadowStrength: document.querySelector("#shadowStrength"),
  showOriginal: document.querySelector("#showOriginal"),
  compactMode: document.querySelector("#compactMode"),
  transparentBg: document.querySelector("#transparentBg")
};

init();

async function init() {
  els.redirectUri.textContent = redirectUri();
  bindEvents();
  await initDesktop();
  els.clientId.value = state.settings.clientId || "";
  els.translator.value = state.settings.translator || "openai";
  els.openAiModel.value = state.settings.openAiModel || "gpt-4.1-mini";
  els.openAiKey.value = state.desktopConfig?.openAiKey || "";
  els.libreUrl.value = state.settings.libreUrl || "";
  els.originalFontSize.value = state.settings.originalFontSize || Math.round((state.settings.fontSize || 28) * 0.86);
  els.translationFontSize.value = state.settings.translationFontSize || state.settings.fontSize || 28;
  els.opacity.value = state.settings.opacity || 92;
  els.originalColor.value = state.settings.originalColor || "#c8d0da";
  els.translationColor.value = state.settings.translationColor || "#ffffff";
  els.originalFontFamily.value = state.settings.originalFontFamily || "Yu Gothic, Meiryo, sans-serif";
  els.translationFontFamily.value = state.settings.translationFontFamily || "Microsoft YaHei, Segoe UI, sans-serif";
  els.shadowStrength.value = state.settings.shadowStrength ?? 6;
  els.showOriginal.checked = state.settings.showOriginal !== false;
  els.compactMode.checked = Boolean(state.settings.compactMode);
  els.transparentBg.checked = Boolean(state.settings.transparentBg);
  applyStyleSettings();
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
  els.copyTitleBtn.addEventListener("click", copyTitleForLrcSearch);
  els.lyricsifyBtn.addEventListener("click", searchLyricsify);
  els.trackBar.addEventListener("dblclick", () => setMiniMode(true));
  els.loadManualBtn.addEventListener("click", loadManualLyrics);
  els.copyChatGptBtn.addEventListener("click", copyChatGPTPrompt);
  els.importTranslationBtn.addEventListener("click", importManualTranslation);
  els.pinToggle.addEventListener("click", toggleAlwaysOnTop);
  els.miniToggle.addEventListener("click", () => setMiniMode(true));
  els.lyricsViewport.addEventListener("dblclick", () => {
    if (state.miniMode) setMiniMode(false);
  });
  els.openAtLogin.addEventListener("change", toggleOpenAtLogin);
  els.saveConfigBtn.addEventListener("click", saveSettings);
  els.testOpenAiBtn.addEventListener("click", testOpenAI);
  els.hideSettingsBtn.addEventListener("click", collapseSettings);
  els.editSettingsBtn.addEventListener("click", expandSettings);

  els.lyricsViewport.addEventListener("wheel", handleLyricsWheel, { passive: false });
  els.lyricsViewport.addEventListener("pointerdown", startMiniDrag);

  [els.clientId, els.translator, els.openAiModel, els.openAiKey, els.libreUrl, els.originalFontSize, els.translationFontSize, els.opacity, els.originalColor, els.translationColor, els.originalFontFamily, els.translationFontFamily, els.shadowStrength, els.showOriginal, els.compactMode, els.transparentBg].forEach((el) => {
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
    openAiModel: els.openAiModel.value.trim() || "gpt-4.1-mini",
    libreUrl: els.libreUrl.value.trim(),
    originalFontSize: Number(els.originalFontSize.value),
    translationFontSize: Number(els.translationFontSize.value),
    opacity: Number(els.opacity.value),
    originalColor: els.originalColor.value,
    translationColor: els.translationColor.value,
    originalFontFamily: els.originalFontFamily.value,
    translationFontFamily: els.translationFontFamily.value,
    shadowStrength: Number(els.shadowStrength.value),
    showOriginal: els.showOriginal.checked,
    compactMode: els.compactMode.checked,
    transparentBg: els.transparentBg.checked
  };
  saveJson("settings", state.settings);
  state.openAiAvailable = Boolean(els.openAiKey.value.trim()) || state.openAiAvailable;
  if (window.desktopApi) {
    window.desktopApi.saveAppConfig({
      settings: state.settings,
      openAiKey: els.openAiKey.value.trim()
    }).then((result) => {
      state.desktopConfig = result.config;
      state.openAiAvailable = Boolean(result.openAiAvailable);
      applyStyleSettings();
    }).catch(() => {
      setStatus("本地配置保存失败。", true);
    });
  }
  applyStyleSettings();
}

function applyStyleSettings() {
  document.documentElement.style.setProperty("--original-font-size", `${els.originalFontSize.value}px`);
  document.documentElement.style.setProperty("--translation-font-size", `${els.translationFontSize.value}px`);
  document.documentElement.style.setProperty("--alpha", String(Number(els.opacity.value) / 100));
  document.documentElement.style.setProperty("--original-color", els.originalColor.value);
  document.documentElement.style.setProperty("--translation-color", els.translationColor.value);
  document.documentElement.style.setProperty("--original-font-family", els.originalFontFamily.value);
  document.documentElement.style.setProperty("--translation-font-family", els.translationFontFamily.value);
  document.documentElement.style.setProperty("--shadow-strength", els.shadowStrength.value);
  document.body.classList.toggle("compact", els.compactMode.checked);
  document.body.classList.toggle("transparent-bg", els.transparentBg.checked || state.miniMode);
  document.body.classList.toggle("mini-mode", state.miniMode);
  els.openAiModelWrap.classList.toggle("hidden", els.translator.value !== "openai");
  els.openAiKeyWrap.classList.toggle("hidden", els.translator.value !== "openai");
  els.saveConfigRow.classList.toggle("hidden", els.translator.value !== "openai");
  els.openAiStatus.classList.toggle("hidden", els.translator.value !== "openai");
  if (els.translator.value === "openai") {
    els.openAiStatus.textContent = state.isDesktop
      ? (state.openAiAvailable ? "OpenAI API Key 已保存，本地翻译可用。" : "请保存 OpenAI API Key。")
      : "OpenAI 翻译只在桌面版可用。";
  }
  renderConnectionControls();
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
    state.openAiAvailable = Boolean(desktopState.openAiAvailable);
    state.desktopConfig = desktopState.config || {};
    state.settings = {
      ...state.settings,
      ...(state.desktopConfig.settings || {})
    };
    state.savedSpotifyToken = state.desktopConfig.spotifyToken || null;
    els.pinToggle.classList.remove("hidden");
    els.miniToggle.classList.remove("hidden");
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

async function setMiniMode(enabled) {
  state.miniMode = Boolean(enabled);
  state.manualScrollOffset = 0;
  document.body.classList.toggle("mini-mode", state.miniMode);
  document.body.classList.toggle("transparent-bg", els.transparentBg.checked || state.miniMode);
  els.miniToggle.classList.toggle("active", state.miniMode);
  if (window.desktopApi) await window.desktopApi.setMiniMode(state.miniMode);
  renderLyrics();
}

async function toggleOpenAtLogin() {
  if (!window.desktopApi) return;
  const actual = await window.desktopApi.setOpenAtLogin(els.openAtLogin.checked);
  els.openAtLogin.checked = Boolean(actual);
}

function handleLyricsWheel(event) {
  if (!state.lyrics.length) return;
  event.preventDefault();
  state.manualScrollOffset += event.deltaY;
  const limit = state.miniMode ? 90 : els.lyricsViewport.clientHeight * 0.45;
  state.manualScrollOffset = Math.max(-limit, Math.min(limit, state.manualScrollOffset));
  updateActiveLine(true);
}

async function startMiniDrag(event) {
  if (!state.miniMode || !window.desktopApi || event.button !== 0) return;
  const startedAt = Date.now();
  const startX = event.screenX;
  const startY = event.screenY;
  const startBounds = await window.desktopApi.getWindowBounds();
  let moved = false;

  function onMove(moveEvent) {
    const dx = moveEvent.screenX - startX;
    const dy = moveEvent.screenY - startY;
    if (Math.abs(dx) + Math.abs(dy) < 4) return;
    moved = true;
    window.desktopApi.setWindowBounds({
      ...startBounds,
      x: startBounds.x + dx,
      y: startBounds.y + dy
    });
  }

  function onUp(upEvent) {
    window.removeEventListener("pointermove", onMove);
    window.removeEventListener("pointerup", onUp);
    if (!moved && Date.now() - startedAt < 300 && upEvent.detail >= 2) {
      setMiniMode(false);
    }
  }

  window.addEventListener("pointermove", onMove);
  window.addEventListener("pointerup", onUp);
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
    collapseSettings();
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
  if (window.desktopApi) {
    window.desktopApi.saveSpotifyToken({
      token: state.token,
      refreshToken: state.refreshToken,
      tokenExpiresAt: state.tokenExpiresAt
    });
  }
}

function restoreToken() {
  const saved = state.savedSpotifyToken || loadJson("spotifyToken", null);
  if (!saved) return;
  state.token = saved.token;
  state.refreshToken = saved.refreshToken;
  state.tokenExpiresAt = saved.tokenExpiresAt;
  if (state.token) collapseSettings();
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
  if (window.desktopApi) window.desktopApi.clearSpotifyToken();
  state.token = null;
  state.track = null;
  state.trackKey = "";
  state.progressMs = 0;
  state.isPlaying = false;
  renderTrack();
  expandSettings();
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
      state.manualScrollOffset = 0;
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

async function copyChatGPTPrompt() {
  if (!state.lyrics.length) {
    setStatus("请先载入当前歌曲的歌词，再复制给 ChatGPT。", true);
    return;
  }
  const trackText = state.track
    ? `${state.track.title} - ${state.track.artist}`
    : "当前歌曲";
  const lines = state.lyrics
    .map((line, index) => `${index + 1}. ${line.original}`)
    .join("\n");
  const prompt = [
    `请把下面歌曲《${trackText}》的歌词翻译成自然、适合字幕显示的简体中文。`,
    "要求：",
    "1. 保持行数和编号完全一致。",
    "2. 每行只输出：编号. 中文翻译",
    "3. 不要解释，不要输出原文。",
    "",
    lines
  ].join("\n");

  try {
    await navigator.clipboard.writeText(prompt);
    setStatus("已复制给 ChatGPT 的翻译提示词。粘贴到 ChatGPT 后，把结果复制回来点“导入翻译”。");
  } catch {
    els.manualLrc.value = prompt;
    setStatus("无法访问剪贴板，已把提示词放进文本框。");
  }
}

async function copyTitleForLrcSearch() {
  if (!state.track) {
    setStatus("还没有当前歌曲标题。", true);
    return;
  }
  const query = lrcSearchQuery();
  try {
    await navigator.clipboard.writeText(query);
    setStatus(`已复制：${query}`);
  } catch {
    els.manualLrc.value = query;
    setStatus("无法访问剪贴板，已把标题放进文本框。");
  }
}

async function searchLyricsify() {
  if (!state.track) {
    setStatus("还没有当前歌曲标题。", true);
    return;
  }
  const query = lrcSearchQuery();
  try {
    await navigator.clipboard.writeText(query);
  } catch {
    // Opening the site is still useful even if clipboard permission is unavailable.
  }
  if (window.desktopApi) {
    try {
      await window.desktopApi.openExternal("https://www.lyricsify.com/");
      setStatus(`已打开 Lyricsify，并复制搜索词：${query}`);
      return;
    } catch (error) {
      setStatus(`打开 Lyricsify 失败：${error.message}`, true);
      return;
    }
  }
  window.open("https://www.lyricsify.com/", "_blank", "noopener");
  setStatus(`已打开 Lyricsify，并复制搜索词：${query}`);
}

function lrcSearchQuery() {
  if (!state.track) return "";
  return `${state.track.title} ${state.track.artist} lrc`;
}

async function importManualTranslation() {
  if (!state.lyrics.length) {
    setStatus("请先载入 LRC 或让软件找到歌词，再导入翻译。", true);
    return;
  }
  const text = els.manualLrc.value.trim();
  if (!text) {
    setStatus("请先粘贴 ChatGPT 翻译结果。", true);
    return;
  }

  const translations = parseImportedTranslations(text, state.lyrics.length);
  if (!translations.length) {
    setStatus("没有识别到可导入的翻译。可以粘贴纯中文逐行、编号列表或 JSON 数组。", true);
    return;
  }

  let applied = 0;
  translations.forEach((translation, index) => {
    if (!translation || !state.lyrics[index]) return;
    state.lyrics[index].translation = translation;
    applied += 1;
  });

  if (!applied) {
    setStatus("识别到了翻译文本，但没有匹配到当前歌词行。请确认编号从 1 开始，或粘贴纯中文逐行翻译。", true);
    return;
  }

  renderLyrics();
  await saveCurrentSongCache("manual-translation");
  setStatus(`已自动导入 ${applied} 行翻译，并保存到本地缓存。`);
}

function parseImportedTranslations(text, expectedCount) {
  const json = parseTranslationJson(text, expectedCount);
  if (json.length) return json;

  const numbered = [];
  const plain = [];
  text.split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .forEach((line) => {
      if (isInstructionLine(line)) return;
      const stripped = line
        .replace(/^[-*]\s+/, "")
        .replace(/^["'“”]+|["'“”]+$/g, "")
        .trim();
      const numberedMatch = stripped.match(/^(\d{1,4})[\s.)、:：-]+(.+)$/);
      if (numberedMatch) {
        const index = Number(numberedMatch[1]) - 1;
        const value = cleanImportedTranslation(numberedMatch[2]);
        if (index >= 0 && index < expectedCount && value) numbered[index] = value;
        return;
      }
      const arrowMatch = stripped.match(/^.+?(?:=>|->|→|：|:)\s*(.+)$/);
      const value = cleanImportedTranslation(arrowMatch ? arrowMatch[1] : stripped);
      if (value) plain.push(value);
    });

  if (numbered.filter(Boolean).length) return fillByOrder(numbered, expectedCount);
  return plain.slice(0, expectedCount);
}

function isInstructionLine(line) {
  return /^(请把|要求|不要解释|保持行数|每行只输出|歌曲《|翻译成|以下是|当然|好的|可以)/.test(line)
    || /^第?\s*\d+\s*[条点]/.test(line);
}

function parseTranslationJson(text, expectedCount) {
  try {
    const parsed = JSON.parse(text);
    const values = Array.isArray(parsed) ? parsed : parsed.translations;
    if (!Array.isArray(values)) return [];
    return values.map((item) => cleanImportedTranslation(String(item || ""))).filter(Boolean).slice(0, expectedCount);
  } catch {
    return [];
  }
}

function fillByOrder(values, expectedCount) {
  const result = [];
  for (let index = 0; index < expectedCount; index += 1) {
    if (values[index]) result[index] = values[index];
  }
  const present = result.filter(Boolean);
  if (!present.length) return [];
  return result;
}

function cleanImportedTranslation(text) {
  return String(text || "")
    .replace(/^["'“”]+|["'“”]+$/g, "")
    .replace(/,$/, "")
    .trim();
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
    const translation = escapeHtml(line.translation || "待翻译");
    const pendingClass = line.translation ? "" : " pending";
    const originalHtml = (els.showOriginal.checked || state.miniMode) ? `<div class="original">${original}</div>` : "";
    return `<div class="lyric-line" data-index="${index}">${originalHtml}<div class="translation${pendingClass}">${translation}</div></div>`;
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
    const anchor = state.miniMode ? 0.5 : 0.42;
    const target = active.offsetTop - els.lyricsViewport.clientHeight * anchor + state.manualScrollOffset;
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
  if (els.translator.value === "openai") {
    await translateLyricsWithOpenAI();
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

async function translateLyricsWithOpenAI() {
  if (!window.desktopApi) {
    setStatus("OpenAI 翻译需要用桌面版启动。", true);
    return;
  }

  const missing = state.lyrics
    .map((line, index) => ({ line, index }))
    .filter((item) => shouldTranslateLine(item.line));
  if (!missing.length) {
    setStatus("歌词已经翻译完成。");
    return;
  }

  setStatus(`正在用 OpenAI 翻译 ${missing.length} 行歌词...`);
  try {
    const translations = await window.desktopApi.translateWithOpenAI({
      model: els.openAiModel.value.trim() || "gpt-4.1-mini",
      track: state.track ? {
        title: state.track.title,
        artist: state.track.artist,
        album: state.track.album
      } : {},
      lines: missing.map((item) => item.line.original)
    });

    let translatedCount = 0;
    missing.forEach((item, offset) => {
      const translated = translations[offset] || "";
      if (translated && translated.trim() !== item.line.original.trim()) {
        item.line.translation = translated;
        translatedCount += 1;
      } else {
        item.line.translation = "";
      }
    });
    renderLyrics();
    if (!translatedCount) {
      throw new Error("OpenAI 没有返回有效中文翻译，请检查 API Key、余额或模型名。");
    }
    await saveCurrentSongCache("openai-translated");
    setStatus(`OpenAI 翻译完成 ${translatedCount} 行，已保存到本地缓存。`);
  } catch (error) {
    setStatus(`OpenAI 翻译失败：${error.message}`, true);
  }
}

async function testOpenAI() {
  saveSettings();
  if (!window.desktopApi) {
    setStatus("OpenAI 测试需要桌面版。", true);
    return;
  }
  setStatus("正在测试 OpenAI...");
  try {
    const result = await window.desktopApi.translateWithOpenAI({
      model: els.openAiModel.value.trim() || "gpt-4.1-mini",
      track: { title: "API test" },
      lines: ["さよなら"]
    });
    if (!result[0] || result[0] === "さよなら") {
      throw new Error("OpenAI 返回了空翻译。");
    }
    setStatus(`OpenAI 测试成功：さよなら -> ${result[0]}`);
  } catch (error) {
    setStatus(`OpenAI 测试失败：${error.message}`, true);
  }
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
  if (local?.lyrics?.length) return sanitizeCachedSong(local);
  if (!window.desktopApi) return null;
  try {
    const cached = await window.desktopApi.loadSongCache(key);
    return cached?.lyrics?.length ? sanitizeCachedSong(cached) : cached;
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
      translation: isBadTranslation(line.translation) ? "" : line.translation || ""
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
  if (state.translateCache[key] && !isBadTranslation(state.translateCache[key])) return state.translateCache[key];
  if (isBadTranslation(state.translateCache[key])) delete state.translateCache[key];
  try {
    let translated = text;
    if (els.translator.value === "libre") {
      translated = await translateLibre(text);
    } else {
      translated = await translateMyMemory(text);
    }
    if (isBadTranslation(translated)) throw new Error("bad translation response");
    state.translateCache[key] = translated || text;
    return state.translateCache[key];
  } catch {
    return text;
  }
}

async function translateMyMemory(text) {
  const source = detectSourceLanguage(text);
  if (source === "zh-CN") return text;
  const url = new URL("https://api.mymemory.translated.net/get");
  url.searchParams.set("q", text);
  url.searchParams.set("langpair", `${source}|zh-CN`);
  const res = await fetch(url);
  if (!res.ok) throw new Error("translation failed");
  const data = await res.json();
  if (Number(data.responseStatus) >= 400) throw new Error(data.responseDetails || "translation failed");
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

function detectSourceLanguage(text) {
  const value = String(text || "");
  if (/[\u3040-\u30ff]/.test(value)) return "ja";
  if (/[\uac00-\ud7af]/.test(value)) return "ko";
  if (/[\u4e00-\u9fff]/.test(value)) return "zh-CN";
  if (/[а-яё]/i.test(value)) return "ru";
  if (/[a-z]/i.test(value)) return "en";
  return "en";
}

function isBadTranslation(text) {
  return /invalid source language|langpair=/i.test(String(text || ""));
}

function shouldTranslateLine(line) {
  if (!line.translation || isBadTranslation(line.translation)) return true;
  if (line.translation.trim() === line.original.trim() && detectSourceLanguage(line.original) !== "zh-CN") return true;
  return false;
}

function sanitizeCachedSong(song) {
  return {
    ...song,
    lyrics: song.lyrics.map((line) => ({
      ...line,
      translation: isBadTranslation(line.translation) || shouldTranslateLine(line) ? "" : line.translation
    }))
  };
}

function collapseSettings() {
  state.showSettings = false;
  renderConnectionControls();
}

function expandSettings() {
  state.showSettings = true;
  renderConnectionControls();
}

function renderConnectionControls() {
  const canCollapse = Boolean(state.token) && !state.showSettings;
  document.body.classList.toggle("settings-collapsed", canCollapse);
  els.connectedSummary.classList.toggle("hidden", !canCollapse);
}
