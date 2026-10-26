@echo off
setlocal enabledelayedexpansion

cd /d "%~dp0"

:: -----------------------------------------------------------------------------
:: Locate Git Bash specifically (avoid Windows System32 / WSL bash)
:: -----------------------------------------------------------------------------
set "GIT_BASH="
if exist "%LOCALAPPDATA%\Programs\Git\bin\bash.exe" set "GIT_BASH=%LOCALAPPDATA%\Programs\Git\bin\bash.exe"
if "%GIT_BASH%"=="" if exist "%ProgramFiles%\Git\bin\bash.exe" set "GIT_BASH=%ProgramFiles%\Git\bin\bash.exe"
if "%GIT_BASH%"=="" if exist "%ProgramFiles(x86)%\Git\bin\bash.exe" set "GIT_BASH=%ProgramFiles(x86)%\Git\bin\bash.exe"
if "%GIT_BASH%"=="" (
    for /f "delims=" %%I in ('where git.exe 2^>nul') do (
        if "%GIT_BASH%"=="" (
            if exist "%%~dpI..\bin\bash.exe" set "GIT_BASH=%%~dpI..\bin\bash.exe"
            if exist "%%~dpI..\usr\bin\bash.exe" set "GIT_BASH=%%~dpI..\usr\bin\bash.exe"
            if exist "%%~dpIbash.exe" if not "%%~dpI"=="C:\Windows\System32\" set "GIT_BASH=%%~dpIbash.exe"
        )
    )
)

if not "%GIT_BASH%"=="" (
    "%GIT_BASH%" build.sh %*
    exit /b !ERRORLEVEL!
)

:: -----------------------------------------------------------------------------
:: Fallback: Pure CMD Execution (Zero PowerShell, Zero Admin)
:: -----------------------------------------------------------------------------
echo ==========================================================
echo    YAWPS Portable Build (CMD Fallback / Zero UAC)
echo ==========================================================

if not exist "%~dp0.tools" mkdir "%~dp0.tools"

:: 1. Locate Portable Go (.tools\go)
set "GO_BIN="
set "GOROOT="

if exist "%~dp0.tools\go\bin\go.exe" (
    set "GO_BIN=%~dp0.tools\go\bin\go.exe"
    set "GOROOT=%~dp0.tools\go"
) else if exist "%~dp0.tools\go\go\bin\go.exe" (
    set "GO_BIN=%~dp0.tools\go\go\bin\go.exe"
    set "GOROOT=%~dp0.tools\go\go"
)

if "%GO_BIN%"=="" (
    echo [-] ERROR: Portable Go was not found in .tools\go\ !
    echo     Please download the official 64-bit Windows Go zip from:
    echo     https://go.dev/dl/ (e.g. go1.22.x.windows-amd64.zip)
    echo     and extract it into the '.tools\go' folder.
    exit /b 1
)

echo [+] Using Portable Go: %GO_BIN%
set "PATH=%GOROOT%\bin;%PATH%"

:: 2. Locate Portable Wails (.tools\wails)
set "WAILS_BIN="
set "WAILS_DIR="
if exist "%~dp0.tools\wails\bin\wails.exe" (
    set "WAILS_BIN=%~dp0.tools\wails\bin\wails.exe"
    set "WAILS_DIR=%~dp0.tools\wails\bin"
) else if exist "%~dp0.tools\wails\wails.exe" (
    set "WAILS_BIN=%~dp0.tools\wails\wails.exe"
    set "WAILS_DIR=%~dp0.tools\wails"
)

if "%WAILS_BIN%"=="" (
    echo [!] Portable Wails CLI not found in .tools\wails.
    echo [*] Compiling Wails CLI locally using portable Go (zero UAC)...
    set "GOPATH=%~dp0.tools\wails"
    "%GO_BIN%" install github.com/wailsapp/wails/v2/cmd/wails@v2.17.0
    if exist "%~dp0.tools\wails\bin\wails.exe" (
        set "WAILS_BIN=%~dp0.tools\wails\bin\wails.exe"
        set "WAILS_DIR=%~dp0.tools\wails\bin"
        echo [+] Successfully built portable Wails: !WAILS_BIN!
    ) else (
        echo [-] ERROR: Failed to compile Wails CLI. You may place pre-built wails.exe into .tools\wails\bin\.
        exit /b 1
    )
) else (
    echo [+] Using Portable Wails: %WAILS_BIN%
)

set "PATH=%WAILS_DIR%;%PATH%"

:: 3. Execute Wails Build
echo [*] Building YAWPS desktop executable (windows/amd64)...
"%WAILS_BIN%" build -platform windows/amd64 %*
if errorlevel 1 (
    echo [-] ERROR: Wails build failed.
    exit /b %ERRORLEVEL%
)

:: 4. Copy Output Binary to dist\
if exist "%~dp0build\bin\yawps.exe" (
    if not exist "%~dp0dist" mkdir "%~dp0dist"
    copy /Y "%~dp0build\bin\yawps.exe" "%~dp0dist\yawps.exe" >nul
    echo ==========================================================
    echo [+] Build Successful!
    echo     Output executable: dist\yawps.exe
    echo ==========================================================
) else (
    echo [-] ERROR: Build finished but build\bin\yawps.exe was not found.
    exit /b 1
)

endlocal
