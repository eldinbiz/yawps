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

    // Composer integration
    getComposerStatus: () => callGo('GetComposerStatus'),
    installComposer: () => callGo('InstallComposer'),
    updateComposer: () => callGo('UpdateComposer'),
    uninstallComposer: (options) => callGo('UninstallComposer', options),
    getComposerGlobalPackages: () => callGo('GetComposerGlobalPackages'),
    installComposerGlobalPackage: (payload) => callGo('InstallComposerGlobalPackage', payload),
    removeComposerGlobalPackage: (payload) => callGo('RemoveComposerGlobalPackage', payload),
    updateComposerGlobalPackage: (payload) => callGo('UpdateComposerGlobalPackage', payload),
    toggleComposerGlobalBinPath: (payload) => callGo('ToggleComposerGlobalBinPath', payload),

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
    },
    onComposerProgress: (callback) => {
      if (window.runtime && window.runtime.EventsOn) {
        return window.runtime.EventsOn('composer-progress', callback);
      }
      return () => {};
    },
    onComposerLog: (callback) => {
      if (window.runtime && window.runtime.EventsOn) {
        return window.runtime.EventsOn('composer-log', callback);
      }
      return () => {};
    }
  };
})();
