const { app, BrowserWindow, ipcMain, shell } = require('electron');
const path = require('path');
const { assertWindows10OrAbove, getWindowsVersionInfo } = require('../core/osCheck');

// Check OS version before proceeding
if (!assertWindows10OrAbove({ isGui: true })) {
  // If not supported, dialog has been displayed and app will quit
}

const {
  fetchReleases
} = require('../core/releases');

const {
  installRelease,
  installVersion
} = require('../core/installer');

const {
  getCurrentVersion,
  getInstalledVersions,
  switchVersion,
  checkPathStatus,
  addToUserPath,
  removeFromUserPath
} = require('../core/environment');

const {
  getExtensions,
  setExtensionStatus,
  getDirectives,
  updateDirectives
} = require('../core/extensions');

const {
  checkUpdates,
  performUpdate
} = require('../core/updater');

const {
  uninstallVersion,
  cleanCachedArchives,
  removeEnvironmentPath,
  fullCleanup
} = require('../core/uninstaller');

const {
  getComposerStatus,
  installComposer,
  updateComposer,
  uninstallComposer,
  getComposerGlobalPackages,
  installComposerGlobalPackage,
  removeComposerGlobalPackage,
  updateComposerGlobalPackage,
  toggleComposerGlobalBinPath
} = require('../core/composer');

const { CURRENT_LINK, VERSIONS_DIR } = require('../core/paths');

let mainWindow = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1100,
    height: 780,
    minWidth: 900,
    minHeight: 640,
    title: 'Win PHP Switcher',
    backgroundColor: '#0f172a',
    autoHideMenuBar: true,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http:') || url.startsWith('https:')) {
      shell.openExternal(url);
      return { action: 'deny' };
    }
    return { action: 'allow' };
  });
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// IPC HANDLERS

// 1. Get full app state
ipcMain.handle('get-state', async () => {
  const current = getCurrentVersion();
  const installed = getInstalledVersions();
  const pathStatus = checkPathStatus();
  const osInfo = getWindowsVersionInfo();
  return {
    current,
    installed,
    pathStatus,
    osInfo,
    currentLink: CURRENT_LINK
  };
});

// 2. Fetch remote releases
ipcMain.handle('fetch-remote-releases', async () => {
  return await fetchReleases();
});

// 3. Switch active PHP version
ipcMain.handle('switch-version', async (event, versionId) => {
  const result = switchVersion(versionId);
  return {
    success: true,
    target: result,
    current: getCurrentVersion(),
    pathStatus: checkPathStatus()
  };
});

// 4. Install version
ipcMain.handle('install-version', async (event, { query, release, type, arch }) => {
  const onProgress = (data) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('install-progress', data);
    }
  };

  if (release) {
    return await installRelease(release, onProgress);
  } else {
    return await installVersion(query, { type: type || 'nts', arch: arch || 'x64' }, onProgress);
  }
});

// 5. Check updates
ipcMain.handle('check-updates', async () => {
  return await checkUpdates();
});

// 6. Perform update
ipcMain.handle('update-version', async (event, versionId) => {
  const onProgress = (data) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('update-progress', data);
    }
  };
  return await performUpdate(versionId, onProgress);
});

// 7. Extensions
ipcMain.handle('get-extensions', async (event, versionId) => {
  return getExtensions(versionId);
});

ipcMain.handle('set-extension-status', async (event, { versionId, extensionId, enabled }) => {
  setExtensionStatus(versionId, extensionId, enabled);
  return getExtensions(versionId);
});

// 8. Directives
ipcMain.handle('get-directives', async (event, versionId) => {
  return getDirectives(versionId);
});

ipcMain.handle('update-directives', async (event, { versionId, updates }) => {
  return updateDirectives(versionId, updates);
});

// 9. Environment PATH
ipcMain.handle('fix-path', async () => {
  addToUserPath();
  return checkPathStatus();
});

// 10. Open folder in Explorer
ipcMain.handle('open-folder', async (event, targetPath) => {
  const folder = targetPath || VERSIONS_DIR;
  await shell.openPath(folder);
  return true;
});

// 11. Uninstall PHP version
ipcMain.handle('uninstall-version', async (event, { versionId, cleanCache }) => {
  return uninstallVersion(versionId, { cleanCache });
});

// 12. Remove from User PATH
ipcMain.handle('remove-path', async () => {
  removeEnvironmentPath();
  return checkPathStatus();
});

// 13. Full cleanup
ipcMain.handle('full-cleanup', async (event, { purgeAll }) => {
  return fullCleanup({ purgeAll });
});

// 14. Composer
ipcMain.handle('get-composer-status', async () => {
  return getComposerStatus();
});

ipcMain.handle('install-composer', async (event) => {
  return installComposer((p) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('composer-progress', p);
    }
  });
});

ipcMain.handle('update-composer', async (event) => {
  return updateComposer((p) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('composer-progress', p);
    }
  });
});

ipcMain.handle('uninstall-composer', async (event, options) => {
  return uninstallComposer(options);
});

ipcMain.handle('get-composer-global-packages', async () => {
  return getComposerGlobalPackages();
});

ipcMain.handle('install-composer-global-package', async (event, payload = {}) => {
  return installComposerGlobalPackage(payload.packageName, payload.version, (line) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('composer-log', { text: line });
    }
  });
});

ipcMain.handle('remove-composer-global-package', async (event, payload = {}) => {
  return removeComposerGlobalPackage(payload.packageName, (line) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('composer-log', { text: line });
    }
  });
});

ipcMain.handle('update-composer-global-package', async (event, payload = {}) => {
  return updateComposerGlobalPackage(payload.packageName, (line) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('composer-log', { text: line });
    }
  });
});

ipcMain.handle('toggle-composer-global-bin-path', async (event, payload = {}) => {
  return toggleComposerGlobalBinPath(payload.enable);
});
