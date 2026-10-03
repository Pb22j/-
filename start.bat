@echo off
REM ============================================================
REM   بصير (Baseer) - Hackathon Project Startup
REM   Starts the Backend (FastAPI) and the Frontend (Vite).
REM   The frontend runs standalone without the backend.
REM ============================================================

title Baseer Project Startup

echo.
echo ============================================================
echo   بصير - Saudi Stock Market Simulator
echo   Starting Backend + Frontend...
echo ============================================================
echo.

set "ROOT_DIR=%~dp0"

REM ===== Data (only if the JSON is missing) =====
if not exist "%ROOT_DIR%frontend\public\data\market_data.json" (
  echo [0/2] Building market data from TasiStocks/*.xlsx ...
  pushd "%ROOT_DIR%"
  python scripts\process_data.py
  popd
  echo.
)

REM ===== Backend (optional) =====
echo [1/2] Starting Backend (FastAPI on port 8000)...
start "Baseer Backend" cmd /k "cd /d %ROOT_DIR%backend && python main.py"

REM ===== Frontend =====
echo [2/2] Starting Frontend (Vite on port 5173)...
ping -n 4 127.0.0.1 >nul
start "Baseer Frontend" cmd /k "cd /d %ROOT_DIR%frontend && npm run dev"

echo.
echo ============================================================
echo   Project is now running:
echo   - Frontend App:  http://localhost:5173
echo   - Backend API:   http://localhost:8000
echo   - API Docs:      http://localhost:8000/docs
echo.
echo   The app works fully without the backend.
echo   Press any key in the terminal running this script
echo   if you want to stop the backend window.
echo ============================================================
echo.
pause >nul
