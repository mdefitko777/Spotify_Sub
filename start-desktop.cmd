@echo off
setlocal

cd /d "%~dp0"

set "USER_OPENAI_KEY="
set "MACHINE_OPENAI_KEY="
set "USER_OPENAI_MODEL="
set "MACHINE_OPENAI_MODEL="

for /f "tokens=2,*" %%A in ('reg query HKCU\Environment /v OPENAI_API_KEY 2^>nul') do set "USER_OPENAI_KEY=%%B"
for /f "tokens=2,*" %%A in ('reg query "HKLM\SYSTEM\CurrentControlSet\Control\Session Manager\Environment" /v OPENAI_API_KEY 2^>nul') do set "MACHINE_OPENAI_KEY=%%B"
for /f "tokens=2,*" %%A in ('reg query HKCU\Environment /v OPENAI_TRANSLATE_MODEL 2^>nul') do set "USER_OPENAI_MODEL=%%B"
for /f "tokens=2,*" %%A in ('reg query "HKLM\SYSTEM\CurrentControlSet\Control\Session Manager\Environment" /v OPENAI_TRANSLATE_MODEL 2^>nul') do set "MACHINE_OPENAI_MODEL=%%B"

if not defined OPENAI_API_KEY (
  if defined USER_OPENAI_KEY (
    set "OPENAI_API_KEY=%USER_OPENAI_KEY%"
  ) else (
    if defined MACHINE_OPENAI_KEY set "OPENAI_API_KEY=%MACHINE_OPENAI_KEY%"
  )
)

if not defined OPENAI_TRANSLATE_MODEL (
  if defined USER_OPENAI_MODEL (
    set "OPENAI_TRANSLATE_MODEL=%USER_OPENAI_MODEL%"
  ) else (
    if defined MACHINE_OPENAI_MODEL set "OPENAI_TRANSLATE_MODEL=%MACHINE_OPENAI_MODEL%"
  )
)

if not exist "node_modules\electron" (
  echo Installing desktop dependencies...
  call npm.cmd install
  if errorlevel 1 goto error
)

call npm.cmd run desktop
if errorlevel 1 goto error
exit /b 0

:error
echo.
echo Failed to start Spotify Sub.
echo Keep this window open and send the error text if you want me to fix it.
pause
exit /b 1
