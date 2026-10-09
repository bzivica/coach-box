
@echo off
title Coach-Box - Dev Server
cd /d C:\Projekti\Coach-Box\coach-box

echo ========================================
echo  Coach-Box - Dev Server
echo ========================================
echo.
echo URL: http://localhost:5173/
echo Import CZ.BASKETBALL: pomocny server na portu 4179
echo.
echo Otevre se druhe okno pro nacitani soupisek. Nezavirej ho, dokud pouzivas import.
echo.

start "Coach-Box - CZ.BASKETBALL import" cmd /k "cd /d C:\Projekti\Coach-Box\coach-box && node server\cz-basketball-server.mjs"
call npm run dev

echo.
echo Server skoncil.
pause

