const os = require('os');
const { spawnSync } = require('child_process');

/**
 * Get detailed Windows OS information
 */
function getWindowsVersionInfo() {
  const isWindows = process.platform === 'win32';
  if (!isWindows) {
    return {
      isWindows: false,
      isSupported: false,
      osName: process.platform,
      kernel: os.release(),
      errorMessage: 'YAWPS is exclusively designed for Windows 10 and Windows 11. Non-Windows operating systems are not supported.'
    };
  }

  const release = os.release() || '';
  const parts = release.split('.').map(p => parseInt(p, 10));
  const major = parts[0] || 0;
  const minor = parts[1] || 0;
  const build = parts[2] || 0;

  let osName = 'Windows';
  if (major === 10) {
    osName = build >= 22000 ? 'Windows 11' : 'Windows 10';
  } else if (major === 6 && minor === 3) {
    osName = 'Windows 8.1';
  } else if (major === 6 && minor === 2) {
    osName = 'Windows 8';
  } else if (major === 6 && minor === 1) {
    osName = 'Windows 7';
  } else if (major === 6 && minor === 0) {
    osName = 'Windows Vista';
  } else if (major < 6) {
    osName = 'Windows XP or older';
  }

  const isSupported = major >= 10;

  const errorMessage = isSupported
    ? null
    : `YAWPS requires Windows 10 or Windows 11.\n\nDetected operating system: ${osName} (NT kernel ${release}).\n\nWindows versions below 10 (such as Windows 7, 8, and 8.1) are not supported. Modern PHP runtimes, NTFS directory junctions, and system APIs require Windows 10 or later. Please upgrade to Windows 10 or 11.`;

  return {
    isWindows,
    isSupported,
    major,
    minor,
    build,
    kernel: release,
    osName,
    errorMessage
  };
}

/**
 * Pop up a native Windows modal error dialog box
 */
function showNativeAlert(title, message) {
  try {
    // If inside Electron
    if (process.versions && process.versions.electron) {
      const { dialog } = require('electron');
      if (dialog && typeof dialog.showErrorBox === 'function') {
        dialog.showErrorBox(title, message);
        return;
      }
    }

    // Fallback using PowerShell
    const script = `
Add-Type -AssemblyName System.Windows.Forms;
[System.Windows.Forms.MessageBox]::Show(
  @'
${message.replace(/'/g, "''")}
'@,
  '${title.replace(/'/g, "''")}',
  [System.Windows.Forms.MessageBoxButtons]::OK,
  [System.Windows.Forms.MessageBoxIcon]::Error
) | Out-Null
`;
    spawnSync('powershell.exe', ['-NoProfile', '-WindowStyle', 'Hidden', '-Command', script], {
      stdio: 'ignore'
    });
  } catch (err) {
    // Fallback: print to stderr if modal popup fails
    console.error(`\n[${title}]\n${message}\n`);
  }
}

/**
 * Assert that the current OS is Windows 10 or higher.
 * If not supported, gives user feedback (dialog or CLI error) and terminates.
 */
function assertWindows10OrAbove(options = {}) {
  const info = getWindowsVersionInfo();
  if (info.isSupported) {
    return true;
  }

  const isElectron = Boolean(process.versions && process.versions.electron);
  const isGui = Boolean(options.isGui || isElectron);

  // In GUI mode, show native alert dialog
  if (isGui && options.showAlert !== false) {
    showNativeAlert('YAWPS - Unsupported Windows Version', info.errorMessage);
  }

  // Always output clean error message to stderr if available
  console.error('\n' + '='.repeat(70));
  console.error(' ❌ UNSUPPORTED OPERATING SYSTEM');
  console.error('='.repeat(70));
  console.error(info.errorMessage);
  console.error('='.repeat(70) + '\n');

  if (options.exit !== false) {
    if (process.versions && process.versions.electron) {
      try {
        const { app } = require('electron');
        if (app && typeof app.quit === 'function') {
          app.quit();
          return false;
        }
      } catch {}
    }
    process.exit(1);
  }

  return false;
}

module.exports = {
  getWindowsVersionInfo,
  showNativeAlert,
  assertWindows10OrAbove
};
