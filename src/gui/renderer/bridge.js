// bridge.js - Universal Bridge for Electron & Wails
(function () {
  if (window.api) {
    // Already exposed by Electron preload
    return;
  }

  // Wails Go binding bridge
  const callGo = async (method, ...args) => {
    // Wait briefly if Wails runtime is still initializing
    let attempts = 0;
    while ((!window.go || !window.go.main || !window.go.main.App) && attempts < 20) {
      await new Promise(r => setTimeout(r, 50));
      attempts++;
    }

    if (window.go && window.go.main && window.go.main.App && typeof window.go.main.App[method] === 'function') {
      return await window.go.main.App[method](...args);
    }
    throw new Error(`Go backend method App.${method} not found`);
  };

  window.api = {
    getState: () => callGo('GetState'),
    fetchRemoteReleases: () => callGo('FetchRemoteReleases'),
    switchVersion: (versionId) => callGo('SwitchVersion', versionId),
    installVersion: (options) => callGo('InstallVersion', options),
    checkUpdates: () => callGo('CheckUpdates'),
    updateVersion: (versionId) => callGo('UpdateVersion', versionId),
    getExtensions: (versionId) => callGo('GetExtensions', versionId),
    setExtensionStatus: (payload) => callGo('SetExtensionStatus', payload),
    getDirectives: (versionId) => callGo('GetDirectives', versionId),
    updateDirectives: (payload) => callGo('UpdateDirectives', payload),
    fixPath: () => callGo('FixPath'),
    removePath: () => callGo('RemovePath'),
    uninstallVersion: (options) => callGo('UninstallVersion', options),
    fullCleanup: (options) => callGo('FullCleanup', options),
    openFolder: (path) => callGo('OpenFolder', path),

    onInstallProgress: (callback) => {
      if (window.runtime && window.runtime.EventsOn) {
        return window.runtime.EventsOn('install-progress', callback);
      }
      return () => {};
    },
    onUpdateProgress: (callback) => {
      if (window.runtime && window.runtime.EventsOn) {
        return window.runtime.EventsOn('update-progress', callback);
      }
      return () => {};
    }
  };
})();
