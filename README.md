# YAWPS - Yet Another Windows PHP Switcher

A fast, lightweight, and portable Windows desktop application and CLI tool to download, manage, and switch between multiple PHP versions with zero UAC elevation.

---

## ⚡ Main Capabilities

- **Automatic Download & Setup**: Downloads official precompiled Windows binaries (PHP 7.4 through PHP 8.5+) directly from [windows.php.net](https://windows.php.net/downloads/releases/) with SHA256 checksum verification.
- **Instant Version Switching**: Switches active PHP versions atomically using NTFS directory junctions (`%USERPROFILE%\.yawps\current`) with no restart or administrator rights needed.
- **Extension & Directive Management**: Easily toggle common extensions (`curl`, `mbstring`, `openssl`, `xdebug`, `opcache`, etc.) and adjust `php.ini` directives graphically or via CLI.
- **Dual Interface**: Run as a modern Windows 11 Fluent desktop app or as a command-line tool in PowerShell / CMD.
- **One-Click Patch Updates**: Detect and upgrade installed versions to newer official patch releases while preserving custom configuration.

---

## 📋 Requirements to Run

- **Operating System**: Windows 10 or Windows 11 (64-bit)
- **Runtime**: Microsoft Edge WebView2 (included by default on Windows 10 & 11)
- **Permissions**: Standard user permissions (**no** UAC elevation or Administrator rights required)

---

## 🛠️ How to Compile to Executable

### Prerequisites
1. [Go](https://go.dev/dl/) 1.21 or later
2. [Node.js](https://nodejs.org/) 18+ and npm
3. [Wails v2 CLI](https://wails.io/):
   ```powershell
   go install github.com/wailsapp/wails/v2/cmd/wails@latest
   ```

### Compile
Run the build command from the project root directory:

```powershell
# Compile using Wails
wails build

# Or compile via npm script
npm run build:wails
```

The resulting standalone executable will be generated at:
```
build\bin\yawps.exe
```
