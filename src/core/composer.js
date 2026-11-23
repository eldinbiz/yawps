const fs = require('fs');
const path = require('path');
const os = require('os');
const https = require('https');
const { spawnSync, spawn } = require('child_process');
const { BASE_DIR, BIN_DIR, CURRENT_LINK, ensureDirectories } = require('./paths');
const {
  getCurrentVersion,
  isDirectoryInUserPath,
  addDirectoryToUserPath,
  removeDirectoryFromUserPath
} = require('./environment');

function getComposerHome() {
  if (process.env.COMPOSER_HOME) {
    return path.resolve(process.env.COMPOSER_HOME);
  }

  const userProfile = os.homedir();
  const dotComposer = path.join(userProfile, '.composer');
  const appdataComposer = process.env.APPDATA ? path.join(process.env.APPDATA, 'Composer') : null;

  if (fs.existsSync(dotComposer) && fs.statSync(dotComposer).isDirectory()) {
    return dotComposer;
  }

  if (appdataComposer && fs.existsSync(appdataComposer) && fs.statSync(appdataComposer).isDirectory()) {
    return appdataComposer;
  }

  return dotComposer;
}

function getComposerGlobalBinDir() {
  return path.join(getComposerHome(), 'vendor', 'bin');
}

function findComposerExecutable() {
  ensureDirectories();
  const yawpsPhar = path.join(BIN_DIR, 'composer.phar');
  const yawpsBat = path.join(BIN_DIR, 'composer.bat');

  if (fs.existsSync(yawpsPhar)) {
    return {
      composerBat: fs.existsSync(yawpsBat) ? yawpsBat : '',
      composerPhar: yawpsPhar,
      isYawpsManaged: true
    };
  }

  const whereResult = spawnSync('where.exe', ['composer.bat'], { windowsHide: true, encoding: 'utf8' });
  if (whereResult.status === 0 && whereResult.stdout.trim()) {
    const loc = whereResult.stdout.trim().split('\r\n')[0];
    const pharCand = path.join(path.dirname(loc), 'composer.phar');
    return {
      composerBat: loc,
      composerPhar: fs.existsSync(pharCand) ? pharCand : '',
      isYawpsManaged: false
    };
  }

  const candidates = [
    'C:\\ProgramData\\ComposerSetup\\bin\\composer.bat',
    process.env.APPDATA ? path.join(process.env.APPDATA, 'Composer', 'vendor', 'bin', 'composer.bat') : null,
    path.join(os.homedir(), 'scoop', 'shims', 'composer.exe'),
    'C:\\ProgramData\\chocolatey\\bin\\composer.bat'
  ].filter(Boolean);

  for (const cand of candidates) {
    if (fs.existsSync(cand)) {
      const pharCand = path.join(path.dirname(cand), 'composer.phar');
      return {
        composerBat: cand,
        composerPhar: fs.existsSync(pharCand) ? pharCand : '',
        isYawpsManaged: false
      };
    }
  }

  return { composerBat: '', composerPhar: '', isYawpsManaged: false };
}

function fetchLatestComposerVersion() {
  return new Promise((resolve, reject) => {
    https.get('https://getcomposer.org/versions', {
      headers: { 'User-Agent': 'YAWPS-PHP-Switcher' },
      family: 4,
      timeout: 5000
    }, (res) => {
      if (res.statusCode !== 200) {
        return resolve({ version: '', path: '' });
      }
      let rawData = '';
      res.on('data', chunk => rawData += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(rawData);
          if (parsed.stable && parsed.stable.length > 0) {
            resolve({
              version: parsed.stable[0].version,
              path: parsed.stable[0].path
            });
          } else {
            resolve({ version: '', path: '' });
          }
        } catch {
          resolve({ version: '', path: '' });
        }
      });
    }).on('error', () => {
      resolve({ version: '', path: '' });
    });
  });
}

function compareVersions(v1, v2) {
  const clean = (v) => {
    return (v || '').replace(/^v/i, '').split('-')[0].split('.').map(Number);
  };
  const nums1 = clean(v1);
  const nums2 = clean(v2);
  for (let i = 0; i < Math.max(nums1.length, nums2.length); i++) {
    const a = nums1[i] || 0;
    const b = nums2[i] || 0;
    if (a > b) return 1;
    if (a < b) return -1;
  }
  return 0;
}

async function getComposerStatus() {
  ensureDirectories();
  const { composerBat, composerPhar, isYawpsManaged } = findComposerExecutable();
  const isInstalled = Boolean(composerBat || composerPhar);

  const cur = getCurrentVersion();
  const activePhp = cur ? `PHP ${cur.version} (${cur.type.toUpperCase()} ${cur.arch})` : '';
  const activePhpPath = cur ? path.join(cur.path, 'php.exe') : '';

  let version = '';
  let releaseDate = '';

  if (isInstalled) {
    let cmd = null;
    let args = [];
    if (cur && activePhpPath && composerPhar) {
      cmd = activePhpPath;
      args = [composerPhar, '--version'];
    } else if (composerBat) {
      cmd = 'cmd.exe';
      args = ['/c', composerBat, '--version', '--no-ansi'];
    }

    if (cmd) {
      const runEnv = Object.assign({}, process.env, {
        PATH: `${CURRENT_LINK};${BIN_DIR};${process.env.PATH}`
      });
      const check = spawnSync(cmd, args, { windowsHide: true, encoding: 'utf8', env: runEnv });
      const out = ((check.stdout || '') + (check.stderr || '')).replace(/\x1b\[[0-9;]*[a-zA-Z]/g, '');
      const match = out.match(/Composer (?:version )?([0-9]+\.[0-9]+(?:\.[0-9]+)?(?:-[a-zA-Z0-9.]+)?)(?: \(([^\)]+)\))? ([0-9]{4}-[0-9]{2}-[0-9]{2})?/i);
      if (match) {
        version = match[1];
        if (match[3]) releaseDate = match[3];
      }
    }
  }

  const latest = await fetchLatestComposerVersion();
  const latestVersion = latest.version || '';
  const isUpToDate = isInstalled && version && latestVersion ? compareVersions(version, latestVersion) >= 0 : false;

  const composerHome = getComposerHome();
  const globalBinDir = getComposerGlobalBinDir();
  const isBinInPath = isDirectoryInUserPath(BIN_DIR);
  const isGlobalBinInPath = isDirectoryInUserPath(globalBinDir);
  const packages = getComposerGlobalPackages();

  return {
    installed: isInstalled,
    version,
    releaseDate,
    location: composerBat,
    pharPath: composerPhar,
    isYawpsManaged,
    latestVersion,
    isUpToDate,
    activePhp,
    activePhpPath,
    composerHome,
    globalBinDir,
    isBinInPath,
    isGlobalBinInPath,
    packagesCount: packages.length
  };
}

function installComposer(onProgress) {
  return new Promise(async (resolve, reject) => {
    const cur = getCurrentVersion();
    if (!cur) {
      return reject(new Error('No active PHP version selected. Please select a PHP version first.'));
    }

    ensureDirectories();
    if (onProgress) onProgress({ stage: 'Checking releases', percent: 5, message: 'Fetching latest release info...' });

    const latest = await fetchLatestComposerVersion();
    const downloadUrl = latest.path ? `https://getcomposer.org${latest.path}` : 'https://getcomposer.org/download/latest-stable/composer.phar';

    if (onProgress) {
      onProgress({
        stage: 'Downloading Composer',
        percent: 15,
        message: `Downloading composer.phar (${latest.version || 'latest stable'})...`
      });
    }

    const pharPath = path.join(BIN_DIR, 'composer.phar');
    const tmpPath = pharPath + '.tmp';
    const file = fs.createWriteStream(tmpPath);

    https.get(downloadUrl, { headers: { 'User-Agent': 'YAWPS-PHP-Switcher' } }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        // Follow redirect
        https.get(res.headers.location, (redirRes) => {
          handleDownloadStream(redirRes);
        }).on('error', reject);
        return;
      }
      handleDownloadStream(res);
    }).on('error', reject);

    function handleDownloadStream(stream) {
      const totalBytes = parseInt(stream.headers['content-length'] || '0', 10);
      let receivedBytes = 0;

      stream.on('data', (chunk) => {
        receivedBytes += chunk.length;
        if (totalBytes > 0 && onProgress) {
          const pct = Math.floor(15 + (receivedBytes / totalBytes) * 70);
          onProgress({
            stage: 'Downloading Composer',
            percent: pct,
            receivedBytes,
            totalBytes,
            message: `Downloaded ${(receivedBytes / (1024 * 1024)).toFixed(1)} MB of ${(totalBytes / (1024 * 1024)).toFixed(1)} MB`
          });
        }
      });

      stream.pipe(file);

      file.on('finish', () => {
        file.close(() => {
          try {
            if (fs.existsSync(pharPath)) fs.unlinkSync(pharPath);
            fs.renameSync(tmpPath, pharPath);

            // Generate composer.bat
            const batPath = path.join(BIN_DIR, 'composer.bat');
            const batContent = '@echo off\r\nphp "%~dp0composer.phar" %*\r\n';
            fs.writeFileSync(batPath, batContent, 'utf8');

            // Generate composer sh wrapper
            const shPath = path.join(BIN_DIR, 'composer');
            const shContent = '#!/usr/bin/env sh\n"$(dirname -- "$0")/composer.phar" "$@"\n';
            fs.writeFileSync(shPath, shContent, 'utf8');

            // Add bin to User PATH
            if (!isDirectoryInUserPath(BIN_DIR)) {
              addDirectoryToUserPath(BIN_DIR);
            }

            // Ensure global bin is in User PATH
            const globalBin = getComposerGlobalBinDir();
            if (!fs.existsSync(globalBin)) fs.mkdirSync(globalBin, { recursive: true });
            if (!isDirectoryInUserPath(globalBin)) {
              addDirectoryToUserPath(globalBin);
            }

            // Verify
            const phpExe = path.join(cur.path, 'php.exe');
            const runCheck = spawnSync(phpExe, [pharPath, '--version'], {
              windowsHide: true,
              encoding: 'utf8',
              env: Object.assign({}, process.env, { PATH: `${CURRENT_LINK};${BIN_DIR};${process.env.PATH}` })
            });

            const output = (runCheck.stdout || '').trim();
            if (onProgress) onProgress({ stage: 'Installation complete', percent: 100, message: output });
            resolve({ success: true, output });
          } catch (err) {
            reject(err);
          }
        });
      });
    }
  });
}

function updateComposer(onProgress) {
  const { isYawpsManaged, composerPhar } = findComposerExecutable();
  if (isYawpsManaged || composerPhar) {
    return installComposer(onProgress);
  }
  const cur = getCurrentVersion();
  const res = spawnSync('cmd.exe', ['/c', 'composer', 'self-update'], {
    windowsHide: true,
    encoding: 'utf8',
    env: Object.assign({}, process.env, { PATH: `${CURRENT_LINK};${BIN_DIR};${process.env.PATH}` })
  });
  return Promise.resolve({
    success: res.status === 0,
    output: (res.stdout || '').trim() || (res.stderr || '').trim()
  });
}

function uninstallComposer(opts = {}) {
  const {
    removeBin = true,
    removeFromPath = true,
    cleanCache = true,
    purgePackages = false,
    removeGlobalBinFromPath = false
  } = opts;

  const deletedPaths = [];
  const { composerBat, composerPhar } = findComposerExecutable();
  const composerHome = getComposerHome();
  const globalBinDir = getComposerGlobalBinDir();

  // 1. Remove executables
  if (removeBin) {
    const targets = [
      path.join(BIN_DIR, 'composer.phar'),
      path.join(BIN_DIR, 'composer.bat'),
      path.join(BIN_DIR, 'composer')
    ];
    if (composerPhar && !composerPhar.toLowerCase().startsWith(BIN_DIR.toLowerCase())) {
      targets.push(composerPhar);
    }
    if (composerBat && !composerBat.toLowerCase().includes('programdata') && !composerBat.toLowerCase().startsWith(BIN_DIR.toLowerCase())) {
      targets.push(composerBat);
    }

    for (const t of targets) {
      if (fs.existsSync(t)) {
        try {
          fs.unlinkSync(t);
          deletedPaths.push(t);
        } catch {}
      }
    }

    if (fs.existsSync(BIN_DIR)) {
      try {
        const remaining = fs.readdirSync(BIN_DIR);
        if (remaining.length === 0) fs.rmdirSync(BIN_DIR);
      } catch {}
    }
  }

  // 2. Remove bin from PATH
  let pathCleaned = false;
  if (removeFromPath) {
    pathCleaned = removeDirectoryFromUserPath(BIN_DIR);
  }

  // 3. Clean cache
  let cacheDeleted = false;
  if (cleanCache) {
    const cacheDirs = [
      process.env.LOCALAPPDATA ? path.join(process.env.LOCALAPPDATA, 'Composer', 'cache') : null,
      path.join(composerHome, 'cache')
    ].filter(Boolean);

    for (const cd of cacheDirs) {
      if (fs.existsSync(cd)) {
        try {
          fs.rmSync(cd, { recursive: true, force: true });
          deletedPaths.push(cd);
          cacheDeleted = true;
        } catch {}
      }
    }
  }

  // 4. Purge packages
  let packagesPurged = false;
  if (purgePackages) {
    const vendorDir = path.join(composerHome, 'vendor');
    const lockFile = path.join(composerHome, 'composer.lock');
    const jsonFile = path.join(composerHome, 'composer.json');

    if (fs.existsSync(vendorDir)) {
      try {
        fs.rmSync(vendorDir, { recursive: true, force: true });
        deletedPaths.push(vendorDir);
      } catch {}
    }
    if (fs.existsSync(lockFile)) {
      try {
        fs.unlinkSync(lockFile);
        deletedPaths.push(lockFile);
      } catch {}
    }
    if (fs.existsSync(jsonFile)) {
      try {
        fs.writeFileSync(jsonFile, '{}\n', 'utf8');
        deletedPaths.push(jsonFile + ' (reset)');
      } catch {}
    }
    packagesPurged = true;
  }

  // 5. Remove global bin from PATH
  let globalBinPathRemoved = false;
  if (removeGlobalBinFromPath) {
    globalBinPathRemoved = removeDirectoryFromUserPath(globalBinDir);
  }

  return {
    success: true,
    executablesDeleted: removeBin,
    pathCleaned,
    cacheDeleted,
    packagesPurged,
    globalBinPathRemoved,
    deletedPaths,
    message: `Composer uninstallation completed. ${deletedPaths.length} items cleaned.`
  };
}

function getComposerGlobalPackages() {
  const { composerBat, composerPhar } = findComposerExecutable();
  if (!composerBat && !composerPhar) {
    return [];
  }

  const composerHome = getComposerHome();
  const lockPath = path.join(composerHome, 'composer.lock');
  const jsonPath = path.join(composerHome, 'composer.json');
  const map = new Map();

  if (fs.existsSync(lockPath)) {
    try {
      const lockData = JSON.parse(fs.readFileSync(lockPath, 'utf8'));
      if (Array.isArray(lockData.packages)) {
        for (const p of lockData.packages) {
          const bins = Array.isArray(p.bin) ? p.bin.map(b => path.basename(b)) : [];
          map.set((p.name || '').toLowerCase(), {
            name: p.name,
            version: p.version,
            description: p.description || '',
            homepage: p.homepage || '',
            license: Array.isArray(p.license) ? p.license : [],
            binaries: bins,
            time: p.time || ''
          });
        }
      }
    } catch {}
  }

  if (fs.existsSync(jsonPath)) {
    try {
      const jsonData = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
      if (jsonData.require && typeof jsonData.require === 'object') {
        for (const [name, constraint] of Object.entries(jsonData.require)) {
          const lower = name.toLowerCase();
          if (map.has(lower)) {
            map.get(lower).constraint = constraint;
          } else {
            map.set(lower, {
              name,
              version: '(Not installed)',
              constraint,
              description: 'Required in composer.json but not yet locked',
              license: [],
              binaries: []
            });
          }
        }
      }
    } catch {}
  }

  return Array.from(map.values());
}

function runComposerCommand(args, onProgress) {
  return new Promise((resolve, reject) => {
    const cur = getCurrentVersion();
    if (!cur) return reject(new Error('No active PHP version selected.'));

    const { composerPhar, composerBat } = findComposerExecutable();
    const phpExe = path.join(cur.path, 'php.exe');

    let execCmd = '';
    let execArgs = [];

    if (composerPhar) {
      execCmd = phpExe;
      execArgs = [composerPhar, ...args];
    } else if (composerBat) {
      execCmd = 'cmd.exe';
      execArgs = ['/c', composerBat, ...args];
    } else {
      return reject(new Error('Composer is not installed.'));
    }

    const env = Object.assign({}, process.env, {
      PATH: `${CURRENT_LINK};${BIN_DIR};${process.env.PATH}`,
      COMPOSER_HOME: getComposerHome()
    });

    const child = spawn(execCmd, execArgs, { windowsHide: true, env });
    let output = '';

    const handleData = (chunk) => {
      const str = chunk.toString();
      output += str;
      if (onProgress) {
        str.split('\n').map(l => l.trim()).filter(Boolean).forEach(l => onProgress(l));
      }
    };

    child.stdout.on('data', handleData);
    child.stderr.on('data', handleData);

    child.on('close', (code) => {
      resolve({
        success: code === 0,
        output
      });
    });

    child.on('error', (err) => {
      reject(err);
    });
  });
}

function installComposerGlobalPackage(pkgName, version, onProgress) {
  let spec = (pkgName || '').trim();
  if (version) spec += `:${version.trim()}`;
  return runComposerCommand(['global', 'require', spec, '--no-interaction'], onProgress);
}

function removeComposerGlobalPackages(pkgNames, onProgress) {
  const list = Array.isArray(pkgNames)
    ? pkgNames.map(p => (p || '').trim()).filter(Boolean)
    : [(pkgNames || '').trim()].filter(Boolean);
  if (list.length === 0) return Promise.reject(new Error('No package names specified'));
  return runComposerCommand(['global', 'remove', ...list, '--no-interaction'], onProgress);
}

function removeComposerGlobalPackage(pkgName, onProgress) {
  return removeComposerGlobalPackages(pkgName, onProgress);
}

function updateComposerGlobalPackages(pkgNames, onProgress) {
  const list = Array.isArray(pkgNames)
    ? pkgNames.map(p => (p || '').trim()).filter(Boolean)
    : (pkgNames ? [(pkgNames || '').trim()].filter(Boolean) : []);
  const args = list.length > 0
    ? ['global', 'update', ...list, '--no-interaction']
    : ['global', 'update', '--no-interaction'];
  return runComposerCommand(args, onProgress);
}

function updateComposerGlobalPackage(pkgName, onProgress) {
  return updateComposerGlobalPackages(pkgName, onProgress);
}

function toggleComposerGlobalBinPath(enable) {
  const binDir = getComposerGlobalBinDir();
  if (!fs.existsSync(binDir)) fs.mkdirSync(binDir, { recursive: true });
  if (enable) {
    addDirectoryToUserPath(binDir);
  } else {
    removeDirectoryFromUserPath(binDir);
  }
  return isDirectoryInUserPath(binDir);
}

module.exports = {
  getComposerHome,
  getComposerGlobalBinDir,
  findComposerExecutable,
  fetchLatestComposerVersion,
  getComposerStatus,
  installComposer,
  updateComposer,
  uninstallComposer,
  getComposerGlobalPackages,
  installComposerGlobalPackage,
  removeComposerGlobalPackage,
  removeComposerGlobalPackages,
  updateComposerGlobalPackage,
  updateComposerGlobalPackages,
  toggleComposerGlobalBinPath
};
