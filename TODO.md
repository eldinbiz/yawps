# YAWPS Remediation & Parity Backlog (`TODO.md`)

## 1. Context & Policy Alignment

### 1.1 Relationship to the OpenSpec 2.1.1 Baseline (Option A)

All specifications in `openspec/specs/` and `openspec/config.yaml` were reverse-engineered from `/home/antigravity/eldinbiz/yawps` under **Option A** (*Document Exact Current Behavior + Parity Notes*). Under Option A, the OpenSpec baseline faithfully records what the Go/Wails and Node/Electron runtimes and the shared SPA currently do—explicitly annotating Go-vs-Node/UI divergences via `Runtime Parity` notes—without altering application code.

This `TODO.md` document captures **every parity gap, live Wails/UI contract bug, runtime crash, concurrency/safety defect, CLI divergence, UI/XSS/CSS issue, packaging/NSIS flaw, documentation inaccuracy, and testing/CI gap** discovered during reverse-engineering and subsequent line-by-line code audits. Each item is intended to be resolved cleanly in future OpenSpec workflows (`openspec-propose` -> `openspec-apply-change` -> `openspec-verify-change` -> `openspec-archive-change`), updating the corresponding `openspec/specs/<capability>/spec.md` delta specs and application code together.

### 1.2 Severity & Priority Rubric

| Severity | Label | Criteria |
|---|---|---|
| **P0** | **Critical** | Live GUI/runtime crash, data corruption/loss (e.g., Windows Registry `Path` wipe or corruption, corrupted `php.ini` directive writes), silent security/integrity bypass (SHA256 error swallowing, nil-pointer panic), or data race causing truncated/corrupted execution. |
| **P1** | **High** | Core feature silently fails or breaks parity across runtimes (broken patch migration, missing CLI subcommand execution, exit code `0` on failures, XSS in renderer views, broken Packagist URLs, CI `npm ci` lockfile desync, broken NSIS junction cleanup, zero automated tests). |
| **P2** | **Medium** | Functional/UX discrepancies, edge-case regex/casing bugs, inconsistent CLI flags/output formatting, missing UI filters/error guards, build-script fragility, or missing CI checks. |
| **P3** | **Low** | Legacy naming remnants, dead/unused scaffolding (`config.json` helpers, unused imports), minor UI polish, and internal type/module drift. |

### 1.3 Canonical OpenSpec Capability IDs (`openspec/specs/`)

Every `TODO-*` item maps to one or more of the 9 canonical capabilities:

1. `platform-runtime-and-storage`
2. `php-release-catalog-and-installer`
3. `php-version-switching-and-path`
4. `php-ini-and-extension-management`
5. `php-patch-updater`
6. `composer-lifecycle-and-packages`
7. `desktop-gui-workspace`
8. `cli-interface`
9. `portable-build-and-packaging`

---

## 2. Executive Summary Matrix

| ID | Title | Severity | Category | Affected Runtimes | Affected OpenSpec Capabilities | Primary Files |
|---|---|---|---|---|---|---|
| `TODO-001` | `GetDirectives` / `UpdateDirectives` key mismatch, literal snake-case write bug, missing keys, return type & `$1` regex pitfall | `P0 Critical` | Live Wails/UI Contract | Go/Wails, Node/Electron, Shared UI | `php-ini-and-extension-management`, `desktop-gui-workspace` | `app.go:171-192`, `pkg/core/extensions.go:208-272`, `src/core/extensions.js:191-262`, `src/gui/renderer/app.js:1015-1062` |
| `TODO-002` | `UpdateVersion` return shape mismatch & `CheckUpdates` DTO divergence + swallowed Go update-check errors | `P0 Critical` | Live Wails/UI Contract | Go/Wails, Node/Electron, Shared UI | `php-patch-updater`, `desktop-gui-workspace` | `app.go:129-150`, `pkg/core/updater.go:8-51,53-99`, `src/core/updater.js:11-45,117-122`, `src/gui/renderer/app.js:651,751-787` |
| `TODO-003` | Live Wails GUI crash (`TypeError`) on `FixPath()`, `RemovePath()`, `SwitchVersion()` from `nil` `ActivePhpLocations` | `P0 Critical` | Live Wails Crash | Go/Wails, Shared UI | `php-version-switching-and-path`, `desktop-gui-workspace` | `pkg/core/environment.go:238,268`, `app.go:49-51,77-82,194-202`, `src/gui/renderer/app.js:205-207,219-221,1093` |
| `TODO-004` | Broken `php.ini` patch migration in both runtimes, swallowed errors & Node backward progress / empty query bug | `P1 High` | Core State & Parity | Go/Wails, Node/Electron | `php-patch-updater`, `php-ini-and-extension-management` | `pkg/core/updater.go:60-96`, `src/core/updater.js:58-72,80-84,101-115`, `src/core/extensions.js:37-52` |
| `TODO-005` | Initial `php.ini` defaults & bootstrap parity gap (Go `extension_dir` only vs Node `date.timezone=UTC` + 8 extensions) | `P1 High` | Core Parity | Go/Wails, Node/Electron | `php-release-catalog-and-installer`, `php-ini-and-extension-management` | `pkg/core/installer.go:178-207,273`, `src/core/installer.js:97-152,189-190` |
| `TODO-006` | `RemovePath()` / `env remove` leaves `current` NTFS junction intact in Go & swallows `RemoveFromUserPath` error | `P1 High` | Core Parity | Go/Wails, Node/Electron, Shared UI | `php-version-switching-and-path`, `cli-interface`, `desktop-gui-workspace` | `app.go:199-202`, `pkg/cli/cli.go:319-325`, `src/core/uninstaller.js:161-175`, `src/gui/renderer/app.js:219-223` |
| `TODO-007` | Dangling NTFS junction breaks Node switch/uninstall/remove & version discovery DTO/nullability bugs | `P1 High` | Core State & Parity | Go/Wails, Node/Electron | `php-version-switching-and-path` | `src/core/environment.js:11,22-28,55,122-136`, `src/core/uninstaller.js:112,163`, `pkg/core/environment.go:51-86` |
| `TODO-008` | Missing `php.ini` handling in `GetExtensions` & unchecked `.dll` existence in `SetExtensionStatus` | `P2 Medium` | Core Parity | Go/Wails, Node/Electron, Shared UI | `php-ini-and-extension-management` | `pkg/core/extensions.go:87-91,159-206`, `app.go:152-158`, `src/core/extensions.js:62-64,139-186`, `src/gui/renderer/app.js:997-1012` |
| `TODO-009` | `FetchRemoteReleases`, `FindRelease` & semver pre-release comparison parity gaps | `P2 Medium` | Core Parity | Go/Wails, Node/Electron | `php-release-catalog-and-installer`, `composer-lifecycle-and-packages` | `pkg/core/releases.go:20-47,78-100,170-237`, `src/core/releases.js:8-12,45-47,61-114`, `pkg/core/composer.go:225-252` |
| `TODO-010` | `FullCleanup` DTO mismatch & Go hardcoded `PathRemoved: true` / `JunctionRemoved: true` ignoring errors | `P2 Medium` | Core Parity | Go/Wails, Node/Electron | `php-version-switching-and-path` | `pkg/core/uninstaller.go:11-15,115-136`, `src/core/uninstaller.js:183-205` |
| `TODO-011` | CLI `update [version]` parity gap (Go check-only vs Node execute + migration) & help/cheat-sheet misalignment | `P1 High` | CLI Divergence | Go CLI, Node CLI, Shared UI | `cli-interface`, `php-patch-updater` | `pkg/cli/cli.go:212-229,536`, `src/cli/index.js:315-358`, `src/gui/renderer/index.html:612-613` |
| `TODO-012` | CLI `cleanup` / `uninstall-self` inverted `purgeAll` default, missing flags/aliases & non-TTY destructive purge | `P1 High` | CLI Divergence & Safety | Go CLI, Node CLI, Shared UI | `cli-interface`, `php-version-switching-and-path` | `pkg/cli/cli.go:363-377,552`, `src/cli/index.js:503-537`, `src/gui/renderer/index.html:632-633` |
| `TODO-013` | Both CLIs exit `0` on all errors, misreport Composer `install`/`update`/`require`/`remove` & `env fix` failures | `P1 High` | CLI Error & Exit Codes | Go CLI, Node CLI | `cli-interface`, `composer-lifecycle-and-packages` | `main.go:60-63`, `pkg/cli/cli.go:11-82,422-498`, `src/cli/index.js:165-712` |
| `TODO-014` | CLI `list-remote` & `install` parity bugs (`--x86`, 15-row cap, hardcoded `"TS x64"`, wrong installed badge, `--no-use`, progress glitch) | `P2 Medium` | CLI Divergence | Go CLI, Node CLI | `cli-interface`, `php-release-catalog-and-installer` | `pkg/cli/cli.go:105-179,532`, `src/cli/index.js:132-219,344-346` |
| `TODO-015` | CLI `uninstall` (`rm`, prompts, `--no-switch`, branch prefix, swallowed switch error) & `cache clean [version]` gaps | `P2 Medium` | CLI Divergence | Go CLI, Node CLI | `cli-interface`, `php-version-switching-and-path`, `php-release-catalog-and-installer` | `pkg/cli/cli.go:66,328-361,550`, `pkg/core/uninstaller.go:25-48,54,84`, `src/cli/index.js:222-264,478-500` |
| `TODO-016` | CLI `composer` & `current` parity gaps (`require -v`, `packages` details, aliases, `powershell.exe` wrapper & uncaught `spawn`) | `P2 Medium` | CLI Divergence | Go CLI, Node CLI | `cli-interface`, `composer-lifecycle-and-packages` | `pkg/cli/cli.go:194-210,379-522,540-546`, `src/cli/index.js:289-312,540-714` |
| `TODO-017` | Go CLI flag-before-arg positional bug, silent no-ops (`env`/`cache`), case sensitivity, hardcoded OS status & `AttachConsole` stdin/stderr | `P2 Medium` | CLI Parsing & Windows Console | Go CLI, Go Runtime | `cli-interface`, `platform-runtime-and-storage` | `main.go:20-45,49,70,96`, `pkg/cli/cli.go:16,144,232-255,283-337,350` |
| `TODO-018` | Legacy `win-php` error strings, duplicate `bin/win-php.js`, `yawps gui` `isGui: false`, uncaught `launchGui` & unused imports | `P3 Low` | CLI Hygiene & Packaging | Go/Node Core, Node CLI | `cli-interface`, `platform-runtime-and-storage` | `pkg/core/environment.go:151`, `src/core/environment.js:92`, `src/core/uninstaller.js:158,178-180`, `bin/yawps.js:8`, `bin/win-php.js:1-18`, `package.json:8`, `src/cli/index.js:14,28-29,731-743` |
| `TODO-019` | Electron post-OS-check startup leak, window title/icon mismatch, permissive `setWindowOpenHandler` & Wails external URL gap | `P1 High` | Desktop Shell & Security | Go/Wails, Node/Electron | `platform-runtime-and-storage`, `desktop-gui-workspace` | `src/gui/main.js:6-8,66-94`, `src/core/osCheck.js:118-127`, `main.go:74-93` |
| `TODO-020` | Broken Packagist `%2F` URLs, stale Extensions/Directives dropdown state sync & custom `date.timezone` wiped to `""` | `P1 High` | GUI State & Navigation | Shared UI | `desktop-gui-workspace`, `php-ini-and-extension-management`, `composer-lifecycle-and-packages` | `src/gui/renderer/app.js:698-701,878-911,915,1016,1036,1053,1444-1445`, `src/gui/renderer/index.html:340-353` |
| `TODO-021` | Unescaped `innerHTML` XSS vectors in non-Composer views & `bridge.js` synchronous `window.runtime.EventsOn` init race | `P1 High` | Security & IPC Bridge | Shared UI, Wails Bridge | `desktop-gui-workspace`, `platform-runtime-and-storage` | `src/gui/renderer/app.js:653-688,797,825-847,926,955-972,1102-1127`, `src/gui/renderer/bridge.js:9-21,51-74` |
| `TODO-022` | `"Open YAWPS Folder"` opens `versions/`, Download hides `x86` & uses static chips, missing 7 ext categories & `v0.1` label | `P2 Medium` | GUI Parity & Gaps | Go/Wails, Node/Electron, Shared UI | `desktop-gui-workspace`, `platform-runtime-and-storage` | `app.go:204-211`, `src/gui/main.js:202-206`, `src/gui/renderer/index.html:56-57,153-162,191-200`, `src/gui/renderer/app.js:104-106,807` |
| `TODO-023` | Shared UI/UX/CSS/A11y defects (`user-select: none`, sticky PATH pill, timers, `confirm()`, Composer UX, `.btn-sm`, `.hidden`, ARIA, CSP) | `P2 Medium` | GUI UX, CSS & A11y | Node/Electron, Shared UI | `desktop-gui-workspace` | `src/gui/renderer/styles.css:29,32,49-56,163-168,389-431,1008-1047`, `src/gui/renderer/app.js:54-62,320,564-566,616-632,1255-1610`, `src/gui/renderer/index.html:133,387,437,460,648-735`, `src/gui/main.js:196-199` |
| `TODO-024` | Unused `config.json` path/helpers, unexposed backend IPC APIs (`fullCleanup`, `cleanCachedArchives`) & unused `models.ts` fields | `P3 Low` | Dead Code & API Surface | Go/Wails, Node/Electron | `platform-runtime-and-storage`, `desktop-gui-workspace`, `composer-lifecycle-and-packages` | `pkg/core/paths.go:14,51,74-76`, `src/core/paths.js:20,43-65,73-76`, `app.go:219`, `src/gui/main.js:25,42,220`, `src/gui/renderer/wailsjs/go/models.ts:28-29` |
| `TODO-025` | Node double-backslash `\\` User `PATH` corruption & PowerShell string/here-string injection | `P0 Critical` | Windows Registry & Injection | Node/Electron | `php-version-switching-and-path`, `platform-runtime-and-storage`, `php-release-catalog-and-installer` | `src/core/environment.js:158,161,169,203,224`, `src/core/osCheck.js:77`, `src/core/installer.js:81` |
| `TODO-026` | Go Registry `Path` wipe on `GetStringValue` error, `REG_SZ` over `REG_EXPAND_SZ`, stale `os.Getenv("PATH")` & prefix boundary bug | `P0 Critical` | Windows Registry & Data Loss | Go/Wails | `php-version-switching-and-path` | `pkg/core/environment.go:230,237,261,322,335,355,366`, `pkg/cli/cli.go:299`, `src/core/environment.js:170`, `src/gui/renderer/app.js:1099` |
| `TODO-027` | Go `RunComposerCommand` concurrent `strings.Builder` data race, premature `cmd.Wait()`, corrupted `ansiRegex` & broken POSIX `bin/composer` | `P0 Critical` | Concurrency & Wrapper Bugs | Go/Wails, Node/Electron | `composer-lifecycle-and-packages` | `pkg/core/composer.go:255,461-464,759-777`, `src/core/composer.js:264-267` |
| `TODO-028` | Go `downloadFileWithProgress` nil-`resp` panic & `%!w(<nil>)`, swallowed `computeSHA256`, partial `.zip` cache poisoning & Node zip/progress defects | `P0 Critical` | Crash, Integrity & Extraction | Go/Wails, Node/Electron | `php-release-catalog-and-installer` | `pkg/core/installer.go:41-111,141-175,211-258`, `src/core/installer.js:25-92,160-186` |
| `TODO-029` | Composer edge-case bugs (Node `fetchLatestComposerVersion` hang, unverified phar, missing `error`, `cmd.exe ^` mangle, Go `tcp4`/JSON/map/flags) | `P1 High` | Safety & Edge Cases | Go/Wails, Node/Electron | `composer-lifecycle-and-packages` | `src/core/composer.js:88,156,222-298,312-315,505-546`, `pkg/core/composer.go:150-151,383,512,575-622,647-740,863` |
| `TODO-030` | Extensions/release/OS edge cases (`gd`/`gd2` collision, `php_` casing, duplicate directives, `"php-"` case, silent `10.0.19045` fallback) | `P1 High` | Parsing & Regex Correctness | Go/Wails, Node/Electron | `php-ini-and-extension-management`, `php-release-catalog-and-installer`, `platform-runtime-and-storage` | `pkg/core/extensions.go:100-102,131-134,172-180,234`, `src/core/extensions.js:75,107-110,148,155,202`, `pkg/core/releases.go:199-231`, `pkg/core/oscheck.go:67-72` |
| `TODO-031` | NSIS `build/installer.nsh` PowerShell 5.1 junction hang, escaping & ignored `YAWPS_HOME` + `package-lock.json` orphaned `chalk` | `P1 High` | Packaging & Dependencies | Node/Electron Packaging | `portable-build-and-packaging` | `build/installer.nsh:1-19`, `package.json:41-48,64-72`, `package-lock.json:16,1076-1088` |
| `TODO-032` | Portable build scripts (`build.sh`, `build.cmd`) `go1.22.x`/`GOBIN`/CMD quote bugs, manifest `asInvoker` & PowerShell wrappers swallowing `$LASTEXITCODE` | `P2 Medium` | Build & Wrappers | Go/Wails Build, Node Wrappers | `portable-build-and-packaging`, `cli-interface`, `platform-runtime-and-storage` | `build.sh:42,66-67,85`, `build.cmd:2,18,52,58,74-75,88,92`, `build/windows/wails.exe.manifest:1-15`, `yawps.ps1:1-2`, `win-php.ps1:1-2` |
| `TODO-033` | `README.md` major omissions & factual inaccuracies (`go1.22.x`, `npm run build:wails`, false CLI directives) + GUI cheat sheet drift | `P1 High` | Documentation | Docs, Shared UI | `portable-build-and-packaging`, `cli-interface`, `desktop-gui-workspace`, `platform-runtime-and-storage` | `README.md:1-72`, `src/gui/renderer/index.html:570,612-613,632-633` |
| `TODO-034` | Zero automated test coverage across Go (`go test ./...`) and Node.js (`package.json` lacks `"test"`) | `P1 High` | Automated Testing | Go/Wails, Node/Electron | All 9 capabilities | `go.mod`, `package.json:10-20`, `pkg/**/*`, `src/**/*` |
| `TODO-035` | GitHub Actions workflow (`build-windows.yml`) manual-only trigger, missing `go test`, missing `node --check` & missing Electron `.exe` smoke test | `P2 Medium` | CI/CD Pipeline | Go/Wails CI, Node/Electron CI | `portable-build-and-packaging` | `.github/workflows/build-windows.yml:3-21,54-57,140-152` |
| `TODO-036` | Missing local & CI `openspec validate --specs --strict` / `--all --strict` integration | `P2 Medium` | Spec Tooling & CI | OpenSpec Workflow | All 9 capabilities | `openspec/config.yaml`, `package.json`, `.github/workflows/build-windows.yml` |

---

## 3. Detailed Backlog by Section

---

### Section 1: Live Wails/UI Contract Bugs & Runtime Crashes

#### TODO-001: `GetDirectives` / `UpdateDirectives` Key Mismatch, Literal Snake-Case Write Bug, Missing Keys, Return Type & `$1` Regex Pitfall
- **Severity**: `P0 Critical`
- **Category**: Live Wails/UI Contract
- **Affected Files & Verified Lines**:
  - `app.go:171-177` (`GetDirectives`), `app.go:179-192` (`UpdateDirectives`)
  - `pkg/core/extensions.go:208-241` (`GetDirectives`), `pkg/core/extensions.go:243-272` (`UpdateDirectives`)
  - `src/gui/renderer/app.js:1015-1062` (`loadDirectives`, `saveDirectives`)
  - `src/core/extensions.js:191-219` (`getDirectives`), `src/core/extensions.js:224-262` (`updateDirectives`)
  - `src/gui/main.js:187-193`
  - `src/gui/renderer/wailsjs/go/main/App.d.ts:18,50`, `src/gui/renderer/wailsjs/go/main/App.js:29-31,93-95`
- **Current Behavior per Runtime / UI**:
  - **Shared UI (`app.js:1032,1036,1046-1054`)**: `loadDirectives()` reads `directives.opcache_enable` and `directives.date_timezone`. `saveDirectives()` constructs and sends `{ opcache_enable, date_timezone }` in snake_case.
  - **Node/Electron (`extensions.js:207-218,234-262`, `main.js:191-193`)**: `getDirectives()` returns **10** keys (`memory_limit`, `upload_max_filesize`, `post_max_size`, `max_execution_time`, `max_input_time`, `display_errors`, `error_reporting`, `date_timezone`, `opcache_enable`, `opcache_enable_cli`). `updateDirectives()` translates `date_timezone -> date.timezone`, `opcache_enable -> opcache.enable`, and `opcache_enable_cli -> opcache.enable_cli` via `keyMap` and returns the refreshed directives object.
  - **Go/Wails (`app.go:171-192`, `extensions.go:221-272`)**: `GetDirectives()` returns **7** dotted keys (`date.timezone`, `opcache.enable`, omitting `max_input_time`, `error_reporting`, `opcache_enable_cli`). `app.go:171-177` swallows any `core.GetDirectives` error and returns `map[string]string{}`. `core.UpdateDirectives` has **no `keyMap`**, writing whatever keys the caller sends verbatim into `php.ini`, and `app.go:179` returns `(bool, error)` rather than the updated map.
  - **Regex Hazards in Both Runtimes**:
    - Go (`extensions.go:263,265`) passes `fmt.Sprintf("%s = %s", k, v)` into `Regexp.ReplaceAllString`, expanding `$1`, `$2`, `${name}`, or `$$` in `v` (where group `$1` captures `k =`, corrupting e.g. `$1` into `k = k =`).
    - Node (`extensions.js:202,252,254`) compiles `readVal` with `'m'` instead of `'mi'` (case-sensitive), fails to escape `.` in `readVal` (`date.timezone` matches `dateXtimezone`), treats empty values (`date.timezone =`) as default `'UTC'`, uses `iniKey.replace('.', '\\.')` in `updateDirectives` (escaping only the first dot), and calls `content.replace(regex, \`\${iniKey} = \${value}\`)` which expands `$1`/`$&`/`$$` in `value`.
- **Root Cause & User Impact**:
  - *(Correction to Phase 1 assumption)*: `app.js:1052-1053` does **not** send dotted keys when saving. Because Go lacks `keyMap`:
    1. Loading PHP Settings in Wails always displays OPcache as `Off` and Timezone as `UTC` regardless of `php.ini`.
    2. Saving PHP Settings in Wails writes **invalid non-PHP lines** (`opcache_enable = 1`, `date_timezone = America/New_York`) at the end of `php.ini` while leaving actual `opcache.enable` and `date.timezone` untouched!
    3. Values containing `$` (e.g., future directives or user strings) are corrupted during regex replacement in both runtimes.
- **Suggested Remediation Options**:
  1. Standardize canonical `Directives` contract across Go, Node, and `app.js` using snake_case keys (`date_timezone`, `opcache_enable`, `opcache_enable_cli`) with bidirectional `keyMap` in Go `pkg/core/extensions.go` matching Node's 10 keys, OR normalize Go/Node on dotted keys (`date.timezone`, `opcache.enable`) and update `app.js` + Node `getDirectives`. Adding `keyMap` + all 10 keys in Go preserves backward compatibility with existing JS/UI callers.
  2. Have `App.GetDirectives` (`app.go:171`) return `(map[string]string, error)` (propagating errors) and `App.UpdateDirectives` (`app.go:179`) return `(map[string]string, error)` returning refreshed directives, then regenerate `wailsjs/`.
  3. Replace `ReplaceAllString` / string replacement with literal replacement functions (`ReplaceAllStringFunc` in Go; callback `() => \`\${iniKey} = \${value}\`` in Node), escape all dots (`replaceAll('.', '\\.')`), and use case-insensitive `'mi'` regex flags.
- **OpenSpec Change Proposal Notes**:
  - **Capabilities**: `php-ini-and-extension-management`, `desktop-gui-workspace`
  - **Proposal**: Update `GetDirectives` / `UpdateDirectives` canonical DTO schema in `openspec/config.yaml` and `php-ini-and-extension-management/spec.md`, removing the `Runtime Parity` divergence once both backends align.
- **Verification Criteria**:
  - Go unit tests in `pkg/core/extensions_test.go` verifying `GetDirectives` and `UpdateDirectives` translate `opcache_enable <-> opcache.enable` and `date_timezone <-> date.timezone`, preserve `$1`/`$$` literals, and reject missing `php.ini`.
  - Node tests using `node --test` covering `getDirectives`/`updateDirectives` with empty values, mixed casing, and `$1`/`$&` values.
  - `GOOS=windows GOARCH=amd64 go vet ./...` and `node --check` exit `0`.
  - Manual Windows Wails smoke check: toggle OPcache ON, set timezone `Asia/Tokyo`, click Save, reopen tab, and inspect `php.ini` to confirm `opcache.enable = 1` and `date.timezone = Asia/Tokyo` (zero `opcache_enable`/`date_timezone` lines).

---

#### TODO-002: `UpdateVersion` Return Shape Mismatch & `CheckUpdates` DTO Divergence + Swallowed Go Update-Check Errors
- **Severity**: `P0 Critical`
- **Category**: Live Wails/UI Contract
- **Affected Files & Verified Lines**:
  - `app.go:129-135` (`CheckUpdates`), `app.go:137-150` (`UpdateVersion`)
  - `pkg/core/updater.go:8-13` (`UpdateItem`), `pkg/core/updater.go:15-51` (`CheckUpdates`), `pkg/core/updater.go:53-99` (`UpdateVersion`)
  - `pkg/core/installer.go:27-31` (`InstallResult`)
  - `src/core/updater.js:11-45` (`checkUpdates`), `src/core/updater.js:117-122` (`performUpdate`)
  - `src/gui/main.js:162-174`
  - `src/gui/renderer/app.js:651,751-787`
  - `src/gui/renderer/wailsjs/go/main/App.d.ts:6,52`, `src/gui/renderer/wailsjs/go/models.ts:187-201,304-320`
- **Current Behavior per Runtime / UI**:
  - **`UpdateVersion`**: Node `performUpdate` (`updater.js:95,117-122`) returns `{ updated: false, message, currentVersion }` or `{ updated: true, oldVersion, newVersion, switched }`. Go `App.UpdateVersion` (`app.go:137`) returns `*core.InstallResult` (`{ targetDir, alreadyInstalled, release }`). `app.js:778-783` checks `if (res.updated)` and interpolates `res.newVersion`.
  - **`CheckUpdates`**: Node returns `{ installedId, currentVersion: item.version, latestVersion, type, arch, isActive, release }` (`updater.js:31-39`). Go returns `{ currentVersion: inst.ID, latestVersion, release, hasUpdate }` (`updater.go:8-13,38-43`). Consequently `app.js:759` formats `php-8.3.10-nts-x64 ➜ 8.3.36` in Wails vs `8.3.10 ➜ 8.3.36` in Node. Furthermore, `app.go:130-133` swallows `core.CheckUpdates()` network/JSON errors and returns `[]core.UpdateItem{}` (falsely showing `"All installed PHP versions are up to date!"`), whereas Node rejects the Promise.
- **Root Cause & User Impact**:
  - Under Wails, `res.updated` is always `undefined` (falsy). Clicking `Update` on an installed PHP card performs the backend install, then silently skips `showToast("Updated to PHP ...")`, `await refreshAppState()`, and `await checkForUpdates()` (`app.js:780-782`), leaving the UI card list and `#updates-alert-box` stale until manual refresh. Offline `Check for Updates` silently claims everything is up to date in Wails.
- **Suggested Remediation Options**:
  1. Introduce `core.UpdateResult` in `pkg/core/updater.go` (`Updated bool`, `OldVersion string`, `NewVersion string`, `Switched bool`, `Message string`, `CurrentVersion string`) and return `(*core.UpdateResult, error)` from `App.UpdateVersion`.
  2. Align Go `core.UpdateItem` with Node (`InstalledId string`, `CurrentVersion string` = `inst.Version`, `LatestVersion string`, `Type string`, `Arch string`, `IsActive bool`, `Release *ReleaseInfo`, `HasUpdate bool`).
  3. Change `App.CheckUpdates()` (`app.go:129`) to return `([]core.UpdateItem, error)` and surface errors in `checkForUpdates()` (`app.js:749-772`, showing error toast when `notifyIfClean` is true). Regenerate `wailsjs/` bindings.
- **OpenSpec Change Proposal Notes**:
  - **Capabilities**: `php-patch-updater`, `desktop-gui-workspace`
  - **Proposal**: Lock canonical `UpdateItem` and `UpdateResult` DTO schemas in `openspec/config.yaml` and `php-patch-updater/spec.md`.
- **Verification Criteria**:
  - Go unit tests verifying `UpdateItem` JSON keys and `UpdateVersion` returning `UpdateResult{Updated: true, OldVersion, NewVersion, Switched}`.
  - `GOOS=windows GOARCH=amd64 go vet ./...` exits `0`.
  - Windows Wails UI smoke test: verify update alert shows clean semver (`8.3.x -> 8.3.y`), clicking `Update` displays success toast, updates installed list, and clears update alert.

---

#### TODO-003: Live Wails GUI Crash (`TypeError`) on `FixPath()`, `RemovePath()`, and `SwitchVersion()` from `nil` `ActivePhpLocations`
- **Severity**: `P0 Critical`
- **Category**: Live Wails Crash
- **Affected Files & Verified Lines**:
  - `pkg/core/environment.go:238,268` (`CheckPathStatus`)
  - `app.go:49-51` (`GetState`), `app.go:77-82` (`SwitchVersion`), `app.go:194-202` (`FixPath`, `RemovePath`)
  - `src/gui/renderer/app.js:205-207,219-221,1093`
- **Current Behavior per Runtime / UI**:
  - `core.CheckPathStatus()` (`pkg/core/environment.go:238`) declares `var locations []string` (a `nil` slice). When zero `php.exe` files exist on `PATH` (for example, right after clicking `"❌ Remove from User PATH"` when YAWPS was the sole PHP on `PATH`), `ActivePhpLocations` stays `nil`, which serializes to JSON `null`.
  - `App.GetState()` (`app.go:49-51`) explicitly converts `nil` to `[]string{}`, and `refreshAppState()` (`app.js:577-579`) adds a JS guard. However, `App.SwitchVersion()` (`app.go:81`), `App.FixPath()` (`app.go:196`), and `App.RemovePath()` (`app.go:201`) return `core.CheckPathStatus()` directly **without** normalizing `nil` to `[]string{}`.
  - `btn-fix-path` and `btn-remove-path` handlers (`app.js:205-207,219-221`) overwrite `appState.pathStatus = newStatus` and immediately invoke `renderEnvironmentTab()`, which accesses `appState.pathStatus.activePhpLocations.length` (`app.js:1093`).
- **Root Cause & User Impact**:
  - In the Wails desktop app, clicking `"❌ Remove from User PATH"` (when no external `php.exe` exists on `PATH`) throws an uncaught `TypeError: Cannot read properties of null (reading 'length')`, aborting the handler before the confirmation toast appears and leaving the Environment tab broken.
- **Suggested Remediation Options**:
  1. Initialize `locations := make([]string, 0)` in `core.CheckPathStatus()` (`pkg/core/environment.go:238`) so Go never returns a `nil` slice for `ActivePhpLocations` across any caller (`GetState`, `FixPath`, `RemovePath`, `SwitchVersion`).
  2. Add defensive `!Array.isArray(appState.pathStatus.activePhpLocations)` guard in `renderEnvironmentTab()` (`app.js:1093`) or normalize in a shared helper.
- **OpenSpec Change Proposal Notes**:
  - **Capabilities**: `php-version-switching-and-path`, `desktop-gui-workspace`
  - **Proposal**: Require non-null empty array `[]` for `PathStatus.activePhpLocations` across all RPC methods returning `PathStatus`.
- **Verification Criteria**:
  - Go unit test on `CheckPathStatus()` with empty `PATH` asserting `locations != nil` and `json.Marshal` yields `"activePhpLocations":[]` (not `null`).
  - `GOOS=windows GOARCH=amd64 go vet ./...` exits `0`.
  - Windows Wails UI test: click `❌ Remove from User PATH` on a machine with no external PHP and verify zero console `TypeError` and clean `"No php.exe detected in system PATH yet."` render.

---

### Section 2: Core Runtime Parity Gaps & State Bugs (Go vs Node)

#### TODO-004: Broken `php.ini` Patch Migration in Both Runtimes, Swallowed Errors & Node Backward Progress / Empty Query Bug
- **Severity**: `P1 High`
- **Category**: Core State & Parity
- **Affected Files & Verified Lines**:
  - `pkg/core/updater.go:60-73,85,89,95` (`UpdateVersion`)
  - `pkg/core/extensions.go:57-79` (`ResolveVersionDir`)
  - `src/core/updater.js:58-72,80-84,101-115` (`migratePhpSettings`, `performUpdate`)
  - `src/core/extensions.js:37-52` (`resolveVersionDir`)
- **Current Behavior per Runtime / UI**:
  - **Go (`pkg/core/updater.go:60-73`)**: Matches `targetUpdate` using `strings.EqualFold(u.CurrentVersion, versionId) || strings.Contains(u.CurrentVersion, versionId)` (so queries like `"8.3"` or `""` match), but lines `72-73` call `GetExtensions(versionId)` and `GetDirectives(versionId)` with raw `versionId` instead of `targetUpdate.CurrentVersion`! Passing `"8.3"` causes `ResolveVersionDir("8.3")` (`extensions.go:66-78`) to fail (`"PHP version '8.3' not found"`), which lines `72-73` silently discard (`_`). Passing `""` matches `updates[0]` via `strings.Contains(..., "") == true` while `GetExtensions("")` / `GetDirectives("")` read the *currently active* version—silently migrating the wrong PHP version's config! Lines `85,89,95` also discard errors from `SetExtensionStatus`, `UpdateDirectives`, and `SwitchVersion`.
  - **Node (`src/core/updater.js:58-72,105`)**: `performUpdate` calls `migratePhpSettings(target.path, installResult.targetDir)`, passing **full directory paths** (`C:\Users\...\.yawps\versions\php-8.3.x-...`) into `getExtensions`, `setExtensionStatus`, `getDirectives`, and `updateDirectives`. All four invoke `resolveVersionDir(versionId)` (`src/core/extensions.js:37-52`), which joins `VERSIONS_DIR` with `versionId` (`path.join(VERSIONS_DIR, versionId)`) or compares `v.id === versionId || v.version === versionId`—never matching a full path! `resolveVersionDir` throws `'PHP version ... not found.'`, which `migratePhpSettings` catches and swallows as a warning (`updater.js:70-72`).
  - **Node Empty Query & Progress Ordering (`src/core/updater.js:80-84,101-115`)**: Empty/undefined `installedIdOrVersion` throws `TypeError` on `.toLowerCase()` or matches `installed[0]` via `startsWith('')`. Forwarding `onProgress` directly to `installRelease` emits `completed (100%)` (`installer.js:192`) *before* `migrating (95%)` and `switching (98%)` (`updater.js:104-110`), causing the GUI progress bar to jump backward and trigger early `2500ms` auto-hide (`app.js:561-566`).
- **Root Cause & User Impact**:
  - Patch updates in Node/Electron **never migrate `php.ini` extensions or directives** (every patch update loses user settings). Go CLI/API patch updates using prefix queries (`"8.3"`) or `""` fail migration or cross-contaminate settings from another branch.
- **Suggested Remediation Options**:
  1. In Go `pkg/core/updater.go:72-73`, pass `targetUpdate.CurrentVersion` (rejecting empty `versionId` at entry) and surface/aggregate migration or `SwitchVersion` errors/warnings instead of `_ =`.
  2. In Node `src/core/updater.js:105`, pass `target.id` and `updateInfo.release.id` to `migratePhpSettings` (or support full directory paths inside `resolveVersionDir`), validate non-empty `installedIdOrVersion` before lookup, and scale/suppress `installRelease`'s `completed (100%)` event inside `performUpdate` until migration and switching finish.
- **OpenSpec Change Proposal Notes**:
  - **Capabilities**: `php-patch-updater`, `php-ini-and-extension-management`
  - **Proposal**: Add scenarios for branch-query patch migration, empty query rejection, monotonic `update-progress` percentages, and surfaced migration failure warnings.
- **Verification Criteria**:
  - Unit tests in Go (`pkg/core/updater_test.go`) and Node (`node --test`) verifying that updating `"8.3"` migrates enabled extensions (`curl`, `mbstring`) and directives (`memory_limit=512M`) into the new patch `php.ini`, rejects empty `versionId`, and emits monotonic progress (`<= 90%` before migration, `100%` only after switchover).

---

#### TODO-005: Initial `php.ini` Defaults & Bootstrap Parity Gap
- **Severity**: `P1 High`
- **Category**: Core Parity
- **Affected Files & Verified Lines**:
  - `pkg/core/installer.go:178-207,273` (`configureDefaultPhpIni`, `InstallRelease`)
  - `src/core/installer.js:97-152,189-190` (`setupInitialPhpIni`, `installRelease`)
- **Current Behavior per Runtime / UI**:
  - **Node/Electron (`src/core/installer.js:116-151,189-190`)**: Copies `php.ini-development` (fallback `php.ini-production`), uncomments or appends `extension_dir = "ext"`, replaces `;date.timezone =` with `date.timezone = UTC`, auto-enables **8 extensions** (`curl`, `fileinfo`, `mbstring`, `openssl`, `pdo_mysql`, `pdo_sqlite`, `sqlite3`, `zip`), and emits a `"configuring"` (`98%`) progress event.
  - **Go/Wails (`pkg/core/installer.go:178-207,273`)**: Only uncomments `;extension_dir = "ext"` (does not append if absent, does not set `date.timezone = UTC`, enables zero extensions by default), emits no `"configuring"` event, and ignores `configureDefaultPhpIni` errors (`_ =` at line `273`).
- **Root Cause & User Impact**:
  - Fresh PHP installs created by `yawps.exe` (Go) lack `openssl`, `curl`, `mbstring`, and `zip`, causing Composer (`composer.phar` over HTTPS) and frameworks like Laravel/Symfony to fail immediately after install unless the user manually runs `ext enable` or clicks `"⚡ Enable Standard Web Stack"`.
- **Suggested Remediation Options**:
  1. Port Node's `setupInitialPhpIni` defaults (`extension_dir = "ext"` fallback append, `date.timezone = UTC`, and the 8 standard extensions when their DLLs exist) plus the `"configuring"` (`98%`) progress event to `pkg/core/installer.go:178-207,273`, and propagate I/O errors instead of `_ =`.
  2. Guard extension auto-enabling against actual DLLs in `<versionDir>/ext/` (see `TODO-008`).
- **OpenSpec Change Proposal Notes**:
  - **Capabilities**: `php-release-catalog-and-installer`, `php-ini-and-extension-management`
  - **Proposal**: Standardize initial `php.ini` provisioning across both runtimes and update `php-release-catalog-and-installer/spec.md` accordingly.
- **Verification Criteria**:
  - Go and Node unit tests verifying `configureDefaultPhpIni` / `setupInitialPhpIni` against a sample `php.ini-development` produce identical active `extension_dir`, `date.timezone`, and default extension lines without duplicating entries.

---

#### TODO-006: `RemovePath()` / `env remove` Leaves `current` NTFS Junction Intact in Go & Swallows Error
- **Severity**: `P1 High`
- **Category**: Core Parity
- **Affected Files & Verified Lines**:
  - `app.go:199-202` (`RemovePath`)
  - `pkg/cli/cli.go:319-325` (`handleEnv` `"remove"`, `"unlink"`)
  - `pkg/core/environment.go:378-380` (`RemoveFromUserPath`)
  - `src/core/uninstaller.js:161-175` (`removeEnvironmentPath`)
  - `src/gui/main.js:214-217`, `src/cli/index.js:460-475`
  - `src/gui/renderer/app.js:219-223`
- **Current Behavior per Runtime / UI**:
  - **Node/Electron (`uninstaller.js:161-175`, `main.js:214-217`, `src/cli/index.js:466`)**: `removeEnvironmentPath()` unlinks the `CURRENT_LINK` NTFS junction AND removes `CURRENT_LINK` from User `PATH`.
  - **Go/Wails (`app.go:199-202`, `cli.go:319-325`)**: Both `App.RemovePath()` and CLI `env remove` / `env unlink` only call `core.RemoveFromUserPath()`, leaving the `current` junction on disk. Moreover, `app.go:200` ignores any error returned by `RemoveFromUserPath()`, and `app.js:223` always displays `'✔ Removed YAWPS from User PATH and unlinked junction.'` (false under Wails).
- **Root Cause & User Impact**:
  - Behavior diverges between runtimes; in Wails/Go CLI, the UI toast and CLI command `env unlink` promise junction removal that never happens, leaving `GetCurrentVersion()` reporting an active version.
- **Suggested Remediation Options**:
  1. Add `core.RemoveEnvironmentPath() error` in `pkg/core/environment.go` (or `uninstaller.go`) using the safe `os.Lstat` + `cmd.exe /c rmdir` + `os.Remove` junction unlink pattern followed by `RemoveFromUserPath()`.
  2. Call `RemoveEnvironmentPath()` from `App.RemovePath()` (`app.go:199`) and `handleEnv` `"remove"`/`"unlink"` (`cli.go:319`), propagating errors cleanly (`(core.PathStatus, error)` in `app.go` or checking error in `cli.go`).
- **OpenSpec Change Proposal Notes**:
  - **Capabilities**: `php-version-switching-and-path`, `cli-interface`, `desktop-gui-workspace`
  - **Proposal**: Align `removePath` / `env remove` requirement across both runtimes to unlink `current` and clean User `PATH`.
- **Verification Criteria**:
  - Go unit test verifying junction unlinking helper removes a symlink/directory cleanly without deleting target files.
  - Windows Wails & Go CLI test: run `yawps env remove` and verify `%USERPROFILE%\.yawps\current` no longer exists and `GetCurrentVersion()` returns `nil`.

---

#### TODO-007: Dangling NTFS Junction Failure & Version Discovery Bugs (`GetCurrentVersion`, `getInstalledVersions`)
- **Severity**: `P1 High`
- **Category**: Core State & Parity
- **Affected Files & Verified Lines**:
  - `src/core/environment.js:9-32,55,121-136` (`getCurrentVersion`, `getInstalledVersions`, `switchVersion`)
  - `src/core/uninstaller.js:111-122,163-171` (`uninstallVersion`, `removeEnvironmentPath`)
  - `pkg/core/environment.go:37-87,126` (`GetCurrentVersion`, `GetInstalledVersions`)
- **Current Behavior per Runtime / UI**:
  - **Node dangling junction (`environment.js:11,122`, `uninstaller.js:112,163`)**: All four checks use `fs.existsSync(CURRENT_LINK)`. On Node/Windows, `fs.existsSync` follows the junction target and returns `false` when the target directory was deleted externally! Thus `switchVersion` skips unlinking the broken `CURRENT_LINK`, and `fs.symlinkSync(target.path, CURRENT_LINK, 'junction')` (`environment.js:136`) throws **`EEXIST: file already exists`**.
  - **Node `isActive: null` & case sensitivity (`environment.js:55`)**: `const isActive = current && current.id === entry.name` evaluates to `null` (instead of `false`) when `current === null`, violating boolean DTO contract (`models.ts:246`), and performs case-sensitive ID comparison on Windows paths (Go uses `strings.EqualFold` at `environment.go:126`).
  - **Node `getCurrentVersion` omitted fields (`environment.js:22-28`)**: Returns `{ id, path, version, type, arch }`, omitting `isActive`, `phpExe`, `phpIni` (present in `getInstalledVersions` and Go `GetCurrentVersion`).
  - **Go `GetCurrentVersion` missing target verification (`environment.go:51-86`)**: Checks `os.Lstat(curLink)` and `os.Readlink(curLink)` without checking whether `target` or `<target>/php.exe` still exists on disk, reporting a manually deleted folder as active.
- **Root Cause & User Impact**:
  - Deleting a PHP version folder manually locks out Node `switchVersion` with `EEXIST` until the user manually runs `rmdir` on `current`; meanwhile Go continues reporting the deleted version as active, and Node's `isActive: null` breaks strict boolean consumers.
- **Suggested Remediation Options**:
  1. Replace `fs.existsSync(CURRENT_LINK)` with `fs.lstatSync(CURRENT_LINK)` (wrapped in `try/catch`) in `environment.js` and `uninstaller.js` whenever checking or unlinking `CURRENT_LINK`.
  2. In `getCurrentVersion` (`environment.js:15-28`) and `GetCurrentVersion` (`environment.go:51-86`), verify `php.exe` exists inside `target` (returning `null`/`nil` on dangling junction) and include `isActive: true`, `phpExe`, `phpIni` in Node.
  3. Fix `Boolean(current && current.id.toLowerCase() === entry.name.toLowerCase())` at `src/core/environment.js:55`.
- **OpenSpec Change Proposal Notes**:
  - **Capabilities**: `php-version-switching-and-path`
  - **Proposal**: Add scenarios for dangling `current` junction recovery and strict `VersionInfo` schema parity.
- **Verification Criteria**:
  - Node unit test creating a symlink to a temporary dir, deleting the target dir, and asserting `switchVersion` succeeds without `EEXIST` and `getInstalledVersions` emits boolean `isActive` (`false` when inactive, never `null`).
  - Go unit test verifying `GetCurrentVersion` returns `nil` if target `php.exe` is missing.

---

#### TODO-008: Missing `php.ini` Handling in `GetExtensions` & Unchecked `.dll` Existence in `SetExtensionStatus`
- **Severity**: `P2 Medium`
- **Category**: Core Parity
- **Affected Files & Verified Lines**:
  - `pkg/core/extensions.go:87-91,159-206` (`GetExtensions`, `SetExtensionStatus`)
  - `app.go:152-158` (`GetExtensions`)
  - `src/core/extensions.js:62-64,139-186` (`getExtensions`, `setExtensionStatus`)
  - `src/gui/renderer/app.js:997-1012` (`enableCommonWebExtensions`)
- **Current Behavior per Runtime / UI**:
  - **Missing `php.ini`**: Node `getExtensions` (`extensions.js:62-64`) throws `php.ini not found in ...`, whereas Go `GetExtensions` (`extensions.go:87-91`) silently defaults `iniContent = ""` (reporting all DLLs as `Enabled: false`), even though Go `SetExtensionStatus` (`line 168`) and `GetDirectives` (`line 217`) return an error. Also `app.go:152-158` swallows `core.GetExtensions` errors and returns `[]core.ExtensionInfo{}`.
  - **Unchecked `.dll` on toggle**: Neither Go `SetExtensionStatus` (`extensions.go:159-206`) nor Node `setExtensionStatus` (`extensions.js:139-186`) checks whether `<versionDir>/ext/php_<id>.dll` (or `php_opcache.dll`) actually exists on disk before writing `extension=<id>` into `php.ini`. Clicking `"⚡ Enable Standard Web Stack"` (`app.js:1001-1006`) or running `yawps ext enable nonexistent` writes broken extensions into `php.ini` (causing PHP CLI startup warnings like `PHP Warning: PHP Startup: Unable to load dynamic library`).
- **Root Cause & User Impact**:
  - Divergent error behavior when `php.ini` is missing, plus PHP runtime startup warnings caused by enabling nonexistent extensions.
- **Suggested Remediation Options**:
  1. Make Go `GetExtensions` return `fmt.Errorf("php.ini not found in %s", vDir)` on missing `php.ini` and propagate the error from `App.GetExtensions(versionId) ([]core.ExtensionInfo, error)`.
  2. Validate that the target `.dll` exists in `ext/` (or `<versionDir>/php_opcache.dll`) inside `SetExtensionStatus` / `setExtensionStatus` (or skip missing DLLs gracefully in `enableCommonWebExtensions` when batch-enabling).
- **OpenSpec Change Proposal Notes**:
  - **Capabilities**: `php-ini-and-extension-management`
  - **Proposal**: Standardize missing-`php.ini` error behavior and DLL existence checks before writing `extension=` lines.
- **Verification Criteria**:
  - Go & Node unit tests asserting `GetExtensions` returns error when `php.ini` is missing and `SetExtensionStatus("bogus", true)` fails without modifying `php.ini`.

---

#### TODO-009: `FetchRemoteReleases`, `FindRelease` & Semver Pre-Release Comparison Parity Gaps
- **Severity**: `P2 Medium`
- **Category**: Core Parity
- **Affected Files & Verified Lines**:
  - `pkg/core/releases.go:20-47,78-100,151,168-237` (`ReleaseInfo`, `CompareVersions`, `FetchRemoteReleases`, `FindRelease`)
  - `src/core/releases.js:8-12,36-50,61-114` (`fetchReleases`, `compareVersions`, `findRelease`)
  - `pkg/core/composer.go:225-252`, `src/core/composer.js:116-129`
  - `src/gui/renderer/wailsjs/go/models.ts:155-186`
- **Current Behavior per Runtime / UI**:
  - **DTO differences**: Go `ReleaseInfo` (`releases.go:20-32`) omits `mtime` despite unmarshaling `MTime` in `rawBuildEntry` (`lines 40-43`), lowercases `compiler` (`line 151`), and uses `""` for missing `sha256` (Node keeps `mtime: buildData.mtime || null`, preserves `compiler` case, uses `null` for `sha256`).
  - **HTTP timeout**: Go enforces `Timeout: 15 * time.Second` (`releases.go:46`); Node `fetch(RELEASES_JSON_URL)` (`releases.js:8-12`) has no timeout / `AbortSignal.timeout(15000)`.
  - **`FindRelease` behavior**: Go matches exact `r.ID` across all flavors (`releases.go:208-213`) and returns `(*ReleaseInfo, error)` (`line 236`), while Node (`releases.js:78-114`) pre-filters by `type`/`arch` first (`lines 83-85`)—failing to resolve `'php-8.3.36-ts-x64'` under default `{ type: 'nts' }`—and returns `null`.
  - **Pre-release semver blindness**: Go `parseVersionParts` (`releases.go:78-100`) and Node `compareVersions` (`releases.js:61-73`) ignore suffixes like `RC1`/`alpha`/`beta` (`"8.4.0RC1"` compares equal to `"8.4.0"`, and Composer `"2.8.0-RC1"` compares equal to `"2.8.0"` in `pkg/core/composer.go:228` and `src/core/composer.js:118`).
  - **Dead code**: `verRegex` at `pkg/core/releases.go:47` is unused.
- **Root Cause & User Impact**:
  - Node CLI/API cannot look up a release by full `php-...-ts-x64` ID without explicit `--ts`; hung connections stall Node indefinitely; pre-release PHP/Composer versions misorder or falsely satisfy `IsUpToDate`.
- **Suggested Remediation Options**:
  1. Add `MTime string \`json:"mtime"\`` to Go `ReleaseInfo` (and regenerate `models.ts`), remove dead `verRegex`, and standardize `compiler` casing.
  2. Add `signal: AbortSignal.timeout(15000)` to Node `fetchReleases`, and add exact `r.id` lookup before `type`/`arch` filtering in Node `findRelease`.
  3. Extend `CompareVersions` (and Composer `compareVersions`) in both runtimes so pre-release versions rank below stable releases (`8.4.0-RC1 < 8.4.0`).
- **OpenSpec Change Proposal Notes**:
  - **Capabilities**: `php-release-catalog-and-installer`, `composer-lifecycle-and-packages`
  - **Proposal**: Define canonical `ReleaseInfo` fields (including `mtime`), 15s catalog timeout, full-ID lookup precedence, and pre-release semver comparison rules.
- **Verification Criteria**:
  - Go & Node unit tests covering `releases.json` parsing (`mtime` preserved, `*pack*` filtered), `findRelease('php-8.3.36-ts-x64')`, and `CompareVersions("8.4.0", "8.4.0RC1") > 0`.

---

#### TODO-010: `FullCleanup` DTO Mismatch & Hardcoded Success Flags in Go
- **Severity**: `P2 Medium`
- **Category**: Core Parity
- **Affected Files & Verified Lines**:
  - `pkg/core/uninstaller.go:11-15,115-136` (`CleanupResult`, `FullCleanup`)
  - `app.go:219-222` (`FullCleanup`)
  - `src/core/uninstaller.js:183-205` (`fullCleanup`)
  - `src/gui/renderer/wailsjs/go/models.ts:3-18`
- **Current Behavior per Runtime / UI**:
  - **DTO mismatch**: Go `CleanupResult` returns `{ baseDirDeleted, pathRemoved, junctionRemoved }` (`uninstaller.go:11-15`), omitting `success`. Node `fullCleanup` returns `{ success: true, pathRemoved: true, baseDirDeleted }` (`uninstaller.js:200-204`), omitting `junctionRemoved`.
  - **Misleading flags**: Go `FullCleanup` (`uninstaller.go:117-135`) discards all errors from `rmdir`, `os.Remove`, `RemoveFromUserPath()`, and `os.RemoveAll(bDir)`, then **hardcodes `PathRemoved: true` and `JunctionRemoved: true`** (`lines 133-134`) even if PATH/junction removal failed! Node similarly hardcodes `pathRemoved: true` (`line 202`) without inspecting `removeEnvironmentPath()`.
- **Root Cause & User Impact**:
  - Callers cannot detect partial cleanup failure (e.g., locked `php.exe` or Registry write failure) and receive divergent result objects across runtimes.
- **Suggested Remediation Options**:
  1. Unify `CleanupResult` across Go and Node: `{ success, pathRemoved, junctionRemoved, baseDirDeleted, error? }`.
  2. Track actual return values of junction unlink, `RemoveFromUserPath()`, and `os.RemoveAll(baseDir)` in both runtimes (`success = pathRemoved && junctionRemoved && (!purgeAll || baseDirDeleted)`), returning errors if `baseDir` deletion fails.
- **OpenSpec Change Proposal Notes**:
  - **Capabilities**: `php-version-switching-and-path`
  - **Proposal**: Align `CleanupResult` schema and error propagation across Go and Node.
- **Verification Criteria**:
  - Unit tests verifying `FullCleanup` reports `junctionRemoved: false` / `pathRemoved: false` on failure rather than hardcoded `true`.

---

### Section 3: CLI Command, Flag & Exit-Code Divergences (Go vs Node)

#### TODO-011: CLI `update [version]` Parity Gap (Go Check-Only vs Node Execute + Migration) & Help/UI Misalignment
- **Severity**: `P1 High`
- **Category**: CLI Divergence
- **Affected Files & Verified Lines**:
  - `pkg/cli/cli.go:212-229,536` (`handleUpdate`, `printHelp`)
  - `src/cli/index.js:315-358` (`update [version]`)
  - `src/gui/renderer/index.html:612-613`
- **Current Behavior per Runtime / UI**:
  - **Node CLI (`src/cli/index.js:315-358`)**: `yawps update` without args lists available patch updates; `yawps update <version>` executes `performUpdate` with progress output, `php.ini` migration, and active switchover.
  - **Go CLI (`pkg/cli/cli.go:212-229`)**: `handleUpdate(args []string)` completely ignores `args` and only runs `core.CheckUpdates()`. Yet `printHelp()` (`cli.go:536`) and the GUI CLI Cheat Sheet (`index.html:612-613`) falsely advertise `"update [version] — Check and install patch updates"`.
- **Root Cause & User Impact**:
  - Users running `yawps.exe update 8.3` on the primary Go binary cannot apply patch updates via CLI, contradicting built-in `--help` and GUI documentation.
- **Suggested Remediation Options**:
  1. Update `handleUpdate(args)` in `pkg/cli/cli.go:212` to mirror Node: when `len(args) == 0`, list available updates (plus hint `Run 'yawps update <version>' to apply`); when `len(args) > 0`, invoke `core.UpdateVersion(args[0], onProgress)` (after fixing `TODO-004`).
- **OpenSpec Change Proposal Notes**:
  - **Capabilities**: `cli-interface`, `php-patch-updater`
  - **Proposal**: Mandate `yawps update <version>` execution parity in `cli-interface/spec.md`.
- **Verification Criteria**:
  - Go CLI unit test injecting mock/stub updater or integration test on Windows verifying `yawps update` lists updates and `yawps update 8.3` invokes `UpdateVersion("8.3")` with progress output.

---

#### TODO-012: CLI `cleanup` / `uninstall-self` Inverted `purgeAll` Default, Missing Flags/Aliases & Non-TTY Destructive Purge
- **Severity**: `P1 High`
- **Category**: CLI Divergence & Safety
- **Affected Files & Verified Lines**:
  - `pkg/cli/cli.go:58-60,363-377,552` (`handleCleanup`, `printHelp`)
  - `src/cli/index.js:503-537` (`cleanup` / `uninstall-self`)
  - `src/gui/renderer/index.html:632-633`
- **Current Behavior per Runtime / UI**:
  - **Go CLI (`pkg/cli/cli.go:363-377`)**: `purgeAll` defaults to **`false`** (requires `--purge` or `--all`); has no confirmation prompt, no `-y`/`--yes`/`--force`/`--keep-versions`, and no `uninstall-self` alias (`printHelp` at `cli.go:552` also omits `--all`).
  - **Node CLI (`src/cli/index.js:503-537`)**: `purgeAll = !options.keepVersions` defaults to **`true`** (`index.js:513`); supports `uninstall-self` alias, `-y`/`--yes`, `--force`, `--keep-versions`; prompts `y/N` only if `!force && process.stdin.isTTY` (`line 515`). In a non-TTY context (piped stdin or CI script), `yawps cleanup` **silently deletes `%USERPROFILE%\.yawps` without `-y`/`--force`**!
- **Root Cause & User Impact**:
  - Running `yawps cleanup` has **opposite destructive semantics** depending on which runtime is executed (`Go` preserves versions; `Node` deletes all PHP versions, downloads, and configs, and does so without confirmation in non-TTY scripts). GUI Cheat Sheet (`index.html:632-633`) documents Node's wipe-by-default behavior.
- **Suggested Remediation Options**:
  1. Align both CLIs on a **safe non-destructive default** or explicit confirmation policy: e.g., require `--purge` / `--all` to delete `BASE_DIR` (or keep default `purgeAll` only with interactive confirmation and **refuse destructive non-TTY purge unless `-y`/`--yes`/`--force` is explicitly passed**).
  2. Support consistent aliases/flags across both runtimes (`cleanup` / `uninstall-self`, `--purge`, `--keep-versions`, `-y`/`--yes`/`--force`).
- **OpenSpec Change Proposal Notes**:
  - **Capabilities**: `cli-interface`, `php-version-switching-and-path`
  - **Proposal**: Unify `cleanup` flags, safety prompt, and non-TTY guard across Go and Node CLIs.
- **Verification Criteria**:
  - CLI tests verifying piped stdin (`!isTTY`) without `--yes`/`--force` aborts non-zero instead of purging `BASE_DIR`, and verifying `--keep-versions` vs `--purge` behave identically in Go and Node.

---

#### TODO-013: Both CLIs Exit `0` on All Errors & Misreport Composer / PATH Failures
- **Severity**: `P1 High`
- **Category**: CLI Error & Exit Codes
- **Affected Files & Verified Lines**:
  - `main.go:60-63`
  - `pkg/cli/cli.go:11-82,120,165,187,215,238,268,314,320,331,351,388,422-426,440-444,452,477-479,493-495,513`
  - `src/cli/index.js:165,217,262,284,356,393,405,417,453-456,473,498,535,567,574-595,603-613,623-633,671,674,690,693,712`
- **Current Behavior per Runtime / UI**:
  - **Both CLIs exit `0` on all errors**:
    - Go `cli.Run(args)` (`cli.go:11-82`, `main.go:60-63`) returns `bool` (`true` = handled, not success), prints all errors via `fmt.Printf` to `os.Stdout`, and terminates `0` on unknown commands, missing args, failed downloads, SHA256 mismatches, and failed Composer operations.
    - Node (`src/cli/index.js`) logs errors in `catch` / `!res.success` blocks via `console.error` without setting `process.exitCode = 1` or calling `process.exit(1)`.
  - **`composer install` & `composer update` falsely print success**:
    - Both Go (`cli.go:422-426,440-444`) and Node (`src/cli/index.js:603-611,623-631`) check only thrown `err` and ignore `res.Success === false` (which `InstallComposer` / `UpdateComposer` return with `err == nil` on `--version` verify or `self-update` failure!). Both print **`✔ Composer installed successfully!`** / **`✔ Composer updated successfully!`** on failure!
  - **Go `composer require` & `remove` print `❌ Failed: <nil>`**:
    - `RunComposerCommand` (`pkg/core/composer.go:778-784`) returns `(&ComposerOperationResult{Success: false, Error: err.Error()}, nil)` when `composer` exits non-zero. Because `err == nil`, `cli.go:478,494` prints `❌ Failed: <nil>`.
  - **Node `composer status` missing `try/catch` (`src/cli/index.js:574-595`)**: Unhandled Promise rejection if `getComposerStatus()` throws.
  - **Node `env fix` ignores failure (`src/cli/index.js:453-454`)**: Prints `✔ Successfully added to User PATH!` even if `addToUserPath()` returned `false`.
- **Root Cause & User Impact**:
  - CI scripts and shell automation calling `yawps install ...`, `yawps use ...`, or `yawps composer ...` cannot detect failures via `$?` / `$LASTEXITCODE`, and users get `✔` success messages or `<nil>` error diagnostics on failed Composer commands.
- **Suggested Remediation Options**:
  1. Change Go `cli.Run(args) int` (exit code) and call `os.Exit(code)` in `main.go:60-63` (printing CLI errors to `os.Stderr`).
  2. Set `process.exitCode = 1` in every error/failure branch in `src/cli/index.js` and wrap `composer status` in `try/catch`.
  3. Inspect `res.Success` (`res.success`) in `composer install`/`update`, print `res.Error` / `res.Output` in Go `composer require`/`remove`, and check `addToUserPath()` return value in Node `env fix`.
- **OpenSpec Change Proposal Notes**:
  - **Capabilities**: `cli-interface`, `composer-lifecycle-and-packages`
  - **Proposal**: Codify non-zero exit codes (`1`) for all CLI errors/unknown commands and strict `res.Success` handling.
- **Verification Criteria**:
  - Go and Node CLI tests asserting exit code `1` on unknown command, missing version, failed `SwitchVersion`, and `!res.Success` Composer operations, plus stderr verification (no `<nil>` output).

---

#### TODO-014: CLI `list-remote` & `install` Parity Bugs (`--x86`, Row Cap, Hardcoded `"TS x64"`, Installed Badge, `--no-use`, Progress Glitch)
- **Severity**: `P2 Medium`
- **Category**: CLI Divergence
- **Affected Files & Verified Lines**:
  - `pkg/cli/cli.go:105-179,532` (`handleListRemote`, `handleInstall`, `printHelp`)
  - `src/cli/index.js:132-219,344-346` (`list-remote`, `install`, `update`)
- **Current Behavior per Runtime / UI**:
  - **`list-remote` / `available`**:
    - Go (`cli.go:105-136`) supports `--ts` and `--x86`, caps output at 15 rows (`line 130`), and **line 135 hardcodes `"Showing top %d %s x64 releases..."`** even when `--x86` was passed (`printHelp` at `line 532` also omits `[--x86]`).
    - Node (`index.js:132-167`) has no `--x86` flag (hardcodes `r.arch === 'x64'`), displays all rows with a `Status` column, and **`installedVersions.has(rel.version)` (`lines 144,152`) ignores `type` and `arch`**, falsely marking TS releases as `✔ Installed` when only NTS is installed.
  - **`install`**:
    - Go (`cli.go:138-179`) supports `--ts` and `--x86`, lacks `--no-use`, and line `177` unconditionally runs `_, _ = core.SwitchVersion(res.Release.ID)` while printing `★ Switched active PHP to:` even if `SwitchVersion` failed.
    - Node (`index.js:170-219`) lacks `--x86` (hardcodes `x64`), supports `--use` / `--no-use`, explicitly checks `pathStatus.isInUserPath` and calls `addToUserPath()` even with `--no-use` (`lines 203-215`), and omits a newline after `\r📥 Downloading...` when switching to `verifying` because `lastLine` was never updated during `downloading` (`lines 190-195`). Meanwhile `update` (`lines 344-346`) prints a separate line per download progress chunk.
- **Root Cause & User Impact**:
  - Node cannot install `x86` builds via CLI and mislabels installed flavors; Go hides older releases beyond 15, prints false `x64` / `Switched` messages, and cannot skip activation (`--no-use`).
- **Suggested Remediation Options**:
  1. Add `--x86` support to Node `list-remote` and `install`, and add `--no-use` (plus `SwitchVersion` error check) to Go `install`.
  2. Fix Go `cli.go:135` footer to print `%s` for `arch`, document `[--x86]` in `cli.go:532`, and fix Node `list-remote` installed matching to compare `v.id` (version + `type` + `arch`).
  3. Fix Node `install` progress line break when transitioning from `\r📥 Downloading...` to `⚙` stages and throttle/CR-format `update` progress output.
- **OpenSpec Change Proposal Notes**:
  - **Capabilities**: `cli-interface`, `php-release-catalog-and-installer`
  - **Proposal**: Align `list-remote` and `install` flags, installed-status checks, and `x86` support across both CLIs.
- **Verification Criteria**:
  - CLI tests verifying `list-remote --x86`, `list-remote --ts` installed badge accuracy when only NTS exists, and `install --no-use` preserving current junction.

---

#### TODO-015: CLI `uninstall` (`rm`, Prompts, `--no-switch`, Branch Prefix, Swallowed Switch Error) & `cache clean [version]` Gaps
- **Severity**: `P2 Medium`
- **Category**: CLI Divergence
- **Affected Files & Verified Lines**:
  - `pkg/cli/cli.go:66,328-361,550` (`handleCache`, `handleUninstall`, `printHelp`)
  - `pkg/core/uninstaller.go:25-48,50-113` (`CleanCachedArchives`, `UninstallVersion`)
  - `src/cli/index.js:222-264,478-500` (`uninstall`, `cache clean`)
  - `src/core/uninstaller.js:49-83,93-155`
- **Current Behavior per Runtime / UI**:
  - **`uninstall` / `remove` / `rm`**:
    - Node (`index.js:222-264`) supports `rm` alias, `-y`/`--yes`/`--force`, `--clean-cache`, `--no-switch`, branch prefix matching (`findInstalledVersion` at `uninstaller.js:38`), and interactive TTY confirmation—but **silently skips confirmation on non-TTY stdin (`line 234`)**.
    - Go (`cli.go:66,339-361`) omits `rm` alias, omits `-y`/`--yes`/`--force`/`--no-switch`, has no prompt, only matches exact ID/version in `UninstallVersion` (`uninstaller.go:54`), and line `84` swallows `SwitchVersion(alternative.ID)` errors (`switchedTo, _ = ...`) before deleting `target.Path` (potentially leaving a dangling `current` junction).
  - **`cache clean [version]`**:
    - Node (`index.js:478-500`, `uninstaller.js:49-83`) accepts optional `[version]`, strips `"php-"` prefix, and deletes matching `.zip` files.
    - Go (`cli.go:328-337,550`) ignores `args[1]` (calls `CleanCachedArchives("")` wiping all cached zips), omits `[version]` from `printHelp()`, returns `nil` slice on 0 files (`uninstaller.go:33,47`), does not strip `"php-"` prefix (`line 39`), and does not skip directories ending in `.zip`.
- **Root Cause & User Impact**:
  - `yawps rm 8.3` fails in Go; `yawps cache clean 8.3.36` unexpectedly deletes *all* cached zips in Go; Node piped `yawps uninstall 8.3` deletes without confirmation or `-y`.
- **Suggested Remediation Options**:
  1. Add `rm` alias, `--no-switch`, `-y`/`--yes`/`--force`, branch prefix lookup, and `SwitchVersion` error handling to Go `uninstall`. Require `-y`/`--force` when `!isTTY` in Node `uninstall`.
  2. Pass optional `args[1]` to `CleanCachedArchives(filter)` in Go (`cli.go:330`), strip `"php-"` prefix, skip `!e.IsDir()` entries, return `[]string{}` instead of `nil`, and document `[version]` in `printHelp()`.
- **OpenSpec Change Proposal Notes**:
  - **Capabilities**: `cli-interface`, `php-version-switching-and-path`, `php-release-catalog-and-installer`
  - **Proposal**: Align `uninstall` and `cache clean [version]` syntax and safety checks.
- **Verification Criteria**:
  - Go & Node unit tests verifying `CleanCachedArchives("php-8.3.36")` matches only matching files (ignoring directories), and `UninstallVersion` handles fallback switch errors without leaving dangling junctions.

---

#### TODO-016: CLI `composer` & `current` Parity Gaps (`require -v`, `packages` Details, Aliases, `powershell.exe` Wrapper & Uncaught `spawn`)
- **Severity**: `P2 Medium`
- **Category**: CLI Divergence
- **Affected Files & Verified Lines**:
  - `pkg/cli/cli.go:194-210,379-522,540-546` (`handleCurrent`, `handleComposer`, `printHelp`)
  - `src/cli/index.js:289-312,540-714` (`current`, `composer`)
- **Current Behavior per Runtime / UI**:
  - **`composer` subcommands**:
    - Go (`cli.go:379-522`) defaults bare `yawps composer` to `status` and adds aliases `info`, `pkgs`, `clean-uninstall`, and `--all` (all omitted in `cli.go:540-546` and absent in Node `index.js:540-714`), whereas Go `composer require` (`line 474`) hardcodes `""` version (missing Node's `-v, --pkg-version <version>` at `index.js:661`), Go `composer packages` (`line 463`) omits `Constraint` and `Binaries` (printed by Node at `lines 650-652`), and Node `composer status` (`line 587`) omits the `Global Bin` line (`index.js:558`, `cli.go:404`).
  - **`current`**:
    - Go (`cli.go:205-208`) invokes `exec.Command(cur.PhpExe, "-v")` directly (target dir exe, ignoring `cmd.Run()` error).
    - Node (`index.js:304-311`) spawns `'powershell.exe'` running `& "${CURRENT_LINK}\php.exe" -v` without attaching `result.on('error', ...)` (an async spawn error crashes uncaught).
- **Root Cause & User Impact**:
  - Users cannot specify version constraints with `yawps.exe composer require`, miss package CLI binary hints in Go, or hit inconsistent alias behavior.
- **Suggested Remediation Options**:
  1. Add `-v` / `--pkg-version` flag parsing to Go `composer require` (`cli.go:467`), print `Constraint` and `Binaries` in `composer packages`, and unify aliases (`info`, `pkgs`, `clean-uninstall`, `--all`) and `--help` text in both CLIs.
  2. In Node `current`, spawn `phpExe` directly with `{ stdio: 'inherit' }` (matching Go, avoiding slow PowerShell startup) and handle `'error'`/`'exit'` events with proper exit codes.
- **OpenSpec Change Proposal Notes**:
  - **Capabilities**: `cli-interface`, `composer-lifecycle-and-packages`
  - **Proposal**: Align `composer` subcommand flags/aliases/output and `current` execution across both CLIs.
- **Verification Criteria**:
  - CLI tests checking `composer require laravel/installer -v ^5.0`, `composer packages` formatting, and `current` error handling if `php.exe` fails to spawn.

---

#### TODO-017: Go CLI Flag-Before-Arg Positional Bug, Silent No-Ops, Case-Sensitivity, Hardcoded OS Status & `AttachConsole` Stdin/Stderr Gaps
- **Severity**: `P2 Medium`
- **Category**: CLI Parsing & Windows Console
- **Affected Files & Verified Lines**:
  - `main.go:20-45,49,70,96` (`attachParentConsole`, `main`)
  - `pkg/cli/cli.go:16,144,232,254-255,283-326,328-337,350`
- **Current Behavior per Runtime / UI**:
  - **Positional argument assumption**: `handleInstall` (`cli.go:144`) assumes `args[0]` is `<version>` (`yawps install --ts 8.3` queries `"--ts"`). Same in `handleUninstall` (`cli.go:350`: `yawps uninstall --clean-cache 8.3`). Unknown flags are silently ignored everywhere.
  - **Silent no-ops**: `handleEnv` (`cli.go:283-326`) has no `default:` branch (`yawps env bogus` prints nothing); `handleCache` (`cli.go:328-337`) prints nothing on `yawps cache` or `yawps cache bogus`.
  - **Hardcoded OS status**: `handleEnv` (`cli.go:289`) hardcodes `✔ Supported (Windows 10+)` rather than checking `osInfo.IsSupported`.
  - **Case sensitivity**: `main.go:49` checks `args[0] == "gui" || args[0] == "ui"` case-sensitively (`yawps GUI` attaches parent console before falling through to GUI); `handleExt` (`cli.go:232,254-255`) compares `"list"`, `"enable"`, `"disable"` case-sensitively.
  - **`attachParentConsole` (`main.go:20-45`)**: Does not rebind `os.Stdin` (`CONIN$` / `STD_INPUT_HANDLE`), which will hang/fail any interactive prompt when built with `-H windowsgui`; also skips `AttachConsole(-1)` for `hStderr` if `hStdout` is redirected to a file while `hStderr` isn't.
  - **Startup errors**: `main.go:70,96` write to `println` and return with exit status `0`.
- **Root Cause & User Impact**:
  - Standard CLI idioms (`yawps install --ts 8.3`) fail unexpectedly in Go, invalid `env`/`cache` commands succeed silently, and interactive Go CLI prompts cannot work reliably under `-H windowsgui`.
- **Suggested Remediation Options**:
  1. Write a small Go argument/flag parser for `pkg/cli/cli.go` separating positional args from `--flags` regardless of order and rejecting unknown flags/subcommands with usage output and exit code `1`.
  2. Lowercase subcommand comparisons in `main.go:49` and `handleExt`, check `osInfo.IsSupported` in `handleEnv`, and rebind `os.Stdin`/`os.Stderr` properly in `attachParentConsole()`.
- **OpenSpec Change Proposal Notes**:
  - **Capabilities**: `cli-interface`, `platform-runtime-and-storage`
  - **Proposal**: Mandate order-independent CLI flag parsing, unknown-subcommand usage errors, and stdin/stdout/stderr parent console binding in Go.
- **Verification Criteria**:
  - Go CLI unit tests for `install --ts 8.3`, `uninstall --clean-cache 8.3`, `env invalid`, `cache invalid`, `ext LIST`, and unknown flag rejection.

---

#### TODO-018: Legacy `win-php` Remnants, Entrypoint Duplication, `yawps gui` OS Check Flag & Unused Node CLI Imports
- **Severity**: `P3 Low`
- **Category**: CLI Hygiene & Packaging
- **Affected Files & Verified Lines**:
  - `pkg/core/environment.go:151`
  - `src/core/environment.js:92`, `src/core/uninstaller.js:158,178-180`
  - `bin/yawps.js:8`, `bin/win-php.js:1-18`, `package.json:6-9`, `win-php.cmd:2`, `win-php.ps1:2`
  - `src/cli/index.js:14,28-29,731-743` (`launchGui`)
- **Current Behavior per Runtime / UI**:
  - Both `pkg/core/environment.go:151` and `src/core/environment.js:92` return `"Install one using: win-php install <version>"` instead of `yawps`. `src/core/uninstaller.js:158,178-180` JSDoc references `Win-PHP` / `.win-php`.
  - `bin/win-php.js` is a byte-for-byte duplicate of `bin/yawps.js`; `package.json:8` maps `"win-php"` to `./bin/yawps.js`, while `win-php.cmd:2` and `win-php.ps1:2` invoke `bin/win-php.js`.
  - `bin/yawps.js:8` and `bin/win-php.js:8` pass `isGui: args.length === 0`, so `yawps gui` / `yawps ui` runs with `isGui: false` and suppresses the native error box on `< Win 10` (whereas `main.go:49` checks `gui`/`ui`).
  - `launchGui()` (`src/cli/index.js:731-743`) calls `require('electron')` without handling missing `devDependencies` (crashes with raw `MODULE_NOT_FOUND` stack trace if installed globally as CLI-only).
  - `src/cli/index.js:14,28-29` imports `installRelease`, `getDirectives`, and `updateDirectives` without using them.
- **Root Cause & User Impact**:
  - Confusing legacy error hints, duplicate entrypoint drift, silent GUI OS alert omission on `yawps gui`, and raw crash if Electron isn't installed.
- **Suggested Remediation Options**:
  1. Update error strings to `yawps install <version>`, point `win-php.cmd`/`win-php.ps1` to `bin/yawps.js` (or keep `bin/win-php.js` as a 1-line re-export), and align `isGui` check with `main.go:49` (`args.length === 0 || ['gui', 'ui'].includes(args[0].toLowerCase())`).
  2. Guard `require('electron')` in `launchGui()` with a friendly message instructing the user to use `yawps.exe` or install Electron; remove unused imports in `src/cli/index.js`.
- **OpenSpec Change Proposal Notes**:
  - **Capabilities**: `cli-interface`, `platform-runtime-and-storage`
  - **Proposal**: Clean up `win-php` error messages, unify `yawps gui` `isGui` detection, and document graceful `launchGui` error handling.
- **Verification Criteria**:
  - `node --check` and `GOOS=windows GOARCH=amd64 go vet ./...`; unit test verifying `launchGui()` friendly error when `electron` is unavailable.

---

### Section 4: Desktop GUI, Bridge, UX & CSS Bugs/Gaps

#### TODO-019: Electron Post-OS-Check Startup Leak, Window Title/Icon Mismatch & Permissive `setWindowOpenHandler` vs Wails External URL Gap
- **Severity**: `P1 High`
- **Category**: Desktop Shell & Security
- **Affected Files & Verified Lines**:
  - `src/gui/main.js:6-8,65-95,97-105`
  - `src/core/osCheck.js:118-127`
  - `main.go:74-93`
- **Current Behavior per Runtime / UI**:
  - **Electron post-OS-check leak (`src/gui/main.js:6-8`, `osCheck.js:118-127`)**: `assertWindows10OrAbove({ isGui: true })` inside Electron calls `app.quit()` and returns `false` without throwing or calling `process.exit(1)`. In `main.js:6-8`, `if (!assertWindows10OrAbove({ isGui: true })) { // comment }` has an **empty body**, so `main.js` continues executing all `require()` calls and registers `app.whenReady().then(() => createWindow())`!
  - **Title & icon mismatch**: `src/gui/main.js:71` sets `title: 'Win PHP Switcher'` (vs `main.go:75` / `index.html:6` `'YAWPS - Yet Another Windows PHP Switcher'`), and `BrowserWindow` (`lines 66-80`) omits `icon` for dev runs.
  - **External link handling asymmetry**:
    - Electron (`main.js:88-94`) delegates `http:` / `https:` popups to `shell.openExternal(url)`, but **returns `{ action: 'allow' }`** for all non-HTTP schemes (`file:`, `javascript:`, `about:blank`) and registers no `will-navigate` handler.
    - Wails (`main.go:74-93`) has **no external browser handler** when `app.js:1445` runs `window.open('https://packagist.org/...', '_blank')` (WebView2 opens a popup WebView window instead of the user's default browser).
- **Root Cause & User Impact**:
  - Unsupported Windows / Linux Electron invocations can briefly spin up or execute main-process handlers; Electron exposes an insecure popup allowlist fallback and legacy title; Wails fails to open Packagist links in the user's browser.
- **Suggested Remediation Options**:
  1. Immediately `app.exit(1)` / `return` early in `src/gui/main.js:6-8` when `!assertWindows10OrAbove({ isGui: true })`.
  2. Update `src/gui/main.js:71` title to `'YAWPS - Yet Another Windows PHP Switcher'`, pass `icon: path.join(__dirname, '../../build/appicon.png')` (or `.ico`), deny all non-HTTP schemes in `setWindowOpenHandler` (`return { action: 'deny' }` + `will-navigate` guard).
  3. In Wails (`app.go` / `src/gui/renderer/app.js`), add an `OpenExternalURL` method (validating `https://` scheme and launching `rundll32 url.dll,FileProtocolHandler` or `runtime.BrowserOpenURL(a.ctx, url)`) or configure WebView2 external URL opening.
- **OpenSpec Change Proposal Notes**:
  - **Capabilities**: `platform-runtime-and-storage`, `desktop-gui-workspace`
  - **Proposal**: Align window title, immediate OS-abort exit, `deny`-default navigation policy, and Wails external URL delegation.
- **Verification Criteria**:
  - On Linux / `< Win 10`, launching Electron does not invoke `createWindow` or register `app.whenReady`.
  - On Windows Wails & Electron, clicking `🌐 Packagist` opens the URL in the system default browser; `file://` popups are denied.

---

#### TODO-020: Broken Packagist `%2F` URLs, Stale Extensions/Directives Dropdown Sync & Custom `date.timezone` Wipe
- **Severity**: `P1 High`
- **Category**: GUI State & Navigation
- **Affected Files & Verified Lines**:
  - `src/gui/renderer/app.js:698-701,878-911,915,1016,1036,1053,1444-1445`
  - `src/gui/renderer/index.html:340-353`
- **Current Behavior per Runtime / UI**:
  - **Broken Packagist URL (`app.js:1444-1445`)**: Uses ``https://packagist.org/packages/${encodeURIComponent(pkg.name)}``, which encodes `/` as `%2F` (e.g. `https://packagist.org/packages/laravel%2Finstaller`), returning **HTTP 404** on Packagist.
  - **Stale Extension & Directives dropdown state (`app.js:698-701,878-911,915,1016`)**:
    1. If the selected version is uninstalled, `appState.selectedExtVersion` / `selectedDirectivesVersion` keep pointing to the deleted ID, failing tab loads.
    2. When installed versions exist but none is active (`isActive: false`), `selectedExtVersion` / `selectedDirectivesVersion` remain `null` even though `<select>` visually displays `installed[0]`, causing `"No PHP version available."` / silent no-op on Save (`line 1044`)!
    3. Clicking `🧩 Extensions` on a non-active card (`lines 698-701`) sets `appState.selectedExtVersion = item.id` without updating `#ext-version-select.value`, so the dropdown displays a different version than the rendered extension switches.
    4. Re-populating dropdowns in `refreshAppState()` (`lines 894-910`) forgets to re-apply `opt.selected = true` when `selectedExtVersion` / `selectedDirectivesVersion` is already set, resetting the `<select>` visually to `installed[0]` while keeping the old `appState` value!
  - **Custom `date.timezone` wipe (`index.html:340-353`, `app.js:1036,1053`)**: `#select-timezone` only includes 12 hardcoded `<option>` values. If `php.ini` specifies another valid IANA zone (e.g., `Asia/Kolkata` or `America/Sao_Paulo`), setting `.value` leaves the dropdown blank (`""`), and clicking `💾 Save Settings` overwrites `date.timezone` with `""`.
- **Root Cause & User Impact**:
  - Packagist links 404; users frequently edit the wrong PHP version's extensions/settings or get `"No PHP version available"` when no version is active; custom timezones are silently erased on save.
- **Suggested Remediation Options**:
  1. Encode vendor and package segments separately (`pkg.name.split('/').map(encodeURIComponent).join('/')`) in `app.js:1444`.
  2. Refactor `populateVersionDropdowns()` to validate `selectedExtVersion` / `selectedDirectivesVersion` against `appState.installed`, fall back to `current.id` or `installed[0].id`, set `select.value = appState.selected...`, and sync `#ext-version-select.value` when clicking card `🧩 Extensions`.
  3. Dynamically append a custom `<option>` to `#select-timezone` when `directives.date_timezone` is non-empty and not among the 12 presets (or support editable/datalist input).
- **OpenSpec Change Proposal Notes**:
  - **Capabilities**: `desktop-gui-workspace`, `php-ini-and-extension-management`, `composer-lifecycle-and-packages`
  - **Proposal**: Add scenarios for Packagist URL formatting, dropdown state synchronization across uninstall/non-active states, and preserving custom `date.timezone` values.
- **Verification Criteria**:
  - Renderer unit/DOM checks (or manual verification) confirming `laravel/installer` builds `https://packagist.org/packages/laravel/installer`, custom `Asia/Kolkata` timezone persists across load/save, and uninstalling/switching keeps `<select>.value` aligned with `appState`.

---

#### TODO-021: Unescaped `innerHTML` XSS Vectors Across Non-Composer Views & `bridge.js` Event Listener Race
- **Severity**: `P1 High`
- **Category**: Security & IPC Bridge
- **Affected Files & Verified Lines**:
  - `src/gui/renderer/app.js:653-688,797,825-847,926,955-972,1102-1127`
  - `src/gui/renderer/bridge.js:9-21,51-74`
- **Current Behavior per Runtime / UI**:
  - **Unescaped `innerHTML` (XSS / HTML injection)**: `escapeHtml()` (`app.js:1119-1127`) is used ONLY inside `renderComposerPackages()` (`lines 1387-1417`). Raw unescaped `innerHTML` interpolation appears in:
    - `renderInstalledList()` (`app.js:653-688`): `item.version`, `item.type`, `item.arch`, `item.id`, `item.phpIni`, `item.path`, `updateInfo.latestVersion`
    - `loadRemoteReleases()` (`app.js:797`): `err.message`
    - `renderRemoteList()` (`app.js:825-847`): remote `rel.version`, `rel.type`, `rel.arch`, `rel.compiler`, `rel.size`, `rel.zipName`, `rel.id`
    - `loadExtensions()` (`app.js:926`): `err.message`
    - `renderExtensionsList()` (`app.js:955-972`): `ext.name`, `ext.category`, `ext.dll`, `ext.description`, `ext.id`
    - `renderEnvironmentTab()` (`app.js:1102-1110`): `loc` from Windows `PATH`
  - **`bridge.js` synchronous `window.runtime` race (`bridge.js:51-74`)**: While `callGo` (`lines 9-21`) polls up to 1000ms (20 × 50ms) for `window.go.main.App`, the 4 event subscription helpers (`onInstallProgress`, `onUpdateProgress`, `onComposerProgress`, `onComposerLog`) check `window.runtime && window.runtime.EventsOn` **synchronously once** during `DOMContentLoaded` (`app.js:47`). If Wails injects `window.runtime` slightly later, all 4 return no-op `() => {}` and the progress banner / Composer console drawer never receive events.
- **Root Cause & User Impact**:
  - Malicious or unusual folder names (`<>` in `PATH`/DLL/error text) or compromised remote release metadata can inject arbitrary HTML/DOM attributes into the Electron/Wails renderer; late Wails runtime injection silently drops all live progress/log streams.
- **Suggested Remediation Options**:
  1. Escape all dynamic values with `escapeHtml(...)` (or use `document.createElement` + `textContent`) in every renderer function (`renderInstalledList`, `renderRemoteList`, `renderExtensionsList`, `renderEnvironmentTab`, and error banners).
  2. Update `bridge.js:51-74` to poll for `window.runtime && window.runtime.EventsOn` (mirroring `callGo`) and attach queued listeners once available, returning a working cancel handle.
- **OpenSpec Change Proposal Notes**:
  - **Capabilities**: `desktop-gui-workspace`, `platform-runtime-and-storage`
  - **Proposal**: Require DOM/HTML escaping for all dynamic renderer fields and asynchronous `window.runtime.EventsOn` registration retry in `bridge.js`.
- **Verification Criteria**:
  - Renderer test injecting `<img src=x onerror=alert(1)>` in mock `ReleaseInfo.compiler` / `PATH` / error message verifies text is escaped literally with zero extra DOM nodes.
  - Bridge test delaying `window.runtime.EventsOn` availability by 200ms verifies callback still binds and receives emitted payloads.

---

#### TODO-022: `"Open YAWPS Folder"` Opens `versions/`, Download Tab Hides `x86` & Uses Static Chips, Missing 7 Ext Categories & `v0.1` Label
- **Severity**: `P2 Medium`
- **Category**: GUI Parity & Gaps
- **Affected Files & Verified Lines**:
  - `app.go:204-211`, `src/gui/main.js:202-206`, `src/gui/renderer/index.html:57`, `src/gui/renderer/app.js:104-106`
  - `src/gui/renderer/app.js:807`, `src/gui/renderer/index.html:153-162`
  - `src/gui/renderer/index.html:191-200`, `pkg/core/extensions.go:19-45`, `src/core/extensions.js:6-32`
  - `src/gui/renderer/index.html:56`, `package.json:3`, `wails.json:15`
- **Current Behavior per Runtime / UI**:
  - **`OpenFolder()`**: Sidebar button `"📁 Open YAWPS Folder"` (`index.html:57`, `app.js:104-106`) calls `window.api.openFolder()` with no path; both `app.go:205-207` and `src/gui/main.js:203` default empty `targetPath` to `VERSIONS_DIR` (`versions/`) rather than `BASE_DIR` (`.yawps`). On a fresh install where `EnsureDirectories()` hasn't run yet, `versions/` may not even exist! Additionally, `app.go:209` ignores `cmd.Start()` errors (never reaps child) and `main.js:204` ignores `shell.openPath()`'s returned error string, both always returning `true`.
  - **Download `x86` & static branches**: `app.js:807` hardcodes `const matchArch = r.arch === 'x64'`, hiding `x86` releases supported by backend & Go CLI. Branch chips (`8.5`..`7.4`, `index.html:153-162`) are hardcoded and omit newly released branches (e.g., `8.6+`).
  - **Missing 7 extension category chips**: `EXTENSION_METADATA` includes `File System`, `Localization`, `XML`, `Markup`, `Advanced`, `Debugging`, and `General` (for unknown DLLs), none of which appear in `#ext-category-chips` (`index.html:191-200`).
  - **Version label drift**: Sidebar footer (`index.html:56`) displays `v0.1 (Windows x64)` while `package.json:3`, `wails.json:15`, and CLI report `0.1.0`.
- **Root Cause & User Impact**:
  - Users clicking `"Open YAWPS Folder"` land inside `versions/` instead of root `.yawps/`; 32-bit PHP users cannot use the GUI; 7 extension categories (including `Debugging`/Xdebug!) have no filter chip.
- **Suggested Remediation Options**:
  1. Default `OpenFolder("")` to `GetBaseDir()` / `BASE_DIR` (calling `EnsureDirectories()` first) and return `false`/error if `shell.openPath` returns a non-empty error string or `explorer.exe` fails to start.
  2. Add an `x64` / `x86` architecture toggle in Download tab (`index.html` + `app.js:807`) and generate branch chips dynamically from fetched `appState.remoteReleases`.
  3. Generate `#ext-category-chips` dynamically from `appState.extensions` categories (or add all 7 missing chips).
  4. Update `index.html:56` to `v0.1.0` (and reflect selected/runtime arch if appropriate).
- **OpenSpec Change Proposal Notes**:
  - **Capabilities**: `desktop-gui-workspace`, `platform-runtime-and-storage`
  - **Proposal**: Align `openFolder()` default directory, add `x86` filter & dynamic branch/extension category chips, and sync version label.
- **Verification Criteria**:
  - Verify `openFolder()` opens `.yawps` (and card `📁 Folder` still opens `versions/<id>`).
  - Verify Download tab displays `x86` builds when toggled and Extensions tab includes `Debugging` (Xdebug) and `General` chips.

---

#### TODO-023: Shared UI/UX, CSS & Accessibility Defects (`user-select: none`, Sticky PATH Pill, Timers, `confirm()`, Composer UX, `.btn-sm`, `.hidden`, ARIA, CSP)
- **Severity**: `P2 Medium`
- **Category**: GUI UX, CSS & A11y
- **Affected Files & Verified Lines**:
  - `src/gui/renderer/styles.css:29,32,49-56,163-168,389-431,1008-1047`
  - `src/gui/renderer/app.js:54-62,320,333-336,564-566,616-632,674,1255-1273,1490-1623`
  - `src/gui/renderer/index.html:46,133,387,437,460,648-735`
  - `src/gui/main.js:196-199`
- **Current Behavior per Runtime / UI**:
  - `* { user-select: none; }` (`styles.css:29`) prevents users from highlighting/copying paths, CLI commands, `php.ini` paths, or Composer logs.
  - **Sticky `pathStatusPillEl.onclick` & missing `try/catch`** (`app.js:616-632`): When `isInUserPath` becomes `true`, `updatePathStatusUI()` changes class/text only and leaves `onclick` active and `cursor: 'pointer'`; clicking the pill has no `try/catch`, and in Electron `src/gui/main.js:196-199` ignores `addToUserPath()` failure while `app.js:208,629` shows success toast.
  - **Uncancelled timers**: `showToast` (`app.js:54-62`) and `showProgress` (`app.js:564-566`) schedule uncancelled `setTimeout` calls—rapid notifications or back-to-back installs hide early.
  - **Blocking `window.confirm()`** (`app.js:1536`) is used for Composer package removal instead of a themed HTML modal like `#modal-uninstall`.
  - **Composer UX & State Sync quirks**:
    - `loadComposerTab()` (`app.js:1272`) calls `renderComposerPackages()` with `filter = ''`, resetting filtered results while text remains in `#input-pkg-search`.
    - Pressing `Enter` in `#input-pkg-version` (`index.html:460`) does not submit (only `#input-pkg-name` binds `keydown`).
    - `#composer-nav-badge` (`index.html:46`, `app.js:1255`) remains hidden/0 until the Composer tab is visited.
    - `#modal-composer-uninstall` (`app.js:333-336`) does not reset checkboxes to defaults on reopen.
    - Missing double-click busy locks on `Update` (`app.js:674`), `Require`, `Install Composer`, `Update Composer`, and `Update All`.
    - `res.error` logged as `undefined` (`app.js:320,1517,1559,1610`) under Node/Electron (`composer.js:312-315,532-535`).
  - **CSS & Accessibility/Security gaps**:
    - Missing CSS classes `.btn-sm` (used at `index.html:387,437`) and `.btn:disabled` (disabled buttons retain hover/pointer affordance).
    - `.main-content` (`styles.css:163-168`) lacks `min-width: 0` and `.sidebar` (`styles.css:49-56`) lacks `flex-shrink: 0`.
    - `.hidden { display: none !important; }` (`styles.css:32`) suppresses CSS opacity/transform transitions on `.toast` and `.modal-overlay`.
    - Modals (`index.html:648-735`) lack `role="dialog"`, `aria-modal="true"`, `Escape` key closing, and focus management; clickable `<div>` elements (`#path-status-pill`, `.composer-pkg-row`) lack keyboard semantics; `index.html:133` uses inline `onclick`, and `index.html` lacks a Content Security Policy `<meta>` tag.
- **Root Cause & User Impact**:
  - Accumulated rough edges degrade usability (cannot copy Composer output/paths), allow concurrent double-click operations, break keyboard navigation, and show misleading `"undefined"` errors or early-hiding progress banners.
- **Suggested Remediation Options**:
  1. Allow `user-select: text` on `code`, `pre`, `.console-output`, `.cli-row`, `.card-meta`, and `.grid-code`; define `.btn-sm` and `.btn:disabled`; add `min-width: 0` on `.main-content` and `flex-shrink: 0` on `.sidebar`; decouple modal/toast transition states from `display: none !important`.
  2. Clear `pathStatusPillEl.onclick = null` / `cursor = 'default'` when `isInUserPath === true`, add `try/catch` + `addToUserPath()` failure propagation in `main.js:196-199`, store/clear timer handles in `showToast`/`showProgress`, replace `window.confirm()` with a confirmation modal, preserve `#input-pkg-search.value` across `loadComposerTab()`, bind `Enter` on `#input-pkg-version`, add operation busy flags/disabled states, and add modal `role="dialog"` + `Escape` handling + CSP meta without inline `onclick`.
- **OpenSpec Change Proposal Notes**:
  - **Capabilities**: `desktop-gui-workspace`
  - **Proposal**: Capture modal accessibility, copyable monospace text, timer debouncing, busy locking, and Composer search/badge persistence in `desktop-gui-workspace/spec.md`.
- **Verification Criteria**:
  - `node --check src/gui/renderer/app.js` exits `0`.
  - Manual/UI verification: text selectable in console drawer & paths; `Escape` closes modals; Enter in `#input-pkg-version` submits; rapid toasts reset 3.2s timer; `fix-path` error propagates to toast.

---

#### TODO-024: Unused `config.json` Infrastructure, Unexposed Backend APIs (`fullCleanup`, `cleanCachedArchives`) & Unused `models.ts` Fields
- **Severity**: `P3 Low`
- **Category**: Dead Code & API Surface
- **Affected Files & Verified Lines**:
  - `pkg/core/paths.go:14,51,74-76` (`configFile`, `GetConfigFile`)
  - `src/core/paths.js:20,43-65,73-76` (`CONFIG_FILE`, `getConfig`, `saveConfig`)
  - `app.go:219`, `src/gui/main.js:25,42,220`, `src/gui/preload.js:17`, `src/gui/renderer/bridge.js:37`
  - `pkg/core/composer.go:49-50`, `src/gui/renderer/wailsjs/go/models.ts:28-29`, `src/gui/renderer/wailsjs/go/main/App.js`
- **Current Behavior per Runtime / UI**:
  - `config.json` path constants and Node `getConfig`/`saveConfig` helpers exist in both runtimes with zero callers.
  - `fullCleanup` is implemented across all 4 IPC layers (`app.go:219`, `main.js:220`, `preload.js:17`, `bridge.js:37`) yet has no UI control in Environment tab (`index.html`).
  - `removeFromUserPath` and `cleanCachedArchives` are imported at `src/gui/main.js:25,42` and never used (`cleanCachedArchives` has no GUI/IPC handler at all).
  - `ComposerGlobalPackage` defines `IsOutdated` / `Latest` (`pkg/core/composer.go:49-50`, `models.ts:28-29`) which are never populated by either Go or Node. `wailsjs/` ESM files are unreferenced by `bridge.js` / `index.html`.
- **Root Cause & User Impact**:
  - Confusing dead code and unexposed cleanup features force users to use CLI for cache/full cleanup.
- **Suggested Remediation Options**:
  1. Either expose `"Clean Download Cache"` and `"Full Cleanup"` buttons with confirmation modals in the Environment tab, or prune dead IPC methods/imports (`main.js:25,42`, unused `IsOutdated`/`Latest`, or `config.json` helpers until a user-settings feature is proposed).
- **OpenSpec Change Proposal Notes**:
  - **Capabilities**: `platform-runtime-and-storage`, `desktop-gui-workspace`, `composer-lifecycle-and-packages`
  - **Proposal**: Decide whether to wire `cleanCachedArchives`/`fullCleanup`/`config.json` into the GUI or remove unused stubs.
- **Verification Criteria**:
  - `GOOS=windows GOARCH=amd64 go vet ./...` and `node --check src/gui/main.js` pass; verify zero dead imports remain.

---

### Section 5: Concurrency, Safety, Error-Handling, Packaging & Dependency Issues

#### TODO-025: Node Double-Backslash `\\` User `PATH` Corruption & PowerShell String/Here-String Injection
- **Severity**: `P0 Critical`
- **Category**: Windows Registry & Injection
- **Affected Files & Verified Lines**:
  - `src/core/environment.js:158,161,169,170,203,224` (`checkPathStatus`, `addDirectoryToUserPath`, `removeDirectoryFromUserPath`)
  - `src/core/osCheck.js:77` (`showNativeAlert`)
  - `src/core/installer.js:81` (`extractZip`)
- **Current Behavior per Runtime / UI**:
  - **Double-backslash User `PATH` corruption (`src/core/environment.js:203,224`)**: Both `addDirectoryToUserPath` and `removeDirectoryFromUserPath` embed `$target = "${normalized.replace(/\\/g, '\\\\')}";` inside a PowerShell double-quoted string. In PowerShell, `\` is **literal** (backtick `` ` `` is PowerShell's escape character)! Consequently, `C:\Users\Alice\.yawps\current` becomes **`C:\\Users\\Alice\\.yawps\\current`** with double backslashes!
    - `addDirectoryToUserPath` writes `C:\\...` into `HKCU\Environment\Path`.
    - `checkPathStatus()` (`lines 158,161`) compares `p.toLowerCase() === CURRENT_LINK.toLowerCase()` without `path.resolve`, so it continues reporting **`isInUserPath: false`** even after `"Fix PATH"`!
    - `removeDirectoryFromUserPath` (`line 226`) fails to match/remove legitimate single-backslash `C:\...` entries because `$_ -ne $target` compares `C:\...` against `C:\\...`!
  - **PowerShell string interpolation hazards (`environment.js:203,224`, `installer.js:81`)**: Double-quoted PowerShell interpolation breaks or executes expressions if Windows usernames/paths contain `$`, `"`, or backticks `` ` ``. Also `environment.js:169` splits `where.exe` output on `'\r\n'` rather than `/\r?\n/`.
  - **Here-string quote corruption (`osCheck.js:77`)**: Inside PowerShell's single-quoted here-string `@'\n...\n'@`, single quotes are literal and must NOT be doubled—`message.replace(/'/g, "''")` turns apostrophes into `''`, and `\n'@` in `message` breaks out of the here-string.
- **Root Cause & User Impact**:
  - Every Node/Electron PATH modification corrupts Windows User `PATH` with double backslashes (`C:\\...`), causes `isInUserPath` to stay permanently `false`, and prevents clean removal of `current` from `PATH`.
- **Suggested Remediation Options**:
  1. Pass paths safely via environment variables (`env: { YAWPS_TARGET_DIR: normalized }`) or `-EncodedCommand` (UTF-16LE Base64) rather than string interpolation in `environment.js` and `installer.js:81` (reading `$env:YAWPS_TARGET_DIR` inside PowerShell, and comparing normalized `path.resolve` equivalents or case-insensitive `[IO.Path]::GetFullPath(...)`).
  2. Remove `.replace(/'/g, "''")` inside the `@'...'@` here-string at `osCheck.js:77` (or pass via env var `$env:YAWPS_ALERT_MSG`).
  3. Normalize path comparison in `checkPathStatus` (`environment.js:158-161`) via `path.resolve` (matching `isDirectoryInUserPath`) and split `where.exe` output on `/\r?\n/`.
- **OpenSpec Change Proposal Notes**:
  - **Capabilities**: `php-version-switching-and-path`, `platform-runtime-and-storage`, `php-release-catalog-and-installer`
  - **Proposal**: Mandate safe parameter passing (env vars or `-EncodedCommand`) for all PowerShell invocations and normalized `PATH` comparisons.
- **Verification Criteria**:
  - Node unit test inspecting generated PowerShell command/env variables confirming zero `\\` doubling for `C:\Users\O'Connor\$test\.yawps\current`.
  - Windows Node/Electron smoke test: run `yawps env fix`, inspect `HKCU\Environment\Path` to confirm single-backslash `C:\Users\...\.yawps\current` and `env check` reports `✔ Yes`.

---

#### TODO-026: Go Registry `Path` Wipe on `GetStringValue` Error, `REG_SZ` Over `REG_EXPAND_SZ`, Stale `os.Getenv("PATH")` & Prefix Boundary Bug
- **Severity**: `P0 Critical`
- **Category**: Windows Registry & Data Loss
- **Affected Files & Verified Lines**:
  - `pkg/core/environment.go:230,237,261,322,335,355,366` (`CheckPathStatus`, `AddDirectoryToUserPath`, `RemoveDirectoryFromUserPath`)
  - `pkg/cli/cli.go:299`, `src/core/environment.js:170`, `src/cli/index.js:439`, `src/gui/renderer/app.js:1099`
- **Current Behavior per Runtime / UI**:
  - **Registry `Path` wipe (`environment.go:322,355`)**: `userPath, _, _ := k.GetStringValue("Path")` discards the error. If `GetStringValue` fails for any reason other than `registry.ErrNotExist` (e.g., `registry.ErrUnexpectedType` if `Path` is `REG_MULTI_SZ`, or transient access/read failure), `userPath` becomes `""` and lines `335`/`366` overwrite and **wipe the user's entire `HKCU\Environment\Path`**!
  - **`REG_SZ` overwrites `REG_EXPAND_SZ` (`environment.go:335,366`)**: Writes User `Path` using `k.SetStringValue("Path", newPath)` (`REG_SZ`) unconditionally. Standard Windows 10/11 User `Path` defaults to `REG_EXPAND_SZ` (e.g., `%USERPROFILE%\AppData\Local\Microsoft\WindowsApps`), so converting to `REG_SZ` breaks `%VAR%` expansion for those entries!
  - **Stale process `PATH` & uncleaned User `Path` (`environment.go:230,237`)**: Line `230` compares `strings.ToLower(strings.TrimSpace(p)) == normLink` without `filepath.Clean` or `%ENVVAR%` expansion (unlike `IsDirectoryInUserPath` on `line 303`). Line `237` scans `os.Getenv("PATH")`—the running GUI process's launch-time snapshot—instead of querying fresh Registry `HKLM`+`HKCU` `PATH`, so `ActivePhpLocations`/`IsPrimary` stay stale in the running GUI after `FixPath`/`RemovePath`!
  - **Missing path-separator boundary (`environment.go:261`, `cli.go:299`, `environment.js:170`, `index.js:439`, `app.js:1099`)**: All 5 places check `strings.HasPrefix(..., normLink)` / `.startsWith(currentLink)` without appending `\` (`filepath.Dir(loc) == normLink`), causing false `(managed by YAWPS)` / `isPrimary: true` matches on sibling folders like `.yawps\current_backup\php.exe`.
- **Root Cause & User Impact**:
  - Risk of wiping a developer's entire Windows User `PATH` or breaking `%LOCALAPPDATA%` / `%USERPROFILE%` PATH expansion; stale UI state after fixing/removing PATH; false positive managed-PHP detection.
- **Suggested Remediation Options**:
  1. Check `err` from `k.GetStringValue("Path")`: only proceed with `userPath = ""` if `errors.Is(err, registry.ErrNotExist)`; otherwise return `err` immediately without calling `Set*Value`.
  2. Read registry value type (`valType`) alongside `userPath`; preserve `registry.EXPAND_SZ` (using `k.SetExpandStringValue`, or default to `REG_EXPAND_SZ` whenever `%` tokens exist or key was `EXPAND_SZ`).
  3. In `CheckPathStatus`, normalize `p` via `filepath.Clean`, optionally read fresh `HKLM` + `HKCU` `Path` + `registry.ExpandString` (or re-read `where.exe` / fresh env), and check `strings.EqualFold(filepath.Clean(filepath.Dir(loc)), normLink)` (in both Go and Node/UI).
- **OpenSpec Change Proposal Notes**:
  - **Capabilities**: `php-version-switching-and-path`
  - **Proposal**: Add strict registry error preservation, `REG_EXPAND_SZ` preservation, fresh PATH inspection, and directory-equality matching requirements.
- **Verification Criteria**:
  - Go unit test verifying directory-equality helper rejects `...\current_backup\php.exe` while matching `...\current\php.exe`.
  - Windows verification: confirm `HKCU\Environment\Path` type remains `REG_EXPAND_SZ` and `%USERPROFILE%` entries continue expanding after `yawps env fix` and `yawps env remove`.

---

#### TODO-027: Go `RunComposerCommand` Concurrent `strings.Builder` Race, Premature `cmd.Wait()`, Broken `ansiRegex` & Broken POSIX `bin/composer`
- **Severity**: `P0 Critical`
- **Category**: Concurrency & Wrapper Bugs
- **Affected Files & Verified Lines**:
  - `pkg/core/composer.go:255` (`ansiRegex`), `pkg/core/composer.go:461-464` (POSIX `bin/composer`), `pkg/core/composer.go:759-777` (`RunComposerCommand`)
  - `src/core/composer.js:264-267` (POSIX `bin/composer` also broken)
- **Current Behavior per Runtime / UI**:
  - **Data Race & Pipe Contract Violation (`pkg/core/composer.go:759-777`)**: Two concurrent goroutines (`go readScanner(stdoutPipe)` and `go readScanner(stderrPipe)`) write to a single unsynchronized `strings.Builder` (`outputBuilder.WriteString`). Furthermore, `cmd.Wait()` (`line 775`) executes **before** the scanner goroutines finish draining pipes (violating Go `os/exec.Cmd.StdoutPipe`/`StderrPipe` documentation), risking lost trailing lines, closed-pipe truncation, and an unguarded concurrent read/write data race on `outputBuilder.String()` (`line 776`). Also `bufio.Scanner` uses the default 64KB token limit with `scanner.Err()` unchecked.
  - **Corrupted `ansiRegex` (`pkg/core/composer.go:255`)**: Uses a literal space `" \`[[0-9;]*[a-zA-Z]"` instead of ESC `\x1b\[[0-9;]*[a-zA-Z]` (compare Node `src/core/composer.js:159`), failing to strip ANSI escapes and stripping legitimate `" [..."` substrings.
  - **Broken POSIX `bin/composer` shim in BOTH runtimes (`pkg/core/composer.go:463`, `src/core/composer.js:266`)**: Writes `#!/usr/bin/env sh\n"$(dirname -- "$0")/composer.phar" "$@"\n` **without `php `**! Executing `composer` in Git Bash / MinGW fails with `Exec format error` because `.phar` is not a native binary.
- **Root Cause & User Impact**:
  - Running `composer global require/update/remove` in Go triggers a Go memory race under `-race` and can drop final Composer output lines; `composer` fails to run in Git Bash across both Go and Node installs.
- **Suggested Remediation Options**:
  1. In `RunComposerCommand` (`pkg/core/composer.go:759-777`), synchronize writes to `outputBuilder` with a `sync.Mutex`, wait on a `sync.WaitGroup` for both reader goroutines **before** calling `cmd.Wait()`, increase `bufio.Scanner` buffer (`scanner.Buffer(make([]byte, 64*1024), 1024*1024)`) or use `bufio.Reader`, and check `scanner.Err()`.
  2. Fix `ansiRegex` (`pkg/core/composer.go:255`) to `regexp.MustCompile("\x1b\\[[0-9;]*[a-zA-Z]")`.
  3. Fix POSIX `bin/composer` in both Go (`composer.go:463`) and Node (`composer.js:266`) to: `#!/usr/bin/env sh\nphp "$(dirname -- "$0")/composer.phar" "$@"\n`.
- **OpenSpec Change Proposal Notes**:
  - **Capabilities**: `composer-lifecycle-and-packages`
  - **Proposal**: Add thread-safe pipe draining and executable `php ".../composer.phar"` POSIX wrapper requirements.
- **Verification Criteria**:
  - `go test -race ./pkg/core/...` on a test invoking concurrent stdout/stderr streaming in `RunComposerCommand` passes with zero race detections and 100% output capture.
  - Unit tests verifying `ansiRegex` strips `\x1b[32mComposer version 2.8.0\x1b[0m` without corrupting `" [dev]"` text, and generated `bin/composer` contains `php "$(dirname -- "$0")/composer.phar" "$@"`.

---

#### TODO-028: Go `downloadFileWithProgress` Nil-`resp` Panic & `%!w(<nil>)`, Swallowed `computeSHA256`, Partial `.zip` Cache Poisoning & Node Zip/Progress Defects
- **Severity**: `P0 Critical`
- **Category**: Crash, Integrity & Extraction
- **Affected Files & Verified Lines**:
  - `pkg/core/installer.go:41-111,141-175,211-258` (`downloadFileWithProgress`, `unzipFile`, `InstallRelease`)
  - `src/core/installer.js:25-92,160-186` (`downloadFile`, `extractZip`, `installRelease`)
- **Current Behavior per Runtime / UI**:
  - **Go Nil-Pointer Panic & `%!w(<nil>)` (`pkg/core/installer.go:41-64`)**: When primary `client.Do(req)` fails (`err != nil || resp.StatusCode != 200`), `resp.Body.Close()` runs (`line 44`). If `fallbackURL != ""` and `http.NewRequest("GET", fallbackURL, nil)` returns `fbErr != nil`, control skips `if fbErr == nil` with **no `else` return** and falls through to `defer resp.Body.Close()` (`line 64`):
    - If primary failed with network `err != nil` (`resp == nil`), line `64` **panics with nil pointer dereference**!
    - If primary returned HTTP 404 (`resp != nil`), it reads/writes the closed 404 response!
    - If `fallbackURL == ""` and primary returned non-200 (`err == nil`), line `61` formats `fmt.Errorf("download failed: %w", err)` -> **`"download failed: %!w(<nil>)"`**.
  - **Go swallowed `computeSHA256` (`installer.go:253-257`)**: `if err == nil && !strings.EqualFold(...)` silently ignores I/O errors from `computeSHA256`, bypassing checksum verification!
  - **Partial `.zip` cache poisoning (Both runtimes)**: Both Go (`installer.go:67,231`) and Node (`installer.js:38,169`) stream directly to `downloads/<zipName>` (no `.tmp` + atomic rename). Interrupted downloads stay in `downloads/`, skip re-download on retry, and fail extraction if `release.SHA256 == ""`.
  - **Retry lockout on partial extraction (Both runtimes)**: If extraction fails mid-way after writing `php.exe`, `versions/<id>/php.exe` exists on disk, causing subsequent `InstallRelease` calls (`installer.go:215`, `installer.js:163`) to falsely report `AlreadyInstalled: true`. Neither runtime checks `release == nil` (`installer.go:211`, `installer.js:160`).
  - **Node `installer.js` defects (`lines 25-92`)**: `downloadFile` has no `fetch` timeout, only retries `fallbackUrl` on HTTP `!response.ok` (not network errors), emits `percent: 100` during `downloading` (`line 49`) prematurely triggering GUI `app.js:561` before SHA256 (`90%`) / extract (`95%`) / `php.ini` (`98%`), ignores `fileStream.write()` backpressure and attaches `fileStream.on('error')` after streaming (`line 62`). `extractZip` (`line 88`) crashes with `TypeError` calling `.stderr.toString('utf8')` if `spawnSync` fails to spawn (`stderr === null`), and delegates to `tar.exe`/`Expand-Archive` without explicit Zip Slip validation in JS.
- **Root Cause & User Impact**:
  - Bad fallback URLs crash Go with nil-pointer panic; SHA256 I/O errors go unnoticed; interrupted downloads/extractions poison subsequent installs; Node prematurely hides/completes progress before extraction finishes.
- **Suggested Remediation Options**:
  1. Fix Go `downloadFileWithProgress` fallback branch (`return fmt.Errorf(..., fbErr)` on `fbErr != nil`, and include `resp.StatusCode` when `err == nil`) and check `if err != nil { return nil, err }` on `computeSHA256`.
  2. Download to `<zipPath>.tmp` in both runtimes, closing/flushing and atomically renaming to `<zipPath>` only on complete EOF (deleting `.tmp` on failure). Extract to `<targetDir>.tmp` and rename to `<targetDir>` on success so partial extraction cannot leave a false `AlreadyInstalled` folder. Validate `release != nil`.
  3. In Node `installer.js`: catch network errors on primary `fetch` to try `fallbackUrl`, cap `downloading` progress at `90%` (matching Go), use `Readable.fromWeb(response.body)` + `stream.promises.pipeline` with backpressure and error handling, guard `stderr?.toString('utf8')`, and verify extracted entries stay within `targetDir` (or use a safe JS zip reader).
- **OpenSpec Change Proposal Notes**:
  - **Capabilities**: `php-release-catalog-and-installer`
  - **Proposal**: Add atomic `.tmp` download/extraction, strict SHA256 I/O error failure, network-error archive fallback, and capped `90%` download progress requirements.
- **Verification Criteria**:
  - Go & Node unit tests with `httptest.Server` / mock fetch verifying: bad fallback URL returns clean error (no panic), primary network error triggers `fallbackUrl`, interrupted transfer leaves zero `.zip` in `downloads/`, SHA256 read failure aborts install, and partial extract does not trigger `AlreadyInstalled: true`.

---

#### TODO-029: Composer Edge-Case Bugs Across Both Runtimes (Hang, Unverified PHAR, Missing `error`, `cmd.exe ^` Mangle, JSON Parsing & Determinism)
- **Severity**: `P1 High`
- **Category**: Safety & Edge Cases
- **Affected Files & Verified Lines**:
  - `src/core/composer.js:88,156,222-298,312-315,505-546`
  - `pkg/core/composer.go:150-151,383,512,575-622,647-740,863`
- **Current Behavior per Runtime / UI**:
  - **Node `composer.js`**:
    - `fetchLatestComposerVersion()` (`line 88`) sets `timeout: 5000` on `https.get` without registering a `'timeout'` event listener to call `req.destroy()`, so stalled sockets hang indefinitely.
    - `installComposer()` (`lines 222-298`) never checks `res.statusCode === 200` on primary or redirect responses, omits `stream.on('error')` / `file.on('error')` (hanging Promise on stream errors), and **never checks `runCheck.status !== 0`** (`lines 283-291`)—resolving `{ success: true }` even when `composer.phar` is corrupt HTML!
    - `updateComposer()` (`lines 312-315`) & `runComposerCommand()` (`lines 532-535`) omit the `error` field on failure (`{ success: false, output }`), causing `app.js:320,1517,1559,1610` (`res.error`) to print **`undefined`**.
    - `installComposerGlobalPackage()` (`lines 544-546`) does not reject empty/whitespace `pkgName` (Go rejects at `composer.go:795-797`).
    - `runComposerCommand()` (`line 524`) splits raw chunks on `\n` before line-buffering (corrupting lines split across chunks) and `.trim()` strips Composer indentation.
    - `PATH` env construction (`lines 156,286,310,513`) interpolates `${process.env.PATH}` (`"undefined"` if unset) and can duplicate `'Path'` vs `'PATH'` keys in Windows env.
  - **Go `composer.go`**:
    - `InstallComposer()` (`line 383`) creates `&http.Client{Timeout: 3 * time.Minute}` without `FetchLatestComposerVersion`'s IPv4 `tcp4` dialer (`line 179`), risking IPv6 hangs on Windows.
    - `GetComposerGlobalPackages()` (`lines 665-678`): `_ = json.Unmarshal(p.License, &licList)` and `json.Unmarshal(p.Bin, &rawBins)` silently drop string-typed `"license": "MIT"` or `"bin": "bin/tool"` fields.
    - `GetComposerGlobalPackages()` (`lines 647,717-720`) iterates a Go `map` without sorting, producing non-deterministic UI/CLI orderings.
    - Empty `APPDATA` / `USERPROFILE` / `LOCALAPPDATA` (`lines 150-151,588`) join against `""`, creating CWD-relative paths.
    - `UninstallComposer()` (`lines 575,580-582,598,622`) sets `ExecutablesDeleted`, `CacheDeleted`, `PackagesPurged`, `PathCleaned` to `true` regardless of actual unlink/deletion/presence.
    - `ToggleComposerGlobalBinPath(false)` (`line 863`) calls `os.MkdirAll(binDir, 0755)` even when removing from PATH.
  - **Both Runtimes**:
    - External Composer execution (`composer.go:512,732-740` & `composer.js:505-507`) runs `"cmd.exe /c composer"` instead of the discovered `composerBat` path, omits checking Composer availability before `RunComposerCommand` in Go, and exposes arguments like `^5.0` (caret is `cmd.exe`'s escape char!) and shell metacharacters (`&`, `|`, `%`) to CMD mangling!
    - Platform constraints in `composer.json` (`"php": "^8.2"`, `"ext-mbstring"`) appear in the package list with `Version: "(Not installed)"` (`composer.go:700-713`, `composer.js:474-482`).
- **Root Cause & User Impact**:
  - Hung sockets, silently corrupt Composer installs in Node, `undefined` UI error logs, mangled `^` constraints on external Composer, missing licenses/binaries, and non-deterministic package order.
- **Suggested Remediation Options**:
  1. In Node `composer.js`: destroy timed-out requests in `'timeout'` listener, check `res.statusCode === 200` and stream errors, verify `runCheck.status === 0` (returning `{ success: false, error, output }`), populate `error` on failures, validate non-empty `pkgName`, buffer incomplete lines before emitting `composer-log`, and normalize `Path`/`PATH` env key.
  2. In Go `composer.go`: reuse the `tcp4` dialer for `InstallComposer`, unmarshal both `string` and `[]string` for `License`/`Bin`, sort `GetComposerGlobalPackages` deterministically by `Name`, guard empty env vars before `filepath.Join`, compute accurate `ComposerUninstallResult` flags, and only `MkdirAll` in `ToggleComposerGlobalBinPath(true)`.
  3. In both runtimes: execute `composerBat` directly (or pass `cur.PhpExe, composerPhar` where available), quote/validate package specs against shell metacharacters, and filter or tag platform constraints (`php`, `php-64bit`, `ext-*`, `lib-*`, `composer-*`) separately from real packages.
- **OpenSpec Change Proposal Notes**:
  - **Capabilities**: `composer-lifecycle-and-packages`
  - **Proposal**: Add verification, deterministic package sorting, string-or-array lockfile parsing, platform constraint filtering, and non-empty `error` DTO guarantees.
- **Verification Criteria**:
  - Go & Node unit tests covering string `"license"`/`"bin"`, sorted package output, platform constraints (`php`, `ext-mbstring`), timeout cleanup, `status !== 0` Composer verification failure, and populated `res.error`.

---

#### TODO-030: Extensions, Releases & OS Detection Edge Cases (`gd`/`gd2` Collision, Casing, Duplicate Directives, `"php-"` Prefix, Silent `10.0.19045` Fallback)
- **Severity**: `P1 High`
- **Category**: Parsing & Regex Correctness
- **Affected Files & Verified Lines**:
  - `pkg/core/extensions.go:100-102,131,134,172,179-180,234`
  - `src/core/extensions.js:75,107,110,148,155-156,202`
  - `pkg/core/releases.go:199,202,217,224,231`
  - `pkg/core/environment.go:154`
  - `pkg/core/oscheck.go:67-72`
- **Current Behavior per Runtime / UI**:
  - **Extension prefix collision (`extensions.go:131,134,179,180`, `extensions.js:107,110,155-156`)**: Extension regexes lack trailing token boundary (`(?:\s|;|$)`). Checking or disabling `"gd"` matches `extension=gd2` (`php_gd2.dll` on PHP 7.4); `"pdo"` matches `extension=pdo_mysql`! In Node `extensions.js:107,110`, `id` is not regex-escaped (`RegExp.escape`), and `activePattern` (`line 155`) lacks the `'g'` flag despite comment `"comment out all active instances"` (`line 178`), leaving duplicate `extension=` lines active.
  - **Case-sensitive `php_` / `.dll` stripping (`extensions.go:100-102,172`, `extensions.js:75,148`)**: Strips `php_` before lowercasing (`PHP_CURL.DLL` retains `php_` prefix in ID).
  - **Duplicate directive precedence (`extensions.go:234`, `extensions.js:202`)**: Both return the *first* matching line in `php.ini`, whereas PHP itself applies the *last* active directive.
  - **Case-sensitive `"php-"` strip & `relType`/`arch` checks (`releases.go:199,202,217,224,231`, `environment.go:154`)**: `strings.TrimPrefix(query, "php-")` runs before `strings.ToLower` (`"PHP-8.3"` fails to strip `"PHP-"`), and Go `FindRelease` doesn't lowercase `relType`/`arch` (`"NTS"`/`"X64"` return no match).
  - **Silent `10.0.19045` fallback (`pkg/core/oscheck.go:67-72`)**: If `RtlGetVersion` returns `ret != 0`, silently fabricates Windows 10 (`IsSupported: true`) instead of surfacing an error or falling back safely.
- **Root Cause & User Impact**:
  - PHP 7.4 `gd2` can be misread or disabled when toggling `gd`; duplicate `php.ini` directives cause wrong UI values; uppercase queries fail in Go API; `RtlGetVersion` failure goes unreported.
- **Suggested Remediation Options**:
  1. Require exact extension token boundary `(?:\s|;|$)` after `(?:php_)?<escapedId>(?:\.dll)?["']?` in both Go and Node, lowercase before stripping `php_`/`.dll`, and add `'g'` flag to Node `activePattern` (`extensions.js:155`).
  2. Scan all matches and take the last occurrence in `GetDirectives` / `getDirectives`.
  3. Lowercase `query`, `relType`, and `arch` before prefix-stripping and filtering in `releases.go` and `environment.go`.
  4. Record or surface an `RtlGetVersion` API error rather than silently fabricating `10.0.19045` in `pkg/core/oscheck.go:67-72`.
- **OpenSpec Change Proposal Notes**:
  - **Capabilities**: `php-ini-and-extension-management`, `php-release-catalog-and-installer`, `platform-runtime-and-storage`
  - **Proposal**: Add scenarios for `gd` vs `gd2` token boundaries, last-directive-wins precedence, uppercase `PHP-` query normalization, and `RtlGetVersion` failure handling.
- **Verification Criteria**:
  - Unit tests in Go & Node covering `extension=gd2` + `extension=gd`, `PHP_CURL.DLL`, duplicate `memory_limit` lines, and `FindRelease("PHP-8.3", "NTS", "X64")`.

---

#### TODO-031: NSIS `build/installer.nsh` PowerShell 5.1 Junction Hang, Escaping & Ignored `YAWPS_HOME` + `package-lock.json` Orphaned `chalk`
- **Severity**: `P1 High`
- **Category**: Packaging & Dependencies
- **Affected Files & Verified Lines**:
  - `build/installer.nsh:1-19`
  - `package.json:41-48,61,64-72`
  - `package-lock.json:16,1076-1088`
  - `.github/workflows/build-windows.yml:141`
- **Current Behavior per Runtime / UI**:
  - **NSIS `customUnInstall` bugs (`build/installer.nsh:10-19`)**:
    1. Line `12` executes `Remove-Item -Force $current1` in Windows PowerShell 5.1 inside hidden `nsExec::Exec`. On PowerShell 5.1, `Remove-Item` on a directory/NTFS junction without `-Recurse` prompts interactively for confirmation, hanging or failing silently in hidden `nsExec`!
    2. Line `12` uses `\"` inside an NSIS single-quoted string (`'...'`), where NSIS escape syntax is `$\"`, passing literal `\"` to `CreateProcess`.
    3. Hardcodes `$env:USERPROFILE\.yawps\current` and `.win-php\current` (`$PROFILE\.yawps` / `$PROFILE\.win-php`), ignoring `YAWPS_HOME`, `WIN_PHP_HOME`, trailing slashes in User `PATH`, and Composer PATH entries (`bin/`, `%COMPOSER_HOME%\vendor\bin`).
    4. Line `15` asks only about `%USERPROFILE%\.yawps`, yet lines `16-17` run `RMDir /r` on **both** `$PROFILE\.yawps` and `$PROFILE\.win-php`.
    5. If the user clicks **No** at line `11` (`IDNO skipPathCleanup`) and **Yes** at line `15`, `RMDir /r "$PROFILE\.yawps"` runs while the `current` NTFS junction still exists! Also `MessageBox MB_YESNO` lacks `/SD IDNO` silent-mode defaults.
    6. `package.json:41-48` defaults `win.target` to `portable`, so `build/installer.nsh` (`line 61`) is only exercised by `npm run dist:nsis`.
  - **`package-lock.json` orphaned `"chalk": "^6.0.1"` (`package-lock.json:16,1076-1088`)**: `package-lock.json` retains `"chalk": "^6.0.1"` in root `devDependencies`, whereas `package.json:64-72` removed it in favor of `picocolors` and zero source files import `chalk`. `npm ci` in CI (`.github/workflows/build-windows.yml:141`) relies on lockfile parity with `package.json`.
- **Root Cause & User Impact**:
  - NSIS uninstaller can hang on PowerShell 5.1 junction removal, fail to clean `YAWPS_HOME` paths, delete `.win-php` without asking, or traverse junctions via `RMDir /r`; `package-lock.json` carries a dead dependency mismatch.
- **Suggested Remediation Options**:
  1. Rewrite `build/installer.nsh:11-18` to unlink junctions via `cmd.exe /c rmdir` or `[System.IO.Directory]::Delete($p, $false)` (never `Remove-Item -Force` on junctions), fix NSIS quote escaping (`$\"`), resolve `YAWPS_HOME`/`WIN_PHP_HOME`, unlink `current` before `RMDir /r` regardless of PATH prompt answer, prompt separately or explicitly mention `.win-php`, and add `/SD IDNO`.
  2. Regenerate `package-lock.json` (removing `"chalk": "^6.0.1"`) and verify `npm ci --dry-run` / `npm ci` matches `package.json`.
- **OpenSpec Change Proposal Notes**:
  - **Capabilities**: `portable-build-and-packaging`
  - **Proposal**: Update NSIS uninstall safety requirements (junction unlinking without PowerShell prompt hang, `YAWPS_HOME` awareness, lockfile hygiene).
- **Verification Criteria**:
  - Run `npm ci` cleanly in CI or test dir with synchronized `package-lock.json` (zero `chalk@6.0.1` entries).
  - Windows NSIS test (`npm run dist:nsis`): install & uninstall with active junction answering No to PATH cleanup and Yes to data purge (and vice versa), verifying zero hangs and clean uninstall.

---

#### TODO-032: Portable Build Scripts (`build.sh`, `build.cmd`), Manifest `asInvoker` & PowerShell Wrappers Swallowing `$LASTEXITCODE`
- **Severity**: `P2 Medium`
- **Category**: Build & Wrappers
- **Affected Files & Verified Lines**:
  - `build.sh:42,66-67,85`
  - `build.cmd:2,18,52,58,74-75,88,92`
  - `build/windows/wails.exe.manifest:1-15`
  - `yawps.ps1:1-2`, `win-php.ps1:1-2`
- **Current Behavior per Runtime / UI**:
  - **Build scripts (`build.sh`, `build.cmd`)**:
    - Error text (`build.sh:42`, `build.cmd:52`) tells users to download `go1.22.x.windows-amd64.zip`, whereas `go.mod:3` requires **`go 1.27.0`**.
    - Installing Wails CLI (`build.sh:66-67`, `build.cmd:74-75`) sets `GOPATH` to `.tools/wails` without clearing `GOBIN`; if `GOBIN` is already set in the caller's environment, `go install` writes `wails.exe` outside `.tools/wails/bin/` and the script fails!
    - Both scripts invoke `wails build -platform windows/amd64` without `-trimpath` or `-clean` (unlike CI `.github/workflows/build-windows.yml:68`), embedding developer local paths and risking stale incremental cache issues. Passing `-upx` fails without a preflight `upx.exe` check.
    - `build.cmd:2` enables `enabledelayedexpansion` (corrupting paths/args with `!`), `build.cmd:58,88` executes `set "PATH=...;%PATH%"` (breaking if `%PATH%` contains literal `"`), and `build.cmd:18` excludes `"C:\Windows\System32\"` case-sensitively on drive `C:`.
  - **Manifest (`build/windows/wails.exe.manifest:1-15`)**: Omits explicit `<trustInfo><security><requestedPrivileges><requestedExecutionLevel level="asInvoker" uiAccess="false"/></requestedPrivileges></security></trustInfo>`, relying on Windows heuristics rather than declaring zero-UAC intent explicitly.
  - **PowerShell wrappers (`yawps.ps1:1-2`, `win-php.ps1:1-2`)**: Invoke `node "$scriptDir\bin\..." @args` without `exit $LASTEXITCODE`, causing failed commands to exit `0`, and use `$MyInvocation.MyCommand.Path` instead of `$PSScriptRoot`.
- **Root Cause & User Impact**:
  - Users following portable build instructions hit Go version mismatch errors (`1.22` vs `1.27.0`) or `GOBIN` failures; `.ps1` wrappers mask non-zero exit codes in PowerShell pipelines; builds embed local user paths.
- **Suggested Remediation Options**:
  1. Update `build.sh:42` & `build.cmd:52` to `go1.27.0` (or read `go.mod`), clear `GOBIN=""` before installing Wails, pass `-clean -trimpath`, check for `upx.exe` when `-upx` is passed, and fix `build.cmd` quoting/System32 detection (`/i` against `%SystemRoot%\System32\`).
  2. Add explicit `<requestedExecutionLevel level="asInvoker" uiAccess="false"/>` to `build/windows/wails.exe.manifest`.
  3. Update `yawps.ps1` and `win-php.ps1` to use `$PSScriptRoot` and append `exit $LASTEXITCODE`.
- **OpenSpec Change Proposal Notes**:
  - **Capabilities**: `portable-build-and-packaging`, `cli-interface`, `platform-runtime-and-storage`
  - **Proposal**: Standardize `-trimpath -clean`, `GOBIN` isolation, explicit `asInvoker` manifest, and `$LASTEXITCODE` propagation.
- **Verification Criteria**:
  - Windows portable build test with `GOBIN=C:\invalid` and `.tools/go` (`1.27.0`) builds `dist/yawps.exe` cleanly.
  - PowerShell test running `.\yawps.ps1 invalid-cmd; echo $LASTEXITCODE` prints `1` (after `TODO-013`).

---

### Section 6: Documentation, CI & Automated Testing Gaps

#### TODO-033: `README.md` Major Omissions & Factual Inaccuracies + GUI CLI Cheat Sheet Drift
- **Severity**: `P1 High`
- **Category**: Documentation
- **Affected Files & Verified Lines**:
  - `README.md:1-72`
  - `src/gui/renderer/index.html:570,612-613,632-633`
- **Current Behavior per Runtime / UI**:
  - **`README.md` Factual Inaccuracies**:
    - `README.md:34` specifies `go1.22.x.windows-amd64.zip`, whereas `go.mod:3` requires `go 1.27.0`.
    - `README.md:56-72` ("Method 2: Global System Build") claims `npm run build:wails` is a global build, whereas `package.json:14-16` invokes `build.cmd` which still requires `.tools/go/`; also conflates `wails build` output (`build\bin\yawps.exe`) with script-copied `dist\yawps.exe`.
    - `README.md:46-49` promotes `./build.sh -upx` without documenting `upx.exe` as a prerequisite in lines `18-24`.
    - `README.md:11` falsely claims users can *"adjust `php.ini` directives graphically or via CLI"* (neither CLI has any directive command!).
    - `README.md:10,13,14,21` oversimplify GUI vs CLI switching/PATH differences (GUI `InstallVersion` does not auto-switch or auto-add PATH), claim *"Windows 11 Fluent desktop app"* (custom dark-slate HTML/CSS UI on WebView2/Electron), claim *"preserving custom configuration"* (migration copies only tracked directives/extensions, and is currently broken per `TODO-004`), and state WebView2 is *"included by default on Windows 10 & 11"* (older Win 10 builds require Evergreen WebView2 Runtime).
  - **`README.md` Major Omissions**: Zero mention of the Node.js/Electron runtime (`bin/*.js`, `src/`, `*.cmd`/`*.ps1`, `win-php` alias), `YAWPS_HOME` / `WIN_PHP_HOME` / `.win-php` fallback / `COMPOSER_HOME`, managed directory structure, `window.api` IPC contract, full CLI command grammar, or `openspec/` / test status.
  - **GUI Cheat Sheet (`index.html:570,612-613,632-633`)**: Hardcodes `%USERPROFILE%\.yawps\current` (`line 570`) ignoring `YAWPS_HOME`, and lists Node-only semantics for `yawps update` and `yawps cleanup` that contradict Go CLI.
- **Root Cause & User Impact**:
  - New contributors following `README.md` download an incompatible Go version (`1.22`), misunderstand build scripts, attempt non-existent CLI directive commands, and remain unaware of Node/Electron parity or environment variables.
- **Suggested Remediation Options**:
  1. Rewrite `README.md` to match verified code reality (after or alongside parity fixes): update Go prerequisite to `1.27.0`, separate `wails build` vs `build.cmd`/`npm run build:wails` vs Electron `npm start`/`npm run dist`, remove false CLI directive claims, add CLI command reference, `YAWPS_HOME`/`WIN_PHP_HOME`/`.win-php`/`COMPOSER_HOME` documentation, and architecture/`openspec/` pointers.
  2. Update `index.html:570` dynamically (or mention `YAWPS_HOME`) and keep `index.html:612-633` accurate once Go CLI parity (`TODO-011`, `TODO-012`) ships.
- **OpenSpec Change Proposal Notes**:
  - **Capabilities**: `portable-build-and-packaging`, `cli-interface`, `desktop-gui-workspace`, `platform-runtime-and-storage`
  - **Proposal**: Include `README.md` and `index.html` Cheat Sheet updates in the respective parity/docs OpenSpec change proposals.
- **Verification Criteria**:
  - Manual doc accuracy audit confirming every command, version, flag, and path in `README.md` matches `go.mod`, `package.json`, `build.sh`/`build.cmd`, and `openspec/specs/`.

---

#### TODO-034: Zero Automated Test Coverage Across Go and Node.js
- **Severity**: `P1 High`
- **Category**: Automated Testing
- **Affected Files & Verified Lines**:
  - `go.mod:1-38`, `pkg/**/*` (`GOOS=windows GOARCH=amd64 go test ./...` -> `[no test files]`)
  - `package.json:10-20`, `src/**/*`, `bin/**/*` (no `"test"` script, 0 test files)
- **Current Behavior per Runtime / UI**:
  - `GOOS=windows GOARCH=amd64 go test ./...` reports `[no test files]` for all 3 Go packages (`yawps`, `yawps/pkg/cli`, `yawps/pkg/core`).
  - `package.json` defines no `"test"` script and contains zero unit/integration test files (`node:test` or otherwise).
- **Root Cause & User Impact**:
  - Zero regression safety net allowed critical live contract bugs (`TODO-001`, `TODO-002`, `TODO-003`), patch migration regressions (`TODO-004`), double-backslash PATH corruption (`TODO-025`), and data races (`TODO-027`) to ship undetected.
- **Suggested Remediation Options**:
  1. Add Go unit tests (`pkg/core/*_test.go`, `pkg/cli/cli_test.go`, `app_test.go`) runnable cross-platform (`go test ./...` for OS-agnostic logic like releases, semver, zip extraction, extensions/directives, updater migration, Composer lock/json parsing, CLI routing, DTO JSON contracts) plus `//go:build windows` integration tests for junctions/registry.
  2. Add Node unit tests (`tests/*.test.js` using built-in `node --test`, requiring zero extra dependencies) and wire `"test": "node --test"` in `package.json:10-20`, testing `releases`, `extensions`, `updater`, `uninstaller`, `composer`, `paths`, `cli`, and `app.js` pure helpers / DOM rendering.
- **OpenSpec Change Proposal Notes**:
  - **Capabilities**: All 9 capabilities (guided by `openspec/config.yaml` `rules.tasks`)
  - **Proposal**: Add mandatory unit test deliverables to every OpenSpec remediation change proposal.
- **Verification Criteria**:
  - `GOOS=windows GOARCH=amd64 go test -c ./pkg/core ./pkg/cli .` (or Linux-runnable Go unit tests with `-race` on OS-independent files) passes with real assertions.
  - `npm test` (`node --test`) passes across all core/CLI/UI test suites.

---

#### TODO-035: GitHub Actions Workflow (`build-windows.yml`) Trigger, Validation & Smoke-Test Gaps
- **Severity**: `P2 Medium`
- **Category**: CI/CD Pipeline
- **Affected Files & Verified Lines**:
  - `.github/workflows/build-windows.yml:3-21,54-57,70-78,140-152`
- **Current Behavior per Runtime / UI**:
  - Trigger (`lines 3-21`) is `workflow_dispatch`-only: zero automated checks run on `push` or `pull_request`.
  - Runs `go vet ./...` (`line 56`), but skips `go test ./...`.
  - Runs neither `node --check` nor `npm test`, and because `build_electron` defaults to `false` (`line 10`), JavaScript syntax errors and `package-lock.json` desyncs (`TODO-031`) go completely untested on default workflow runs.
  - `build-electron` (`lines 143-152`) smoke-tests `node bin/yawps.js --version` *before* running `electron-builder --win portable --x64` (`line 151`), never smoke-testing the packaged `dist/*-portable.exe`.
- **Root Cause & User Impact**:
  - Broken commits, syntax errors, lockfile desyncs, and packaged Electron regressions merge silently without CI feedback.
- **Suggested Remediation Options**:
  1. Add `push` and `pull_request` triggers (or a lightweight `verify` job running `go vet ./...`, `go test -race ./...` / `go test ./...`, JS `node --check`, and `npm test` on every PR/push).
  2. Run `node --check` across `bin/` & `src/` even when `build_electron` is `false`.
  3. Add a post-build smoke check for `dist/*-portable.exe` (e.g., running with `--version` or verifying non-zero size & PE signature).
- **OpenSpec Change Proposal Notes**:
  - **Capabilities**: `portable-build-and-packaging`
  - **Proposal**: Specify automated PR/push verification, `go test` / `node --check` / `npm test` gates, and packaged `.exe` smoke checks in `portable-build-and-packaging/spec.md`.
- **Verification Criteria**:
  - Trigger `.github/workflows/build-windows.yml` on PR/push and `workflow_dispatch` with `build_electron: true`; verify all vet, test, lint, and smoke steps execute and pass.

---

#### TODO-036: Missing Local & CI `openspec validate --strict` Integration
- **Severity**: `P2 Medium`
- **Category**: Spec Tooling & CI
- **Affected Files & Verified Lines**:
  - `openspec/config.yaml` (`operations.archive.guidance`)
  - `package.json:10-20,64-72`
  - `.github/workflows/build-windows.yml`
- **Current Behavior per Runtime / UI**:
  - `openspec/config.yaml` recommends `openspec validate --all --strict`, yet `@fission-ai/openspec` (`openspec` CLI) is absent from `package.json`, absent from the Linux devbox environment, and never executed in `.github/workflows/build-windows.yml`.
- **Root Cause & User Impact**:
  - Spec drift or strict-schema violations in `openspec/specs/` or `openspec/changes/` cannot be caught automatically by CI or `npm` scripts.
- **Suggested Remediation Options**:
  1. Add `@fission-ai/openspec` (at `2.1.1`) to `devDependencies` (or an `npx @fission-ai/openspec@2.1.1 validate --all --strict` CI step) plus an npm script `"spec:validate": "openspec validate --all --strict"`.
  2. Add a CI validation step in `.github/workflows/build-windows.yml` whenever `openspec/**` changes.
- **OpenSpec Change Proposal Notes**:
  - **Capabilities**: `portable-build-and-packaging` (and cross-cutting workflow governance)
  - **Proposal**: Automate `openspec validate --all --strict` in CI/npm scripts once approved by maintainers.
- **Verification Criteria**:
  - `npx openspec validate --specs --strict` and `npx openspec validate --all --strict` pass locally and in CI with exit code `0`.

---

## 4. Suggested OpenSpec Change Proposal Roadmap

To remediate these 36 items cleanly without introducing regressions, execute them as **8 incremental OpenSpec change proposals** (`openspec-propose` -> `openspec-apply-change` -> `openspec-verify-change` -> `openspec-archive-change`), starting with P0 live crashes/corruption and automated tests:

1. **`add-core-test-harness`** (`TODO-034`, `TODO-035`, `TODO-036`)
   - **Scope**: Add Go unit tests (`*_test.go`), Node `node --test` suite (`"test"` npm script), `node --check` lint, and CI `push`/`pull_request` gates + `openspec validate --all --strict` check.
   - **Capabilities**: All 9 capabilities (focus `portable-build-and-packaging`).
   - **Rationale**: Establishes regression safety before modifying production Go/JS logic.

2. **`fix-wails-ui-dto-contracts`** (`TODO-001`, `TODO-002`, `TODO-003`)
   - **Scope**: Fix live Wails crash on `nil` `ActivePhpLocations` (`FixPath`/`RemovePath`/`SwitchVersion`), align `GetDirectives`/`UpdateDirectives` key mapping + return shape + regex `$1` safety, align `UpdateVersion` (`UpdateResult`) and `CheckUpdates` (`UpdateItem`) DTOs, propagate errors in `app.go`, and regenerate `src/gui/renderer/wailsjs/`.
   - **Capabilities**: `php-ini-and-extension-management`, `php-patch-updater`, `php-version-switching-and-path`, `desktop-gui-workspace`.

3. **`fix-path-registry-and-junction-safety`** (`TODO-006`, `TODO-007`, `TODO-010`, `TODO-025`, `TODO-026`)
   - **Scope**: Fix Node `\\` User `PATH` double-backslash corruption & PowerShell injection; fix Go `GetStringValue` `Path` wipe bug, preserve `REG_EXPAND_SZ`, refresh `PATH` inspection, and enforce directory-boundary matching; align `RemovePath`/`env remove` junction unlinking, dangling `lstatSync` recovery, `VersionInfo.isActive` booleans, and `CleanupResult` accuracy.
   - **Capabilities**: `php-version-switching-and-path`, `platform-runtime-and-storage`, `desktop-gui-workspace`.

4. **`fix-installer-migration-and-php-ini-parity`** (`TODO-004`, `TODO-005`, `TODO-008`, `TODO-009`, `TODO-028`, `TODO-030`)
   - **Scope**: Fix `php.ini` patch migration in both Go (`targetUpdate.CurrentVersion`) and Node (`target.id` / `newId`) plus monotonic progress; align initial `php.ini` defaults (`date.timezone = UTC` + 8 extensions); fix Go `downloadFileWithProgress` nil-`resp` panic + `%!w(<nil>)` + `computeSHA256` error checking; implement `.tmp` atomic zip download & extraction; align `ReleaseInfo.mtime`, Node `findRelease` full-ID lookup & fetch timeout, pre-release semver comparison, missing-`php.ini` & `.dll` validation in extensions, `gd`/`gd2` boundary, and `RtlGetVersion` handling.
   - **Capabilities**: `php-release-catalog-and-installer`, `php-ini-and-extension-management`, `php-patch-updater`, `platform-runtime-and-storage`.

5. **`harden-composer-concurrency-and-parsing`** (`TODO-027`, `TODO-029`)
   - **Scope**: Fix Go `RunComposerCommand` concurrent `strings.Builder` race + `cmd.Wait()` ordering + `ansiRegex`; fix POSIX `bin/composer` (`php ...`) in both runtimes; fix Node `fetchLatestComposerVersion` timeout destroy, `installComposer` HTTP/stream/`runCheck` checks, `res.error` field, empty-package validation, chunk line buffering, `cmd.exe` caret/`PATH` handling, Go string `license`/`bin` parsing, deterministic sorting, platform constraint filtering, and accurate uninstall flags.
   - **Capabilities**: `composer-lifecycle-and-packages`.

6. **`unify-cli-parity-and-exit-codes`** (`TODO-011`, `TODO-012`, `TODO-013`, `TODO-014`, `TODO-015`, `TODO-016`, `TODO-017`, `TODO-018`)
   - **Scope**: Return exit code `1` on all CLI errors across Go and Node; implement `yawps update <version>` execution in Go; unify `cleanup` safe defaults & non-TTY `--yes`/`--force` guard; fix `composer install`/`update`/`require`/`remove` and `env fix` result checks; unify `--x86`, `--no-use`, `rm`, `cache clean [version]`, `composer require -v`, `packages`, order-independent flag parsing, unknown-subcommand errors, `AttachConsole` stdin/stderr rebinding, and `win-php` cleanup.
   - **Capabilities**: `cli-interface`, `platform-runtime-and-storage`, `php-patch-updater`, `composer-lifecycle-and-packages`.

7. **`harden-desktop-gui-electron-and-ux`** (`TODO-019`, `TODO-020`, `TODO-021`, `TODO-022`, `TODO-023`, `TODO-024`)
   - **Scope**: Abort Electron cleanly on `< Win 10`, align window title/icon, lock down `setWindowOpenHandler` & add Wails external browser open; fix Packagist `%2F` URLs, Extension/Directives dropdown sync, and custom `date.timezone` preservation; escape all `innerHTML` XSS vectors and add `bridge.js` `EventsOn` retry polling; fix `OpenFolder()` default to `BASE_DIR`, add `x86` & dynamic branch/category chips, fix `user-select: text`, sticky PATH pill, timers, HTML confirm modal, CSS `.btn-sm`/`.btn:disabled`/transitions/A11y/CSP, and resolve unused `config.json`/APIs.
   - **Capabilities**: `desktop-gui-workspace`, `platform-runtime-and-storage`.

8. **`fix-nsis-builds-wrappers-and-docs`** (`TODO-031`, `TODO-032`, `TODO-033`)
   - **Scope**: Fix `build/installer.nsh` PowerShell 5.1 junction removal, NSIS escaping, `YAWPS_HOME` awareness, and `.win-php` prompt; sync `package-lock.json` (remove orphaned `chalk`); fix `build.sh`/`build.cmd` (`go 1.27.0`, `GOBIN`, `-clean -trimpath`, `build.cmd` quoting), add `asInvoker` to `wails.exe.manifest`, propagate `$LASTEXITCODE` in `.ps1` wrappers, and comprehensively update `README.md` + GUI CLI Cheat Sheet.
   - **Capabilities**: `portable-build-and-packaging`, `cli-interface`, `desktop-gui-workspace`.
