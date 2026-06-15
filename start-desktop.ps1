$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $root

$userOpenAiKey = [Environment]::GetEnvironmentVariable("OPENAI_API_KEY", "User")
$machineOpenAiKey = [Environment]::GetEnvironmentVariable("OPENAI_API_KEY", "Machine")
$userOpenAiModel = [Environment]::GetEnvironmentVariable("OPENAI_TRANSLATE_MODEL", "User")
$machineOpenAiModel = [Environment]::GetEnvironmentVariable("OPENAI_TRANSLATE_MODEL", "Machine")

if (-not $env:OPENAI_API_KEY) {
  if ($userOpenAiKey) {
    $env:OPENAI_API_KEY = $userOpenAiKey
  } elseif ($machineOpenAiKey) {
    $env:OPENAI_API_KEY = $machineOpenAiKey
  }
}

if (-not $env:OPENAI_TRANSLATE_MODEL) {
  if ($userOpenAiModel) {
    $env:OPENAI_TRANSLATE_MODEL = $userOpenAiModel
  } elseif ($machineOpenAiModel) {
    $env:OPENAI_TRANSLATE_MODEL = $machineOpenAiModel
  }
}

if (-not (Test-Path ".\node_modules\electron")) {
  npm.cmd install
}

npm.cmd run desktop
