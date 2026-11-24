# Composer Lifecycle and Packages Specification

## Purpose

Resolve `COMPOSER_HOME`, discover YAWPS-managed or external Composer installations, query official Composer version metadata over IPv4, install/update/uninstall `composer.phar` and shell wrappers cleanly, inspect global packages from `composer.lock`/`composer.json`, and execute streaming global package commands.

## Requirements

### Requirement: COMPOSER_HOME and Global Bin Directory Resolution

Both runtimes SHALL resolve `COMPOSER_HOME` using `COMPOSER_HOME` env var first, then `%USERPROFILE%\.composer` if it exists as a directory, then `%APPDATA%\Composer` if it exists as a directory, defaulting to `%USERPROFILE%\.composer`, and derive `globalBinDir` as `<composerHome>/vendor/bin`.

#### Scenario: Custom COMPOSER_HOME Override

- **WHEN** `COMPOSER_HOME` is set in the environment
- **THEN** `GetComposerHome` / `getComposerHome` returns the cleaned/resolved `COMPOSER_HOME` path and `globalBinDir` resolves to `<COMPOSER_HOME>/vendor/bin`

#### Scenario: Default and AppData Composer Home Fallback

- **WHEN** `COMPOSER_HOME` is unset, `%USERPROFILE%\.composer` does not exist, and `%APPDATA%\Composer` exists as a directory
- **THEN** `GetComposerHome` / `getComposerHome` returns `%APPDATA%\Composer`

### Requirement: Composer Executable Discovery and Status Inspection

Composer discovery SHALL check `<baseDir>/bin/composer.phar` first (`isYawpsManaged: true`), then `PATH`, then standard Windows install locations, and aggregate `--version` output, IPv4 remote latest version, `PATH` status, active PHP info, and global package count into `ComposerStatus`.

#### Scenario: YAWPS-Managed Composer Found

- **WHEN** `<baseDir>/bin/composer.phar` exists and an active PHP version is configured
- **THEN** `GetComposerStatus` / `getComposerStatus` reports `installed: true`, `isYawpsManaged: true`, parsed `version`, `releaseDate`, `isBinInPath`, `isGlobalBinInPath`, and `packagesCount`

#### Scenario: External System Composer Locations Checked

- **WHEN** `<baseDir>/bin/composer.phar` does not exist and Composer is absent from `PATH`
- **THEN** discovery checks `C:\ProgramData\ComposerSetup\bin\composer.bat`, `%APPDATA%\Composer\vendor\bin\composer.bat`, `%USERPROFILE%\scoop\shims\composer.exe`, and `C:\ProgramData\chocolatey\bin\composer.bat`, setting `isYawpsManaged: false`

#### Scenario: Offline Status Check Degrades Gracefully

- **WHEN** `https://getcomposer.org/versions` is unreachable or times out
- **THEN** `GetComposerStatus` / `getComposerStatus` succeeds without error, reporting `latestVersion: ""` and `isUpToDate: false`

#### Scenario: Runtime Parity — PATH Lookup, IPv4 Transport and Concurrency

- **WHEN** checking Composer status across runtimes
- **THEN** Go uses `exec.LookPath` (`composer.bat` then `composer`), runs version check + `--version` in parallel goroutines (`ansiRegex` has a leading space ` \[[0-9;]*[a-zA-Z]`), and enforces `tcp4` (3s dial/response, 4s total timeout) on `getcomposer.org/versions`
- **AND** Node runs `where.exe composer.bat`, executes checks sequentially, and passes `family: 4, timeout: 5000` to `https.get` without an explicit `timeout` abort listener

### Requirement: Active-PHP-Gated Composer Installation and Self-Update

Installing Composer SHALL require an active PHP version, download `composer.phar` atomically via `composer.phar.tmp` with `composer-progress` events, write `composer.bat` and POSIX `composer` shims in `<baseDir>/bin`, add `<baseDir>/bin` and `<composerHome>/vendor/bin` to User `PATH`, and verify `--version`.

#### Scenario: Install Fails Without Active PHP

- **WHEN** `InstallComposer` / `installComposer` is invoked while no PHP version is active
- **THEN** installation aborts immediately with `"no active PHP version selected"` without writing files to `<baseDir>/bin`

#### Scenario: Atomic Composer Install and Wrapper Setup

- **WHEN** `InstallComposer` / `installComposer` succeeds with an active PHP version
- **THEN** `composer.phar` is finalized from `composer.phar.tmp`, `composer.bat` (`php "%~dp0composer.phar" %*`) and POSIX `composer` shims exist in `<baseDir>/bin`, `<baseDir>/bin` and `<composerHome>/vendor/bin` are added to User `PATH`, and `ComposerOperationResult.success` is `true`

#### Scenario: Runtime Parity — Download Verification, Shims and Self-Update

- **WHEN** installing or updating Composer in Go vs. Node
- **THEN** Go checks HTTP `200` with a `3m` client timeout and returns `ComposerOperationResult` with `Error` if `--version` fails; Node follows one 3xx redirect without checking HTTP status or `runCheck.status` and omits `error` on `ComposerOperationResult`
- **AND** both write the POSIX `composer` shim without `php` (`"$(dirname -- "$0")/composer.phar" "$@"`), and `UpdateComposer` / `updateComposer` re-runs `InstallComposer` when `isYawpsManaged` or `composerPhar` exists or runs `cmd.exe /c composer self-update` for external Composer

### Requirement: Granular Five-Option Composer Uninstallation

`UninstallComposer` / `uninstallComposer` SHALL selectively clean Composer artifacts via five boolean flags (`removeBin=true`, `removeFromPath=true`, `cleanCache=true`, `purgePackages=false`, `removeGlobalBinFromPath=false`) while protecting `ProgramData` system Composer binaries.

#### Scenario: Default Clean Uninstall Preserves Global Packages

- **WHEN** `UninstallComposer` runs with defaults (`removeBin: true`, `removeFromPath: true`, `cleanCache: true`, `purgePackages: false`, `removeGlobalBinFromPath: false`)
- **THEN** YAWPS Composer binaries (plus empty `bin/` dir), `<baseDir>/bin` `PATH` entry, and `%LOCALAPPDATA%\Composer\cache` + `<composerHome>/cache` are removed while `<composerHome>/vendor` and `composer.json` remain untouched

#### Scenario: Purge Global Packages Resets composer.json

- **WHEN** `UninstallComposer` runs with `purgePackages: true` and `removeGlobalBinFromPath: true`
- **THEN** `<composerHome>/vendor` and `composer.lock` are deleted, `composer.json` is reset to `"{}\n"`, and `globalBinDir` is removed from User `PATH`

#### Scenario: ProgramData External Composer Protected From Deletion

- **WHEN** an external Composer installation is located at `C:\ProgramData\ComposerSetup\bin\composer.bat` and `removeBin` is `true`
- **THEN** `UninstallComposer` skips deleting the `ProgramData` executable

#### Scenario: Runtime Parity — CacheDeleted Flag Reporting

- **WHEN** `cleanCache` is `true` and cache directories do not exist on disk
- **THEN** Go sets `CacheDeleted: true` whenever `opts.CleanCache` is `true`, whereas Node sets `cacheDeleted: true` only when at least one cache directory was actually deleted

### Requirement: Offline Global Package Inspection

`GetComposerGlobalPackages` / `getComposerGlobalPackages` SHALL return an empty array if no Composer executable is found, or merge `<composerHome>/composer.lock` with `<composerHome>/composer.json` `require` constraints, marking unlocked entries as `version: "(Not installed)"`.

#### Scenario: Locked and Unlocked Packages Combined

- **WHEN** `composer.lock` contains `laravel/installer` and `composer.json` requires both `laravel/installer` (`^5.0`) and un-downloaded `phpstan/phpstan` (`^1.10`)
- **THEN** `laravel/installer` returns locked `version`, `binaries`, `license`, and `constraint: "^5.0"`, while `phpstan/phpstan` returns `version: "(Not installed)"` and `"Required in composer.json but not yet downloaded"`

#### Scenario: Runtime Parity — JSON Array Parsing, Fields and Ordering

- **WHEN** parsing `composer.lock` and `composer.json` in Go vs. Node
- **THEN** Go unmarshals `license` and `bin` strictly as JSON string arrays (ignoring string values), sets `isOutdated: false` and `latest: ""`, and iterates a Go map in nondeterministic order
- **AND** Node preserves `composer.lock` then `composer.json` insertion order, omits `isOutdated` and `latest`, omits `homepage`/`time` on unlocked entries, and omits `constraint` on locked-only entries

### Requirement: Streaming Global Package Commands and Vendor Bin PATH Toggle

Running `require`, `remove`, or `update` global package commands SHALL require active PHP and Composer, execute `composer global <action> ... --no-interaction` with `COMPOSER_HOME` and active `PATH`, stream lines via `composer-log`, and support toggling `<composerHome>/vendor/bin` in User `PATH`.

#### Scenario: Stream Global Package Require Logs

- **WHEN** `InstallComposerGlobalPackage({ packageName: "laravel/installer", version: "^5.0" })` runs with active PHP and Composer installed
- **THEN** the backend executes `composer global require laravel/installer:^5.0 --no-interaction` with `COMPOSER_HOME` set and streams output lines via `composer-log`

#### Scenario: Toggle Global Vendor Bin in User PATH

- **WHEN** `ToggleComposerGlobalBinPath({ enable: true })` or `{ enable: false }` is called
- **THEN** `<composerHome>/vendor/bin` is created if needed and added to or removed from `HKCU\Environment\Path`, returning the updated `IsDirectoryInUserPath` boolean

#### Scenario: Runtime Parity — Streaming Pipe Concurrency and Validation

- **WHEN** `RunComposerCommand` / `runComposerCommand` executes global commands
- **THEN** Go writes stdout/stderr from two goroutines into an unsynchronized `strings.Builder` before `cmd.Wait()` drains them and rejects empty `pkgName`/`pkgNames`
- **AND** Node splits streamed chunks on `\n`, does not validate empty `packageName` in `installComposerGlobalPackage`, and omits `error` on `ComposerOperationResult`, while both return `Success: false` with captured `Output` on non-zero exit
