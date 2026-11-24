# PHP Patch Updater Specification

## Purpose

Identify newer patch releases within the same `major.minor` branch, thread-safety flavor, and CPU architecture for installed PHP runtimes, and execute non-destructive side-by-side upgrades that migrate `php.ini` settings and preserve active status.

## Requirements

### Requirement: Same-Branch Patch Update Discovery

`CheckUpdates` / `checkUpdates` SHALL compare each installed PHP version against remote `windows.php.net` releases matching the same `major.minor` branch, `type` (`nts` or `ts`), and `arch` (`x64` or `x86`), reporting an available update whenever remote semver is strictly greater.

#### Scenario: Newer Patch Available in Installed Branch

- **WHEN** `php-8.3.10-nts-x64` is installed and `windows.php.net` publishes `8.3.36` (`nts`, `x64`)
- **THEN** `CheckUpdates` / `checkUpdates` includes an entry identifying `php-8.3.10-nts-x64` with `latestVersion: "8.3.36"` and its `ReleaseInfo`

#### Scenario: No Newer Patch or No Installed Versions

- **WHEN** zero PHP versions are installed or every installed version equals the latest remote patch in its branch/flavor/arch
- **THEN** `CheckUpdates` / `checkUpdates` returns an empty list `[]`

#### Scenario: Runtime Parity — UpdateItem DTO Shape and Error Handling

- **WHEN** `CheckUpdates` (Go) vs. `checkUpdates` (Node) returns update entries
- **THEN** Go returns `[]UpdateItem` (`{ currentVersion: inst.ID, latestVersion, release, hasUpdate: true }`) and `App.CheckUpdates()` swallows fetch errors returning `[]UpdateItem{}`
- **AND** Node returns `{ installedId: item.id, currentVersion: item.version, latestVersion, type, arch, isActive, release }` (numeric `currentVersion`) and propagates `fetchReleases()` errors

### Requirement: Non-Destructive Side-by-Side Patch Upgrade and Migration

Updating an installed version SHALL install the target patch release into `<baseDir>/versions/<newId>` alongside the existing folder, migrate enabled extensions and directives from the prior `php.ini`, emit `update-progress` events, and switch `<baseDir>/current` if the prior version was active.

#### Scenario: Active PHP Version Upgraded Side-by-Side

- **WHEN** `UpdateVersion("php-8.3.10-nts-x64")` / `performUpdate("php-8.3.10-nts-x64")` runs while `php-8.3.10-nts-x64` is active and `8.3.36` is available
- **THEN** `php-8.3.36-nts-x64` is installed without deleting `versions/php-8.3.10-nts-x64`, `update-progress` events are emitted, and `<baseDir>/current` switches to `php-8.3.36-nts-x64`

#### Scenario: Inactive PHP Version Upgraded Without Stealing Active Link

- **WHEN** an inactive PHP version is updated while another PHP version is active
- **THEN** the new patch version is installed side-by-side without changing the active `<baseDir>/current` junction

#### Scenario: Already at Latest Patch Version

- **WHEN** no patch update exists for the requested `versionId`
- **THEN** Go returns an error `"no patch updates available for <versionId>"` while Node emits a `100%` completion event and resolves `{ updated: false, message: "Already up to date", currentVersion }`

#### Scenario: Runtime Parity — Migration Lookup, Progress Order and Update Return Shape

- **WHEN** `UpdateVersion` / `performUpdate` executes in Go/Wails vs. Node/Electron
- **THEN** Go matches `u.CurrentVersion` by `EqualFold` or `Contains`, passes raw `versionId` (instead of `targetUpdate.CurrentVersion`) to `GetExtensions`/`GetDirectives` discarding migration errors, and returns `*core.InstallResult` (`{ targetDir, alreadyInstalled, release }`), causing `app.js:779-780` (`res.updated`) to skip the Wails post-update toast and refresh
- **AND** Node emits `updating` (`10%`), runs `installRelease` (emitting `100%`), then emits `migrating` (`95%`) and `switching` (`98%`) before `completed` (`100%`), passes full filesystem paths (`target.path`, `installResult.targetDir`) to `migratePhpSettings` (failing `resolveVersionDir`), and returns `{ updated: true, oldVersion, newVersion, switched }`
