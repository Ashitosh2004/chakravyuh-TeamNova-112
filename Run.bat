@echo off
setlocal EnableExtensions EnableDelayedExpansion
set "ROOT=%~dp0"
cd /d "%ROOT%"

title CHAKRAVYUH Launcher

echo ============================================================
echo   CHAKRAVYUH - Smart ENTC Learning ^& Innovation Platform
echo   Starting backend (FastAPI + MongoDB) and frontend (Vite)
echo ============================================================
echo.

set "BACKEND_DIR=%ROOT%backend"
set "VENV_PY=%BACKEND_DIR%\.venv\Scripts\python.exe"
set "BACKEND_URL=http://127.0.0.1:8000"
set "FRONTEND_URL=http://127.0.0.1:5173"

rem ---------------------------------------------------------- 1. Python
set "PY_CMD="
where python >nul 2>nul && set "PY_CMD=python"
if not defined PY_CMD (
  where py >nul 2>nul && set "PY_CMD=py -3"
)
if not defined PY_CMD (
  echo [ERROR] Python was not found. Install Python 3.11 or newer from
  echo         https://www.python.org/downloads/ and re-run Run.bat.
  goto :fail
)
for /f "tokens=2" %%v in ('%PY_CMD% -c "import sys; print(sys.version_info.major, sys.version_info.minor)"') do set "PYVER=%%v"
for /f %%v in ('%PY_CMD% -c "import sys; print(sys.version_info.minor)"') do set "PYMINOR=%%v"
for /f %%v in ('%PY_CMD% -c "import sys; print(sys.version_info.major)"') do set "PYMAJOR=%%v"
if %PYMAJOR% LSS 3 goto :python_too_old
if %PYMAJOR% EQU 3 if %PYMINOR% LSS 11 goto :python_too_old
echo [OK] Python found.

rem ---------------------------------------------------------- 2. Node.js
where node >nul 2>nul || (
  echo [ERROR] Node.js was not found. Install Node.js 18+ from
  echo         https://nodejs.org/ and re-run Run.bat.
  goto :fail
)
where npm >nul 2>nul || (
  echo [ERROR] npm was not found. Install Node.js 18+ from https://nodejs.org/.
  goto :fail
)
echo [OK] Node.js and npm found.

rem ---------------------------------------------------------- 3. Backend venv + deps
if not exist "%VENV_PY%" (
  echo [..] Creating Python virtual environment...
  %PY_CMD% -m venv "%BACKEND_DIR%\.venv" || (
    echo [ERROR] Failed to create the virtual environment.
    goto :fail
  )
)
"%VENV_PY%" -c "import fastapi, pymongo, uvicorn" >nul 2>nul || (
  echo [..] Installing backend dependencies ^(first run takes a few minutes^)...
  "%VENV_PY%" -m pip install --quiet --upgrade pip || goto :fail
  "%VENV_PY%" -m pip install --quiet -r "%BACKEND_DIR%\requirements.txt" || (
    echo [ERROR] Backend dependency installation failed. Check your internet connection.
    goto :fail
  )
)
echo [OK] Backend dependencies ready.

rem ---------------------------------------------------------- 4. Frontend deps
if not exist "%ROOT%node_modules" (
  echo [..] Installing frontend dependencies ^(first run takes a few minutes^)...
  pushd "%ROOT%"
  call npm install || (
    echo [ERROR] npm install failed. Check your internet connection.
    popd
    goto :fail
  )
  popd
)
echo [OK] Frontend dependencies ready.

rem ---------------------------------------------------------- 5. Environment files
if not exist "%BACKEND_DIR%\.env" (
  copy "%BACKEND_DIR%\.env.example" "%BACKEND_DIR%\.env" >nul
  echo [NOTE] Created backend\.env from the example template.
  echo        Review it to configure MongoDB Atlas, the AI provider, or email.
)
if not exist "%ROOT%\.env" (
  copy "%ROOT%.env.example" "%ROOT%.env" >nul
  echo [NOTE] Created .env ^(frontend API URL^) from the example template.
)

rem ---------------------------------------------------------- 6. Port conflicts
call :port_pid 8000
set "BACK_PID=!PORT_PID!"
if defined BACK_PID (
  curl -s -m 2 %BACKEND_URL%/health 2>nul | findstr /C:"CHAKRAVYUH" >nul
  if !errorlevel! EQU 0 (
    echo [NOTE] The CHAKRAVYUH backend is already running on port 8000 - keeping it.
    goto :backend_up
  )
  echo [ERROR] Port 8000 is used by another program ^(PID !BACK_PID!^).
  echo         Close that program or change API_PORT in backend\.env, then re-run.
  goto :fail
)
call :port_pid 5173
if defined PORT_PID (
  echo [ERROR] Port 5173 is used by another program ^(PID !PORT_PID!^).
  echo         Close that program, then re-run.
  goto :fail
)

rem ---------------------------------------------------------- 7. MongoDB check
echo [..] Checking MongoDB connection...
pushd "%BACKEND_DIR%"
"%VENV_PY%" -m app.seed --check >nul 2>nul
if not !errorlevel! EQU 0 (
  popd
  echo.
  echo [ERROR] MongoDB is not reachable.
  echo.
  echo   The app stores all data in MongoDB and cannot start without it.
  echo   Fix it with one of these options:
  echo.
  echo   1. Local MongoDB installed as a Windows service:
  echo        open an ADMIN terminal and run:   net start MongoDB
  echo.
  echo   2. MongoDB running manually:
  echo        start mongod, e.g.:  "C:\Program Files\MongoDB\Server\8.0\bin\mongod.exe" --dbpath C:\data\db
  echo.
  echo   3. MongoDB Atlas ^(cloud^): set MONGODB_URI in backend\.env to your
  echo      Atlas connection string, e.g.
  echo        MONGODB_URI=mongodb+srv://USER:PASSWORD@cluster0.xxxxx.mongodb.net/
  echo.
  goto :fail
)
popd
echo [OK] MongoDB is reachable.

rem ---------------------------------------------------------- 8. Initialize DB content
echo [..] Initializing indexes and curriculum content (idempotent)...
pushd "%BACKEND_DIR%"
"%VENV_PY%" -m app.seed
if not !errorlevel! EQU 0 (
  popd
  echo [ERROR] Database initialization failed.
  goto :fail
)
popd
echo [OK] Database ready.

rem ---------------------------------------------------------- 9. Start backend
echo [..] Starting the FastAPI backend in a new window...
pushd "%BACKEND_DIR%"
start "CHAKRAVYUH Backend" cmd /k ""%VENV_PY%" -m uvicorn app.main:app --host 127.0.0.1 --port 8000"
popd

echo [..] Waiting for the backend health endpoint...
call :wait_url "%BACKEND_URL%/health" 40
if not !errorlevel! EQU 0 (
  echo [ERROR] The backend did not become healthy in time.
  echo         Check the CHAKRAVYUH Backend window for the error output.
  goto :fail
)

call :wait_url "%BACKEND_URL%/ready" 20
if not !errorlevel! EQU 0 (
  echo [ERROR] The backend is running but MongoDB is not reachable (readiness failed).
  echo         Start MongoDB ^(see instructions above^) and re-run Run.bat.
  goto :fail
)
echo [OK] Backend is up and ready:   %BACKEND_URL%   (API docs: %BACKEND_URL%/docs)

:backend_up
rem ---------------------------------------------------------- 10. Start frontend
echo [..] Starting the Vite frontend in a new window...
pushd "%ROOT%"
start "CHAKRAVYUH Frontend" cmd /k "npm run dev -- --host 127.0.0.1 --port 5173"
popd

echo [..] Waiting for the frontend dev server...
call :wait_url "%FRONTEND_URL%" 60
if not !errorlevel! EQU 0 (
  echo [ERROR] The frontend did not start in time.
  echo         Check the CHAKRAVYUH Frontend window for the error output.
  goto :fail
)
echo [OK] Frontend is up:            %FRONTEND_URL%

rem ---------------------------------------------------------- 11. Open browser
start "" "%FRONTEND_URL%"

echo.
echo ============================================================
echo   CHAKRAVYUH is running!
echo.
echo   Frontend:      %FRONTEND_URL%
echo   Backend API:   %BACKEND_URL%
echo   API docs:      %BACKEND_URL%/docs
echo   Health:        %BACKEND_URL%/health
echo   Readiness:     %BACKEND_URL%/ready
echo.
echo   Keep the two server windows open. To stop everything,
echo   run Stop.bat or simply close both server windows.
echo ============================================================
echo.
pause
exit /b 0

rem ---------------------------------------------------------- helpers

:python_too_old
echo [ERROR] Python 3.11 or newer is required (found an older version).
echo         Install it from https://www.python.org/downloads/ and re-run Run.bat.
goto :fail

:port_pid
rem %1 = port; sets PORT_PID to the listening PID or clears it
set "PORT_PID="
for /f "tokens=5" %%p in ('netstat -ano ^| findstr /R /C:":%1 .*LISTENING"') do (
  if not defined PORT_PID set "PORT_PID=%%p"
)
exit /b 0

:wait_url
rem %1 = url, %2 = max seconds; returns 0 when the URL responds (single line: batch-safe)
powershell -NoProfile -ExecutionPolicy Bypass -Command "$d=(Get-Date).AddSeconds(%2); while((Get-Date) -lt $d){ try{ Invoke-WebRequest -UseBasicParsing -Uri '%~1' -TimeoutSec 2 | Out-Null; exit 0 }catch{ Start-Sleep -Milliseconds 600 } }; exit 1"
exit /b !errorlevel!

:fail
echo.
echo [FAILED] CHAKRAVYUH did not start. Fix the problem above and re-run Run.bat.
echo.
pause
exit /b 1
