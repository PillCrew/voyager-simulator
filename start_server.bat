@echo off
cd /d "%~dp0"
echo.
echo  Voyager Simulator - local development server
echo  ------------------------------------------------
echo  Opening http://localhost:8000 in your browser.
echo  Press Ctrl+C to stop the server.
echo.

where py >nul 2>nul
if %errorlevel%==0 (
  py -m http.server 8000
  goto :eof
)

where node >nul 2>nul
if %errorlevel%==0 (
  node server.js
  goto :eof
)

echo.
echo ERROR: Python (py) or Node.js is required to run the local server.
echo Install Python from https://www.python.org or Node.js from https://nodejs.org.
pause
