@echo off
setlocal

cd /d "%~dp0"

set "STATUS_FILE=%CD%\artifacts\dev-server.json"
if exist "%STATUS_FILE%" del "%STATUS_FILE%" >nul 2>nul
if not exist "%CD%\artifacts" mkdir "%CD%\artifacts" >nul 2>nul

set "NODE_EXE=node"
if exist "C:\Program Files\nodejs\node.exe" set "NODE_EXE=C:\Program Files\nodejs\node.exe"

start "Falling Sand Dev Server" /min cmd /c ""%NODE_EXE%" scripts\dev-server.mjs"

for /l %%i in (1,1,50) do (
  if exist "%STATUS_FILE%" goto open_url
  powershell -NoProfile -Command "Start-Sleep -Milliseconds 120" >nul 2>nul
)

echo Could not start the local server.
echo Please make sure Node.js is installed, then run:
echo node scripts\dev-server.mjs
pause
exit /b 1

:open_url
for /f "usebackq delims=" %%U in (`powershell -NoProfile -Command "(Get-Content '%STATUS_FILE%' -Raw | ConvertFrom-Json).url"`) do set "APP_URL=%%U"

if not defined APP_URL set "APP_URL=http://127.0.0.1:5173/index.html"

if exist "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe" (
  start "" "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe" "%APP_URL%"
  exit /b 0
)

if exist "C:\Program Files\Microsoft\Edge\Application\msedge.exe" (
  start "" "C:\Program Files\Microsoft\Edge\Application\msedge.exe" "%APP_URL%"
  exit /b 0
)

if exist "C:\Program Files\Google\Chrome\Application\chrome.exe" (
  start "" "C:\Program Files\Google\Chrome\Application\chrome.exe" "%APP_URL%"
  exit /b 0
)

start "" "%APP_URL%"
