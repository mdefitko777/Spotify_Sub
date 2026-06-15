$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $root

if (-not (Test-Path ".\node_modules\electron")) {
  npm.cmd install
}

npm.cmd run desktop
