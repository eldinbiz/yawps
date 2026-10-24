const path = require('path');
const os = require('os');
const fs = require('fs');

// Root directory for YAWPS (Yet Another Windows PHP Switcher)
// Defaults to %USERPROFILE%\.yawps (or legacy %USERPROFILE%\.win-php if exists)
// Overridable via YAWPS_HOME or WIN_PHP_HOME
const yawpsDir = path.join(os.homedir(), '.yawps');
const legacyDir = path.join(os.homedir(), '.win-php');

const customHome = process.env.YAWPS_HOME || process.env.WIN_PHP_HOME;
const BASE_DIR = customHome
  ? path.resolve(customHome)
  : (fs.existsSync(legacyDir) && !fs.existsSync(yawpsDir) ? legacyDir : yawpsDir);

const VERSIONS_DIR = path.join(BASE_DIR, 'versions');
const CURRENT_LINK = path.join(BASE_DIR, 'current');
const DOWNLOADS_DIR = path.join(BASE_DIR, 'downloads');
const CONFIG_FILE = path.join(BASE_DIR, 'config.json');

/**
 * Ensure all necessary directories exist
 */
function ensureDirectories() {
  if (!fs.existsSync(BASE_DIR)) {
    fs.mkdirSync(BASE_DIR, { recursive: true });
  }
  if (!fs.existsSync(VERSIONS_DIR)) {
    fs.mkdirSync(VERSIONS_DIR, { recursive: true });
  }
  if (!fs.existsSync(DOWNLOADS_DIR)) {
    fs.mkdirSync(DOWNLOADS_DIR, { recursive: true });
  }
}

/**
 * Read persistent config
 */
function getConfig() {
  ensureDirectories();
  if (fs.existsSync(CONFIG_FILE)) {
    try {
      return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
    } catch {
      return {};
    }
  }
  return {};
}

/**
 * Save persistent config
 */
function saveConfig(data) {
  ensureDirectories();
  try {
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(data, null, 2), 'utf8');
  } catch (err) {
    console.error('Failed to save config:', err.message);
  }
}

module.exports = {
  BASE_DIR,
  VERSIONS_DIR,
  CURRENT_LINK,
  DOWNLOADS_DIR,
  CONFIG_FILE,
  ensureDirectories,
  getConfig,
  saveConfig
};
