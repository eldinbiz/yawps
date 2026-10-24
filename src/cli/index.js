const { Command } = require('commander');
const pc = require('picocolors');
const Table = require('cli-table3');
const path = require('path');
const { spawn } = require('child_process');

const {
  fetchReleases,
  findRelease
} = require('../core/releases');

const {
  installVersion,
  installRelease
} = require('../core/installer');

const {
  getCurrentVersion,
  getInstalledVersions,
  switchVersion,
  checkPathStatus,
  addToUserPath
} = require('../core/environment');

const {
  getExtensions,
  setExtensionStatus,
  getDirectives,
  updateDirectives
} = require('../core/extensions');

const {
  checkUpdates,
  performUpdate
} = require('../core/updater');

const {
  uninstallVersion,
  cleanCachedArchives,
  removeEnvironmentPath,
  fullCleanup
} = require('../core/uninstaller');

const { getWindowsVersionInfo } = require('../core/osCheck');

const readline = require('readline');

/**
 * Ask a yes/no question interactively
 */
function askConfirmation(question) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
    rl.question(question, (answer) => {
      rl.close();
      const trimmed = answer.trim().toLowerCase();
      resolve(trimmed === 'y' || trimmed === 'yes');
    });
  });
}

const { CURRENT_LINK } = require('../core/paths');

function createCli() {
  const program = new Command();

  program
    .name('yawps')
    .description('⚡ YAWPS - Yet Another Windows PHP Switcher')
    .version('0.1.0');

  // 1. LIST INSTALLED
  program
    .command('list')
    .alias('ls')
    .description('List all installed PHP versions')
    .action(() => {
      const installed = getInstalledVersions();
      const current = getCurrentVersion();

      if (installed.length === 0) {
        console.log(pc.yellow('\nNo PHP versions installed yet.'));
        console.log(`Run ${pc.cyan('yawps install <version>')} to download and install a version.`);
        console.log(`Run ${pc.cyan('yawps list-remote')} to see available versions.\n`);
        return;
      }

      console.log(pc.bold(pc.cyan('\n📦 Installed PHP Versions:\n')));

      const table = new Table({
        head: [pc.bold('Active'), pc.bold('Version'), pc.bold('Type'), pc.bold('Arch'), pc.bold('Directory')],
        colWidths: [8, 12, 10, 8, 48]
      });

      for (const item of installed) {
        const isActive = item.isActive;
        table.push([
          isActive ? pc.green('  ★  ') : '',
          isActive ? pc.bold(pc.green(item.version)) : item.version,
          item.type.toUpperCase(),
          item.arch,
          item.path
        ]);
      }

      console.log(table.toString());

      if (current) {
        console.log(`\nCurrently active: ${pc.bold(pc.green(current.id))}`);
        console.log(`Active Path: ${pc.gray(path.join(CURRENT_LINK, 'php.exe'))}\n`);
      } else {
        console.log(pc.yellow('\nNo version currently active. Run: yawps use <version>\n'));
      }
    });

  // 2. LIST REMOTE
  program
    .command('list-remote')
    .alias('available')
    .description('List available PHP versions from windows.php.net')
    .option('--ts', 'Show Thread-Safe versions instead of NTS')
    .action(async (options) => {
      try {
        console.log(pc.cyan('\n🔍 Fetching latest releases from windows.php.net...\n'));
        const releases = await fetchReleases();
        const type = options.ts ? 'ts' : 'nts';
        const filtered = releases.filter(r => r.type === type && r.arch === 'x64');

        const installed = getInstalledVersions();
        const installedVersions = new Set(installed.map(v => v.version));

        const table = new Table({
          head: [pc.bold('Branch'), pc.bold('Version'), pc.bold('Type'), pc.bold('Size'), pc.bold('Status')],
          colWidths: [10, 14, 10, 12, 16]
        });

        for (const rel of filtered) {
          const isInstalled = installedVersions.has(rel.version);
          table.push([
            rel.branch,
            pc.bold(rel.version),
            rel.type.toUpperCase(),
            rel.size,
            isInstalled ? pc.green('✔ Installed') : pc.gray('Available')
          ]);
        }

        console.log(table.toString());
        console.log(pc.gray(`\nShowing ${type.toUpperCase()} x64 releases. Use --ts for Thread Safe.\n`));
      } catch (err) {
        console.error(pc.red(`Error: ${err.message}`));
      }
    });

  // 3. INSTALL
  program
    .command('install <version>')
    .description('Download, install, and configure a PHP version (e.g. 8.3, 8.4, latest)')
    .option('--ts', 'Install Thread-Safe (TS) build instead of Non-Thread-Safe (NTS)')
    .option('--use', 'Automatically switch to this version after installation', true)
    .option('--no-use', 'Do not switch to this version after installation')
    .action(async (version, options) => {
      try {
        const type = options.ts ? 'ts' : 'nts';
        console.log(pc.bold(pc.cyan(`\n🚀 Preparing to install PHP ${version} (${type.toUpperCase()})...\n`)));

        let lastLine = '';
        const onProgress = (p) => {
          if (p.stage === 'downloading') {
            const barLength = 25;
            const filled = Math.round((p.percent / 100) * barLength);
            const empty = barLength - filled;
            const bar = '█'.repeat(filled) + '░'.repeat(empty);
            const mbDownloaded = (p.receivedBytes / 1024 / 1024).toFixed(1);
            const mbTotal = (p.totalBytes / 1024 / 1024).toFixed(1);
            process.stdout.write(`\r📥 Downloading: [${pc.cyan(bar)}] ${p.percent}% (${mbDownloaded}/${mbTotal} MB)`);
          } else if (p.message && p.message !== lastLine) {
            if (lastLine) console.log('');
            console.log(`⚙ ${pc.yellow(p.message)}`);
            lastLine = p.message;
          }
        };

        const result = await installVersion(version, { type, arch: 'x64' }, onProgress);
        console.log(pc.green(`\n\n✨ Installed successfully to:`));
        console.log(`   ${pc.bold(result.targetDir)}`);

        // Check path
        const pathStatus = checkPathStatus();
        if (!pathStatus.isInUserPath) {
          console.log(pc.yellow('\nℹ Adding YAWPS current directory to your User PATH...'));
          addToUserPath();
          console.log(pc.green('✔ PATH configured!'));
        }

        // Auto use if requested or if it's the only installed version
        const installed = getInstalledVersions();
        if (options.use || installed.length === 1) {
          switchVersion(result.release.id);
          console.log(pc.bold(pc.green(`\n★ Switched active PHP to: ${result.release.id}\n`)));
        }
      } catch (err) {
        console.error(pc.red(`\n❌ Installation failed: ${err.message}\n`));
      }
    });

  // 4. UNINSTALL
  program
    .command('uninstall <version>')
    .alias('remove')
    .alias('rm')
    .description('Uninstall an installed PHP version (e.g. 8.3, 8.4, 8.3.36)')
    .option('-y, --yes', 'Confirm uninstallation without prompting')
    .option('--force', 'Force removal without prompting')
    .option('--clean-cache', 'Also delete matching downloaded .zip archive from cache')
    .option('--no-switch', 'Do not automatically switch active version if uninstalled version was active')
    .action(async (version, options) => {
      try {
        const force = options.yes || options.force;
        if (!force && process.stdin.isTTY) {
          const confirmed = await askConfirmation(pc.yellow(`Are you sure you want to uninstall PHP '${version}'? (y/N) `));
          if (!confirmed) {
            console.log(pc.gray('Operation cancelled.\n'));
            return;
          }
        }

        const result = uninstallVersion(version, {
          cleanCache: options.cleanCache,
          autoSwitch: options.switch !== false
        });

        console.log(pc.bold(pc.green(`\n✔ Uninstalled PHP ${result.target.version} (${result.target.id}) successfully!`)));
        if (result.wasActive) {
          if (result.switchedTo) {
            console.log(pc.bold(pc.cyan(`★ Active PHP automatically switched to: ${result.switchedTo.id}`)));
          } else {
            console.log(pc.yellow('⚠ This was the active version and no other PHP versions are installed. Junction unlinked.'));
          }
        }
        if (result.deletedCacheFiles && result.deletedCacheFiles.length > 0) {
          for (const f of result.deletedCacheFiles) {
            console.log(pc.gray(`🗑 Cleaned cached archive: ${path.basename(f)}`));
          }
        }
        console.log('');
      } catch (err) {
        console.error(pc.red(`\n❌ Uninstall failed: ${err.message}\n`));
      }
    });

  // 4. USE / SWITCH
  program
    .command('use <version>')
    .description('Switch the active PHP version (e.g. 8.3, 8.4, 8.3.36)')
    .action((version) => {
      try {
        const target = switchVersion(version);
        console.log(pc.bold(pc.green(`\n✔ Switched active PHP to: ${target.id}`)));
        console.log(`Path: ${pc.cyan(target.path)}`);

        const pathStatus = checkPathStatus();
        if (pathStatus.isInUserPath) {
          console.log(pc.green('✔ Environment PATH is linked to current version.'));
        } else {
          console.log(pc.yellow('⚠ Note: Run "yawps env fix" to ensure current version is in PATH.'));
        }
        console.log('');
      } catch (err) {
        console.error(pc.red(`\n❌ Switch failed: ${err.message}\n`));
      }
    });

  // 5. CURRENT
  program
    .command('current')
    .description('Show currently active PHP version and run php -v')
    .action(() => {
      const current = getCurrentVersion();
      if (!current) {
        console.log(pc.yellow('\nNo PHP version currently active. Run: yawps use <version>\n'));
        return;
      }

      console.log(pc.bold(pc.green(`\n★ Active Version: ${current.id}`)));
      console.log(`Location: ${pc.cyan(current.path)}`);
      console.log(`Junction: ${pc.cyan(CURRENT_LINK)}\n`);

      // Try running php.exe directly from current link
      const phpExe = path.join(CURRENT_LINK, 'php.exe');
      try {
        const result = spawn('powershell.exe', ['-NoProfile', '-Command', `& "${phpExe}" -v`], {
          stdio: 'inherit'
        });
      } catch (err) {
        console.log(pc.gray(`Could not invoke php.exe: ${err.message}`));
      }
    });

  // 6. UPDATE
  program
    .command('update [version]')
    .description('Check and install latest patch updates for installed PHP versions')
    .action(async (version) => {
      try {
        if (!version) {
          console.log(pc.cyan('\n🔍 Checking for updates across all installed PHP versions...\n'));
          const updates = await checkUpdates();

          if (updates.length === 0) {
            console.log(pc.green('✔ All installed PHP versions are up to date!\n'));
            return;
          }

          console.log(pc.bold(pc.yellow('Updates available:')));
          const table = new Table({
            head: [pc.bold('Installed'), pc.bold('Latest Patch'), pc.bold('Type'), pc.bold('Active')],
            colWidths: [18, 18, 10, 10]
          });

          for (const u of updates) {
            table.push([u.currentVersion, pc.green(u.latestVersion), u.type.toUpperCase(), u.isActive ? '★ Yes' : 'No']);
          }
          console.log(table.toString());
          console.log(pc.gray('\nRun: yawps update <version> to apply an update.\n'));
          return;
        }

        console.log(pc.bold(pc.cyan(`\n🚀 Updating PHP ${version}...`)));
        const onProgress = (p) => {
          if (p.message) console.log(`⚙ ${pc.yellow(p.message)}`);
        };

        const res = await performUpdate(version, onProgress);
        if (res.updated) {
          console.log(pc.bold(pc.green(`\n✔ Updated from ${res.oldVersion} to ${res.newVersion}!`)));
          if (res.switched) {
            console.log(pc.bold(pc.green('★ Automatically updated active environment.\n')));
          }
        }
      } catch (err) {
        console.error(pc.red(`\n❌ Update failed: ${err.message}\n`));
      }
    });

  // 7. EXTENSIONS
  const extCommand = program
    .command('ext')
    .description('Manage PHP extensions (list, enable, disable)');

  extCommand
    .command('list [version]')
    .description('List extensions and enabled status for a PHP version')
    .action((version) => {
      try {
        const exts = getExtensions(version);
        console.log(pc.bold(pc.cyan('\n🧩 PHP Extensions:\n')));

        const table = new Table({
          head: [pc.bold('Status'), pc.bold('Extension'), pc.bold('Category'), pc.bold('DLL File')],
          colWidths: [10, 20, 18, 24]
        });

        for (const ext of exts) {
          table.push([
            ext.enabled ? pc.green('✔ ON') : pc.gray('OFF'),
            ext.enabled ? pc.bold(pc.green(ext.name)) : ext.name,
            ext.category,
            ext.dll
          ]);
        }

        console.log(table.toString());
        console.log(pc.gray('\nToggle extensions via:'));
        console.log(pc.cyan('  yawps ext enable <name>'));
        console.log(pc.cyan('  yawps ext disable <name>'));
        console.log(pc.cyan('  yawps gui  (visual graphical toggle)\n'));
      } catch (err) {
        console.error(pc.red(`\n❌ Error: ${err.message}\n`));
      }
    });

  extCommand
    .command('enable <extension> [version]')
    .description('Enable a PHP extension')
    .action((extension, version) => {
      try {
        setExtensionStatus(version, extension, true);
        console.log(pc.green(`\n✔ Extension '${extension}' enabled successfully in php.ini.\n`));
      } catch (err) {
        console.error(pc.red(`\n❌ Error: ${err.message}\n`));
      }
    });

  extCommand
    .command('disable <extension> [version]')
    .description('Disable a PHP extension')
    .action((extension, version) => {
      try {
        setExtensionStatus(version, extension, false);
        console.log(pc.yellow(`\n✔ Extension '${extension}' disabled in php.ini.\n`));
      } catch (err) {
        console.error(pc.red(`\n❌ Error: ${err.message}\n`));
      }
    });

  // 8. ENVIRONMENT
  const envCommand = program
    .command('env')
    .description('Inspect or configure Windows environment PATH');

  envCommand
    .command('check')
    .description('Check PATH and Windows OS configuration status')
    .action(() => {
      const status = checkPathStatus();
      const osInfo = getWindowsVersionInfo();
      console.log(pc.bold(pc.cyan('\n🌐 Windows & PATH Status:\n')));
      console.log(`Operating System: ${pc.bold(osInfo.osName)} (${osInfo.kernel}) ${osInfo.isSupported ? pc.green('✔ Supported (Windows 10+)') : pc.red('✖ Unsupported')}`);
      console.log(`Current Junction: ${pc.bold(status.currentLink)}`);
      console.log(`In User PATH:     ${status.isInUserPath ? pc.green('✔ Yes') : pc.red('✖ No')}`);
      console.log(`Active 'where php':`);
      if (status.activePhpLocations.length > 0) {
        for (const loc of status.activePhpLocations) {
          const isOurs = loc.toLowerCase().startsWith(status.currentLink.toLowerCase());
          console.log(`  - ${loc} ${isOurs ? pc.green('(managed by YAWPS)') : pc.yellow('(external)')}`);
        }
      } else {
        console.log(pc.gray('  No php.exe detected in PATH.'));
      }
      console.log('');
    });

  envCommand
    .command('fix')
    .description('Add YAWPS current directory to User PATH')
    .action(() => {
      try {
        addToUserPath();
        console.log(pc.green('\n✔ Successfully added to User PATH! New terminals will pick up changes immediately.\n'));
      } catch (err) {
        console.error(pc.red(`\n❌ Failed to update PATH: ${err.message}\n`));
      }
    });

  envCommand
    .command('remove')
    .alias('unlink')
    .description('Remove YAWPS current directory from User PATH and unlink junction')
    .action(() => {
      try {
        const removed = removeEnvironmentPath();
        if (removed) {
          console.log(pc.green('\n✔ Successfully removed YAWPS from User PATH and unlinked junction.\n'));
        } else {
          console.log(pc.yellow('\n⚠ Current directory was not in User PATH.\n'));
        }
      } catch (err) {
        console.error(pc.red(`\n❌ Failed to update PATH: ${err.message}\n`));
      }
    });

  // 9. CACHE
  const cacheCommand = program
    .command('cache')
    .description('Manage downloaded PHP zip archives');

  cacheCommand
    .command('clean [version]')
    .description('Delete downloaded .zip archives from downloads cache')
    .action((version) => {
      try {
        const deleted = cleanCachedArchives(version);
        if (deleted.length === 0) {
          console.log(pc.gray('\nNo matching cached archives found in downloads directory.\n'));
        } else {
          console.log(pc.green(`\n✔ Cleaned ${deleted.length} cached archive(s):`));
          for (const f of deleted) {
            console.log(`  - ${pc.gray(path.basename(f))}`);
          }
          console.log('');
        }
      } catch (err) {
        console.error(pc.red(`\n❌ Cache clean failed: ${err.message}\n`));
      }
    });

  // 10. CLEANUP / UNINSTALL-SELF
  program
    .command('cleanup')
    .alias('uninstall-self')
    .description('Completely decouple PATH, unlink junction, and purge YAWPS data')
    .option('-y, --yes', 'Confirm cleanup without prompting')
    .option('--force', 'Force cleanup without prompting')
    .option('--keep-versions', 'Only unlink PATH and junction without deleting installed PHP versions')
    .action(async (options) => {
      try {
        const force = options.yes || options.force;
        const purgeAll = !options.keepVersions;

        if (!force && process.stdin.isTTY) {
          const warningText = purgeAll
            ? pc.red('⚠ WARNING: This will remove YAWPS from your Windows User PATH and delete all installed PHP versions, downloaded zips, and configuration files.')
            : pc.yellow('This will remove YAWPS from your Windows User PATH and unlink the current directory junction.');
          console.log(`\n${warningText}`);
          const confirmed = await askConfirmation(pc.yellow('Are you sure you want to proceed? (y/N) '));
          if (!confirmed) {
            console.log(pc.gray('Operation cancelled.\n'));
            return;
          }
        }

        const res = fullCleanup({ purgeAll });
        console.log(pc.bold(pc.green('\n✨ YAWPS cleanup completed successfully!')));
        console.log(pc.green('✔ Removed from Windows User PATH.'));
        if (res.baseDirDeleted) {
          console.log(pc.green('✔ Deleted YAWPS data directory.'));
        }
        console.log('');
      } catch (err) {
        console.error(pc.red(`\n❌ Cleanup failed: ${err.message}\n`));
      }
    });

  // 11. GUI / UI
  program
    .command('gui')
    .alias('ui')
    .description('Open the dedicated Desktop Window GUI')
    .action(() => {
      launchGui();
    });

  return program;
}

/**
 * Launch the Desktop Window GUI
 */
function launchGui() {
  const electronPath = require('electron');
  const guiMain = path.join(__dirname, '..', 'gui', 'main.js');

  console.log(pc.cyan('⚡ Launching YAWPS Desktop Window...'));

  const child = spawn(electronPath, [guiMain], {
    detached: true,
    stdio: 'ignore'
  });

  child.unref();
}

module.exports = {
  createCli,
  launchGui
};
