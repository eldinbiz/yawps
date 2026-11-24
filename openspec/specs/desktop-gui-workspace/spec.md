# Desktop GUI Workspace Specification

## Purpose

Provide the shared dark-slate Fluent desktop workspace across Go/Wails WebView2 and Electron BrowserWindow, comprising the `250px` 6-tab sidebar, persistent top status bar, progress banner, toast notifications, 6 operational tabs, live Composer output drawer, and confirmation modals.

## Requirements

### Requirement: Desktop Window Chrome, Theme Tokens and External Links

The desktop shell SHALL render a `1100x780` window (`minWidth: 900`, `minHeight: 640`, background `#0f172a`) hosting `src/gui/renderer/index.html` with dark-slate CSS tokens (`--bg-primary: #0b0f19`, `--bg-secondary: #131c2e`, `--bg-card: #1e293b`, `--accent-cyan: #38bdf8`, `--accent-green: #10b981`, `--accent-amber: #f59e0b`, `--accent-red: #ef4444`) and global `* { user-select: none; }`.

#### Scenario: Electron Opens External Packagist URL in System Browser

- **WHEN** a user clicks `🌐 Packagist` on a Composer global package row in Electron (`window.open('https://packagist.org/packages/' + encodeURIComponent(pkg.name), '_blank')`)
- **THEN** `setWindowOpenHandler` intercepts the `https:` URL, opens it with `shell.openExternal`, and denies creating a child Electron window (returning `{ action: 'allow' }` for non-HTTP schemes)

#### Scenario: Window Initializes State and Loads Remote Catalog

- **WHEN** `DOMContentLoaded` fires in the desktop renderer
- **THEN** the SPA binds navigation, UI listeners, and progress/log streams, awaits `window.api.getState()`, and asynchronously invokes `fetchRemoteReleases()` followed by `checkUpdates()`

#### Scenario: Runtime Parity — Window Title, Asset Embedding and Wails External Links

- **WHEN** comparing Go/Wails (`main.go`, `wails.json`) and Electron (`src/gui/main.js`) window shells
- **THEN** Go/Wails sets title `"YAWPS - Yet Another Windows PHP Switcher"`, embeds `src/gui/renderer` (`WebviewIsTransparent: false`), and lacks an external browser `window.open` interceptor
- **AND** Electron sets window title `'Win PHP Switcher'` (despite `<title>` in `index.html`), sets `autoHideMenuBar: true`, defers `show()` until `ready-to-show`, and configures `nodeIntegration: false` + `contextIsolation: true`

### Requirement: Sidebar Navigation, Persistent Status Header, Progress Banner and Toasts

The workspace SHALL render a fixed `250px` 6-tab sidebar, a `68px` persistent top status bar, a global `#progress-banner` auto-hiding `2500ms` after completion, and a bottom-right `#toast` auto-hiding after `3200ms`.

#### Scenario: Clickable PATH Warning Pill Fixes User PATH

- **WHEN** `appState.pathStatus.isInUserPath` is `false` and the user clicks `#path-status-pill` (`⚠ Not in PATH (Click to Fix)`)
- **THEN** the UI calls `window.api.fixPath()`, refreshes app state, updates the pill to `✔ In User PATH`, and shows a confirmation toast

#### Scenario: Progress Banner Auto-Refreshes on Completion

- **WHEN** an `install-progress`, `update-progress`, or `composer-progress` event arrives with `stage === 'completed'` or `percent >= 100`
- **THEN** `#progress-banner` reaches `100%`, triggers `refreshAppState()` and `renderRemoteList()`, and hides after `2500ms`

#### Scenario: Shell Controls and Runtime UI Quirks

- **WHEN** interacting with the sidebar and top bar (`tab-installed` with `#installed-count-badge`, `tab-download`, `tab-extensions`, `tab-directives`, `tab-composer` with hidden `#composer-nav-badge`, `tab-env`, `v0.1 (Windows x64)`, active dot, quick-switch `<select>`, Refresh button)
- **THEN** clicking `📁 Open YAWPS Folder` invokes `window.api.openFolder()` with no path argument (opening `<baseDir>/versions` instead of `<baseDir>`)
- **AND** transitioning `isInUserPath` to `true` keeps the prior `onclick` and `cursor: pointer`, and rapid consecutive `showToast()` calls share uncancelled `3200ms` timeouts

### Requirement: Installed Versions and Download & Install Tabs

The `Installed` tab SHALL display installed PHP cards with active highlights, update alert banners, and card actions (`★ Set as Active`, `🧩 Extensions`, `📁 Folder`, `🗑 Uninstall`, inline `Update`), while the `Download` tab SHALL filter remote releases by `NTS`/`TS` flavor, static branch chips (`All`, `8.5`..`7.4`), and `arch === 'x64'`.

#### Scenario: One-Click Install Transitions to Installed Versions Tab

- **WHEN** the user clicks `⬇ Download & Install` on a remote release card
- **THEN** the button disables (`"Installing..."`), invokes `window.api.installVersion({ release })`, refreshes state and remote cards on completion, shows a success toast, and clicks `[data-tab="tab-installed"]`

#### Scenario: Uninstall Confirmation Modal Flow

- **WHEN** the user clicks `🗑 Uninstall` on an installed card
- **THEN** `#modal-uninstall` opens showing `#modal-uninstall-active-warning` if `item.isActive` is true, and confirming invokes `window.api.uninstallVersion({ versionId, cleanCache })`, refreshes state/lists, and shows the uninstall toast

#### Scenario: Runtime Parity — Post-Update Toast and Unescaped Card HTML

- **WHEN** `handleUpdateVersion` (`app.js:779-780`) runs or non-Composer cards render
- **THEN** `handleUpdateVersion` checks `if (res.updated)` and reads `res.newVersion` (present in Node `performUpdate`), so under Wails (`*core.InstallResult`) post-update toast and refresh do not run
- **AND** non-Composer templates (`renderInstalledList`, `renderRemoteList`, `renderExtensionsList`, `renderEnvironmentTab`) interpolate values into `innerHTML` without `escapeHtml`

### Requirement: Extensions Manager and PHP Settings Tabs

The `Extensions` tab SHALL support per-version selection, Standard Web Stack batch activation, real-time search/category chips, and immediate toggles that revert on failure, while the `PHP Settings` tab SHALL edit 7 core `php.ini` directives (`memory_limit`, `upload_max_filesize`, `post_max_size`, `max_execution_time`, `display_errors`, `opcache.enable`, `date.timezone`).

#### Scenario: Extension Toggle Reverts on Backend Error

- **WHEN** toggling an extension switch triggers `window.api.setExtensionStatus` and the backend rejects
- **THEN** the checkbox state reverts to `!enabled` and an error toast displays

#### Scenario: Standard Web Stack Batch Activation

- **WHEN** the user clicks `⚡ Enable Standard Web Stack`
- **THEN** the UI sequentially enables `curl`, `fileinfo`, `gd`, `intl`, `mbstring`, `openssl`, `pdo_mysql`, `pdo_sqlite`, `sqlite3`, and `zip` and reloads the extension list

#### Scenario: Preset Chip Populates Directive Input

- **WHEN** the user clicks the `512M` chip under `memory_limit`
- **THEN** `#input-memory-limit` updates to `"512M"` pending `💾 Save Settings`

#### Scenario: Runtime Parity — Wails Directives Key Mismatch and Dropdown Sync

- **WHEN** loading or saving `PHP Settings` or refreshing version dropdowns
- **THEN** `app.js:1032,1036,1046-1054` reads and sends `opcache_enable` and `date_timezone` (matching Node `keyMap`, but mismatching Go dotted keys so Wails loads OPcache Off / UTC and writes literal `opcache_enable`/`date_timezone` keys)
- **AND** non-listed `php.ini` timezones leave the 12-option `#select-timezone` blank and save `""`, and uninstalling a selected target keeps stale `appState.selectedExtVersion`/`selectedDirectivesVersion`

### Requirement: Composer Tab, Multi-Select Toolbar, Console Drawer and Removal Modal

The `Composer` tab SHALL render Composer health, Global Bin PATH toggle, `Require New Global Package` form with 8 Popular CLI chips, search, tri-state `Select All` bulk toolbar, escaped package rows, live `#composer-console-drawer`, and 5-checkbox `#modal-composer-uninstall`.

#### Scenario: Bulk Package Selection and Streaming Console Removal

- **WHEN** a user selects 2 global packages, clicks `Remove Selected (2)`, and confirms the browser `window.confirm()` prompt
- **THEN** `#composer-console-drawer` clears, opens with spinner visible, logs `> composer global remove ... --no-interaction`, streams `composer-log` output lines, hides the spinner on completion, and refreshes the Composer tab

#### Scenario: Clean Composer Removal Modal Submits Five Flags

- **WHEN** the user clicks `🗑️ Remove Composer`, adjusts checkboxes in `#modal-composer-uninstall`, and clicks `Confirm Clean Removal`
- **THEN** the UI invokes `window.api.uninstallComposer({ removeBin, removeFromPath, cleanCache, purgePackages, removeGlobalBinFromPath })` and reloads Composer status

### Requirement: Environment & PATH Tab

The `Environment & PATH` tab SHALL render Windows OS compatibility status, the NTFS junction diagram (`currentLink` -> active `path`), numbered `PATH` `php.exe` precedence rows (`Managed by YAWPS` vs `External PHP`), a 10-row CLI Cheat Sheet, and `⚡ Configure User PATH` / `❌ Remove from User PATH` action buttons.

#### Scenario: Configure or Remove User PATH From Environment Tab

- **WHEN** the user clicks `⚡ Configure User PATH` or `❌ Remove from User PATH`
- **THEN** the UI calls `window.api.fixPath()` or `window.api.removePath()`, updates `appState.pathStatus`, refreshes the header pill and precedence list, and displays a toast notification
