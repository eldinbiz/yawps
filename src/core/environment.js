const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { VERSIONS_DIR, CURRENT_LINK, ensureDirectories } = require('./paths');

/**
 * Get the currently active PHP version
 */
function getCurrentVersion() {
  ensureDirectories();
  if (!fs.existsSync(CURRENT_LINK)) {
    return null;
  }

  try {
    const target = fs.readlinkSync(CURRENT_LINK);
    const resolvedTarget = path.isAbsolute(target) ? target : path.resolve(path.dirname(CURRENT_LINK), target);
    const id = path.basename(resolvedTarget);

    // Parse info from id (e.g. php-8.3.36-nts-x64)
    const match = id.match(/^php-(\d+\.\d+\.\d+)(?:-(nts|ts))?(?:-(x64|x86))?/i);
    return {
      id,
      path: resolvedTarget,
      version: match ? match[1] : id,
      type: match && match[2] ? match[2].toLowerCase() : 'nts',
      arch: match && match[3] ? match[3].toLowerCase() : 'x64'
    };
  } catch (err) {
    return null;
  }
}

/**
 * Get all installed PHP versions
 */
function getInstalledVersions() {
  ensureDirectories();
  const current = getCurrentVersion();
  const versions = [];

  const entries = fs.readdirSync(VERSIONS_DIR, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;

    const versionDir = path.join(VERSIONS_DIR, entry.name);
    const phpExe = path.join(versionDir, 'php.exe');

    if (!fs.existsSync(phpExe)) continue;

    const match = entry.name.match(/^php-(\d+\.\d+\.\d+)(?:-(nts|ts))?(?:-(x64|x86))?/i);
    const versionNum = match ? match[1] : entry.name;
    const type = match && match[2] ? match[2].toLowerCase() : 'nts';
    const arch = match && match[3] ? match[3].toLowerCase() : 'x64';
    const isActive = current && current.id === entry.name;

    versions.push({
      id: entry.name,
      path: versionDir,
      version: versionNum,
      type,
      arch,
      isActive,
      phpExe,
      phpIni: path.join(versionDir, 'php.ini')
    });
  }

  // Sort descending by version number
  versions.sort((a, b) => {
    const partsA = a.version.split('.').map(Number);
    const partsB = b.version.split('.').map(Number);
    for (let i = 0; i < Math.max(partsA.length, partsB.length); i++) {
      const pa = partsA[i] || 0;
      const pb = partsB[i] || 0;
      if (pa !== pb) return pb - pa;
    }
    return 0;
  });

  return versions;
}

/**
 * Switch the active PHP version
 */
function switchVersion(versionQuery) {
  ensureDirectories();
  const installed = getInstalledVersions();

  if (installed.length === 0) {
    throw new Error('No PHP versions installed yet. Install one using: win-php install <version>');
  }

  const cleanQuery = versionQuery ? versionQuery.replace(/^php-/i, '').trim() : '';

  // Find target version
  let target = null;
  if (!cleanQuery) {
    target = installed[0];
  } else {
    // 1. Exact id match: php-8.3.36-nts-x64
    target = installed.find(v => v.id.toLowerCase() === versionQuery.toLowerCase());
    
    // 2. Exact version match: 8.3.36
    if (!target) {
      target = installed.find(v => v.version === cleanQuery);
    }

    // 3. Prefix/branch match: 8.3
    if (!target) {
      target = installed.find(v => v.version.startsWith(cleanQuery));
    }
  }

  if (!target) {
    const available = installed.map(v => v.version).join(', ');
    throw new Error(`PHP version '${versionQuery}' is not installed. Installed versions: ${available}`);
  }

  // Remove existing current link/junction
  if (fs.existsSync(CURRENT_LINK)) {
    try {
      fs.unlinkSync(CURRENT_LINK);
    } catch {
      // In Windows, if junction, rmdirSync may be needed
      try {
        fs.rmdirSync(CURRENT_LINK);
      } catch (rmErr) {
        throw new Error(`Failed to remove current junction: ${rmErr.message}`);
      }
    }
  }

  // Create new junction
  fs.symlinkSync(target.path, CURRENT_LINK, 'junction');

  // Ensure CURRENT_LINK is in User PATH
  const pathStatus = checkPathStatus();
  if (!pathStatus.isInUserPath) {
    addToUserPath();
  }

  return target;
}

/**
 * Check if CURRENT_LINK is present in PATH
 */
function checkPathStatus() {
  const psCommand = `[Environment]::GetEnvironmentVariable('Path', 'User')`;
  const result = spawnSync('powershell.exe', ['-NoProfile', '-Command', psCommand], {
    windowsHide: true,
    encoding: 'utf8'
  });

  const userPath = (result.stdout || '').trim();
  const normalizedCurrent = CURRENT_LINK.toLowerCase();

  const paths = userPath.split(';').map(p => p.trim()).filter(Boolean);
  const isInUserPath = paths.some(p => p.toLowerCase() === normalizedCurrent);

  // Check where.exe php
  const whereResult = spawnSync('where.exe', ['php'], {
    windowsHide: true,
    encoding: 'utf8'
  });

  const activePhpLocations = (whereResult.stdout || '').split('\r\n').map(p => p.trim()).filter(Boolean);
  const isPrimary = activePhpLocations.length > 0 && activePhpLocations[0].toLowerCase().startsWith(normalizedCurrent);

  return {
    currentLink: CURRENT_LINK,
    isInUserPath,
    activePhpLocations,
    isPrimary
  };
}

/**
 * Check if directory is in User PATH
 */
function isDirectoryInUserPath(targetDir) {
  if (!targetDir) return false;
  const psCommand = `[Environment]::GetEnvironmentVariable('Path', 'User')`;
  const result = spawnSync('powershell.exe', ['-NoProfile', '-Command', psCommand], {
    windowsHide: true,
    encoding: 'utf8'
  });
  const userPath = (result.stdout || '').trim();
  const normalizedTarget = path.resolve(targetDir).toLowerCase();
  const paths = userPath.split(';').map(p => p.trim()).filter(Boolean);
  return paths.some(p => path.resolve(p).toLowerCase() === normalizedTarget);
}

/**
 * Add directory to Windows User PATH
 */
function addDirectoryToUserPath(targetDir) {
  if (!targetDir) return false;
  const normalized = path.resolve(targetDir);
  const psScript = `
    $target = "${normalized.replace(/\\/g, '\\\\')}";
    $oldPath = [Environment]::GetEnvironmentVariable('Path', 'User');
    $parts = $oldPath -split ';' | Where-Object { $_ -ne '' -and $_ -ne $target -and $_ -ne 'System.Object[]' };
    $newPath = (@($target) + @($parts)) -join ';';
    [Environment]::SetEnvironmentVariable('Path', $newPath, 'User');
    Write-Output "OK";
  `;
  const result = spawnSync('powershell.exe', ['-NoProfile', '-Command', psScript], {
    windowsHide: true,
    encoding: 'utf8'
  });
  return result.status === 0;
}

/**
 * Remove directory from Windows User PATH
 */
function removeDirectoryFromUserPath(targetDir) {
  if (!targetDir) return false;
  const normalized = path.resolve(targetDir);
  const psScript = `
    $target = "${normalized.replace(/\\/g, '\\\\')}";
    $oldPath = [Environment]::GetEnvironmentVariable('Path', 'User');
    $parts = $oldPath -split ';' | Where-Object { $_ -ne '' -and $_ -ne $target };
    $newPath = $parts -join ';';
    [Environment]::SetEnvironmentVariable('Path', $newPath, 'User');
    Write-Output "OK";
  `;
  const result = spawnSync('powershell.exe', ['-NoProfile', '-Command', psScript], {
    windowsHide: true,
    encoding: 'utf8'
  });
  return result.status === 0;
}

/**
 * Add CURRENT_LINK to Windows User PATH (prepended so it has priority)
 */
function addToUserPath() {
  return addDirectoryToUserPath(CURRENT_LINK);
}

/**
 * Remove CURRENT_LINK from Windows User PATH
 */
function removeFromUserPath() {
  return removeDirectoryFromUserPath(CURRENT_LINK);
}

module.exports = {
  getCurrentVersion,
  getInstalledVersions,
  switchVersion,
  checkPathStatus,
  addToUserPath,
  removeFromUserPath,
  isDirectoryInUserPath,
  addDirectoryToUserPath,
  removeDirectoryFromUserPath
};
