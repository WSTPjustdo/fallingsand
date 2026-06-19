@echo off
setlocal

set "APP_DIR=%~dp0index11_modular"
if not exist "%APP_DIR%\open-modular-simulator.bat" (
  echo Modular version was not found:
  echo %APP_DIR%
  pause
  exit /b 1
)

call "%APP_DIR%\open-modular-simulator.bat"
