@echo off
title AI Trend News Bot - Homelab 24/7
color 0b
echo ====================================================
echo     AI TREND NEWS BOT - HOMELAB RUNNER 24/7
echo ====================================================
echo.

echo [*] Dang kiem tra Node.js...
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [!] Chua tim thay Node.js. Vui long cai dat Node.js v18 tro len!
    pause
    exit /b
)

echo [*] Khoi dong Server Dashboard V2 tai cong 4000...
echo [*] Mo trinh duyet: http://localhost:4000
echo.
node dashboard.js

pause
