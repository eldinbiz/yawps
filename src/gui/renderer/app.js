// Frontend Application Logic for YAWPS (Yet Another Windows PHP Switcher)

let appState = {
  current: null,
  installed: [],
  pathStatus: null,
  osInfo: null,
  remoteReleases: [],
  selectedExtVersion: null,
  selectedDirectivesVersion: null,
  extensions: [],
  directives: {},
  updates: []
};

let currentFlavor = 'nts'; // default NTS
let selectedBranch = 'all';
let selectedCategory = 'all';
let pendingUninstallItem = null;

// DOM Elements
const activeVersionNameEl = document.getElementById('active-version-name');
const activeStatusDotEl = document.getElementById('active-status-dot');
const pathStatusPillEl = document.getElementById('path-status-pill');
const pathStatusTextEl = document.getElementById('path-status-text');
const quickSwitchSelectEl = document.getElementById('quick-switch-select');
const installedCountBadgeEl = document.getElementById('installed-count-badge');

const installedListEl = document.getElementById('installed-list');
const installedEmptyEl = document.getElementById('installed-empty');
const remoteListEl = document.getElementById('remote-list');
const extensionsListEl = document.getElementById('extensions-list');

const progressBannerEl = document.getElementById('progress-banner');
const progressStageTextEl = document.getElementById('progress-stage-text');
const progressPercentTextEl = document.getElementById('progress-percent-text');
const progressFillEl = document.getElementById('progress-fill');
const progressSubTextEl = document.getElementById('progress-sub-text');

const toastEl = document.getElementById('toast');

// INIT
document.addEventListener('DOMContentLoaded', async () => {
  setupNavigation();
  setupEventListeners();
  setupProgressListeners();

  await refreshAppState();
  loadRemoteReleases();
});

// Toast notification helper
function showToast(message, isError = false) {
  toastEl.textContent = message;
  toastEl.style.borderColor = isError ? 'var(--accent-red)' : 'var(--accent-cyan)';
  toastEl.classList.remove('hidden');

  setTimeout(() => {
    toastEl.classList.add('hidden');
  }, 3200);
}

// NAVIGATION
function setupNavigation() {
  const navItems = document.querySelectorAll('.nav-item');
  const panes = document.querySelectorAll('.tab-pane');

  navItems.forEach(item => {
    item.addEventListener('click', async () => {
      const targetTabId = item.dataset.tab;

      navItems.forEach(n => n.classList.remove('active'));
      panes.forEach(p => p.classList.remove('active'));

      item.classList.add('active');
      const targetPane = document.getElementById(targetTabId);
      if (targetPane) targetPane.classList.add('active');

      if (targetTabId === 'tab-installed') {
        await refreshAppState();
      } else if (targetTabId === 'tab-download') {
        renderRemoteList();
      } else if (targetTabId === 'tab-extensions') {
        loadExtensions();
      } else if (targetTabId === 'tab-directives') {
        loadDirectives();
      } else if (targetTabId === 'tab-composer') {
        loadComposerTab();
      } else if (targetTabId === 'tab-env') {
        renderEnvironmentTab();
      }
    });
  });
}

// SETUP EVENT LISTENERS
function setupEventListeners() {
  document.getElementById('btn-refresh').addEventListener('click', async () => {
    await refreshAppState();
    showToast('Refreshed status');
  });

  document.getElementById('btn-open-root-folder').addEventListener('click', () => {
    window.api.openFolder();
  });

  quickSwitchSelectEl.addEventListener('change', async (e) => {
    if (e.target.value) {
      await handleSwitchVersion(e.target.value);
    }
  });

  document.getElementById('btn-check-updates-main').addEventListener('click', async () => {
    await checkForUpdates(true);
  });

  document.getElementById('btn-go-download').addEventListener('click', () => {
    document.querySelector('[data-tab="tab-download"]').click();
  });

  // Flavor toggle
  const btnNts = document.getElementById('btn-flavor-nts');
  const btnTs = document.getElementById('btn-flavor-ts');

  btnNts.addEventListener('click', () => {
    currentFlavor = 'nts';
    btnNts.classList.add('active');
    btnTs.classList.remove('active');
    renderRemoteList();
  });

  btnTs.addEventListener('click', () => {
    currentFlavor = 'ts';
    btnTs.classList.add('active');
    btnNts.classList.remove('active');
    renderRemoteList();
  });

  // Branch chips
  document.querySelectorAll('#branch-chips .chip').forEach(chip => {
    chip.addEventListener('click', () => {
      document.querySelectorAll('#branch-chips .chip').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      selectedBranch = chip.dataset.branch;
      renderRemoteList();
    });
  });

  // Extensions filter & search
  document.getElementById('ext-search-input').addEventListener('input', () => {
    renderExtensionsList();
  });

  document.querySelectorAll('#ext-category-chips .chip').forEach(chip => {
    chip.addEventListener('click', () => {
      document.querySelectorAll('#ext-category-chips .chip').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      selectedCategory = chip.dataset.cat;
      renderExtensionsList();
    });
  });

  document.getElementById('ext-version-select').addEventListener('change', (e) => {
    appState.selectedExtVersion = e.target.value;
    loadExtensions();
  });

  document.getElementById('btn-enable-common-exts').addEventListener('click', async () => {
    await enableCommonWebExtensions();
  });

  // Directives version select & presets
  document.getElementById('directives-version-select').addEventListener('change', (e) => {
    appState.selectedDirectivesVersion = e.target.value;
    loadDirectives();
  });

  document.querySelectorAll('.preset-buttons button').forEach(btn => {
    btn.addEventListener('click', () => {
      const targetId = btn.parentElement.dataset.target;
      const input = document.getElementById(targetId);
      if (input) {
        input.value = btn.dataset.val;
      }
    });
  });

  document.getElementById('switch-display-errors').addEventListener('change', (e) => {
    document.getElementById('display-errors-label').textContent = e.target.checked ? 'On' : 'Off';
  });

  document.getElementById('switch-opcache-enable').addEventListener('change', (e) => {
    document.getElementById('opcache-enable-label').textContent = e.target.checked ? 'On' : 'Off';
  });

  document.getElementById('btn-save-directives').addEventListener('click', async () => {
    await saveDirectives();
  });

  // Fix path
  document.getElementById('btn-fix-path').addEventListener('click', async () => {
    try {
      const newStatus = await window.api.fixPath();
      appState.pathStatus = newStatus;
      updatePathStatusUI();
      renderEnvironmentTab();
      showToast('✔ Added YAWPS current directory to User PATH!');
    } catch (err) {
      showToast(`Error: ${err.message}`, true);
    }
  });

  // Remove path
  const btnRemovePath = document.getElementById('btn-remove-path');
  if (btnRemovePath) {
    btnRemovePath.addEventListener('click', async () => {
      try {
        const newStatus = await window.api.removePath();
        appState.pathStatus = newStatus;
        updatePathStatusUI();
        renderEnvironmentTab();
        showToast('✔ Removed YAWPS from User PATH and unlinked junction.');
      } catch (err) {
        showToast(`Error: ${err.message}`, true);
      }
    });
  }

  // Uninstall modal events
  const modalUninstall = document.getElementById('modal-uninstall');
  const btnModalCancel = document.getElementById('btn-modal-cancel');
  const btnModalConfirm = document.getElementById('btn-modal-confirm-uninstall');

  if (btnModalCancel) {
    btnModalCancel.addEventListener('click', () => {
      modalUninstall.classList.add('hidden');
      pendingUninstallItem = null;
    });
  }

  if (modalUninstall) {
    modalUninstall.addEventListener('click', (e) => {
      if (e.target === modalUninstall) {
        modalUninstall.classList.add('hidden');
        pendingUninstallItem = null;
      }
    });
  }

  if (btnModalConfirm) {
    btnModalConfirm.addEventListener('click', async () => {
      if (!pendingUninstallItem) return;
      const cleanCache = document.getElementById('modal-uninstall-clean-cache').checked;
      const targetItem = pendingUninstallItem;
      modalUninstall.classList.add('hidden');
      pendingUninstallItem = null;

      try {
        showToast(`Uninstalling PHP ${targetItem.version}...`);
        const res = await window.api.uninstallVersion({
          versionId: targetItem.id,
          cleanCache
        });

        await refreshAppState();
        renderRemoteList();

        const ver = (res && res.target && res.target.version) || targetItem.version || targetItem.id;
        let msg = `✔ Uninstalled PHP ${ver}`;
        if (res && res.switchedTo && res.switchedTo.version) {
          msg += ` (Switched active to ${res.switchedTo.version})`;
        }
        showToast(msg);
      } catch (err) {
        showToast(`Uninstall failed: ${err.message}`, true);
      }
    });
  }

  // ==========================================
  // COMPOSER MODULE EVENT LISTENERS
  // ==========================================
  const btnCompRefresh = document.getElementById('btn-composer-refresh');
  if (btnCompRefresh) {
    btnCompRefresh.addEventListener('click', async () => {
      await loadComposerTab(true);
      showToast('Refreshed Composer status');
    });
  }

  const btnCompInstall = document.getElementById('btn-composer-install');
  if (btnCompInstall) {
    btnCompInstall.addEventListener('click', async () => {
      try {
        showToast('Downloading and installing official Composer...');
        const res = await window.api.installComposer();
        if (res && res.success) {
          showToast('✔ Composer installed successfully!');
          await loadComposerTab(true);
        } else {
          showToast(`Installation error: ${res ? res.error : 'Unknown'}`, true);
        }
      } catch (err) {
        showToast(`Error installing Composer: ${err.message}`, true);
      }
    });
  }

  const btnCompUpdate = document.getElementById('btn-composer-update');
  if (btnCompUpdate) {
    btnCompUpdate.addEventListener('click', async () => {
      try {
        showToast('Updating Composer...');
        const res = await window.api.updateComposer();
        if (res && res.success) {
          showToast('✔ Composer updated successfully!');
          await loadComposerTab(true);
        } else {
          showToast(`Update error: ${res ? res.error : 'Unknown'}`, true);
        }
      } catch (err) {
        showToast(`Error updating Composer: ${err.message}`, true);
      }
    });
  }

  const modalComposerUninstall = document.getElementById('modal-composer-uninstall');
  const btnModalComposerCancel = document.getElementById('btn-modal-composer-cancel');
  const btnModalComposerConfirm = document.getElementById('btn-modal-composer-confirm');
  const btnComposerUninstallModal = document.getElementById('btn-composer-uninstall-modal');

  if (btnComposerUninstallModal && modalComposerUninstall) {
    btnComposerUninstallModal.addEventListener('click', () => {
      modalComposerUninstall.classList.remove('hidden');
    });
  }

  if (btnModalComposerCancel && modalComposerUninstall) {
    btnModalComposerCancel.addEventListener('click', () => {
      modalComposerUninstall.classList.add('hidden');
    });
  }

  if (modalComposerUninstall) {
    modalComposerUninstall.addEventListener('click', (e) => {
      if (e.target === modalComposerUninstall) {
        modalComposerUninstall.classList.add('hidden');
      }
    });
  }

  if (btnModalComposerConfirm && modalComposerUninstall) {
    btnModalComposerConfirm.addEventListener('click', async () => {
      const removeBin = document.getElementById('chk-composer-rem-bin').checked;
      const removeFromPath = document.getElementById('chk-composer-rem-path').checked;
      const cleanCache = document.getElementById('chk-composer-clean-cache').checked;
      const purgePackages = document.getElementById('chk-composer-purge-packages').checked;
      const removeGlobalBinFromPath = document.getElementById('chk-composer-rem-global-bin').checked;

      modalComposerUninstall.classList.add('hidden');

      try {
        showToast('Removing Composer cleanly...');
        const res = await window.api.uninstallComposer({
          removeBin,
          removeFromPath,
          cleanCache,
          purgePackages,
          removeGlobalBinFromPath
        });
        showToast(res && res.message ? res.message : '✔ Composer removed cleanly!');
        await loadComposerTab(true);
      } catch (err) {
        showToast(`Uninstall failed: ${err.message}`, true);
      }
    });
  }

  const btnComposerOpenFolder = document.getElementById('btn-composer-open-folder');
  if (btnComposerOpenFolder) {
    btnComposerOpenFolder.addEventListener('click', () => {
      if (appState.composer && appState.composer.status && appState.composer.status.composerHome) {
        window.api.openFolder(appState.composer.status.composerHome);
      } else {
        window.api.openFolder();
      }
    });
  }

  const btnToggleGlobalBin = document.getElementById('btn-toggle-global-bin-path');
  if (btnToggleGlobalBin) {
    btnToggleGlobalBin.addEventListener('click', async () => {
      try {
        const isCurrentlyIn = appState.composer && appState.composer.status && appState.composer.status.isGlobalBinInPath;
        await window.api.toggleComposerGlobalBinPath({ enable: !isCurrentlyIn });
        showToast(!isCurrentlyIn ? '✔ Added Composer Global Bin to User PATH!' : '✔ Removed Global Bin from User PATH');
        await loadComposerTab(true);
      } catch (err) {
        showToast(`Error: ${err.message}`, true);
      }
    });
  }

  const btnPkgRequire = document.getElementById('btn-pkg-require');
  if (btnPkgRequire) {
    btnPkgRequire.addEventListener('click', async () => {
      const pkgName = document.getElementById('input-pkg-name').value;
      const pkgVersion = document.getElementById('input-pkg-version').value;
      await handleInstallComposerPackage(pkgName, pkgVersion);
    });
  }

  const inputPkgName = document.getElementById('input-pkg-name');
  if (inputPkgName) {
    inputPkgName.addEventListener('keydown', async (e) => {
      if (e.key === 'Enter') {
        const pkgName = document.getElementById('input-pkg-name').value;
        const pkgVersion = document.getElementById('input-pkg-version').value;
        await handleInstallComposerPackage(pkgName, pkgVersion);
      }
    });
  }

  document.querySelectorAll('.tool-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      const pkg = chip.dataset.pkg;
      const input = document.getElementById('input-pkg-name');
      if (input) {
        input.value = pkg;
        document.getElementById('input-pkg-version').value = '';
        input.focus();
      }
    });
  });

  const inputPkgSearch = document.getElementById('input-pkg-search');
  if (inputPkgSearch) {
    inputPkgSearch.addEventListener('input', (e) => {
      renderComposerPackages(e.target.value);
    });
  }

  const btnUpdateAll = document.getElementById('btn-composer-update-all');
  if (btnUpdateAll) {
    btnUpdateAll.addEventListener('click', async () => {
      await handleUpdateComposerPackage('');
    });
  }

  const btnConsoleClear = document.getElementById('btn-console-clear');
  if (btnConsoleClear) {
    btnConsoleClear.addEventListener('click', () => {
      clearConsoleLog();
    });
  }

  const btnConsoleClose = document.getElementById('btn-console-close');
  if (btnConsoleClose) {
    btnConsoleClose.addEventListener('click', () => {
      closeConsoleDrawer();
    });
  }
}

// SETUP PROGRESS LISTENERS
function setupProgressListeners() {
  window.api.onInstallProgress((p) => {
    showProgress(p);
  });

  window.api.onUpdateProgress((p) => {
    showProgress(p);
  });

  if (window.api.onComposerProgress) {
    window.api.onComposerProgress((p) => {
      showProgress(p);
    });
  }

  if (window.api.onComposerLog) {
    window.api.onComposerLog((data) => {
      if (data && data.text) {
        appendConsoleLog(data.text);
      }
    });
  }
}

function showProgress(p) {
  progressBannerEl.classList.remove('hidden');
  progressPercentTextEl.textContent = `${p.percent || 0}%`;
  progressFillEl.style.width = `${p.percent || 0}%`;

  if (p.stage === 'downloading') {
    if (typeof p.receivedBytes === 'number' && typeof p.totalBytes === 'number' && p.totalBytes > 0) {
      const mbDownloaded = (p.receivedBytes / 1024 / 1024).toFixed(1);
      const mbTotal = (p.totalBytes / 1024 / 1024).toFixed(1);
      progressStageTextEl.textContent = 'Downloading PHP release...';
      progressSubTextEl.textContent = `${mbDownloaded} MB / ${mbTotal} MB (${p.percent}%)`;
    } else {
      progressStageTextEl.textContent = 'Downloading PHP release...';
      progressSubTextEl.textContent = p.message || `Downloading... (${p.percent || 0}%)`;
    }
  } else {
    progressStageTextEl.textContent = (p.stage || 'PROGRESS').toUpperCase();
    progressSubTextEl.textContent = p.message || '';
  }

  if (p.stage === 'completed' || p.percent >= 100) {
    refreshAppState();
    renderRemoteList();
    setTimeout(() => {
      progressBannerEl.classList.add('hidden');
    }, 2500);
  }
}

// REFRESH APP STATE
async function refreshAppState() {
  try {
    const state = await window.api.getState();
    appState.current = state ? state.current : null;
    appState.installed = (state && Array.isArray(state.installed)) ? state.installed : [];
    appState.pathStatus = state ? state.pathStatus : null;
    if (appState.pathStatus && !Array.isArray(appState.pathStatus.activePhpLocations)) {
      appState.pathStatus.activePhpLocations = [];
    }
    appState.osInfo = state ? state.osInfo : null;

    updateTopBarUI();
    renderInstalledList();
    populateVersionDropdowns();
  } catch (err) {
    console.error('Failed to get app state:', err);
  }
}

// UPDATE TOP BAR
function updateTopBarUI() {
  if (appState.current) {
    activeVersionNameEl.textContent = `${appState.current.id}`;
    activeStatusDotEl.classList.add('active');
  } else {
    activeVersionNameEl.textContent = 'None Active';
    activeStatusDotEl.classList.remove('active');
  }

  const installed = Array.isArray(appState.installed) ? appState.installed : [];
  installedCountBadgeEl.textContent = installed.length;

  updatePathStatusUI();

  // Populate quick switcher
  quickSwitchSelectEl.innerHTML = '<option value="">(Switch Version)</option>';
  installed.forEach(item => {
    const opt = document.createElement('option');
    opt.value = item.id;
    opt.textContent = `${item.version} (${item.type.toUpperCase()})${item.isActive ? ' ★ Active' : ''}`;
    if (item.isActive) opt.selected = true;
    quickSwitchSelectEl.appendChild(opt);
  });
}

function updatePathStatusUI() {
  if (!appState.pathStatus) return;

  if (appState.pathStatus.isInUserPath) {
    pathStatusPillEl.className = 'path-status-pill success';
    pathStatusTextEl.textContent = '✔ In User PATH';
  } else {
    pathStatusPillEl.className = 'path-status-pill warning';
    pathStatusTextEl.textContent = '⚠ Not in PATH (Click to Fix)';
    pathStatusPillEl.style.cursor = 'pointer';
    pathStatusPillEl.onclick = async () => {
      await window.api.fixPath();
      await refreshAppState();
      showToast('Added to User PATH!');
    };
  }
}

// RENDER INSTALLED LIST
function renderInstalledList() {
  installedListEl.innerHTML = '';

  const installed = Array.isArray(appState.installed) ? appState.installed : [];
  if (installed.length === 0) {
    installedEmptyEl.classList.remove('hidden');
    return;
  }
  installedEmptyEl.classList.add('hidden');

  const updatesList = Array.isArray(appState.updates) ? appState.updates : [];

  installed.forEach(item => {
    const card = document.createElement('div');
    card.className = `php-card ${item.isActive ? 'active-version-card' : ''}`;

    const updateInfo = updatesList.find(u => u && (u.installedId === item.id || u.currentVersion === item.id));

    card.innerHTML = `
      <div class="card-top">
        <div class="card-title-group">
          <h3>PHP ${item.version}</h3>
          <span class="badge-tag ${item.type === 'nts' ? 'badge-nts' : 'badge-ts'}">${item.type}</span>
          <span class="badge-tag badge-nts">${item.arch}</span>
          ${item.isActive ? '<span class="badge-tag badge-active">Active</span>' : ''}
        </div>
      </div>

      <div class="card-meta">
        <div>Folder: <code>${item.id}</code></div>
        <div>Config: <code>${item.phpIni}</code></div>
      </div>

      ${updateInfo ? `
        <div class="alert-box" style="margin: 0; padding: 8px 12px;">
          <div class="alert-icon" style="font-size: 16px;">⚡</div>
          <div style="flex: 1; font-size: 12px;">
            Update available: <strong>PHP ${updateInfo.latestVersion}</strong>
          </div>
          <button class="btn btn-outline-green btn-update" data-id="${item.id}" style="padding: 4px 10px; font-size: 11px;">Update</button>
        </div>
      ` : ''}

      <div class="card-actions">
        ${!item.isActive ? `
          <button class="btn btn-outline-green btn-switch" data-id="${item.id}">★ Set as Active</button>
        ` : `
          <span style="font-size: 12px; color: var(--accent-green); font-weight: 600;">✔ Currently Active</span>
        `}
        <button class="btn btn-secondary btn-exts" data-id="${item.id}">🧩 Extensions</button>
        <button class="btn btn-secondary btn-folder" data-path="${item.path}">📁 Folder</button>
        <button class="btn btn-danger btn-uninstall" data-id="${item.id}" title="Uninstall this version">🗑 Uninstall</button>
      </div>
    `;

    // Bind card buttons
    const btnSwitch = card.querySelector('.btn-switch');
    if (btnSwitch) {
      btnSwitch.addEventListener('click', () => handleSwitchVersion(item.id));
    }

    const btnExts = card.querySelector('.btn-exts');
    if (btnExts) {
      btnExts.addEventListener('click', () => {
        appState.selectedExtVersion = item.id;
        document.querySelector('[data-tab="tab-extensions"]').click();
      });
    }

    const btnFolder = card.querySelector('.btn-folder');
    if (btnFolder) {
      btnFolder.addEventListener('click', () => window.api.openFolder(item.path));
    }

    const btnUpdate = card.querySelector('.btn-update');
    if (btnUpdate) {
      btnUpdate.addEventListener('click', () => handleUpdateVersion(item.id));
    }

    const btnUninstall = card.querySelector('.btn-uninstall');
    if (btnUninstall) {
      btnUninstall.addEventListener('click', () => {
        pendingUninstallItem = item;
        document.getElementById('modal-uninstall-title').textContent = `Uninstall PHP ${item.version}?`;
        document.getElementById('modal-uninstall-desc').textContent = `Are you sure you want to uninstall ${item.id}? This will permanently remove its directory and any custom php.ini configurations.`;

        const activeWarning = document.getElementById('modal-uninstall-active-warning');
        if (item.isActive) {
          activeWarning.classList.remove('hidden');
        } else {
          activeWarning.classList.add('hidden');
        }

        document.getElementById('modal-uninstall-clean-cache').checked = false;
        document.getElementById('modal-uninstall').classList.remove('hidden');
      });
    }

    installedListEl.appendChild(card);
  });
}

// SWITCH VERSION
async function handleSwitchVersion(versionId) {
  try {
    const result = await window.api.switchVersion(versionId);
    await refreshAppState();
    showToast(`Switched active PHP to ${versionId}!`);
  } catch (err) {
    showToast(`Failed to switch: ${err.message}`, true);
  }
}

// CHECK UPDATES
async function checkForUpdates(notifyIfClean = false) {
  try {
    const updates = await window.api.checkUpdates();
    appState.updates = Array.isArray(updates) ? updates : [];

    const alertBox = document.getElementById('updates-alert-box');
    const alertDesc = document.getElementById('updates-alert-desc');

    if (appState.updates.length > 0) {
      alertBox.classList.remove('hidden');
      alertDesc.textContent = `${appState.updates.length} update(s) available: ${appState.updates.map(u => `${u.currentVersion} ➜ ${u.latestVersion}`).join(', ')}`;
      renderInstalledList();
      showToast(`${appState.updates.length} PHP update(s) available!`);
    } else {
      alertBox.classList.add('hidden');
      if (notifyIfClean) {
        showToast('All installed PHP versions are up to date!');
      }
    }
  } catch (err) {
    console.error('Check updates error:', err);
    appState.updates = [];
  }
}

// UPDATE VERSION
async function handleUpdateVersion(versionId) {
  try {
    showToast(`Updating PHP ${versionId}...`);
    const res = await window.api.updateVersion(versionId);
    if (res.updated) {
      showToast(`Updated to PHP ${res.newVersion}!`);
      await refreshAppState();
      await checkForUpdates();
    }
  } catch (err) {
    showToast(`Update failed: ${err.message}`, true);
  }
}

// LOAD REMOTE RELEASES
async function loadRemoteReleases() {
  try {
    const releases = await window.api.fetchRemoteReleases();
    appState.remoteReleases = releases;
    renderRemoteList();
    await checkForUpdates();
  } catch (err) {
    remoteListEl.innerHTML = `<div class="loading-state" style="color: var(--accent-red)">Failed to load releases: ${err.message}</div>`;
  }
}

// RENDER REMOTE RELEASES
function renderRemoteList() {
  remoteListEl.innerHTML = '';

  const filtered = appState.remoteReleases.filter(r => {
    const matchFlavor = r.type === currentFlavor;
    const matchArch = r.arch === 'x64';
    const matchBranch = selectedBranch === 'all' || r.branch === selectedBranch;
    return matchFlavor && matchArch && matchBranch;
  });

  if (filtered.length === 0) {
    remoteListEl.innerHTML = '<div class="loading-state">No releases found matching current filters.</div>';
    return;
  }

  const installedMap = new Set(appState.installed.map(v => v.id.toLowerCase()));

  filtered.forEach(rel => {
    const card = document.createElement('div');
    card.className = 'php-card';

    const isInstalled = installedMap.has(rel.id.toLowerCase());

    card.innerHTML = `
      <div class="card-top">
        <div class="card-title-group">
          <h3>PHP ${rel.version}</h3>
          <span class="badge-tag ${rel.type === 'nts' ? 'badge-nts' : 'badge-ts'}">${rel.type}</span>
          <span class="badge-tag badge-nts">${rel.arch}</span>
          <span class="badge-tag" style="background: rgba(255,255,255,0.06);">${rel.compiler}</span>
        </div>
      </div>

      <div class="card-meta">
        <div>Release Size: <strong>${rel.size}</strong></div>
        <div>Archive: <code>${rel.zipName}</code></div>
      </div>

      <div class="card-actions">
        ${isInstalled ? `
          <button class="btn btn-secondary" disabled>✔ Installed</button>
        ` : `
          <button class="btn btn-primary btn-install" data-id="${rel.id}">⬇ Download & Install</button>
        `}
      </div>
    `;

    const btnInstall = card.querySelector('.btn-install');
    if (btnInstall) {
      btnInstall.addEventListener('click', async () => {
        btnInstall.disabled = true;
        btnInstall.textContent = 'Installing...';
        try {
          await window.api.installVersion({ release: rel });
          showToast(`PHP ${rel.version} installed!`);
          await refreshAppState();
          renderRemoteList();

          // Auto-switch to installed versions tab so user immediately sees it
          const tabInstalledBtn = document.querySelector('[data-tab="tab-installed"]');
          if (tabInstalledBtn) {
            tabInstalledBtn.click();
          }
        } catch (err) {
          showToast(`Install failed: ${err.message}`, true);
          btnInstall.disabled = false;
          btnInstall.textContent = '⬇ Download & Install';
        }
      });
    }

    remoteListEl.appendChild(card);
  });
}

// POPULATE VERSION DROPDOWNS
function populateVersionDropdowns() {
  const extSelect = document.getElementById('ext-version-select');
  const dirSelect = document.getElementById('directives-version-select');

  extSelect.innerHTML = '';
  dirSelect.innerHTML = '';

  if (appState.installed.length === 0) {
    const emptyOpt = document.createElement('option');
    emptyOpt.value = '';
    emptyOpt.textContent = 'No installed versions';
    extSelect.appendChild(emptyOpt);
    dirSelect.appendChild(emptyOpt.cloneNode(true));
    return;
  }

  appState.installed.forEach(item => {
    const opt = document.createElement('option');
    opt.value = item.id;
    opt.textContent = `${item.version} (${item.type.toUpperCase()})${item.isActive ? ' ★ Active' : ''}`;
    if (item.isActive && !appState.selectedExtVersion) {
      opt.selected = true;
      appState.selectedExtVersion = item.id;
    }
    extSelect.appendChild(opt);

    const optDir = opt.cloneNode(true);
    if (item.isActive && !appState.selectedDirectivesVersion) {
      optDir.selected = true;
      appState.selectedDirectivesVersion = item.id;
    }
    dirSelect.appendChild(optDir);
  });
}

// EXTENSIONS
async function loadExtensions() {
  const versionId = appState.selectedExtVersion || (appState.current ? appState.current.id : null);
  if (!versionId) {
    extensionsListEl.innerHTML = '<div class="loading-state">No PHP version available.</div>';
    return;
  }

  try {
    const exts = await window.api.getExtensions(versionId);
    appState.extensions = exts;
    renderExtensionsList();
  } catch (err) {
    extensionsListEl.innerHTML = `<div class="loading-state" style="color: var(--accent-red)">Failed to load extensions: ${err.message}</div>`;
  }
}

function renderExtensionsList() {
  extensionsListEl.innerHTML = '';

  const searchQuery = document.getElementById('ext-search-input').value.toLowerCase().trim();

  const filtered = appState.extensions.filter(ext => {
    const matchCat = selectedCategory === 'all' || ext.category.toLowerCase() === selectedCategory.toLowerCase();
    const matchSearch = !searchQuery ||
      ext.name.toLowerCase().includes(searchQuery) ||
      ext.id.toLowerCase().includes(searchQuery) ||
      ext.description.toLowerCase().includes(searchQuery) ||
      ext.dll.toLowerCase().includes(searchQuery);

    return matchCat && matchSearch;
  });

  if (filtered.length === 0) {
    extensionsListEl.innerHTML = '<div class="loading-state">No extensions match your filter.</div>';
    return;
  }

  filtered.forEach(ext => {
    const card = document.createElement('div');
    card.className = 'ext-row-card';

    card.innerHTML = `
      <div class="ext-info">
        <div class="ext-title-line">
          <h4>${ext.name}</h4>
          <span class="ext-category-badge">${ext.category}</span>
          ${ext.isZend ? '<span class="ext-category-badge" style="color: var(--accent-amber);">Zend</span>' : ''}
          <span class="ext-dll-code">(${ext.dll})</span>
        </div>
        <div class="ext-desc">${ext.description}</div>
      </div>

      <div class="ext-switch-box">
        <label class="switch">
          <input type="checkbox" ${ext.enabled ? 'checked' : ''} data-id="${ext.id}">
          <span class="slider"></span>
        </label>
      </div>
    `;

    const checkbox = card.querySelector('input[type="checkbox"]');
    checkbox.addEventListener('change', async (e) => {
      const enabled = e.target.checked;
      try {
        const versionId = appState.selectedExtVersion || appState.current.id;
        await window.api.setExtensionStatus({
          versionId,
          extensionId: ext.id,
          enabled
        });
        ext.enabled = enabled;
        showToast(`${ext.name} ${enabled ? 'enabled' : 'disabled'} in php.ini!`);
      } catch (err) {
        e.target.checked = !enabled; // Revert switch
        showToast(`Failed to update extension: ${err.message}`, true);
      }
    });

    extensionsListEl.appendChild(card);
  });
}

// ENABLE COMMON EXTENSIONS
async function enableCommonWebExtensions() {
  const versionId = appState.selectedExtVersion || (appState.current ? appState.current.id : null);
  if (!versionId) return;

  const stack = ['curl', 'fileinfo', 'gd', 'intl', 'mbstring', 'openssl', 'pdo_mysql', 'pdo_sqlite', 'sqlite3', 'zip'];

  try {
    for (const extId of stack) {
      await window.api.setExtensionStatus({ versionId, extensionId: extId, enabled: true });
    }
    showToast('✔ Standard Web Stack extensions enabled!');
    await loadExtensions();
  } catch (err) {
    showToast(`Error: ${err.message}`, true);
  }
}

// DIRECTIVES / SETTINGS
async function loadDirectives() {
  const versionId = appState.selectedDirectivesVersion || (appState.current ? appState.current.id : null);
  if (!versionId) return;

  try {
    const directives = await window.api.getDirectives(versionId);
    appState.directives = directives;

    document.getElementById('input-memory-limit').value = directives.memory_limit || '';
    document.getElementById('input-upload-max-filesize').value = directives.upload_max_filesize || '';
    document.getElementById('input-post-max-size').value = directives.post_max_size || '';
    document.getElementById('input-max-execution-time').value = directives.max_execution_time || '';

    const isDisplayErrorsOn = (directives.display_errors || '').toLowerCase() === 'on';
    document.getElementById('switch-display-errors').checked = isDisplayErrorsOn;
    document.getElementById('display-errors-label').textContent = isDisplayErrorsOn ? 'On' : 'Off';

    const isOpcacheOn = directives.opcache_enable === '1' || (directives.opcache_enable || '').toLowerCase() === 'on';
    document.getElementById('switch-opcache-enable').checked = isOpcacheOn;
    document.getElementById('opcache-enable-label').textContent = isOpcacheOn ? 'On' : 'Off';

    document.getElementById('select-timezone').value = directives.date_timezone || 'UTC';
  } catch (err) {
    showToast(`Failed to load settings: ${err.message}`, true);
  }
}

async function saveDirectives() {
  const versionId = appState.selectedDirectivesVersion || (appState.current ? appState.current.id : null);
  if (!versionId) return;

  const updates = {
    memory_limit: document.getElementById('input-memory-limit').value.trim(),
    upload_max_filesize: document.getElementById('input-upload-max-filesize').value.trim(),
    post_max_size: document.getElementById('input-post-max-size').value.trim(),
    max_execution_time: document.getElementById('input-max-execution-time').value.trim(),
    display_errors: document.getElementById('switch-display-errors').checked ? 'On' : 'Off',
    opcache_enable: document.getElementById('switch-opcache-enable').checked ? '1' : '0',
    date_timezone: document.getElementById('select-timezone').value
  };

  try {
    await window.api.updateDirectives({ versionId, updates });
    showToast('✔ PHP settings saved to php.ini!');
  } catch (err) {
    showToast(`Failed to save settings: ${err.message}`, true);
  }
}

// ENVIRONMENT TAB
function renderEnvironmentTab() {
  if (!appState.pathStatus) return;

  if (appState.osInfo) {
    const osNameEl = document.getElementById('env-os-name');
    const osBadgeEl = document.getElementById('env-os-badge');
    if (osNameEl) osNameEl.textContent = `${appState.osInfo.osName} (NT ${appState.osInfo.kernel})`;
    if (osBadgeEl) {
      if (appState.osInfo.isSupported) {
        osBadgeEl.style.background = 'rgba(16, 185, 129, 0.15)';
        osBadgeEl.style.color = 'var(--accent-green)';
        osBadgeEl.style.borderColor = 'rgba(16, 185, 129, 0.3)';
        osBadgeEl.textContent = '✔ Windows 10+ Compatible';
      } else {
        osBadgeEl.style.background = 'rgba(239, 68, 68, 0.15)';
        osBadgeEl.style.color = 'var(--accent-red)';
        osBadgeEl.style.borderColor = 'rgba(239, 68, 68, 0.3)';
        osBadgeEl.textContent = '✖ Unsupported Windows Version';
      }
    }
  }

  document.getElementById('env-junction-path').textContent = appState.pathStatus.currentLink;
  document.getElementById('env-target-path').textContent = appState.current ? appState.current.path : 'None (No active version)';

  const detectedListEl = document.getElementById('detected-paths-list');
  detectedListEl.innerHTML = '';

  if (appState.pathStatus.activePhpLocations.length === 0) {
    detectedListEl.innerHTML = '<div style="color: var(--text-dim); font-size: 13px;">No php.exe detected in system PATH yet.</div>';
    return;
  }

  appState.pathStatus.activePhpLocations.forEach((loc, idx) => {
    const isOurs = loc.toLowerCase().startsWith(appState.pathStatus.currentLink.toLowerCase());
    const row = document.createElement('div');
    row.className = `path-item-row ${isOurs ? 'is-ours' : ''}`;
    row.innerHTML = `
      <div>
        <strong style="margin-right: 8px;">#${idx + 1}</strong>
        <code>${loc}</code>
      </div>
      <div>
        ${isOurs ? '<span style="color: var(--accent-green); font-weight: 600;">Managed by YAWPS</span>' : '<span style="color: var(--accent-amber);">External PHP</span>'}
      </div>
    `;
    detectedListEl.appendChild(row);
  });
}

// ==========================================
// COMPOSER MODULE IMPLEMENTATION
// ==========================================

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

async function loadComposerTab(force = false) {
  const statusBadgeEl = document.getElementById('composer-status-badge');
  const statusSubEl = document.getElementById('composer-status-sub');
  const btnInstall = document.getElementById('btn-composer-install');
  const btnUpdate = document.getElementById('btn-composer-update');
  const btnUninstallModal = document.getElementById('btn-composer-uninstall-modal');

  if (statusBadgeEl) {
    statusBadgeEl.className = 'badge-status checking';
    statusBadgeEl.textContent = 'Checking...';
  }

  try {
    const [status, packages] = await Promise.all([
      window.api.getComposerStatus(),
      window.api.getComposerGlobalPackages()
    ]);

    appState.composer = {
      status,
      packages: packages || []
    };

    const notInstalledAlert = document.getElementById('composer-not-installed-alert');
    const pkgInstallCard = document.getElementById('package-install-card');
    const pkgToolbar = document.getElementById('packages-toolbar');
    const btnUpdateAll = document.getElementById('btn-composer-update-all');

    if (statusBadgeEl && statusSubEl) {
      if (status.installed) {
        if (status.isUpToDate) {
          statusBadgeEl.className = 'badge-status installed';
          statusBadgeEl.textContent = `✔ Installed (v${status.version})`;
          statusSubEl.textContent = `Composer v${status.version} is installed and up to date with official stable release.`;
          if (btnUpdate) btnUpdate.classList.add('hidden');
        } else if (status.latestVersion) {
          statusBadgeEl.className = 'badge-status update-available';
          statusBadgeEl.textContent = `▲ Update Available (v${status.latestVersion})`;
          statusSubEl.textContent = `Composer v${status.version} is installed. Newer release v${status.latestVersion} is available!`;
          if (btnUpdate) {
            btnUpdate.classList.remove('hidden');
            btnUpdate.textContent = `⚡ Update to v${status.latestVersion}`;
          }
        } else {
          statusBadgeEl.className = 'badge-status installed';
          statusBadgeEl.textContent = `✔ Installed (v${status.version})`;
          statusSubEl.textContent = `Composer v${status.version} is installed.`;
          if (btnUpdate) btnUpdate.classList.add('hidden');
        }

        if (btnInstall) btnInstall.classList.add('hidden');
        if (btnUninstallModal) btnUninstallModal.classList.remove('hidden');
        if (notInstalledAlert) notInstalledAlert.classList.add('hidden');
        if (pkgInstallCard) pkgInstallCard.classList.remove('hidden');
        if (pkgToolbar) pkgToolbar.classList.remove('hidden');
        if (btnUpdateAll) btnUpdateAll.classList.remove('hidden');
      } else {
        statusBadgeEl.className = 'badge-status not-installed';
        statusBadgeEl.textContent = '❌ Not Installed';
        statusSubEl.textContent = status.latestVersion
          ? `Composer is not installed on this system. Click the "Install Composer" button above to download and set up official Composer v${status.latestVersion}.`
          : 'Composer is not installed on this system.';
        if (btnInstall) btnInstall.classList.remove('hidden');
        if (btnUpdate) btnUpdate.classList.add('hidden');
        if (btnUninstallModal) btnUninstallModal.classList.add('hidden');
        if (notInstalledAlert) notInstalledAlert.classList.remove('hidden');
        if (pkgInstallCard) pkgInstallCard.classList.add('hidden');
        if (pkgToolbar) pkgToolbar.classList.add('hidden');
        if (btnUpdateAll) btnUpdateAll.classList.add('hidden');
      }
    }

    // Grid details
    const elVersion = document.getElementById('comp-val-version');
    if (elVersion) elVersion.textContent = status.version ? `v${status.version} (${status.releaseDate || 'official'})` : 'Not installed';

    const elLatest = document.getElementById('comp-val-latest');
    if (elLatest) elLatest.textContent = status.latestVersion ? `v${status.latestVersion} (stable)` : 'Checking...';

    const elPhp = document.getElementById('comp-val-php');
    if (elPhp) elPhp.textContent = status.activePhp || 'None (Select a PHP version)';

    const elType = document.getElementById('comp-val-type');
    if (elType) elType.textContent = status.installed ? (status.isYawpsManaged ? '⚡ YAWPS Native Integration' : '🌐 System / External Binary') : 'Not Installed';

    const elLoc = document.getElementById('comp-val-location');
    if (elLoc) elLoc.textContent = status.installed ? (status.location || status.pharPath || 'Detected on PATH') : 'None';

    const elHome = document.getElementById('comp-val-home');
    if (elHome) elHome.textContent = status.composerHome || 'None';

    // Global Bin in PATH
    const binBadge = document.getElementById('comp-val-bin-path-badge');
    const btnToggleBin = document.getElementById('btn-toggle-global-bin-path');
    if (binBadge && btnToggleBin) {
      if (!status.installed) {
        binBadge.className = 'badge-pill';
        binBadge.textContent = 'Composer not installed';
        btnToggleBin.disabled = true;
        btnToggleBin.classList.add('hidden');
      } else if (status.isGlobalBinInPath) {
        binBadge.className = 'badge-pill success';
        binBadge.textContent = '✔ Added to User PATH';
        btnToggleBin.textContent = 'Remove from PATH';
        btnToggleBin.className = 'btn btn-xs btn-secondary';
        btnToggleBin.disabled = false;
        btnToggleBin.classList.remove('hidden');
      } else {
        binBadge.className = 'badge-pill warning';
        binBadge.textContent = '⚠️ Not in User PATH';
        btnToggleBin.textContent = '⚡ Add to PATH';
        btnToggleBin.className = 'btn btn-xs btn-primary';
        btnToggleBin.disabled = false;
        btnToggleBin.classList.remove('hidden');
      }
    }

    // Package count badge
    const pkgCount = status.installed ? appState.composer.packages.length : 0;
    const pkgCountEl = document.getElementById('composer-packages-count');
    if (pkgCountEl) pkgCountEl.textContent = pkgCount;

    const navBadge = document.getElementById('composer-nav-badge');
    if (navBadge) {
      navBadge.textContent = pkgCount;
      navBadge.classList.toggle('hidden', pkgCount === 0);
    }

    // Render packages
    renderComposerPackages();

  } catch (err) {
    if (statusBadgeEl) {
      statusBadgeEl.className = 'badge-status not-installed';
      statusBadgeEl.textContent = 'Error';
    }
    if (statusSubEl) {
      statusSubEl.textContent = `Failed to query Composer status: ${err.message}`;
    }
    showToast(`Composer error: ${err.message}`, true);
  }
}

function renderComposerPackages(filter = '') {
  const gridEl = document.getElementById('composer-packages-grid');
  const emptyEl = document.getElementById('composer-packages-empty');
  if (!gridEl) return;

  gridEl.innerHTML = '';

  if (appState.composer && appState.composer.status && !appState.composer.status.installed) {
    if (emptyEl) emptyEl.classList.add('hidden');
    return;
  }

  const packages = (appState.composer && appState.composer.packages) ? appState.composer.packages : [];
  const normalizedFilter = filter.toLowerCase().trim();

  const filtered = packages.filter(p => {
    if (!normalizedFilter) return true;
    return (p.name || '').toLowerCase().includes(normalizedFilter) ||
           (p.description || '').toLowerCase().includes(normalizedFilter);
  });

  if (filtered.length === 0) {
    if (emptyEl) {
      emptyEl.classList.remove('hidden');
      if (normalizedFilter) {
        emptyEl.querySelector('h3').textContent = 'No Matching Packages';
        emptyEl.querySelector('p').textContent = `No global packages matched "${filter}".`;
      } else {
        emptyEl.querySelector('h3').textContent = 'No Global Packages Installed';
        emptyEl.querySelector('p').textContent = 'You haven\'t installed any global PHP packages yet. Use the form above to require one!';
      }
    }
    return;
  }

  if (emptyEl) emptyEl.classList.add('hidden');

  filtered.forEach(pkg => {
    const card = document.createElement('div');
    card.className = 'composer-pkg-card';

    const binTagsHtml = (pkg.binaries && pkg.binaries.length > 0)
      ? `<span class="pkg-bin-tag" title="CLI command available in terminal">⚡ ${escapeHtml(pkg.binaries.join(', '))}</span>`
      : '';

    const licenseHtml = (pkg.license && pkg.license.length > 0)
      ? `<span class="pkg-license-tag">${escapeHtml(pkg.license.join(', '))}</span>`
      : '';

    const constraintHtml = pkg.constraint
      ? `<span class="pkg-constraint-badge" title="Required Constraint">${escapeHtml(pkg.constraint)}</span>`
      : '';

    card.innerHTML = `
      <div>
        <div class="pkg-header">
          <div class="pkg-title">${escapeHtml(pkg.name)}</div>
          <div class="pkg-badges">
            <span class="pkg-ver-badge">${escapeHtml(pkg.version)}</span>
            ${constraintHtml}
          </div>
        </div>
        <div class="pkg-desc">${escapeHtml(pkg.description || 'No description provided.')}</div>
        <div class="pkg-meta-row">
          ${binTagsHtml}
          ${licenseHtml}
        </div>
      </div>
      <div class="pkg-actions">
        <button class="btn btn-xs btn-secondary btn-pkg-packagist">🌐 Packagist</button>
        <button class="btn btn-xs btn-secondary btn-pkg-update">🔄 Update</button>
        <button class="btn btn-xs btn-danger btn-pkg-remove">🗑️ Remove</button>
      </div>
    `;

    card.querySelector('.btn-pkg-packagist').addEventListener('click', () => {
      const url = `https://packagist.org/packages/${encodeURIComponent(pkg.name)}`;
      window.open(url, '_blank');
    });

    card.querySelector('.btn-pkg-update').addEventListener('click', async () => {
      await handleUpdateComposerPackage(pkg.name);
    });

    card.querySelector('.btn-pkg-remove').addEventListener('click', async () => {
      await handleRemoveComposerPackage(pkg.name);
    });

    gridEl.appendChild(card);
  });
}

function openConsoleDrawer(title = 'Composer Command') {
  const drawer = document.getElementById('composer-console-drawer');
  if (!drawer) return;
  document.getElementById('composer-console-title').textContent = title;
  const spinner = document.getElementById('composer-console-spinner');
  if (spinner) spinner.classList.remove('hidden');
  drawer.classList.remove('hidden');
}

function closeConsoleDrawer() {
  const drawer = document.getElementById('composer-console-drawer');
  if (drawer) drawer.classList.add('hidden');
}

function appendConsoleLog(line) {
  const output = document.getElementById('composer-console-output');
  if (output) {
    output.textContent += line + '\n';
    output.scrollTop = output.scrollHeight;
  }
}

function clearConsoleLog() {
  const output = document.getElementById('composer-console-output');
  if (output) output.textContent = '';
}

async function handleInstallComposerPackage(name, version = '') {
  if (!name || !name.trim()) {
    showToast('Please enter a package name (e.g. laravel/installer)', true);
    return;
  }

  clearConsoleLog();
  openConsoleDrawer(`Installing global package: ${name}`);
  appendConsoleLog(`> composer global require ${name}${version ? ':' + version : ''} --no-interaction\n`);

  try {
    const res = await window.api.installComposerGlobalPackage({
      packageName: name.trim(),
      version: version.trim()
    });

    const spinner = document.getElementById('composer-console-spinner');
    if (spinner) spinner.classList.add('hidden');

    if (res && res.success) {
      appendConsoleLog('\n✔ Package installed successfully!');
      showToast(`✔ Successfully installed ${name}!`);
      const inputName = document.getElementById('input-pkg-name');
      const inputVer = document.getElementById('input-pkg-version');
      if (inputName) inputName.value = '';
      if (inputVer) inputVer.value = '';
      await loadComposerTab(true);
    } else {
      appendConsoleLog(`\n❌ Installation failed: ${res ? res.error : 'Unknown error'}`);
      showToast(`Failed to install ${name}`, true);
    }
  } catch (err) {
    const spinner = document.getElementById('composer-console-spinner');
    if (spinner) spinner.classList.add('hidden');
    appendConsoleLog(`\n❌ Error: ${err.message}`);
    showToast(`Error: ${err.message}`, true);
  }
}

async function handleRemoveComposerPackage(name) {
  if (!confirm(`Are you sure you want to remove global package "${name}"?`)) {
    return;
  }

  clearConsoleLog();
  openConsoleDrawer(`Removing global package: ${name}`);
  appendConsoleLog(`> composer global remove ${name} --no-interaction\n`);

  try {
    const res = await window.api.removeComposerGlobalPackage({ packageName: name });
    const spinner = document.getElementById('composer-console-spinner');
    if (spinner) spinner.classList.add('hidden');

    if (res && res.success) {
      appendConsoleLog('\n✔ Package removed successfully!');
      showToast(`✔ Successfully removed ${name}!`);
      await loadComposerTab(true);
    } else {
      appendConsoleLog(`\n❌ Removal failed: ${res ? res.error : 'Unknown error'}`);
      showToast(`Failed to remove ${name}`, true);
    }
  } catch (err) {
    const spinner = document.getElementById('composer-console-spinner');
    if (spinner) spinner.classList.add('hidden');
    appendConsoleLog(`\n❌ Error: ${err.message}`);
    showToast(`Error: ${err.message}`, true);
  }
}

async function handleUpdateComposerPackage(name = '') {
  clearConsoleLog();
  const label = name ? `Updating global package: ${name}` : 'Updating all global packages';
  openConsoleDrawer(label);
  appendConsoleLog(`> composer global update ${name} --no-interaction\n`);

  try {
    const res = await window.api.updateComposerGlobalPackage({ packageName: name });
    const spinner = document.getElementById('composer-console-spinner');
    if (spinner) spinner.classList.add('hidden');

    if (res && res.success) {
      appendConsoleLog('\n✔ Update completed successfully!');
      showToast(name ? `✔ Successfully updated ${name}!` : '✔ All packages updated!');
      await loadComposerTab(true);
    } else {
      appendConsoleLog(`\n❌ Update failed: ${res ? res.error : 'Unknown error'}`);
      showToast('Update failed', true);
    }
  } catch (err) {
    const spinner = document.getElementById('composer-console-spinner');
    if (spinner) spinner.classList.add('hidden');
    appendConsoleLog(`\n❌ Error: ${err.message}`);
    showToast(`Error: ${err.message}`, true);
  }
}
