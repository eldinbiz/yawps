#!/usr/bin/env bash
# ==============================================================================
# YAWPS Portable Build Script (Git Bash)
# Zero UAC / No Administrator Rights / No System Install Required
# ==============================================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Resolve Windows path representation for Go and Wails tools
if command -v cygpath >/dev/null 2>&1; then
    WIN_ROOT="$(cygpath -w "$SCRIPT_DIR")"
else
    WIN_ROOT="$(pwd -W 2>/dev/null || pwd)"
fi

echo "=========================================================="
echo "   YAWPS Portable Build (Zero UAC / Portable Go & Wails)   "
echo "=========================================================="

mkdir -p "$SCRIPT_DIR/.tools"

# ------------------------------------------------------------------------------
# 1. Locate Portable Go (.tools/go)
# ------------------------------------------------------------------------------
GO_BIN=""
GOROOT_DIR=""

if [ -f "$SCRIPT_DIR/.tools/go/bin/go.exe" ]; then
    GOROOT_DIR="$WIN_ROOT\\.tools\\go"
    GO_BIN="$SCRIPT_DIR/.tools/go/bin/go.exe"
elif [ -f "$SCRIPT_DIR/.tools/go/go/bin/go.exe" ]; then
    GOROOT_DIR="$WIN_ROOT\\.tools\\go\\go"
    GO_BIN="$SCRIPT_DIR/.tools/go/go/bin/go.exe"
fi

if [ -z "$GO_BIN" ]; then
    echo "[-] ERROR: Portable Go was not found in .tools/go/ !"
    echo "    Please download the official 64-bit Windows Go zip from:"
    echo "    https://go.dev/dl/ (e.g. go1.22.x.windows-amd64.zip)"
    echo "    and extract it into the '.tools/go' folder."
    exit 1
fi

echo "[+] Using Portable Go: $GO_BIN"
export GOROOT="$GOROOT_DIR"
export PATH="$(dirname "$GO_BIN"):$PATH"

# ------------------------------------------------------------------------------
# 2. Locate Portable Wails (.tools/wails)
# ------------------------------------------------------------------------------
WAILS_BIN=""
WAILS_DIR="$WIN_ROOT\\.tools\\wails"

if [ -f "$SCRIPT_DIR/.tools/wails/bin/wails.exe" ]; then
    WAILS_BIN="$SCRIPT_DIR/.tools/wails/bin/wails.exe"
elif [ -f "$SCRIPT_DIR/.tools/wails/wails.exe" ]; then
    WAILS_BIN="$SCRIPT_DIR/.tools/wails/wails.exe"
fi

if [ -z "$WAILS_BIN" ]; then
    echo "[!] Portable Wails CLI not found in .tools/wails/."
    echo "[*] Compiling Wails CLI locally using portable Go (zero UAC)..."
    export GOPATH="$WAILS_DIR"
    "$GO_BIN" install github.com/wailsapp/wails/v2/cmd/wails@v2.17.0
    if [ -f "$SCRIPT_DIR/.tools/wails/bin/wails.exe" ]; then
        WAILS_BIN="$SCRIPT_DIR/.tools/wails/bin/wails.exe"
        echo "[+] Successfully built portable Wails: $WAILS_BIN"
    else
        echo "[-] ERROR: Failed to compile Wails CLI. You may place pre-built wails.exe into .tools/wails/bin/."
        exit 1
    fi
else
    echo "[+] Using Portable Wails: $WAILS_BIN"
fi

export PATH="$(dirname "$WAILS_BIN"):$PATH"

# ------------------------------------------------------------------------------
# 3. Execute Wails Build
# ------------------------------------------------------------------------------
echo "[*] Building YAWPS desktop executable (windows/amd64)..."
"$WAILS_BIN" build -platform windows/amd64 "$@"

# ------------------------------------------------------------------------------
# 4. Copy Output Binary to dist/
# ------------------------------------------------------------------------------
if [ -f "$SCRIPT_DIR/build/bin/yawps.exe" ]; then
    mkdir -p "$SCRIPT_DIR/dist"
    cp -f "$SCRIPT_DIR/build/bin/yawps.exe" "$SCRIPT_DIR/dist/yawps.exe"
    echo "=========================================================="
    echo "[+] Build Successful!"
    echo "    Output executable: dist/yawps.exe"
    echo "=========================================================="
else
    echo "[-] ERROR: Build finished but build/bin/yawps.exe was not found."
    exit 1
fi
