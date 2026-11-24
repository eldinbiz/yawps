# CLI Interface Specification

## Purpose

Provide full command-line control via `yawps` and `win-php` entrypoints across Windows Command Prompt, PowerShell, and Git Bash for listing, installing, switching, updating, configuring extensions, managing Composer and User `PATH`, cleaning caches, and launching the desktop GUI.

## Requirements

### Requirement: Dual CLI Entrypoints and Shell Wrappers

The CLI SHALL be invocable through `yawps` and legacy `win-php` command names via native `yawps.exe`, Node `bin/yawps.js` / `bin/win-php.js`, Windows batch wrappers (`yawps.cmd`, `win-php.cmd`), and PowerShell wrappers (`yawps.ps1`, `win-php.ps1`).

#### Scenario: Legacy Alias Executes Identically to Primary Entrypoint

- **WHEN** a user invokes `win-php list` via `win-php.cmd` or `win-php.ps1` on Windows 10+
- **THEN** it executes the same CLI command router and produces identical behavior to `yawps list`

#### Scenario: Runtime Parity — Package Bin Mapping and PowerShell Exit Codes

- **WHEN** comparing wrapper entrypoints
- **THEN** `package.json` maps both `"yawps"` and `"win-php"` binaries to `./bin/yawps.js` (with `bin/win-php.js` remaining an identical copy for `win-php.cmd`/`win-php.ps1`)
- **AND** `yawps.ps1` and `win-php.ps1` invoke `node "$scriptDir\bin\*.js" @args` without explicitly propagating `$LASTEXITCODE`

### Requirement: Help and Version Commands

Both CLIs SHALL print usage documentation and report `0.1.0` version information.

#### Scenario: Version Smoke Check

- **WHEN** `yawps.exe --version` or `node bin/yawps.js --version` runs on Windows 10+
- **THEN** Go prints `YAWPS v0.1.0 (Yet Another Windows PHP Switcher)` (supporting `version`, `--version`, `-v` on exact `args[0]`, and `help`, `--help`, `-h`) and Node Commander prints `0.1.0` (`-V`/`--version`, `--help`/`-h`), both exiting `0`

### Requirement: PHP Listing, Remote Catalog, Installation, Switching and Current Commands

The CLI SHALL provide `list` (`ls`), `list-remote` (`available`), `install <version>`, `use <version>`, and `current` commands for querying local/remote runtimes, installing builds, switching the `current` junction, and executing `php -v`.

#### Scenario: Install and Inspect Active PHP Version

- **WHEN** a user runs `yawps install 8.3` followed by `yawps current`
- **THEN** PHP `8.3` is installed and switched to active, User `PATH` is ensured, and `yawps current` prints the junction path and executes `php -v`

#### Scenario: Missing Required Argument Prints Usage

- **WHEN** a user runs `yawps install` or `yawps use` without `<version>`
- **THEN** Go prints a usage message and exits (`0`) while Node Commander outputs a missing-argument error (`1`)

#### Scenario: Runtime Parity — Remote Flags, Caps, Auto-Switch and php -v Invocation

- **WHEN** running `list-remote`, `install`, or `current` across Go vs. Node CLIs
- **THEN** `list-remote` supports `--ts` and `--x86` capped at 15 rows in Go (printing `"Showing top N TS x64 releases"` even with `--x86`), whereas Node supports `--ts` only, hardcodes `x64`, and prints all rows in `cli-table3` with installed status
- **AND** `install` in Go requires `<version>` at `args[0]`, supports `--ts`/`--x86`, and always switches `current`; Node supports `--ts` and `--use`/`--no-use` (hardcoding `x64`), fixes User `PATH` even with `--no-use`, and switches when `options.use || installed.length === 1`
- **AND** `current` executes `cur.PhpExe -v` directly in Go, whereas Node spawns `powershell.exe -NoProfile -Command "& \"<CURRENT_LINK>\php.exe\" -v"`

### Requirement: Patch Update, Extension, Environment PATH and Cache Clean Commands

The CLI SHALL provide `update [version]`, `ext [list|enable|disable]`, `env [check|fix|remove]`, and `cache clean [version]` commands.

#### Scenario: Enable and List Extensions via CLI

- **WHEN** a user runs `yawps ext enable curl` and then `yawps ext list`
- **THEN** `extension=curl` is enabled in active `php.ini` and `curl` is displayed as enabled in the list

#### Scenario: Check Updates via CLI

- **WHEN** a user runs `yawps update` without a version argument
- **THEN** both runtimes query `CheckUpdates` / `checkUpdates` and display available branch patch updates or an up-to-date confirmation

#### Scenario: Runtime Parity — update [version], env remove and cache clean [version]

- **WHEN** running `update <version>`, `env`, or `cache clean [version]` in Go vs. Node
- **THEN** Go `update` ignores `[version]` and only prints available updates (`CheckUpdates`), whereas Node executes `performUpdate(version)` when `[version]` is given
- **AND** Go `env` defaults bare `yawps env` to `check`/`status` (no-oping on unknown subcommands) and `env remove`/`unlink` removes User `PATH` only, whereas Node requires `check|fix|remove` and unlinks `current` plus User `PATH`
- **AND** Go `cache clean` ignores `[version]` and deletes all `.zip` archives (no-oping if `clean` is omitted), whereas Node accepts optional `[version]` filtering

### Requirement: Destructive Uninstallation and Full Cleanup Commands

The CLI SHALL provide `uninstall <version>` (`remove`) and `cleanup` commands to remove individual PHP versions or decouple and purge YAWPS data.

#### Scenario: Go vs Node Cleanup Flag Behavior

- **WHEN** `yawps cleanup` runs without flags in a non-interactive shell
- **THEN** Go unlinks `current` and removes User `PATH` while preserving installed versions (`purgeAll: false`, requiring `--purge`/`--all` to delete `<baseDir>`)
- **AND** Node (`cleanup` / `uninstall-self`) purges `<BASE_DIR>` (`purgeAll: true`, requiring `--keep-versions` to preserve) and prompts `y/N` only when `process.stdin.isTTY && !yes && !force`

#### Scenario: Runtime Parity — Uninstall Prompts, Aliases and --no-switch

- **WHEN** running `yawps uninstall <version>` across Go vs. Node
- **THEN** Go accepts `uninstall`/`remove` and `--clean-cache` with no confirmation prompt and no `--no-switch`
- **AND** Node also accepts `rm`, `--no-switch`, and `-y`/`--yes`/`--force`, prompting `y/N` in interactive TTYs (skipping prompt in non-TTY pipes)

### Requirement: Composer CLI Subcommands

The CLI SHALL provide `composer` subcommands (`status`, `install`, `update`, `packages`/`list`, `require`/`add`, `remove`, `uninstall`) delegating to the Composer core module.

#### Scenario: Require Global Composer Package via CLI

- **WHEN** a user runs `yawps composer require laravel/installer`
- **THEN** the CLI runs `composer global require laravel/installer --no-interaction`, streams output lines to stdout, and prints completion status

#### Scenario: Unknown CLI Command Feedback

- **WHEN** a user runs an unrecognized command `yawps bogus`
- **THEN** Go prints `Unknown command: bogus` with `--help` hint (exiting `0`), and Node Commander prints `error: unknown command 'bogus'` (exiting `1`)

#### Scenario: Runtime Parity — Composer Subcommand Aliases, Flags and Exit Codes

- **WHEN** invoking `composer` subcommands across Go vs. Node CLIs
- **THEN** Go supports bare `composer` -> `status`, `status`/`info`, `packages`/`list`/`pkgs`, `require`/`add <pkg>` (no `-v`), and `uninstall`/`clean-uninstall` (`--purge-packages`/`--all`), printing `Failed: <err>` (`nil` when `res.Success == false && err == nil`) on `require`/`remove` and ignoring `!res.Success` on `install`/`update`
- **AND** Node supports `require -v, --pkg-version <version>` and detailed `packages` output (constraint, description, `CLI:` binaries), while both CLIs exit `0` when subcommand handlers catch/print errors rather than calling `os.Exit(1)` / `process.exit(1)`
