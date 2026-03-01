@echo off
setlocal EnableDelayedExpansion
title Rabbit Alley POS - Launcher

:: ============================================================
::  Rabbit Alley POS - Start Script
::  Starts the API server + frontend dev server,
::  then opens the app in Brave / Chrome / Edge / default browser
:: ============================================================

cd /d "%~dp0"

echo.
echo  =========================================
echo   Rabbit Alley Garden Bar ^& Bistro POS
echo  =========================================
echo.

:: ---- Check Node.js ----
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo  [ERROR] Node.js is not installed or not in PATH.
    echo          Download it at: https://nodejs.org
    echo.
    pause
    exit /b 1
)

:: ---- Install root dependencies if needed ----
if not exist "node_modules" (
    echo  [SETUP] Installing frontend dependencies...
    call npm install
    if %errorlevel% neq 0 (
        echo  [ERROR] npm install failed.
        pause
        exit /b 1
    )
    echo  [OK] Frontend dependencies installed.
    echo.
)

:: ---- Install server dependencies if needed ----
if not exist "server\node_modules" (
    echo  [SETUP] Installing server dependencies...
    cd server
    call npm install
    if %errorlevel% neq 0 (
        echo  [ERROR] Server npm install failed.
        pause
        exit /b 1
    )
    cd ..
    echo  [OK] Server dependencies installed.
    echo.
)

:: ---- Check server/.env ----
if not exist "server\.env" (
    echo  [SETUP] server\.env not found - copying from .env.example...
    copy "server\.env.example" "server\.env" >nul
    echo  [WARN] Please edit server\.env and set your MySQL password if needed.
    echo.
)

:: ---- Read API port from server/.env (default 8000) ----
set "API_PORT=8000"
for /f "usebackq tokens=1,2 delims==" %%A in ("server\.env") do (
    if "%%A"=="PORT" set "API_PORT=%%B"
)
:: Trim spaces from port value
set "API_PORT=%API_PORT: =%"

:: ---- Read Vite port (default 5173) ----
set "VITE_PORT=5173"

echo  [INFO] API server port : %API_PORT%
echo  [INFO] Frontend port   : %VITE_PORT%
echo.

:: ---- Start API Server in a new window ----
echo  [START] Launching API server...
start "Rabbit Alley - API Server" cmd /k "cd /d %~dp0server && node index.js"

:: ---- Start Vite Frontend in a new window ----
echo  [START] Launching frontend dev server...
start "Rabbit Alley - Frontend" cmd /k "cd /d %~dp0 && npm run dev"

:: ---- Wait for servers to warm up ----
echo.
echo  [WAIT] Waiting for servers to start (5 seconds)...
timeout /t 5 /nobreak >nul

:: ---- Open in Brave, Chrome, Edge, or fallback ----
set "APP_URL=http://localhost:%VITE_PORT%"

echo  [BROWSER] Opening %APP_URL%
echo.

:: Try Brave first
set "BRAVE=%LOCALAPPDATA%\BraveSoftware\Brave-Browser\Application\brave.exe"
if exist "%BRAVE%" (
    echo  [OK] Launching Brave Browser...
    start "" "%BRAVE%" --new-window "%APP_URL%"
    goto :DONE
)

:: Try Chrome
set "CHROME=%PROGRAMFILES%\Google\Chrome\Application\chrome.exe"
if exist "%CHROME%" (
    echo  [OK] Launching Google Chrome...
    start "" "%CHROME%" --new-window "%APP_URL%"
    goto :DONE
)
set "CHROME=%PROGRAMFILES(X86)%\Google\Chrome\Application\chrome.exe"
if exist "%CHROME%" (
    echo  [OK] Launching Google Chrome (x86)...
    start "" "%CHROME%" --new-window "%APP_URL%"
    goto :DONE
)

:: Try Edge
set "EDGE=%PROGRAMFILES(X86)%\Microsoft\Edge\Application\msedge.exe"
if exist "%EDGE%" (
    echo  [OK] Launching Microsoft Edge...
    start "" "%EDGE%" --new-window "%APP_URL%"
    goto :DONE
)
set "EDGE=%PROGRAMFILES%\Microsoft\Edge\Application\msedge.exe"
if exist "%EDGE%" (
    echo  [OK] Launching Microsoft Edge...
    start "" "%EDGE%" --new-window "%APP_URL%"
    goto :DONE
)

:: Fallback - open with default browser
echo  [OK] Opening in default browser...
start "" "%APP_URL%"

:DONE
echo.
echo  =========================================
echo   Rabbit Alley POS is running!
echo.
echo   App  : %APP_URL%
echo   API  : http://localhost:%API_PORT%
echo.
echo   Close the two console windows to stop.
echo  =========================================
echo.
pause
endlocal
