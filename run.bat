@echo off
set /p "startid=New Start ID: "
node "%~dp0\id.js" %startid% %*
pause