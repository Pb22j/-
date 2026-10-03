@echo off
REM ============================================================
REM   Baseer Backend Setup
REM   Creates venv, installs deps, sets up .env
REM ============================================================

title Baseer Backend Setup

echo.
echo ===== Backend Setup =====
echo.

cd /d %~dp0

REM Step 1: Create venv if not exists
if not exist venv\ (
    echo [1/3] Creating virtual environment...
    python -m venv venv
    if errorlevel 1 (
        echo ERROR: Failed to create venv. Make sure Python is installed.
        pause
        exit /b 1
    )
) else (
    echo [1/3] Virtual environment already exists.
)

REM Step 2: Install dependencies
echo [2/3] Installing dependencies...
call venv\Scripts\activate.bat
python -m pip install --upgrade pip --quiet
pip install -r requirements.txt --quiet
if errorlevel 1 (
    echo ERROR: Failed to install dependencies.
    pause
    exit /b 1
)

REM Step 3: Create .env from example if not exists
if not exist .env (
    echo [3/3] Creating .env from .env.example...
    copy .env.example .env >nul
    echo.
    echo IMPORTANT: Edit backend\.env and add your API keys!
    echo   - GEMINI_API_KEY (required for AI chat)
    echo   - MINIMAX_API_KEY (optional, for voice STT)
) else (
    echo [3/3] .env file already exists.
)

echo.
echo ============================================================
echo   Setup complete!
echo   To run: python main.py
echo ============================================================
pause
