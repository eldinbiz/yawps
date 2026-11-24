# PHP Release Catalog and Installer Specification

## Purpose

Fetch and normalize official Windows PHP release metadata from `windows.php.net`, resolve release queries by flavor and architecture, download and SHA256-verify zip archives with archive fallback, safely extract runtimes, bootstrap `php.ini`, and clean cached downloads.

## Requirements

### Requirement: Remote PHP Release Catalog Fetch and Normalization

The backend SHALL fetch `https://windows.php.net/downloads/releases/releases.json` with `User-Agent: YAWPS/0.1.0`, discard `version`, `source`, and `*pack*` keys, parse `(nts|ts)-(compiler)-(x64|x86)` entries with `zip.path` into `ReleaseInfo`, and sort results descending by semver.

#### Scenario: Successful Catalog Parse and Descending Semver Sort

- **WHEN** `releases.json` contains multiple PHP branches with `nts-vs16-x64`, `ts-vs16-x64`, `source`, and `test_pack` keys
- **THEN** `source` and `*pack*` keys are ignored
- **AND** valid builds are normalized with `id: "php-<version>-<type>-<arch>"`, `size` defaulting to `"Unknown"`, `url: "https://windows.php.net/downloads/releases/<zip.path>"`, and `archiveUrl: "https://windows.php.net/downloads/releases/archives/<zip.path>"`
- **AND** the returned list is sorted descending by `version`

#### Scenario: Remote Catalog Unreachable or Non-200 HTTP Response

- **WHEN** fetching `releases.json` fails due to network error, timeout, or non-200 HTTP status
- **THEN** the operation returns an error containing the failure or HTTP status without returning partial release data

#### Scenario: Runtime Parity — ReleaseInfo Schema and HTTP Timeout

- **WHEN** comparing `FetchRemoteReleases` (Go) and `fetchReleases` (Node)
- **THEN** Go uses a `15s` HTTP client timeout, omits `mtime`, sets `sha256` to `""` when absent, and returns `([]ReleaseInfo{}, err)` in `app.go` on failure
- **AND** Node uses native `fetch()` without explicit timeout, includes `mtime: buildData.mtime || null`, and sets `sha256: zip.sha256 || null`

### Requirement: Release Query Resolution

Release lookup SHALL resolve `"latest"`, exact release IDs, exact versions, `major.minor` branches, and version prefixes filtered by thread-safety `type` (`nts` or `ts`) and `arch` (`x64` or `x86`).

#### Scenario: Resolve Branch Query to Highest Patch in Branch

- **WHEN** the caller queries `"8.3"` with `type: "nts"` and `arch: "x64"`
- **THEN** the resolver returns the highest descending semver release in branch `8.3` matching `nts` and `x64`

#### Scenario: Resolve Latest Query

- **WHEN** the caller queries `"latest"` (or empty query in Node) with `type` and `arch`
- **THEN** the resolver returns the highest-version release matching that `type` and `arch`

#### Scenario: Runtime Parity — ID Matching, Prefix Stripping and Unmatched Return

- **WHEN** `FindRelease` (Go) or `findRelease` (Node) resolves queries or misses a match
- **THEN** Go strips lowercase `"php-"` only, matches `r.ID` case-insensitively before `type`/`arch`, checks exact version, branch, and `HasPrefix`, and returns an error `"no PHP release found matching query..."` when unmatched
- **AND** Node filters by `type` (`nts`) and `arch` (`x64`) first, strips `/^php-/i`, omits full `r.ID` lookup, checks exact version, branch, and `${cleanQuery}.` major prefix, and returns `null` when unmatched (causing `installVersion` to throw)

### Requirement: Idempotent Version Installation Check

Before downloading or extracting an archive, `InstallRelease` / `installRelease` SHALL inspect `<baseDir>/versions/<id>/php.exe` and return immediately with `alreadyInstalled: true` and a `100%` `"completed"` progress event if `php.exe` already exists.

#### Scenario: Target PHP Version Already Installed

- **WHEN** `InstallRelease` / `installRelease` is invoked for a release whose `<versionsDir>/<id>/php.exe` already exists on disk
- **THEN** no network download or extraction runs, existing `php.ini` files are untouched, a `completed` (`100%`) progress event is emitted, and `InstallResult` returns `alreadyInstalled: true`

### Requirement: Archive Download with Archive Fallback and Progress Streaming

When `<baseDir>/downloads/<zipName>` is absent on disk, the installer SHALL download the zip archive from `url`, fall back to `archiveUrl` if the primary response fails or is non-OK, and emit `install-progress` events during transfer.

#### Scenario: Primary Download Succeeds with Progress Events

- **WHEN** the archive is absent from `downloads/` and `release.url` returns HTTP `200`
- **THEN** the archive is written to `<downloadsDir>/<zipName>` while emitting `"downloading"` progress payloads

#### Scenario: Archived Release Falls Back to /archives/

- **WHEN** `release.url` returns HTTP `404` and `release.archiveUrl` returns HTTP `200`
- **THEN** the downloader retries `release.archiveUrl` transparently and saves the archive to `<downloadsDir>/<zipName>`

#### Scenario: Both Primary and Fallback Downloads Fail

- **WHEN** both `release.url` and `release.archiveUrl` return non-200 responses
- **THEN** installation aborts with a download error before extraction

#### Scenario: Runtime Parity — Download Error Handling, Fallback Trigger and Progress Payloads

- **WHEN** comparing Go `downloadFileWithProgress` and Node `downloadFile`
- **THEN** Go uses a `30m` client timeout and throttles `100ms` `"downloading"` updates scaled `0%–90%` with `message`, `receivedBytes`, and `totalBytes` (note `fmt.Errorf("download failed: %w", err)` formats `<nil>` on non-200 without `fallbackURL`, and `fbErr != nil` in fallback creation can fall through to `defer resp.Body.Close()`)
- **AND** Node uses `fetch()` without explicit timeout, falls back only when `!response.ok`, and emits `"downloading"` on every stream chunk (`0%–100%`) omitting `message`

### Requirement: SHA256 Integrity Verification and Corrupt Cache Removal

When `release.sha256` is present, the installer SHALL compute the SHA256 digest of `<downloadsDir>/<zipName>`, delete the cached archive on mismatch, and abort installation with a checksum error.

#### Scenario: Checksum Mismatch Purges Corrupt Archive

- **WHEN** the computed SHA256 digest of `<downloadsDir>/<zipName>` does not match `release.sha256`
- **THEN** the installer deletes `<downloadsDir>/<zipName>` and fails with a checksum mismatch error without extracting

#### Scenario: Runtime Parity — Verification Progress, Error Handling and Partial Cache

- **WHEN** `InstallRelease` / `installRelease` verifies `<downloadsDir>/<zipName>`
- **THEN** Go emits `"verifying"` at `92%` and checks `if err == nil && !strings.EqualFold(...)` (ignoring `computeSHA256` read errors), whereas Node emits `"verifying"` at `90%` and propagates `calculateSha256` errors
- **AND** both runtimes skip verification when `release.sha256` is empty/null and skip re-downloading when a partial `.zip` already exists at `zipPath`

### Requirement: Zip-Slip-Safe Archive Extraction

The installer SHALL extract the verified zip archive into `<baseDir>/versions/<id>/` while emitting `"extracting"` (`95%`) progress and guarding against path-traversal archive entries.

#### Scenario: Valid Archive Extraction

- **WHEN** extraction runs for a valid archive
- **THEN** runtime files (`php.exe`, `ext/`, `php.ini-development`, `php.ini-production`) are extracted under `<versionsDir>/<id>/`

#### Scenario: Zip Slip Entry Skipped in Go

- **WHEN** an archive processed by Go `archive/zip` contains an entry attempting directory traversal (`../`) outside `targetDir`
- **THEN** `unzipFile` skips any entry whose cleaned path lacks `filepath.Clean(destDir) + PathSeparator`

#### Scenario: Runtime Parity — Windows Native tar.exe and PowerShell Fallback in Node

- **WHEN** Node `extractZip` extracts an archive
- **THEN** it invokes `tar.exe -xf <zipPath> -C <targetDir>` and falls back to `powershell.exe Expand-Archive -LiteralPath "<zipPath>" -DestinationPath "<targetDir>" -Force` if `tar.exe` exits non-zero

### Requirement: Initial php.ini Configuration Bootstrap

After extraction, the installer SHALL create `<versionDir>/php.ini` from `php.ini-development` (falling back to `php.ini-production`) if `php.ini` does not already exist, and enable `extension_dir = "ext"`.

#### Scenario: Fresh Extraction Creates php.ini From Development Template

- **WHEN** `php.ini` does not exist and `php.ini-development` is present in `<versionDir>`
- **THEN** `php.ini` is created with `extension_dir = "ext"` enabled

#### Scenario: Missing Ini Templates Do Not Fail Installation

- **WHEN** neither `php.ini-development` nor `php.ini-production` exists in `<versionDir>`
- **THEN** `php.ini` bootstrap returns without throwing or aborting the installation

#### Scenario: Runtime Parity — Initial Extensions and Timezone Defaults

- **WHEN** bootstrapping `php.ini` on fresh installation
- **THEN** Go (`configureDefaultPhpIni`) only uncomments `;extension_dir = "ext"` and discards bootstrap errors
- **AND** Node (`setupInitialPhpIni`) emits `"configuring"` (`98%`), enables/appends `extension_dir = "ext"`, sets `date.timezone = UTC`, and uncomments 8 extensions (`curl`, `fileinfo`, `mbstring`, `openssl`, `pdo_mysql`, `pdo_sqlite`, `sqlite3`, `zip`)

### Requirement: Download Cache Cleanup

The uninstaller module SHALL remove cached `.zip` files from `<baseDir>/downloads/`, deleting either all `.zip` files or only those whose filenames match a case-insensitive version substring filter.

#### Scenario: Clean All Cached Archives

- **WHEN** `CleanCachedArchives("")` / `cleanCachedArchives()` is called without a filter
- **THEN** every `.zip` file in `<downloadsDir>` is deleted and the list of deleted file paths is returned

#### Scenario: Clean Cached Archives Matching Version Substring

- **WHEN** `CleanCachedArchives("8.3.36")` / `cleanCachedArchives("php-8.3.36")` is called
- **THEN** only `.zip` archives whose filename contains `"8.3.36"` (case-insensitive) are deleted, preserving cached archives for other versions
