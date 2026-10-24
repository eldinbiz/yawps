const fs = require('fs');
const path = require('path');
const {
  BASE_DIR,
  VERSIONS_DIR,
  CURRENT_LINK,
  DOWNLOADS_DIR,
  ensureDirectories
} = require('./paths');
const {
  getCurrentVersion,
  getInstalledVersions,
  switchVersion,
  removeFromUserPath
} = require('./environment');

/**
 * Find an installed version matching a query string
 * @param {string} query Version id, version string, or branch prefix
 * @returns {object|null}
 */
function findInstalledVersion(query) {
  const installed = getInstalledVersions();
  if (installed.length === 0) return null;

  const cleanQuery = query ? query.replace(/^php-/i, '').trim().toLowerCase() : '';

  // 1. Exact ID match (e.g. php-8.3.36-nts-x64)
  let target = installed.find(v => v.id.toLowerCase() === query.toLowerCase());

  // 2. Exact version match (e.g. 8.3.36)
  if (!target) {
    target = installed.find(v => v.version.toLowerCase() === cleanQuery);
  }

  // 3. Prefix/branch match (e.g. 8.3)
  if (!target) {
    target = installed.find(v => v.version.toLowerCase().startsWith(cleanQuery));
  }

  return target || null;
}

/**
 * Delete cached archive file(s) for a version from downloads directory
 * @param {string} versionNum
 * @returns {string[]} List of deleted file paths
 */
function cleanCachedArchives(versionNum = null) {
  ensureDirectories();
  if (!fs.existsSync(DOWNLOADS_DIR)) return [];

  const deleted = [];
  const files = fs.readdirSync(DOWNLOADS_DIR);

  for (const file of files) {
    if (!file.toLowerCase().endsWith('.zip')) continue;

    let shouldDelete = false;
    if (!versionNum) {
      // Clean all
      shouldDelete = true;
    } else {
      // Match exact version substring (e.g. 8.3.36 or php-8.3.36)
      const cleanVer = versionNum.replace(/^php-/i, '');
      if (file.toLowerCase().includes(cleanVer.toLowerCase())) {
        shouldDelete = true;
      }
    }

    if (shouldDelete) {
      const fullPath = path.join(DOWNLOADS_DIR, file);
      try {
        fs.unlinkSync(fullPath);
        deleted.push(fullPath);
      } catch (err) {
        console.warn(`Could not delete cached zip ${file}:`, err.message);
      }
    }
  }

  return deleted;
}

/**
 * Uninstall an installed PHP version
 * @param {string} versionQuery Version query (e.g. "8.3", "php-8.3.36-nts-x64")
 * @param {object} options
 * @param {boolean} [options.cleanCache=false] Also delete matching zip archive in downloads
 * @param {boolean} [options.autoSwitch=true] If active, switch to next available installed version
 * @returns {object} { success, target, wasActive, switchedTo, deletedCacheFiles }
 */
function uninstallVersion(versionQuery, options = {}) {
  ensureDirectories();
  const autoSwitch = options.autoSwitch !== false;
  const cleanCache = Boolean(options.cleanCache);

  const target = findInstalledVersion(versionQuery);
  if (!target) {
    const installed = getInstalledVersions();
    const available = installed.map(v => v.version).join(', ') || 'None';
    throw new Error(`Installed PHP version '${versionQuery}' not found. Currently installed: ${available}`);
  }

  const current = getCurrentVersion();
  const wasActive = current && (current.id.toLowerCase() === target.id.toLowerCase());

  let switchedTo = null;

  // 1. If currently active, unlink the current junction
  if (wasActive) {
    if (fs.existsSync(CURRENT_LINK)) {
      try {
        fs.unlinkSync(CURRENT_LINK);
      } catch {
        try {
          fs.rmdirSync(CURRENT_LINK);
        } catch (rmErr) {
          throw new Error(`Failed to unlink active junction: ${rmErr.message}`);
        }
      }
    }

    // Check for remaining installed versions to fall back to
    const installed = getInstalledVersions();
    const remaining = installed.filter(v => v.id.toLowerCase() !== target.id.toLowerCase());

    if (remaining.length > 0 && autoSwitch) {
      try {
        switchedTo = switchVersion(remaining[0].id);
      } catch (switchErr) {
        console.warn(`Fallback switch failed: ${switchErr.message}`);
      }
    }
  }

  // 2. Remove version folder from disk
  if (fs.existsSync(target.path)) {
    fs.rmSync(target.path, { recursive: true, force: true });
  }

  // 3. Clean cache if requested
  let deletedCacheFiles = [];
  if (cleanCache) {
    deletedCacheFiles = cleanCachedArchives(target.version);
  }

  return {
    success: true,
    target,
    wasActive,
    switchedTo,
    deletedCacheFiles
  };
}

/**
 * Remove Win-PHP from Windows User PATH and clean directory junction
 * @returns {boolean}
 */
function removeEnvironmentPath() {
  // 1. Remove junction if present
  if (fs.existsSync(CURRENT_LINK)) {
    try {
      fs.unlinkSync(CURRENT_LINK);
    } catch {
      try {
        fs.rmdirSync(CURRENT_LINK);
      } catch {}
    }
  }

  // 2. Remove from User PATH
  return removeFromUserPath();
}

/**
 * Complete uninstallation and cleanup of win-php
 * @param {object} options
 * @param {boolean} [options.purgeAll=false] Delete the entire %USERPROFILE%\.win-php directory
 * @returns {object}
 */
function fullCleanup(options = {}) {
  const purgeAll = Boolean(options.purgeAll);

  // 1. Decouple environment PATH & remove junction
  removeEnvironmentPath();

  // 2. Delete base directory if purgeAll requested
  let baseDirDeleted = false;
  if (purgeAll && fs.existsSync(BASE_DIR)) {
    try {
      fs.rmSync(BASE_DIR, { recursive: true, force: true });
      baseDirDeleted = true;
    } catch (err) {
      throw new Error(`Failed to delete base directory ${BASE_DIR}: ${err.message}`);
    }
  }

  return {
    success: true,
    pathRemoved: true,
    baseDirDeleted
  };
}

module.exports = {
  findInstalledVersion,
  uninstallVersion,
  cleanCachedArchives,
  removeEnvironmentPath,
  fullCleanup
};
