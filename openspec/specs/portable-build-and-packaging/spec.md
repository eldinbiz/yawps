# Portable Build and Packaging Specification

## Purpose

Compile standalone `windows/amd64` Go/Wails executables with zero UAC using portable toolchains in `.tools/`, package Electron portable and NSIS installers with Windows 10+ and uninstall hooks, automate Windows artifact builds in GitHub Actions, and maintain repository ignore/documentation conventions.

## Requirements

### Requirement: Zero-UAC Portable Go and Wails Build Scripts

`build.sh` and `build.cmd` SHALL compile `dist/yawps.exe` (`windows/amd64`) using a user-extracted portable Go toolchain under `.tools/go/` and a portable Wails CLI (`v2.17.0`) under `.tools/wails/` without administrator rights or global system installs.

#### Scenario: Portable Build Succeeds With Local Go Toolchain

- **WHEN** `.tools/go/bin/go.exe` exists and the user runs `./build.sh` or `build.cmd` on Windows
- **THEN** Wails CLI `v2.17.0` is resolved or compiled under `.tools/wails` (`GOPATH` = `.tools/wails`), `wails build -platform windows/amd64` runs with forwarded flags (such as `-upx`), and `build/bin/yawps.exe` is copied to `dist/yawps.exe`

#### Scenario: CMD Fallback Without Invoking System32 Bash or PowerShell

- **WHEN** `build.cmd` runs on a machine without Git Bash (`%LOCALAPPDATA%\Programs\Git\bin\bash.exe`, `%ProgramFiles%\Git\bin\bash.exe`, `%ProgramFiles(x86)%\Git\bin\bash.exe`, or `where git.exe` excluding `C:\Windows\System32\bash.exe`)
- **THEN** `build.cmd` executes its pure CMD fallback without invoking PowerShell

#### Scenario: Missing Portable Go Aborts Build Clearly

- **WHEN** neither `.tools/go/bin/go.exe` nor `.tools/go/go/bin/go.exe` exists
- **THEN** `build.sh` and `build.cmd` print extraction instructions for `.tools/go` (note messages still mention `go1.22.x` while `go.mod` specifies `go 1.27.0`) and exit with status `1`
- **AND** `package.json` exposes `build:wails` (`build.cmd`), `build:wails:upx`, and `dist:wails` (`build.cmd -upx`)

### Requirement: Wails Application Metadata and Zero-UAC DPI Manifest

Wails packaging SHALL embed `src/gui/renderer` without a frontend bundler (`wails.json`), populate PE version resources (`build/windows/info.json`), and apply `build/windows/wails.exe.manifest` declaring Common-Controls v6 and `permonitorv2,permonitor` DPI awareness without requesting UAC elevation.

#### Scenario: Wails Config Embeds Vanilla Renderer Assets

- **WHEN** Wails builds the `windows/amd64` target using `wails.json`
- **THEN** `frontend:install` and `frontend:build` are skipped, `src/gui/renderer` is embedded into the binary, and PE metadata uses `productName: "YAWPS - Yet Another Windows PHP Switcher"` and `productVersion: "0.1.0"`

### Requirement: Electron Portable and NSIS Packaging With Windows Hooks

`package.json` and `build/installer.nsh` SHALL configure `electron-builder` (`appId: com.yawps.switcher`, `productName: YAWPS`, `directories.output: dist`, `win.icon: build/windows/icon.ico`, `win.target: portable x64`, `nsis` optional) and enforce Windows 10+ checks and uninstall cleanup prompts in NSIS.

#### Scenario: NSIS Installer Blocks Pre-Windows-10 Hosts

- **WHEN** the NSIS installer executes `customInit` on Windows 8.1 or older
- **THEN** `${AtLeastWin10}` fails, displays an error `MessageBox` requiring Windows 10 or 11, and terminates via `Quit`

#### Scenario: NSIS Uninstaller Offers PATH and Data Cleanup

- **WHEN** the NSIS uninstaller executes `customUnInstall`
- **THEN** it prompts separately to unlink `%USERPROFILE%\.yawps\current` and `%USERPROFILE%\.win-php\current` from User `PATH` via `powershell.exe` + `Remove-Item -Force` and to `RMDir /r` `$PROFILE\.yawps` and `$PROFILE\.win-php`

#### Scenario: Lockfile Parity Note

- **WHEN** running `npm ci` against `package.json` and `package-lock.json`
- **THEN** `package-lock.json` retains an unused root devDependency entry (`chalk ^6.0.1`) absent from `package.json`

### Requirement: GitHub Actions Windows Portable Build Workflow

`.github/workflows/build-windows.yml` SHALL provide a manual `workflow_dispatch` pipeline (`build_electron` boolean default `false`, `retention_days` default `"14"`) on `windows-latest` that verifies `go vet ./...`, builds `yawps.exe`, smoke-tests `--version`, optionally builds the Electron portable executable, and uploads `.exe`, `.zip`, and `.sha256` artifacts.

#### Scenario: Default Wails-Only CI Dispatch

- **WHEN** `build-windows.yml` runs with `build_electron: false`
- **THEN** `build-wails` runs `go vet ./...`, installs `wails@v2.17.0`, builds `wails build -clean -platform windows/amd64 -trimpath`, asserts `yawps.exe --version` exits `0`, packages `yawps.exe`, `yawps-v0.1.0-windows-amd64-wails.zip`, and `yawps-wails-windows-amd64.sha256`, and skips `build-electron`

#### Scenario: Optional Electron Portable CI Build

- **WHEN** `build-windows.yml` runs with `build_electron: true`
- **THEN** `build-electron` sets up Node `24`, runs `npm ci`, smoke-tests `node bin/yawps.js --version`, executes `npx electron-builder --win portable --x64` (`CSC_IDENTITY_AUTO_DISCOVERY=false`), and uploads the portable `.exe`, `.zip`, and `.sha256` checksums

### Requirement: Repository Ignore Rules, Documentation and Test Baseline

`.gitignore` SHALL exclude `/build/bin/`, `/dist/`, `/.tools/`, `node_modules/`, and compiled binaries while preserving `build/appicon.png` and `build/windows/*`, and the baseline codebase SHALL remain documented as having zero automated tests.

#### Scenario: Cross-Platform Static Checks Pass Without Automated Test Files

- **WHEN** `GOOS=windows GOARCH=amd64 go vet ./...` and `GOOS=windows GOARCH=amd64 go test ./...` run in the repository root
- **THEN** `go vet` exits `0` cleanly and `go test` reports `[no test files]` across `yawps`, `yawps/pkg/cli`, and `yawps/pkg/core` (and `package.json` defines no `"test"` script)

#### Scenario: README.md Baseline Documentation Scope

- **WHEN** inspecting `README.md` against the codebase
- **THEN** `README.md` documents YAWPS capabilities, Windows 10/11 + WebView2 + zero-UAC requirements, and portable/global Wails builds (`dist\yawps.exe`), while omitting the Node/Electron runtime, `YAWPS_HOME`/`WIN_PHP_HOME`/`.win-php` precedence, and the `window.api` bridge
