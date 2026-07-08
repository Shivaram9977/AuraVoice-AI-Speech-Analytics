@echo off
title AuraVoice AI - Setup and Run Script
echo =====================================================================
echo               AuraVoice AI Speech Coach Setup ^& Launch
echo =====================================================================
echo.

set PYTHON_CMD=python
python --version >nul 2>&1
if %errorlevel% neq 0 (
    if exist "%USERPROFILE%\AppData\Local\Programs\Python\Python312\python.exe" (
        set PYTHON_CMD="%USERPROFILE%\AppData\Local\Programs\Python\Python312\python.exe"
    ) else if exist "%USERPROFILE%\AppData\Local\Programs\Python\Python311\python.exe" (
        set PYTHON_CMD="%USERPROFILE%\AppData\Local\Programs\Python\Python311\python.exe"
    ) else if exist "%USERPROFILE%\AppData\Local\Programs\Python\Python310\python.exe" (
        set PYTHON_CMD="%USERPROFILE%\AppData\Local\Programs\Python\Python310\python.exe"
    ) else (
        echo [ERROR] Python was not found on your system!
        echo Please download and install Python from: https://www.python.org/downloads/
        echo.
        echo IMPORTANT: Make sure to check the option "Add Python to PATH" during installation.
        echo.
        pause
        exit /b
    )
)

echo [INFO] Python detected successfully.
echo.

:: Check for virtual environment folder
if exist ".venv" goto venv_exists
echo [INFO] Creating Python virtual environment venv...
%PYTHON_CMD% -m venv .venv
if %errorlevel% neq 0 (
    echo [ERROR] Failed to create virtual environment!
    pause
    exit /b
)
echo [INFO] Virtual environment created successfully.
echo.
:venv_exists

:: Activate the virtual environment
echo [INFO] Activating virtual environment...
call .venv\Scripts\activate
if %errorlevel% neq 0 (
    echo [ERROR] Failed to activate virtual environment!
    pause
    exit /b
)
echo.

:: Install dependencies
echo [INFO] Installing required libraries from requirements.txt...
echo This might take a couple of minutes on first run. Please wait...
python -m pip install --upgrade pip >nul
pip install -r requirements.txt
if %errorlevel% neq 0 (
    echo [ERROR] Dependencies installation failed!
    pause
    exit /b
)
echo [INFO] Libraries installed successfully.
echo.

:: Download NLTK models
echo [INFO] Downloading required NLP Models (NLTK data)...
python -c "import nltk; nltk.download('punkt', quiet=True); nltk.download('vader_lexicon', quiet=True); nltk.download('stopwords', quiet=True)"
if %errorlevel% neq 0 (
    echo [WARNING] NLTK models could not download automatically. Heuristic backup will be used.
) else (
    echo [INFO] NLP models downloaded successfully.
)
echo.

echo =====================================================================
echo        Setup Complete! Launching FastAPI Server at http://127.0.0.1:8000
echo =====================================================================
echo.
python main.py
pause
