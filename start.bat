@echo off
echo ============================================
echo    Diep.io RPG Multiplayer Game Server
echo ============================================
echo.

echo Checking if Node.js is installed...
node --version >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: Node.js is not installed or not in PATH
    echo Please install Node.js from https://nodejs.org/
    echo.
    pause
    exit /b 1
)

echo Node.js found! Version:
node --version

echo.
echo Checking for package.json...
if not exist package.json (
    echo ERROR: package.json not found
    echo Please ensure all game files are in the same directory
    echo.
    pause
    exit /b 1
)

echo.
echo Installing/checking dependencies...
call npm install

if %ERRORLEVEL% NEQ 0 (
    echo ERROR: Failed to install dependencies
    echo.
    pause
    exit /b 1
)

echo.
echo ============================================
echo Starting Diep.io RPG Server...
echo ============================================
echo.
echo Server will start on http://localhost:3000
echo Open this URL in your web browser to play!
echo.
echo Press Ctrl+C to stop the server
echo ============================================
echo.

call npm start

pause