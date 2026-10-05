@echo off
REM Portable launcher for Windows PCs without install rights.
REM Put the unzipped Node folder (node-v22.x-win-x64) next to this file, renamed to "node", or have node on PATH.
setlocal
cd /d "%~dp0"
if exist "%~dp0node\node.exe" set "PATH=%~dp0node;%PATH%"
where node >nul 2>nul || (echo Node.js not found. Unzip the Windows "Binary (.zip)" from nodejs.org into a folder named "node" here. & pause & exit /b 1)
if not exist node_modules (echo Installing dependencies... & call npm install --no-audit --no-fund || (pause & exit /b 1))
if not exist .env copy .env.example .env >nul
if not exist data\sites.json copy data\sites.example.json data\sites.json >nul
echo Starting SEO Desk on http://localhost:3040 (close this window to stop)
start "" http://localhost:3040
node --no-warnings src\server.js
pause
