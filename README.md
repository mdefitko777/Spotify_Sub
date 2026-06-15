# Spotify 中文字幕窗口

这是一个本地运行的小窗口 MVP：连接 Spotify 当前播放，自动查找同步歌词，并把歌词翻译成中文显示。

## 启动

在 PowerShell 里运行：

```powershell
.\start.ps1
```

或者：

```powershell
npm start
```

然后打开：

```text
http://127.0.0.1:8765
```

## Spotify 设置

第一次使用需要一个 Spotify Developer App：

1. 打开 Spotify Developer Dashboard。
2. 创建 app。
3. 在 app 的 Redirect URIs 里加入：

```text
http://127.0.0.1:8765/index.html
```

4. 把 Client ID 填进页面右侧设置。
5. 点击 Connect Spotify。

需要的 scopes：

```text
user-read-currently-playing user-read-playback-state
```

## 翻译

默认使用 MyMemory 免费接口，适合试用。你也可以在设置里填 LibreTranslate 地址，例如：

```text
https://libretranslate.com/translate
```

如果歌词 API 或翻译接口不可用，可以直接粘贴 `.lrc` 歌词，仍然可以按 Spotify 进度同步。

## 限制

- Chrome app 窗口不是系统级“永远置顶”。如果你需要真正置顶，下一步建议用 Electron 或 Tauri 包装。
- Spotify 官方 API 不提供歌词，所以歌词来自 LRCLIB 或手动 LRC。
- 免费翻译接口可能限流，长歌第一次翻译会慢一些。
