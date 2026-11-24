# PHP Version Switching and PATH Specification

## Purpose

Discover installed PHP runtimes, atomically switch the active PHP version using zero-UAC NTFS directory junctions, inspect and update Windows User `PATH` registry precedence with `WM_SETTINGCHANGE` notifications, and uninstall individual versions or clean up the YAWPS environment.

## Requirements

### Requirement: Installed and Active PHP Version Discovery

Both runtimes SHALL scan `<baseDir>/versions/*` for `php.exe`, parse version/type/arch metadata (`^php-(\d+\.\d+\.\d+)(?:-(nts|ts))?(?:-(x64|x86))?`), resolve `<baseDir>/current`, and sort installed versions descending by semver.

#### Scenario: Enumerate Multiple Installed Versions With One Active

- **WHEN** `versions/` contains `php-8.2.20-ts-x64` and `php-8.4.1-nts-x64` (each with `php.exe`), and `current` points to `php-8.4.1-nts-x64`
- **THEN** `GetInstalledVersions` / `getInstalledVersions` returns `php-8.4.1-nts-x64` first (`isActive: true`) followed by `php-8.2.20-ts-x64` (`isActive` falsy)

#### Scenario: No Active Junction Present

- **WHEN** `<baseDir>/current` does not exist or cannot be read
- **THEN** `GetCurrentVersion` / `getCurrentVersion` returns `nil` / `null`

#### Scenario: Runtime Parity — VersionInfo Fields and Missing Directory Handling

- **WHEN** comparing Go (`pkg/core/environment.go`) and Node (`src/core/environment.js`)
- **THEN** Go `GetCurrentVersion` uses `os.Lstat`/`os.Readlink` returning all 8 `VersionInfo` fields (`isActive: true`, `phpExe`, `phpIni`) and `GetInstalledVersions` returns `[]VersionInfo{}` if unreadable, defaulting unparsed `type`/`arch` to `nts`/`x64`
- **AND** Node `getCurrentVersion` uses `fs.existsSync` + `fs.readlinkSync` returning 5 fields (omitting `isActive`, `phpExe`, `phpIni`), and `getInstalledVersions` sets `isActive: null` when no version is active and throws if `VERSIONS_DIR` is missing

### Requirement: Atomic Zero-UAC NTFS Directory Junction Switching

When switching versions, the backend SHALL resolve the query against installed versions (newest when empty, exact ID, exact version, then prefix), replace the `<baseDir>/current` NTFS directory junction without UAC elevation, and prepend `<baseDir>/current` to User `PATH` if absent.

#### Scenario: Switch Active Version by Branch or Exact ID

- **WHEN** `SwitchVersion("8.4")` / `switchVersion("php-8.4.1-nts-x64")` is invoked with matching versions installed
- **THEN** any existing `current` junction is removed, a new NTFS directory junction is created from `<baseDir>/current` to the resolved version folder, and `<baseDir>/current` is added to Windows User `PATH` if missing

#### Scenario: Switch Fails When No Versions Installed or Query Unmatched

- **WHEN** zero versions are installed or the query matches no installed version
- **THEN** the switch fails with an error message without altering `<baseDir>/current`

#### Scenario: Runtime Parity — Junction Creation and Removal Commands

- **WHEN** replacing `<baseDir>/current` during a version switch
- **THEN** Go executes `cmd.exe /c rmdir <curLink>` + `os.Remove` followed by `cmd.exe /c mklink /J <curLink> <target.Path>`
- **AND** Node checks `fs.existsSync(CURRENT_LINK)` then unlinks via `fs.unlinkSync` (falling back to `fs.rmdirSync`) and calls `fs.symlinkSync(target.path, CURRENT_LINK, 'junction')`

### Requirement: Windows User PATH Inspection and Registry Mutation

The backend SHALL inspect `HKCU\Environment\Path` and active `PATH` `php.exe` precedence (`isInUserPath`, `activePhpLocations`, `isPrimary`), deduplicate and prepend or remove target directories in `HKCU\Environment\Path`, and broadcast `WM_SETTINGCHANGE` (`"Environment"`).

#### Scenario: External PHP Precedence Detected Over YAWPS

- **WHEN** `C:\xampp\php\php.exe` appears ahead of `<baseDir>\current` in `PATH`
- **THEN** `CheckPathStatus` / `checkPathStatus` lists `C:\xampp\php\php.exe` first in `activePhpLocations` and reports `isPrimary: false`

#### Scenario: Prepend Current Junction to User PATH

- **WHEN** `AddToUserPath` / `addToUserPath` runs while `<baseDir>\current` is absent or buried later in `HKCU\Environment\Path`
- **THEN** `<baseDir>\current` is deduplicated and prepended to the start of `HKCU\Environment\Path` and `WM_SETTINGCHANGE` is broadcast

#### Scenario: Runtime Parity — Registry API vs PowerShell and Nil Slice Risk

- **WHEN** inspecting or mutating User `PATH` across runtimes
- **THEN** Go reads/writes `HKCU\Environment\Path` via `golang.org/x/sys/windows/registry` (`SetStringValue` writes `REG_SZ`, discards `GetStringValue` errors, broadcasts `user32.dll!SendMessageTimeoutW`), scans `os.Getenv("PATH")`, and leaves `PathStatus.ActivePhpLocations` as `nil` (`null`) when empty in `FixPath`/`RemovePath`/`SwitchVersion` (normalized only in `App.GetState()`)
- **AND** Node invokes `powershell.exe` `[Environment]::GetEnvironmentVariable` / `SetEnvironmentVariable('Path', ..., 'User')` (escaping backslashes with `\\`) and `where.exe php`, always returning an array for `activePhpLocations`

### Requirement: Environment PATH Removal Parity

Removing the YAWPS environment entry via `RemovePath` or `env remove` SHALL remove `<baseDir>\current` from Windows User `PATH`.

#### Scenario: Remove YAWPS From User PATH

- **WHEN** the user triggers `RemovePath` or `yawps env remove`
- **THEN** `<baseDir>\current` is stripped from `HKCU\Environment\Path`

#### Scenario: Runtime Parity — Junction Unlinking on Path Removal

- **WHEN** `RemovePath` / `env remove` completes in Go vs. Node
- **THEN** Go (`app.go:199-202`, `pkg/cli/cli.go:319-325`) calls `core.RemoveFromUserPath()` only, leaving `<baseDir>\current` intact (and `App.RemovePath()` swallows any error)
- **AND** Node (`src/core/uninstaller.js:161-175`) calls `removeEnvironmentPath()`, unlinking `<baseDir>\current` and removing `<baseDir>\current` from User `PATH`

### Requirement: PHP Version Uninstallation With Active Fallback

Uninstalling an installed PHP version SHALL delete `<baseDir>/versions/<id>`, optionally clean matching `.zip` archives from `downloads/`, and switch `current` to another installed version (or unlink `current` if none remain) when the target was active.

#### Scenario: Uninstall Active Version When Another Version Exists

- **WHEN** the active version is uninstalled while at least one other PHP version remains installed
- **THEN** `current` is switched to the highest remaining version, the target folder is removed, and `UninstallResult` reports `wasActive: true` with `switchedTo` populated

#### Scenario: Uninstall Sole Remaining Active Version

- **WHEN** the only installed PHP version is uninstalled
- **THEN** the `current` junction is unlinked, the version directory is deleted, and `GetCurrentVersion` / `getCurrentVersion` returns `nil` / `null`

#### Scenario: Uninstall With Clean Cache Enabled

- **WHEN** `UninstallVersion` / `uninstallVersion` is called with `cleanCache: true`
- **THEN** matching `.zip` files in `<downloadsDir>` are deleted and returned in `deletedCacheFiles`

#### Scenario: Runtime Parity — Target Matching and autoSwitch Flag

- **WHEN** resolving and uninstalling a version across runtimes
- **THEN** Go matches exact `ID` or `Version` (no branch prefix fallback) and always attempts to switch to the next highest remaining version
- **AND** Node matches ID, exact version, or branch prefix, unlinks `current` first, and skips fallback switching when `options.autoSwitch === false`

### Requirement: Full Environment Cleanup

`FullCleanup` / `fullCleanup` SHALL unlink `<baseDir>/current`, remove `<baseDir>/current` from Windows User `PATH`, and delete the entire `<baseDir>` tree when `purgeAll` is `true`.

#### Scenario: Full Cleanup Preserving Installed Versions

- **WHEN** `FullCleanup({ purgeAll: false })` / `fullCleanup({ purgeAll: false })` is executed
- **THEN** `<baseDir>/current` is removed and unlinked from User `PATH`, while `<baseDir>/versions/` and `<baseDir>/downloads/` remain intact (`baseDirDeleted: false`)

#### Scenario: Full Cleanup Purging All Data

- **WHEN** `FullCleanup({ purgeAll: true })` / `fullCleanup({ purgeAll: true })` is executed
- **THEN** the junction is unlinked, User `PATH` is cleaned, and `<baseDir>` is recursively deleted (`baseDirDeleted: true`)

#### Scenario: Runtime Parity — CleanupResult Schema and Error Handling

- **WHEN** `FullCleanup` / `fullCleanup` finishes
- **THEN** Go swallows unlink/PATH errors and returns `{ baseDirDeleted, pathRemoved: true, junctionRemoved: true }`
- **AND** Node throws if `fs.rmSync(BASE_DIR, ...)` fails and returns `{ success: true, pathRemoved: true, baseDirDeleted }`
