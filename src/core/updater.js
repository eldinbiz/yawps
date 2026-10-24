const fs = require('fs');
const path = require('path');
const { getInstalledVersions, getCurrentVersion, switchVersion } = require('./environment');
const { fetchReleases, compareVersions } = require('./releases');
const { installRelease } = require('./installer');
const { getExtensions, setExtensionStatus, getDirectives, updateDirectives } = require('./extensions');

/**
 * Check updates for all installed versions
 */
async function checkUpdates() {
  const installed = getInstalledVersions();
  if (installed.length === 0) return [];

  const releases = await fetchReleases();
  const updateList = [];

  for (const item of installed) {
    // Find matching branch & flavor in releases
    const [major, minor] = item.version.split('.');
    const branch = `${major}.${minor}`;

    // Match same branch, same type (nts/ts), same arch (x64/x86)
    const matchingRelease = releases.find(
      r => r.branch === branch && r.type === item.type && r.arch === item.arch
    );

    if (matchingRelease) {
      const cmp = compareVersions(matchingRelease.version, item.version);
      if (cmp > 0) {
        updateList.push({
          installedId: item.id,
          currentVersion: item.version,
          latestVersion: matchingRelease.version,
          type: item.type,
          arch: item.arch,
          isActive: item.isActive,
          release: matchingRelease
        });
      }
    }
  }

  return updateList;
}

/**
 * Migrate settings (php.ini) from old version to new version
 */
function migratePhpSettings(oldVersionDir, newVersionDir) {
  const oldIni = path.join(oldVersionDir, 'php.ini');
  const newIni = path.join(newVersionDir, 'php.ini');

  if (!fs.existsSync(oldIni) || !fs.existsSync(newIni)) return;

  try {
    // Migrate enabled extensions
    const oldExtensions = getExtensions(oldVersionDir);
    for (const ext of oldExtensions) {
      if (ext.enabled) {
        try {
          setExtensionStatus(newVersionDir, ext.id, true);
        } catch {}
      }
    }

    // Migrate directives
    const oldDirectives = getDirectives(oldVersionDir);
    updateDirectives(newVersionDir, oldDirectives);
  } catch (err) {
    console.warn('Warning during php.ini migration:', err.message);
  }
}

/**
 * Update an installed version to its latest patch
 */
async function performUpdate(installedIdOrVersion, onProgress = () => {}) {
  const installed = getInstalledVersions();
  const target = installed.find(
    v => v.id.toLowerCase() === installedIdOrVersion.toLowerCase() ||
         v.version === installedIdOrVersion ||
         v.version.startsWith(installedIdOrVersion)
  );

  if (!target) {
    throw new Error(`Installed version '${installedIdOrVersion}' not found.`);
  }

  const updates = await checkUpdates();
  const updateInfo = updates.find(u => u.installedId === target.id);

  if (!updateInfo) {
    onProgress({ stage: 'completed', percent: 100, message: `PHP ${target.version} is already at the latest release.` });
    return { updated: false, message: 'Already up to date', currentVersion: target.version };
  }

  onProgress({ stage: 'updating', percent: 10, message: `Updating PHP ${target.version} to ${updateInfo.latestVersion}...` });

  // Install the new release
  const installResult = await installRelease(updateInfo.release, onProgress);

  // Migrate php.ini
  onProgress({ stage: 'migrating', percent: 95, message: 'Migrating php.ini configurations...' });
  migratePhpSettings(target.path, installResult.targetDir);

  // If old version was active, switch to new version
  let switched = false;
  if (target.isActive) {
    onProgress({ stage: 'switching', percent: 98, message: 'Updating active environment...' });
    switchVersion(updateInfo.release.id);
    switched = true;
  }

  onProgress({ stage: 'completed', percent: 100, message: `Successfully updated to PHP ${updateInfo.latestVersion}!` });

  return {
    updated: true,
    oldVersion: target.version,
    newVersion: updateInfo.latestVersion,
    switched
  };
}

module.exports = {
  checkUpdates,
  performUpdate,
  migratePhpSettings
};
