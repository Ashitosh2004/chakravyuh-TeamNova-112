@echo off
setlocal EnableExtensions EnableDelayedExpansion
set "ROOT=%~dp0"
cd /d "%ROOT%"
title CHAKRAVYUH Stop

echo Stopping CHAKRAVYUH processes (only ones started for this project)...

rem 1. Close the launcher windows created by Run.bat (exact titles).
taskkill /F /FI "WINDOWTITLE eq CHAKRAVYUH Backend*" >nul 2>nul
taskkill /F /FI "WINDOWTITLE eq CHAKRAVYUH Frontend*" >nul 2>nul

rem 2. Kill only processes whose command line references THIS project folder.
rem    Never terminates unrelated Python/Node applications.
powershell -NoProfile -ExecutionPolicy Bypass -Command "$root='%ROOT%'; $procs=Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -and $_.CommandLine -like ('*'+$root+'*') -and ($_.CommandLine -match 'uvicorn app.main' -or $_.CommandLine -match 'vite') }; foreach($p in $procs){ try{ Stop-Process -Id $p.ProcessId -Force -ErrorAction Stop; Write-Host ('  stopped PID ' + $p.ProcessId) }catch{} }"

rem 3. Also stop the cmd.exe wrappers hosting those window titles.
powershell -NoProfile -ExecutionPolicy Bypass -Command "$procs=Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -match 'CHAKRAVYUH (Backend|Frontend)' }; foreach($p in $procs){ try{ Stop-Process -Id $p.ProcessId -Force -ErrorAction Stop }catch{} }"

echo.
echo CHAKRAVYUH stopped.
pause
exit /b 0
