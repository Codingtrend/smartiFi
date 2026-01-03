@echo off
setlocal enabledelayedexpansion
set OUTPUT=%~dp0System_Details.txt

if exist "%OUTPUT%" del "%OUTPUT%"

REM Get MAC Address (first physical address)
for /f "tokens=2 delims=:" %%A in ('getmac /fo list ^| find /i "Physical Address"') do (
    set TMP=%%A
    set TMP=!TMP: =!
    if defined TMP if not "!TMP!"=="N/A" (
       set MAC=!TMP!
       goto :macFound
    )
)
:macFound
echo MAC Address: !MAC!>>"%OUTPUT%"

REM Get Make/Model
for /f "skip=1 tokens=* delims=" %%A in ('wmic computersystem get model') do (
    if not "%%A"=="" (
        set MODEL=%%A
        goto :gotModel
    )
)
:gotModel
echo Make / Model Number: !MODEL!>>"%OUTPUT%"

REM Get Serial Number
for /f "skip=1 tokens=* delims=" %%A in ('wmic bios get serialnumber') do (
    if not "%%A"=="" (
        set SERIAL=%%A
        goto :gotSerial
    )
)
:gotSerial
echo Serial Number: !SERIAL!>>"%OUTPUT%"

echo.
echo System details saved to "%OUTPUT%"
pause
notepad "%OUTPUT%"
exit /b 0
