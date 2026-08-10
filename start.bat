@echo off
title STEMazing Tank Arena
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo   Node.js is niet gevonden. Installeer het eerst via https://nodejs.org
  echo.
  pause
  exit /b 1
)

if not exist node_modules (
  echo.
  echo   Eerste keer opstarten: pakketten installeren, even geduld...
  echo.
  call npm install
)

echo.
node server.js
pause
