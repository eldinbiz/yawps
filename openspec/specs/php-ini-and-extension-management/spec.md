# PHP INI and Extension Management Specification

## Purpose

Resolve target PHP installations, inspect `ext/*.dll` extensions enriched with curated category and Zend metadata, enable or disable `extension=` and `zend_extension=` entries in `php.ini`, and read or update core `php.ini` runtime directives.

## Requirements

### Requirement: Target Version Directory Resolution

Configuration operations SHALL resolve a target PHP version directory from `"current"` or empty string (active `current` junction), direct directory name under `<baseDir>/versions/`, or installed ID or version string.

#### Scenario: Resolve Active Current Version

- **WHEN** `GetExtensions("")` / `getExtensions("current")` is called while an active PHP version is selected
- **THEN** `ResolveVersionDir` resolves the path referenced by `<baseDir>/current`

#### Scenario: Resolve Fails When Unmatched or No Active Version

- **WHEN** `versionId` is `"current"` with no active junction or matches no installed folder
- **THEN** the operation fails with an error without touching any `php.ini`

#### Scenario: Runtime Parity — Case Sensitivity and Error Messages

- **WHEN** resolving `versionId` across runtimes
- **THEN** Go (`pkg/core/extensions.go`) checks `<versionsDir>/<versionId>` via `os.Stat` (`IsDir()`), then matches `installed` via `strings.EqualFold` on `ID` or `Version`, returning `"no active PHP version selected"` or `"PHP version '<id>' not found"`
- **AND** Node (`src/core/extensions.js`) checks `fs.existsSync` on `<VERSIONS_DIR>/<versionId>`, then matches `installed` strictly (`v.id === versionId || v.version === versionId`), throwing if unresolved

### Requirement: Extension DLL Discovery and Metadata Enrichment

Extension listing SHALL scan `<versionDir>/ext/*.dll` (plus `php_opcache.dll` fallback in `ext/` or `<versionDir>`), strip `php_` and `.dll`, enrich IDs from the 25-entry metadata catalog (defaulting unknown DLLs to `"General"`), detect `php.ini` state, and sort by `category` then `name`.

#### Scenario: Discover Standard and Zend Extensions

- **WHEN** `<versionDir>/ext/` contains `php_curl.dll` and `php_opcache.dll`, and `php.ini` has `extension=curl` active and `;zend_extension=opcache` commented
- **THEN** `GetExtensions` / `getExtensions` returns `curl` with `category: "Network", isZend: false, enabled: true` and `opcache` with `category: "Performance", isZend: true, enabled: false`

#### Scenario: Uncatalogued Extension DLL Uses General Fallback

- **WHEN** `<versionDir>/ext/` contains an uncatalogued DLL such as `php_redis.dll`
- **THEN** the extension appears with `id: "redis"`, `name: "REDIS"`, `category: "General"`, `description: "PHP extension (php_redis.dll)"`, and `isZend: false`

#### Scenario: Runtime Parity — Missing php.ini and Prefix Stripping

- **WHEN** `<versionDir>/php.ini` is missing during extension discovery
- **THEN** Go (`pkg/core/extensions.go`) silently treats `php.ini` as empty (`enabled: false` for all DLLs, and `app.go:GetExtensions` swallows errors returning `[]ExtensionInfo{}`)
- **AND** Node (`src/core/extensions.js`) throws `"php.ini not found in <versionDir>"`
- **AND** both mark `opcache` and `xdebug` with `isZend: true` and strip `php_` case-sensitively

### Requirement: In-Place php.ini Extension Toggling

Enabling or disabling an extension SHALL mutate `<versionDir>/php.ini` in place using `zend_extension=` for `isZend` extensions (`opcache`, `xdebug`) and `extension=` for standard extensions without verifying `.dll` presence on disk.

#### Scenario: Enable Commented Extension Uncomments Existing Line

- **WHEN** `SetExtensionStatus` / `setExtensionStatus` enables an extension whose `;extension=<id>` (or `;zend_extension=<id>`) line exists in `php.ini`
- **THEN** the leading `;` and whitespace are removed in place and `php.ini` is saved

#### Scenario: Enable Missing Extension Inserts Before Module Settings Marker

- **WHEN** `SetExtensionStatus` / `setExtensionStatus` enables an extension with no matching active or commented line in `php.ini`
- **THEN** `<directiveKey>=<cleanId>` is inserted immediately before `; Module Settings ;` if present, or appended at EOF otherwise

#### Scenario: Disable Active Extension Comments Out Line

- **WHEN** `SetExtensionStatus` / `setExtensionStatus` disables an active extension
- **THEN** matching active lines are prefixed with `;` in `php.ini`
- **AND** `SetExtensionStatus` / `set-extension-status` IPC returns the refreshed `ExtensionInfo[]` list (returning an error if `php.ini` does not exist)

### Requirement: Core php.ini Directive Retrieval and Updates

`GetDirectives` and `UpdateDirectives` SHALL read core PHP directives from `<versionDir>/php.ini` with default fallbacks (`memory_limit=128M`, `upload_max_filesize=2M`, `post_max_size=8M`, `max_execution_time=30`, `display_errors=Off`, `date.timezone=UTC`, `opcache.enable=1`) and update them in place.

#### Scenario: Read Directives From Existing php.ini

- **WHEN** `GetDirectives` / `getDirectives` reads a `php.ini` with `memory_limit = 512M` and `date.timezone = "Asia/Tokyo"`
- **THEN** Node returns `{ memory_limit: "512M", date_timezone: "Asia/Tokyo", ... }` across 10 snake_case keys and Go returns `{ "memory_limit": "512M", "date.timezone": "Asia/Tokyo", ... }` across 7 dotted keys

#### Scenario: Update Active Commented or Missing Directives

- **WHEN** `UpdateDirectives` / `updateDirectives` applies a map of directive keys and values to `php.ini`
- **THEN** matching active or `;`-commented lines are replaced in place and missing keys are appended at EOF (with Node translating `keyMap` keys and returning the refreshed object, while Go writes raw map keys and returns `true`)

#### Scenario: Missing php.ini Fails Directive Operations

- **WHEN** `<versionDir>/php.ini` does not exist
- **THEN** `core.GetDirectives`, `core.UpdateDirectives`, `getDirectives`, and `updateDirectives` return a `"php.ini not found"` error (with `App.GetDirectives` in `app.go` catching the error and returning `{}`)

#### Scenario: Runtime Parity — Directives Key Mismatch, Key Count and Regex Behavior

- **WHEN** `app.js` loads or saves `PHP Settings` under Node/Electron vs. Go/Wails
- **THEN** Node (`src/core/extensions.js`) returns 10 keys (adding `max_input_time="60"`, `error_reporting="E_ALL"`, `opcache_enable_cli="0"`), maps `date_timezone <-> date.timezone`, `opcache_enable <-> opcache.enable`, and `opcache_enable_cli <-> opcache.enable_cli` via `keyMap`, and returns the refreshed object
- **AND** Go (`pkg/core/extensions.go`, `app.go`) returns 7 dotted keys (`date.timezone`, `opcache.enable`) and has no `keyMap`, so `app.js` reading `date_timezone`/`opcache_enable` under Wails loads defaults and saving writes literal `date_timezone = ...` / `opcache_enable = ...` lines into `php.ini`, returning `bool`
- **AND** Go `UpdateDirectives` uses `Regexp.ReplaceAllString` (expanding `$1` tokens in values), while Node `readVal`/`updateDirectives` compiles case-sensitive `'m'` regexes without escaping all dots or protecting `$` tokens
