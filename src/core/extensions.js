const fs = require('fs');
const path = require('path');
const { VERSIONS_DIR, CURRENT_LINK } = require('./paths');
const { getCurrentVersion, getInstalledVersions } = require('./environment');

const EXTENSION_METADATA = {
  curl: { name: 'cURL', category: 'Network', desc: 'HTTP/HTTPS requests, REST API client, file transfers' },
  openssl: { name: 'OpenSSL', category: 'Security', desc: 'Cryptographic functions, TLS/SSL streams, HTTPS' },
  mbstring: { name: 'MBString', category: 'String', desc: 'Multibyte string support (UTF-8, Unicode)' },
  fileinfo: { name: 'FileInfo', category: 'File System', desc: 'Detects file MIME types securely' },
  gd: { name: 'GD Library', category: 'Media', desc: 'Image creation, resizing, cropping (JPEG, PNG, WebP)' },
  intl: { name: 'Intl (ICU)', category: 'Localization', desc: 'Internationalization, number/date formatting, collations' },
  zip: { name: 'Zip', category: 'Compression', desc: 'Read and write ZIP archives' },
  bz2: { name: 'Bzip2', category: 'Compression', desc: 'Bzip2 compression support' },
  pdo_mysql: { name: 'PDO MySQL', category: 'Database', desc: 'Database driver for MySQL / MariaDB via PDO' },
  mysqli: { name: 'MySQLi', category: 'Database', desc: 'Improved MySQL driver (procedural & OOP)' },
  pdo_sqlite: { name: 'PDO SQLite', category: 'Database', desc: 'SQLite 3 database driver via PDO' },
  sqlite3: { name: 'SQLite 3', category: 'Database', desc: 'SQLite database engine' },
  pdo_pgsql: { name: 'PDO PostgreSQL', category: 'Database', desc: 'PostgreSQL database driver via PDO' },
  pgsql: { name: 'PostgreSQL', category: 'Database', desc: 'Native PostgreSQL client driver' },
  sodium: { name: 'Sodium', category: 'Security', desc: 'Modern cryptography (Argon2, ChaCha20, Poly1305)' },
  exif: { name: 'EXIF', category: 'Media', desc: 'Read EXIF metadata from photos/camera images' },
  ftp: { name: 'FTP', category: 'Network', desc: 'File Transfer Protocol client functions' },
  soap: { name: 'SOAP', category: 'Network', desc: 'SOAP XML web services client and server' },
  sockets: { name: 'Sockets', category: 'Network', desc: 'Low-level socket communication' },
  xmlrpc: { name: 'XML-RPC', category: 'Network', desc: 'XML-RPC protocol functions' },
  xsl: { name: 'XSL', category: 'XML', desc: 'XSL transformations using libxslt' },
  tidy: { name: 'Tidy', category: 'Markup', desc: 'Clean and repair HTML/XML documents' },
  ffi: { name: 'FFI', category: 'Advanced', desc: 'Foreign Function Interface (call C functions from PHP)' },
  opcache: { name: 'Zend OPcache', category: 'Performance', desc: 'Precompiled script bytecode caching in shared memory', isZend: true },
  xdebug: { name: 'Xdebug', category: 'Debugging', desc: 'Step debugger and profiler for PHP', isZend: true }
};

/**
 * Resolve directory of a given version ID or the active version
 */
function resolveVersionDir(versionId) {
  if (!versionId || versionId === 'current') {
    const current = getCurrentVersion();
    if (!current) throw new Error('No active PHP version is currently selected.');
    return current.path;
  }

  const directPath = path.join(VERSIONS_DIR, versionId);
  if (fs.existsSync(directPath)) return directPath;

  const installed = getInstalledVersions();
  const found = installed.find(v => v.id === versionId || v.version === versionId);
  if (found) return found.path;

  throw new Error(`PHP version '${versionId}' not found.`);
}

/**
 * Get all extensions available and their enabled status
 */
function getExtensions(versionId = null) {
  const versionDir = resolveVersionDir(versionId);
  const extDir = path.join(versionDir, 'ext');
  const phpIniPath = path.join(versionDir, 'php.ini');

  if (!fs.existsSync(phpIniPath)) {
    throw new Error(`php.ini not found in ${versionDir}`);
  }

  const iniContent = fs.readFileSync(phpIniPath, 'utf8');

  // Discover all DLLs in ext/ directory
  const availableDlls = new Map();
  if (fs.existsSync(extDir)) {
    const files = fs.readdirSync(extDir);
    for (const file of files) {
      if (file.toLowerCase().endsWith('.dll')) {
        let baseName = file.replace(/\.dll$/i, '');
        if (baseName.startsWith('php_')) {
          baseName = baseName.substring(4);
        }
        availableDlls.set(baseName.toLowerCase(), file);
      }
    }
  }

  // Also include opcache if in versionDir or ext
  if (!availableDlls.has('opcache')) {
    if (fs.existsSync(path.join(extDir, 'php_opcache.dll')) || fs.existsSync(path.join(versionDir, 'php_opcache.dll'))) {
      availableDlls.set('opcache', 'php_opcache.dll');
    }
  }

  const extensions = [];

  for (const [id, dll] of availableDlls.entries()) {
    const meta = EXTENSION_METADATA[id] || {
      name: id.toUpperCase(),
      category: 'General',
      desc: `PHP extension (${dll})`
    };

    const isZend = meta.isZend || id === 'opcache' || id === 'xdebug';

    // Check if enabled in php.ini
    // Active line: extension=id OR extension=dll OR zend_extension=...
    // Disabled line: ;extension=...
    let enabled = false;

    if (isZend) {
      const zendRegex = new RegExp(`^\\s*zend_extension\\s*=\\s*(?:"|')?(?:php_)?${id}(?:\\.dll)?(?:"|')?`, 'im');
      enabled = zendRegex.test(iniContent);
    } else {
      const extRegex = new RegExp(`^\\s*extension\\s*=\\s*(?:"|')?(?:php_)?${id}(?:\\.dll)?(?:"|')?`, 'im');
      enabled = extRegex.test(iniContent);
    }

    extensions.push({
      id,
      name: meta.name,
      dll,
      category: meta.category,
      description: meta.desc,
      isZend,
      enabled
    });
  }

  // Sort by category, then by name
  extensions.sort((a, b) => {
    if (a.category !== b.category) {
      return a.category.localeCompare(b.category);
    }
    return a.name.localeCompare(b.name);
  });

  return extensions;
}

/**
 * Enable or disable an extension
 */
function setExtensionStatus(versionId, extensionId, enable) {
  const versionDir = resolveVersionDir(versionId);
  const phpIniPath = path.join(versionDir, 'php.ini');

  if (!fs.existsSync(phpIniPath)) {
    throw new Error(`php.ini not found in ${versionDir}`);
  }

  let content = fs.readFileSync(phpIniPath, 'utf8');
  const cleanId = extensionId.toLowerCase().replace(/^php_/, '').replace(/\.dll$/, '');
  const meta = EXTENSION_METADATA[cleanId];
  const isZend = meta && meta.isZend;
  const directiveKey = isZend ? 'zend_extension' : 'extension';

  // Patterns for this extension (both enabled and commented)
  // e.g. extension = curl, ;extension = curl, extension = php_curl.dll, ;extension = "php_curl.dll"
  const activePattern = new RegExp(`^(\\s*${directiveKey}\\s*=\\s*(?:"|')?(?:php_)?${cleanId}(?:\\.dll)?(?:"|')?.*)$`, 'im');
  const commentedPattern = new RegExp(`^(\\s*;\\s*${directiveKey}\\s*=\\s*(?:"|')?(?:php_)?${cleanId}(?:\\.dll)?(?:"|')?.*)$`, 'im');

  if (enable) {
    if (activePattern.test(content)) {
      // Already enabled
      return true;
    }
    if (commentedPattern.test(content)) {
      // Uncomment it
      content = content.replace(commentedPattern, (match) => {
        return match.replace(/^\s*;\s*/, '');
      });
    } else {
      // Append under Windows Extensions block or at end of file
      const marker = '; Module Settings ;';
      if (content.includes(marker)) {
        content = content.replace(marker, `${directiveKey}=${cleanId}\r\n\r\n${marker}`);
      } else {
        content += `\r\n${directiveKey}=${cleanId}\r\n`;
      }
    }
  } else {
    // Disable: comment out all active instances
    if (activePattern.test(content)) {
      content = content.replace(activePattern, ';$1');
    }
  }

  fs.writeFileSync(phpIniPath, content, 'utf8');
  return true;
}

/**
 * Read key PHP directives from php.ini
 */
function getDirectives(versionId = null) {
  const versionDir = resolveVersionDir(versionId);
  const phpIniPath = path.join(versionDir, 'php.ini');

  if (!fs.existsSync(phpIniPath)) {
    throw new Error(`php.ini not found in ${versionDir}`);
  }

  const content = fs.readFileSync(phpIniPath, 'utf8');

  function readVal(key, defaultVal = '') {
    const regex = new RegExp(`^\\s*${key}\\s*=\\s*(.+?)(?:\\s*;.*)?$`, 'm');
    const match = content.match(regex);
    return match ? match[1].trim().replace(/^["']|["']$/g, '') : defaultVal;
  }

  return {
    memory_limit: readVal('memory_limit', '128M'),
    upload_max_filesize: readVal('upload_max_filesize', '2M'),
    post_max_size: readVal('post_max_size', '8M'),
    max_execution_time: readVal('max_execution_time', '30'),
    max_input_time: readVal('max_input_time', '60'),
    display_errors: readVal('display_errors', 'Off'),
    error_reporting: readVal('error_reporting', 'E_ALL'),
    date_timezone: readVal('date.timezone', 'UTC'),
    opcache_enable: readVal('opcache.enable', '1'),
    opcache_enable_cli: readVal('opcache.enable_cli', '0')
  };
}

/**
 * Update key directives in php.ini
 */
function updateDirectives(versionId, updates) {
  const versionDir = resolveVersionDir(versionId);
  const phpIniPath = path.join(versionDir, 'php.ini');

  if (!fs.existsSync(phpIniPath)) {
    throw new Error(`php.ini not found in ${versionDir}`);
  }

  let content = fs.readFileSync(phpIniPath, 'utf8');

  const keyMap = {
    memory_limit: 'memory_limit',
    upload_max_filesize: 'upload_max_filesize',
    post_max_size: 'post_max_size',
    max_execution_time: 'max_execution_time',
    max_input_time: 'max_input_time',
    display_errors: 'display_errors',
    error_reporting: 'error_reporting',
    date_timezone: 'date.timezone',
    opcache_enable: 'opcache.enable',
    opcache_enable_cli: 'opcache.enable_cli'
  };

  for (const [field, value] of Object.entries(updates)) {
    const iniKey = keyMap[field] || field;
    if (value === undefined || value === null) continue;

    // Replace active or commented directive
    const regex = new RegExp(`^(\\s*;?\\s*${iniKey.replace('.', '\\.')}\\s*=).*$`, 'm');
    if (regex.test(content)) {
      content = content.replace(regex, `${iniKey} = ${value}`);
    } else {
      content += `\r\n${iniKey} = ${value}\r\n`;
    }
  }

  fs.writeFileSync(phpIniPath, content, 'utf8');
  return getDirectives(versionId);
}

module.exports = {
  getExtensions,
  setExtensionStatus,
  getDirectives,
  updateDirectives,
  EXTENSION_METADATA
};
