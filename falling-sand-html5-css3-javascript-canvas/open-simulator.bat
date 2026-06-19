@echo off
setlocal

set "HTML_FILE=%~dp0index.html"

if exist "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe" (
  start "" "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe" "%HTML_FILE%"
  goto :eof
)

if exist "C:\Program Files\Microsoft\Edge\Application\msedge.exe" (
  start "" "C:\Program Files\Microsoft\Edge\Application\msedge.exe" "%HTML_FILE%"
  goto :eof
)

if exist "C:\Program Files\Google\Chrome\Application\chrome.exe" (
  start "" "C:\Program Files\Google\Chrome\Application\chrome.exe" "%HTML_FILE%"
  goto :eof
)

start "" "%HTML_FILE%"
