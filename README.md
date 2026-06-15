# Spotify 中文字幕窗口

这是一个本地运行的 Spotify 中文字幕窗口：连接 Spotify 当前播放，自动查找同步歌词，并把歌词翻译成中文显示。

## 启动

桌面版：

```powershell
.\start-desktop.ps1
```

第一次运行会安装 Electron 依赖。桌面版支持：

- 永远置顶窗口
- 系统托盘
- 拖动字幕窗口
- 开机自启开关
- 本地歌曲缓存

网页开发版：

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

桌面版默认使用 OpenAI API 翻译。先在 PowerShell 里设置 API Key：

```powershell
setx OPENAI_API_KEY "你的 OpenAI API Key"
```

设置后重新打开一个 PowerShell，再启动桌面版：

```powershell
.\start-desktop.ps1
```

默认模型是：

```text
gpt-4.1-mini
```

也可以在设置里改模型名，或用环境变量指定：

```powershell
setx OPENAI_TRANSLATE_MODEL "gpt-4.1-mini"
```

如果不想用 OpenAI，也可以切换到 MyMemory 免费接口，或在设置里填 LibreTranslate 地址，例如：

```text
https://libretranslate.com/translate
```

如果歌词 API 或翻译接口不可用，可以直接粘贴 `.lrc` 歌词，仍然可以按 Spotify 进度同步。

## 本地缓存

每首歌翻译后会保存一份缓存，内容包括：

- 歌名、歌手、专辑、时长
- 每行歌词的时间轴
- 原文歌词
- 中文翻译

桌面版缓存目录在 Electron 的 userData 下：

```text
song-cache
```

可以从托盘菜单点击“打开缓存目录”。再次播放同一首歌时，会优先读取本地缓存，避免重复实时翻译。

## 限制

- Spotify 官方 API 不提供歌词，所以歌词来自 LRCLIB 或手动 LRC。
- 免费翻译接口可能限流，长歌第一次翻译会慢一些。
