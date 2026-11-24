# Platform Runtime and Storage Specification

## Purpose

Enforce Windows 10 and Windows 11 execution requirements, route GUI and CLI invocations across both the Go/Wails and Node/Electron runtimes, resolve zero-UAC user storage paths (including legacy `.win-php` compatibility), and unify the frontend `window.api` bridge and Explorer folder helper.

## Requirements

### Requirement: Windows 10+ OS Compatibility Gate

Both runtimes MUST verify that the host operating system is Windows 10 or Windows 11 (`major >= 10`) before executing CLI subcommands or launching the desktop UI, classifying `major == 10 && build >= 22000` as Windows 11 and `major == 10 && build < 22000` as Windows 10.

#### Scenario: Supported Windows 10 or Windows 11 Host

- **WHEN** `GetWindowsVersionInfo` / `getWindowsVersionInfo` inspects a Windows host with kernel `10.0.19045` or `10.0.22631`
- **THEN** it returns `isWindows: true` and `isSupported: true`
- **AND** it sets `osName` to `"Windows 10"` for `build < 22000` and `"Windows 11"` for `build >= 22000`

#### Scenario: Unsupported Windows Version or Non-Windows Host Aborts Startup

- **WHEN** `AssertWindows10OrAbove` / `assertWindows10OrAbove` detects `isSupported == false` (such as Windows 8.1 `6.3` or Linux on Node)
- **THEN** it prints a boxed `UNSUPPORTED OPERATING SYSTEM` banner and error details to `stderr`
- **AND** when running in GUI mode it displays a native error dialog (`user32.dll!MessageBoxW` in Go, Electron `dialog.showErrorBox` or PowerShell `System.Windows.Forms.MessageBox` fallback in Node)
- **AND** CLI invocations exit immediately with code `1`

#### Scenario: Runtime Parity — Go RtlGetVersion vs Node Platform Detection

- **WHEN** `GetWindowsVersionInfo` / `getWindowsVersionInfo` runs across runtimes
- **THEN** Go calls `ntdll.dll!RtlGetVersion` (falling back silently to `10.0.19045` `Windows 10` on error, always setting `isWindows: true`, labeling `6.3`..`<6` legacy versions)
- **AND** Node checks `process.platform === 'win32'` (omitting `major`, `minor`, `build` on non-Windows) and parses `os.release()` on Windows

#### Scenario: Runtime Parity — Electron Startup Guard on Unsupported OS

- **WHEN** `src/gui/main.js` runs on an unsupported OS inside Electron
- **THEN** `assertWindows10OrAbove({ isGui: true })` invokes `dialog.showErrorBox` and calls `app.quit()` rather than `process.exit(1)`, allowing top-level module requires after the empty `if (!assertWindows10OrAbove(...))` block to continue until Electron terminates

### Requirement: Parent Console Attachment for Windows GUI Binary

When the Go/Wails executable is invoked with CLI arguments, the process SHALL attach to its caller's console handles prior to printing CLI output so a Windows GUI-subsystem binary writes to the parent terminal.

#### Scenario: Redirected or Inherited Stdout/Stderr Handles

- **WHEN** `yawps.exe` starts in CLI mode with valid non-`FILE_TYPE_UNKNOWN` standard handles
- **THEN** `attachParentConsole` rebinds `os.Stdout` and `os.Stderr` to the inherited `STD_OUTPUT_HANDLE` and `STD_ERROR_HANDLE`

#### Scenario: Interactive Parent Console Without Redirected Handles

- **WHEN** `yawps.exe` starts in CLI mode with `FILE_TYPE_UNKNOWN` standard output handles
- **THEN** `attachParentConsole` calls `kernel32.dll!AttachConsole(-1)` (`ATTACH_PARENT_PROCESS`) and reopens `CONOUT$` for `os.Stdout` and `os.Stderr`, silently continuing as a no-op if the parent process has no console

### Requirement: Dual-Mode GUI and CLI Entrypoint Routing

Both runtimes MUST launch the Desktop GUI when invoked with zero arguments or `gui`/`ui`, and dispatch all other invocations to the CLI command router.

#### Scenario: Zero-Argument Invocation Launches Desktop GUI

- **WHEN** a user invokes `yawps.exe`, `node bin/yawps.js`, or `node bin/win-php.js` with no CLI arguments on Windows 10+
- **THEN** the runtime launches the Desktop GUI window without printing CLI usage

#### Scenario: Explicit GUI Subcommand Invocation

- **WHEN** a user runs `yawps gui` or `yawps ui`
- **THEN** Go treats `gui`/`ui` as `isGui = true` (`cli.Run` returns `false`) and launches the embedded Wails window (`//go:embed all:src/gui/renderer`)
- **AND** Node (`bin/yawps.js`, `bin/win-php.js`) passes `isGui: false` during startup OS check and spawns detached `electron src/gui/main.js` (`stdio: 'ignore', detached: true`) via `launchGui()`

#### Scenario: Subcommand Arguments Route to CLI

- **WHEN** a user passes a subcommand such as `yawps list` or `yawps --version`
- **THEN** Go executes `cli.Run(args)` with attached console handles and exits without starting Wails, and Node delegates `process.argv` to `createCli().parse(process.argv)`

### Requirement: Zero-UAC Base Directory Resolution and Legacy Fallback

Both runtimes SHALL resolve the YAWPS root storage directory strictly under user-accessible paths without requiring administrator rights, honoring environment overrides and preserving legacy `.win-php` installations.

#### Scenario: Explicit Environment Override Precedence

- **WHEN** `YAWPS_HOME` is set in the environment
- **THEN** `baseDir` resolves to the cleaned/resolved `YAWPS_HOME` path
- **AND** when `YAWPS_HOME` is unset and `WIN_PHP_HOME` is set, `baseDir` resolves to `WIN_PHP_HOME`

#### Scenario: Legacy .win-php Fallback When .yawps Does Not Exist

- **WHEN** neither `YAWPS_HOME` nor `WIN_PHP_HOME` is set, `%USERPROFILE%\.win-php` exists as a directory, and `%USERPROFILE%\.yawps` does not exist
- **THEN** `baseDir` resolves to `%USERPROFILE%\.win-php`

#### Scenario: Default .yawps Directory Selection

- **WHEN** neither `YAWPS_HOME` nor `WIN_PHP_HOME` is set, and either `%USERPROFILE%\.yawps` exists or `%USERPROFILE%\.win-php` does not exist
- **THEN** `baseDir` resolves to `%USERPROFILE%\.yawps`

### Requirement: Managed Directory Tree Scaffolding

Core storage operations SHALL lazily create the managed zero-UAC directory tree (`baseDir`, `bin/`, `versions/`, `downloads/`) on demand while defining sibling paths for `current` and `config.json`.

#### Scenario: Lazy Directory Initialization

- **WHEN** `EnsureDirectories` / `ensureDirectories` runs
- **THEN** it creates `<baseDir>`, `<baseDir>/bin`, `<baseDir>/versions`, and `<baseDir>/downloads` recursively if absent
- **AND** it leaves `<baseDir>/current` (managed on switch) and `<baseDir>/config.json` (unused) uncreated

#### Scenario: Runtime Parity — Unused config.json Helpers

- **WHEN** inspecting `config.json` management across both runtimes
- **THEN** Go (`pkg/core/paths.go`) declares `configFile = <baseDir>/config.json` and exports `GetConfigFile()` without reading or writing it
- **AND** Node (`src/core/paths.js`) exports `CONFIG_FILE`, `getConfig()`, and `saveConfig(data)` (which swallow parse/write errors), also currently unreferenced by runtime flows

### Requirement: Unified Frontend window.api IPC and Event Bridge

The shared frontend renderer MUST communicate with either Electron or Go/Wails exclusively through a consistent `window.api` contract exposing 24 asynchronous RPC methods and 4 event stream subscription listeners.

#### Scenario: Electron Preload Short-Circuit

- **WHEN** `src/gui/renderer/bridge.js` executes inside an Electron BrowserWindow where `preload.js` has already defined `window.api` via `contextBridge.exposeInMainWorld` across the 24 kebab-case `ipcRenderer.invoke` channels
- **THEN** `bridge.js` exits immediately without overwriting `window.api`

#### Scenario: Wails Binding Injection Delay

- **WHEN** the Wails frontend invokes any of the 24 `window.api` RPC methods (`getState`, `fetchRemoteReleases`, `switchVersion`, `installVersion`, `checkUpdates`, `updateVersion`, `getExtensions`, `setExtensionStatus`, `getDirectives`, `updateDirectives`, `fixPath`, `removePath`, `uninstallVersion`, `fullCleanup` [unused by `app.js`], `openFolder`, and the 9 Composer RPCs) while `window.go.main.App` is still initializing
- **THEN** `bridge.js` polls every `50ms` up to `20` times (`1000ms` max) and invokes `window.go.main.App.<Method>` once available, or throws `"Go backend method App.<method> not found"` if still missing

#### Scenario: Real-Time Event Channel Subscriptions

- **WHEN** the frontend registers callbacks via `onInstallProgress`, `onUpdateProgress`, `onComposerProgress`, or `onComposerLog`
- **THEN** Electron subscribes via `ipcRenderer.on` and Wails registers synchronously on `window.runtime.EventsOn` (returning `() => {}` if `window.runtime` is not yet ready)
- **AND** it receives streamed payloads for `install-progress`, `update-progress`, `composer-progress`, and `composer-log` with an unsubscribe function

### Requirement: Explorer Folder Delegation

The desktop backend SHALL open a specified directory in Windows Explorer via `OpenFolder` / `open-folder`, defaulting to the managed `versions/` directory when no path argument is supplied.

#### Scenario: Open Specific Version or Composer Home Directory

- **WHEN** the UI calls `window.api.openFolder(targetPath)` with a non-empty folder path (such as a PHP version path or `composerHome`)
- **THEN** Go launches `explorer.exe <targetPath>` via `cmd.Start()` (ignoring any start error) and Electron calls `await shell.openPath(targetPath)`, both resolving to `true`

#### Scenario: Open Folder Without Explicit Path

- **WHEN** the UI calls `window.api.openFolder()` with an empty or undefined path (such as clicking `"Open YAWPS Folder"` in the sidebar)
- **THEN** both backends default `targetPath` to `<baseDir>/versions` rather than `<baseDir>` and open Windows Explorer
