const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { spawnSync } = require('child_process');
const { VERSIONS_DIR, DOWNLOADS_DIR, ensureDirectories } = require('./paths');
const { findRelease } = require('./releases');

/**
 * Calculate SHA256 of a file
 */
function calculateSha256(filePath) {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256');
    const stream = fs.createReadStream(filePath);
    stream.on('data', chunk => hash.update(chunk));
    stream.on('end', () => resolve(hash.digest('hex').toLowerCase()));
    stream.on('error', reject);
  });
}

/**
 * Download a file with progress reporting
 */
async function downloadFile(url, destPath, onProgress, fallbackUrl = null) {
  let response = await fetch(url);
  if (!response.ok && fallbackUrl) {
    // Try archive URL if primary release 404s
    response = await fetch(fallbackUrl);
  }

  if (!response.ok) {
    throw new Error(`Failed to download from ${url}: HTTP ${response.status} ${response.statusText}`);
  }

  const totalBytes = parseInt(response.headers.get('content-length') || '0', 10);
  let receivedBytes = 0;

  const fileStream = fs.createWriteStream(destPath);
  const reader = response.body.getReader();

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    receivedBytes += value.length;
    fileStream.write(Buffer.from(value));

    if (onProgress) {
      const percent = totalBytes > 0 ? Math.round((receivedBytes / totalBytes) * 100) : 0;
      onProgress({
        receivedBytes,
        totalBytes,
        percent,
        stage: 'downloading'
      });
    }
  }

  await new Promise((resolve, reject) => {
    fileStream.end();
    fileStream.on('finish', resolve);
    fileStream.on('error', reject);
  });
}

/**
 * Extract zip using Windows native tar.exe (fast and built-in)
 */
function extractZip(zipPath, targetDir) {
  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }

  const tarResult = spawnSync('tar.exe', ['-xf', zipPath, '-C', targetDir], {
    windowsHide: true,
    stdio: 'pipe'
  });

  if (tarResult.status !== 0) {
    // Fallback to PowerShell Expand-Archive
    const psCommand = `Expand-Archive -LiteralPath "${zipPath}" -DestinationPath "${targetDir}" -Force`;
    const psResult = spawnSync('powershell.exe', ['-NoProfile', '-Command', psCommand], {
      windowsHide: true,
      stdio: 'pipe'
    });

    if (psResult.status !== 0) {
      const err = psResult.stderr.toString('utf8') || tarResult.stderr.toString('utf8');
      throw new Error(`Failed to extract archive: ${err}`);
    }
  }
}

/**
 * Configure default php.ini
 */
function setupInitialPhpIni(versionDir) {
  const phpIniPath = path.join(versionDir, 'php.ini');
  const phpIniDev = path.join(versionDir, 'php.ini-development');
  const phpIniProd = path.join(versionDir, 'php.ini-production');

  if (!fs.existsSync(phpIniPath)) {
    if (fs.existsSync(phpIniDev)) {
      fs.copyFileSync(phpIniDev, phpIniPath);
    } else if (fs.existsSync(phpIniProd)) {
      fs.copyFileSync(phpIniProd, phpIniPath);
    } else {
      return;
    }
  }

  let content = fs.readFileSync(phpIniPath, 'utf8');

  // Configure extension_dir to absolute or "ext"
  // Look for ;extension_dir = "ext"
  if (content.includes(';extension_dir = "ext"')) {
    content = content.replace(';extension_dir = "ext"', 'extension_dir = "ext"');
  } else if (!content.match(/^extension_dir\s*=/m)) {
    content += '\r\nextension_dir = "ext"\r\n';
  }

  // Set default timezone if not set
  if (content.includes(';date.timezone =')) {
    content = content.replace(';date.timezone =', 'date.timezone = UTC');
  }

  // Enable safe, commonly needed extensions
  const defaultExts = [
    'curl',
    'fileinfo',
    'mbstring',
    'openssl',
    'pdo_mysql',
    'pdo_sqlite',
    'sqlite3',
    'zip'
  ];

  for (const ext of defaultExts) {
    // Check if extension is commented out: ;extension=ext or ;extension=php_ext.dll
    const regex1 = new RegExp(`^;\\s*(extension\\s*=\\s*${ext})\\b`, 'im');
    const regex2 = new RegExp(`^;\\s*(extension\\s*=\\s*php_${ext}\\.dll)\\b`, 'im');

    if (regex1.test(content)) {
      content = content.replace(regex1, '$1');
    } else if (regex2.test(content)) {
      content = content.replace(regex2, '$1');
    }
  }

  fs.writeFileSync(phpIniPath, content, 'utf8');
}

/**
 * Full install workflow for a release
 */
async function installRelease(release, onProgress = () => {}) {
  ensureDirectories();

  const targetDir = path.join(VERSIONS_DIR, release.id);
  const zipPath = path.join(DOWNLOADS_DIR, release.zipName);

  if (fs.existsSync(targetDir) && fs.existsSync(path.join(targetDir, 'php.exe'))) {
    onProgress({ stage: 'completed', percent: 100, message: 'Already installed' });
    return { targetDir, alreadyInstalled: true, release };
  }

  // 1. Download if not cached or size mismatch
  if (!fs.existsSync(zipPath)) {
    onProgress({ stage: 'downloading', percent: 0, message: `Downloading ${release.zipName}...` });
    await downloadFile(release.url, zipPath, onProgress, release.archiveUrl);
  }

  // 2. Verify SHA256 if available
  if (release.sha256) {
    onProgress({ stage: 'verifying', percent: 90, message: 'Verifying SHA256 checksum...' });
    const localHash = await calculateSha256(zipPath);
    if (localHash.toLowerCase() !== release.sha256.toLowerCase()) {
      fs.unlinkSync(zipPath); // Delete corrupted download
      throw new Error(`Checksum mismatch for ${release.zipName}! Expected: ${release.sha256}, Got: ${localHash}`);
    }
  }

  // 3. Extract
  onProgress({ stage: 'extracting', percent: 95, message: `Extracting to ${release.id}...` });
  extractZip(zipPath, targetDir);

  // 4. Configure php.ini
  onProgress({ stage: 'configuring', percent: 98, message: 'Configuring php.ini...' });
  setupInitialPhpIni(targetDir);

  onProgress({ stage: 'completed', percent: 100, message: `PHP ${release.version} (${release.type.toUpperCase()}) installed successfully!` });

  return { targetDir, alreadyInstalled: false, release };
}

/**
 * Install by query string (e.g. "8.3", "8.4", "latest")
 */
async function installVersion(query, { type = 'nts', arch = 'x64' } = {}, onProgress = () => {}) {
  onProgress({ stage: 'resolving', percent: 5, message: `Fetching available releases for '${query}'...` });
  const release = await findRelease(query, { type, arch });

  if (!release) {
    throw new Error(`No PHP release found matching query: '${query}' (${type.toUpperCase()} ${arch})`);
  }

  return await installRelease(release, onProgress);
}

module.exports = {
  calculateSha256,
  downloadFile,
  extractZip,
  setupInitialPhpIni,
  installRelease,
  installVersion
};
