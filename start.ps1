$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$port = 8765
$url = "http://127.0.0.1:$port"

try {
  Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 1 | Out-Null
} catch {
  Start-Process -WindowStyle Hidden -FilePath "node" -ArgumentList "server.js" -WorkingDirectory $root
  Start-Sleep -Seconds 1
}

$chrome = "${env:ProgramFiles}\Google\Chrome\Application\chrome.exe"
if (-not (Test-Path $chrome)) {
  $chrome = "${env:ProgramFiles(x86)}\Google\Chrome\Application\chrome.exe"
}

if (Test-Path $chrome) {
  Start-Process -FilePath $chrome -ArgumentList "--app=$url", "--window-size=900,360"
} else {
  Start-Process $url
}
