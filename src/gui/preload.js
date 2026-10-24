const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  getState: () => ipcRenderer.invoke('get-state'),
  fetchRemoteReleases: () => ipcRenderer.invoke('fetch-remote-releases'),
  switchVersion: (versionId) => ipcRenderer.invoke('switch-version', versionId),
  installVersion: (options) => ipcRenderer.invoke('install-version', options),
  checkUpdates: () => ipcRenderer.invoke('check-updates'),
  updateVersion: (versionId) => ipcRenderer.invoke('update-version', versionId),
  getExtensions: (versionId) => ipcRenderer.invoke('get-extensions', versionId),
  setExtensionStatus: (payload) => ipcRenderer.invoke('set-extension-status', payload),
  getDirectives: (versionId) => ipcRenderer.invoke('get-directives', versionId),
  updateDirectives: (payload) => ipcRenderer.invoke('update-directives', payload),
  fixPath: () => ipcRenderer.invoke('fix-path'),
  removePath: () => ipcRenderer.invoke('remove-path'),
  uninstallVersion: (options) => ipcRenderer.invoke('uninstall-version', options),
  fullCleanup: (options) => ipcRenderer.invoke('full-cleanup', options),
  openFolder: (path) => ipcRenderer.invoke('open-folder', path),

  onInstallProgress: (callback) => {
    const handler = (event, data) => callback(data);
    ipcRenderer.on('install-progress', handler);
    return () => ipcRenderer.removeListener('install-progress', handler);
  },
  onUpdateProgress: (callback) => {
    const handler = (event, data) => callback(data);
    ipcRenderer.on('update-progress', handler);
    return () => ipcRenderer.removeListener('update-progress', handler);
  }
});
