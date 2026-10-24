package main

import (
	"embed"
	"io/fs"
	"os"
	"syscall"
	"yawps/pkg/cli"
	"yawps/pkg/core"

	"github.com/wailsapp/wails/v2"
	"github.com/wailsapp/wails/v2/pkg/options"
	"github.com/wailsapp/wails/v2/pkg/options/assetserver"
	"github.com/wailsapp/wails/v2/pkg/options/windows"
)

//go:embed all:src/gui/renderer
var rawAssets embed.FS

func attachParentConsole() {
	hStdout, _ := syscall.GetStdHandle(syscall.STD_OUTPUT_HANDLE)
	hStderr, _ := syscall.GetStdHandle(syscall.STD_ERROR_HANDLE)

	fileType, _ := syscall.GetFileType(hStdout)

	if fileType != syscall.FILE_TYPE_UNKNOWN && hStdout != 0 && hStdout != syscall.InvalidHandle {
		os.Stdout = os.NewFile(uintptr(hStdout), "/dev/stdout")
		if hStderr != 0 && hStderr != syscall.InvalidHandle {
			os.Stderr = os.NewFile(uintptr(hStderr), "/dev/stderr")
		}
		return
	}

	kernel32 := syscall.NewLazyDLL("kernel32.dll")
	attachConsole := kernel32.NewProc("AttachConsole")
	r, _, _ := attachConsole.Call(^uintptr(0)) // -1 = ATTACH_PARENT_PROCESS
	if r != 0 {
		if stdout, err := os.OpenFile("CONOUT$", os.O_WRONLY, 0); err == nil {
			os.Stdout = stdout
		}
		if stderr, err := os.OpenFile("CONOUT$", os.O_WRONLY, 0); err == nil {
			os.Stderr = stderr
		}
	}
}

func main() {
	args := os.Args[1:]
	isGui := len(args) == 0 || (len(args) > 0 && (args[0] == "gui" || args[0] == "ui"))

	if !isGui {
		attachParentConsole()
	}

	// 1. Verify Windows 10+
	core.AssertWindows10OrAbove(isGui)

	// 2. Handle CLI commands if non-GUI arguments are provided
	if !isGui {
		if cli.Run(args) {
			return
		}
	}

	// 3. Launch Wails GUI Desktop Window
	app := NewApp()

	assets, err := fs.Sub(rawAssets, "src/gui/renderer")
	if err != nil {
		println("Error preparing web assets:", err.Error())
		return
	}

	err = wails.Run(&options.App{
		Title:     "YAWPS - Yet Another Windows PHP Switcher",
		Width:     1100,
		Height:    780,
		MinWidth:  900,
		MinHeight: 640,
		AssetServer: &assetserver.Options{
			Assets: assets,
		},
		BackgroundColour: &options.RGBA{R: 15, G: 23, B: 42, A: 1}, // #0f172a
		OnStartup:        app.startup,
		Bind: []interface{}{
			app,
		},
		Windows: &windows.Options{
			WebviewIsTransparent: false,
			WindowIsTranslucent:  false,
			DisableWindowIcon:    false,
		},
	})

	if err != nil {
		println("Error:", err.Error())
	}
}
