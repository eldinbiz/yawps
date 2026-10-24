package core

import (
	"fmt"
	"os"
	"syscall"
	"unsafe"
)

type WindowsVersionInfo struct {
	IsWindows    bool   `json:"isWindows"`
	IsSupported  bool   `json:"isSupported"`
	Major        uint32 `json:"major"`
	Minor        uint32 `json:"minor"`
	Build        uint32 `json:"build"`
	Kernel       string `json:"kernel"`
	OSName       string `json:"osName"`
	ErrorMessage string `json:"errorMessage"`
}

type osVersionInfoEx struct {
	dwOSVersionInfoSize uint32
	dwMajorVersion      uint32
	dwMinorVersion      uint32
	dwBuildNumber       uint32
	dwPlatformId        uint32
	szCSDVersion        [128]uint16
	wServicePackMajor   uint16
	wServicePackMinor   uint16
	wSuiteMask          uint16
	wProductType        byte
	wReserved           byte
}

var (
	modNtDll         = syscall.NewLazyDLL("ntdll.dll")
	procRtlGetVer    = modNtDll.NewProc("RtlGetVersion")
	modUser32        = syscall.NewLazyDLL("user32.dll")
	procMessageBoxW  = modUser32.NewProc("MessageBoxW")
)

const (
	MB_OK        = 0x00000000
	MB_ICONERROR = 0x00000010
)

func ShowNativeAlert(title, message string) {
	tPtr, _ := syscall.UTF16PtrFromString(title)
	mPtr, _ := syscall.UTF16PtrFromString(message)
	procMessageBoxW.Call(
		0,
		uintptr(unsafe.Pointer(mPtr)),
		uintptr(unsafe.Pointer(tPtr)),
		uintptr(MB_OK|MB_ICONERROR),
	)
}

func GetWindowsVersionInfo() WindowsVersionInfo {
	var info osVersionInfoEx
	info.dwOSVersionInfoSize = uint32(unsafe.Sizeof(info))

	ret, _, _ := procRtlGetVer.Call(uintptr(unsafe.Pointer(&info)))
	major := info.dwMajorVersion
	minor := info.dwMinorVersion
	build := info.dwBuildNumber

	if ret != 0 {
		// Fallback defaults
		major = 10
		minor = 0
		build = 19045
	}

	kernel := fmt.Sprintf("%d.%d.%d", major, minor, build)
	osName := "Windows"

	if major == 10 {
		if build >= 22000 {
			osName = "Windows 11"
		} else {
			osName = "Windows 10"
		}
	} else if major == 6 && minor == 3 {
		osName = "Windows 8.1"
	} else if major == 6 && minor == 2 {
		osName = "Windows 8"
	} else if major == 6 && minor == 1 {
		osName = "Windows 7"
	} else if major == 6 && minor == 0 {
		osName = "Windows Vista"
	} else if major < 6 {
		osName = "Windows XP or older"
	}

	isSupported := major >= 10
	var errMsg string
	if !isSupported {
		errMsg = fmt.Sprintf("YAWPS requires Windows 10 or Windows 11.\n\nDetected operating system: %s (NT kernel %s).\n\nWindows versions below 10 (such as Windows 7, 8, and 8.1) are not supported. Modern PHP runtimes, NTFS directory junctions, and system APIs require Windows 10 or later. Please upgrade to Windows 10 or 11.", osName, kernel)
	}

	return WindowsVersionInfo{
		IsWindows:    true,
		IsSupported:  isSupported,
		Major:        major,
		Minor:        minor,
		Build:        build,
		Kernel:       kernel,
		OSName:       osName,
		ErrorMessage: errMsg,
	}
}

func AssertWindows10OrAbove(isGui bool) bool {
	info := GetWindowsVersionInfo()
	if info.IsSupported {
		return true
	}

	if isGui {
		ShowNativeAlert("YAWPS - Unsupported Windows Version", info.ErrorMessage)
	}

	fmt.Fprintln(os.Stderr, "\n======================================================================")
	fmt.Fprintln(os.Stderr, " ❌ UNSUPPORTED OPERATING SYSTEM")
	fmt.Fprintln(os.Stderr, "======================================================================")
	fmt.Fprintln(os.Stderr, info.ErrorMessage)
	fmt.Fprintln(os.Stderr, "======================================================================")
	fmt.Fprintln(os.Stderr, "")

	os.Exit(1)
	return false
}
