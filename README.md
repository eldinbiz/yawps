# YAWPS - Yet Another Windows PHP Switcher

A fast, lightweight, and portable Windows desktop application and CLI tool to download, manage, and switch between multiple PHP versions with zero UAC elevation.

---

## ⚡ Main Capabilities

- **Automatic Download & Setup**: Downloads official precompiled Windows binaries (PHP 7.4 through PHP 8.5+) directly from [windows.php.net](https://windows.php.net/downloads/releases/) with SHA256 checksum verification.
- **Instant Version Switching**: Switches active PHP versions atomically using NTFS directory junctions (`%USERPROFILE%\.yawps\current`) with no restart or administrator rights needed.
- **Extension & Directive Management**: Easily toggle common extensions (`curl`, `mbstring`, `openssl`, `xdebug`, `opcache`, etc.) and adjust `php.ini` directives graphically or via CLI.
- **Composer Dependency Manager**: Check if Composer is installed and up to date, 1-click install/update official Composer, graphically manage globally installed PHP packages (Laravel Installer, Pest, PHPStan, PHPUnit, Rector, etc.), and cleanly uninstall with cache and PATH purging.
- **Dual Interface**: Run as a modern Windows 11 Fluent desktop app or as a command-line tool in Git Bash / CMD / PowerShell.
- **One-Click Patch Updates**: Detect and upgrade installed versions to newer official patch releases while preserving custom configuration.

---

## 📋 Requirements to Run

- **Operating System**: Windows 10 or Windows 11 (64-bit)
- **Runtime**: Microsoft Edge WebView2 (included by default on Windows 10 & 11)
- **Shell**: Git Bash *(optional, recommended for development and portable builds)*, Command Prompt (CMD), or PowerShell
- **Permissions**: Standard user permissions (**no** UAC elevation or Administrator rights required)

---

## 🛠️ How to Compile to Executable

### Method 1: Portable Build (Zero UAC & No Installation Required — Recommended)

Ideal for developer workstations with restricted permissions where installing software or running PowerShell scripts is blocked:

1. **Extract Portable Go**:
   - Download the official 64-bit Windows Go `.zip` archive from [go.dev/dl](https://go.dev/dl/) (e.g. `go1.22.x.windows-amd64.zip` or newer).
   - Extract the contents into the `.tools/go/` folder so that `.tools/go/bin/go.exe` (or `.tools/go/go/bin/go.exe`) is present.

2. **Run the Portable Build Script**:
   - **Git Bash** *(Primary)*:
     ```bash
     ./build.sh
     ```
   - **Command Prompt (CMD)** *(Fallback)*:
     ```cmd
     build.cmd
     ```
   - *Optional UPX compression:*
     ```bash
     ./build.sh -upx
     ```

> [!NOTE]
> If `.tools/wails/` does not already contain `wails.exe`, the build script will automatically use your portable Go to compile the Wails CLI directly into `.tools/wails/bin/wails.exe` with zero admin privileges. You can also manually drop a pre-compiled `wails.exe` into that folder.

---

### Method 2: Global System Build (If Go & Wails are installed)

If Go and Wails CLI are already installed globally on your machine:

```bash
# Compile using Wails CLI
wails build

# Or compile via npm script
npm run build:wails
```

The resulting standalone executable will be generated at:
```
dist\yawps.exe
(also at build\bin\yawps.exe)
```
