@echo off
title Cloudflare Tunnel - Remote Dashboard
color 0a
echo ====================================================
echo      CLOUDFLARE TUNNEL - REMOTE ACCESS
echo ====================================================
echo.

if not exist cloudflared.exe (
    echo [*] Dang tai cloudflared.exe tu Cloudflare ve may...
    powershell -Command "[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; Invoke-WebRequest -Uri 'https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe' -OutFile 'cloudflared.exe'"
    if not exist cloudflared.exe (
        echo [!] Khong the tai tu dong. Vui long kiem tra ket noi mang.
        pause
        exit /b
    )
    echo [*] Tai thanh cong cloudflared.exe!
)

echo [*] Dang ket noi Cloudflare Tunnel qua giao thuc HTTP/2...
echo.
echo =========================================================================
echo   LUU Y: Link truy cap tu xa https://xxx.trycloudflare.com se xuat hien
echo   o cac dong DAU TIEN. Neu bi bang kiem tra PRE-CHECKS day xuong,
echo   ban hay CUON CHUOT LEN PHIA TREN cua cua so de copy link nhe!
echo =========================================================================
echo.
cloudflared.exe tunnel --protocol http2 --url http://localhost:4000

pause
