package core

import (
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"sort"
	"strings"
	"syscall"
	"unsafe"

	"golang.org/x/sys/windows/registry"
)

type VersionInfo struct {
	ID       string `json:"id"`
	Path     string `json:"path"`
	Version  string `json:"version"`
	Type     string `json:"type"`
	Arch     string `json:"arch"`
	IsActive bool   `json:"isActive"`
	PhpExe   string `json:"phpExe"`
	PhpIni   string `json:"phpIni"`
}

type PathStatus struct {
	CurrentLink        string   `json:"currentLink"`
	IsInUserPath       bool     `json:"isInUserPath"`
	ActivePhpLocations []string `json:"activePhpLocations"`
	IsPrimary          bool     `json:"isPrimary"`
}

var versionDirRegex = regexp.MustCompile(`(?i)^php-(\d+\.\d+\.\d+)(?:-(nts|ts))?(?:-(x64|x86))?`)

func GetCurrentVersion() *VersionInfo {
	_ = EnsureDirectories()
	curLink := GetCurrentLink()

	fi, err := os.Lstat(curLink)
	if err != nil {
		return nil
	}

	// Check if symlink or junction
	if fi.Mode()&os.ModeSymlink == 0 && fi.Mode()&os.ModeIrregular == 0 && !fi.IsDir() {
		return nil
	}

	target, err := os.Readlink(curLink)
	if err != nil {
		return nil
	}

	if !filepath.IsAbs(target) {
		target = filepath.Join(filepath.Dir(curLink), target)
	}

	id := filepath.Base(target)
	matches := versionDirRegex.FindStringSubmatch(id)

	ver := id
	relType := "nts"
	arch := "x64"

	if len(matches) > 1 && matches[1] != "" {
		ver = matches[1]
	}
	if len(matches) > 2 && matches[2] != "" {
		relType = strings.ToLower(matches[2])
	}
	if len(matches) > 3 && matches[3] != "" {
		arch = strings.ToLower(matches[3])
	}

	return &VersionInfo{
		ID:       id,
		Path:     target,
		Version:  ver,
		Type:     relType,
		Arch:     arch,
		IsActive: true,
		PhpExe:   filepath.Join(target, "php.exe"),
		PhpIni:   filepath.Join(target, "php.ini"),
	}
}

func GetInstalledVersions() []VersionInfo {
	_ = EnsureDirectories()
	vDir := GetVersionsDir()
	cur := GetCurrentVersion()

	entries, err := os.ReadDir(vDir)
	if err != nil {
		return []VersionInfo{}
	}

	list := make([]VersionInfo, 0)
	for _, entry := range entries {
		if !entry.IsDir() {
			continue
		}

		dirPath := filepath.Join(vDir, entry.Name())
		phpExe := filepath.Join(dirPath, "php.exe")
		if _, err := os.Stat(phpExe); os.IsNotExist(err) {
			continue
		}

		matches := versionDirRegex.FindStringSubmatch(entry.Name())
		ver := entry.Name()
		relType := "nts"
		arch := "x64"

		if len(matches) > 1 && matches[1] != "" {
			ver = matches[1]
		}
		if len(matches) > 2 && matches[2] != "" {
			relType = strings.ToLower(matches[2])
		}
		if len(matches) > 3 && matches[3] != "" {
			arch = strings.ToLower(matches[3])
		}

		isActive := cur != nil && strings.EqualFold(cur.ID, entry.Name())

		list = append(list, VersionInfo{
			ID:       entry.Name(),
			Path:     dirPath,
			Version:  ver,
			Type:     relType,
			Arch:     arch,
			IsActive: isActive,
			PhpExe:   phpExe,
			PhpIni:   filepath.Join(dirPath, "php.ini"),
		})
	}

	sort.Slice(list, func(i, j int) bool {
		return CompareVersions(list[i].Version, list[j].Version) > 0
	})

	return list
}

func SwitchVersion(query string) (*VersionInfo, error) {
	_ = EnsureDirectories()
	installed := GetInstalledVersions()
	if len(installed) == 0 {
		return nil, fmt.Errorf("no PHP versions installed yet. Install one using: win-php install <version>")
	}

	cleanQuery := strings.ToLower(strings.TrimPrefix(query, "php-"))
	var target *VersionInfo

	if cleanQuery == "" {
		target = &installed[0]
	} else {
		// 1. Exact ID
		for _, v := range installed {
			if strings.EqualFold(v.ID, query) {
				target = &v
				break
			}
		}
		// 2. Exact Version
		if target == nil {
			for _, v := range installed {
				if strings.EqualFold(v.Version, cleanQuery) {
					target = &v
					break
				}
			}
		}
		// 3. Prefix match
		if target == nil {
			for _, v := range installed {
				if strings.HasPrefix(v.Version, cleanQuery) {
					target = &v
					break
				}
			}
		}
	}

	if target == nil {
		return nil, fmt.Errorf("PHP version '%s' is not installed", query)
	}

	curLink := GetCurrentLink()
	// Remove existing junction/symlink
	if _, err := os.Lstat(curLink); err == nil {
		// Use cmd /c rmdir for directory junction removal
		cmd := exec.Command("cmd.exe", "/c", "rmdir", curLink)
		_ = cmd.Run()
		_ = os.Remove(curLink)
	}

	// Create junction via mklink /J
	cmd := exec.Command("cmd.exe", "/c", "mklink", "/J", curLink, target.Path)
	if out, err := cmd.CombinedOutput(); err != nil {
		return nil, fmt.Errorf("failed to create directory junction: %s (%w)", string(out), err)
	}

	// Ensure in user path
	status := CheckPathStatus()
	if !status.IsInUserPath {
		_ = AddToUserPath()
	}

	target.IsActive = true
	return target, nil
}

func CheckPathStatus() PathStatus {
	curLink := GetCurrentLink()
	normLink := strings.ToLower(filepath.Clean(curLink))

	k, err := registry.OpenKey(registry.CURRENT_USER, `Environment`, registry.QUERY_VALUE)
	var userPath string
	if err == nil {
		userPath, _, _ = k.GetStringValue("Path")
		k.Close()
	}

	parts := strings.Split(userPath, ";")
	isInPath := false
	for _, p := range parts {
		if strings.ToLower(strings.TrimSpace(p)) == normLink {
			isInPath = true
			break
		}
	}

	// Scan PATH environment variable for all php.exe occurrences in order
	pathEnv := os.Getenv("PATH")
	var locations []string
	isPrimary := false

	for _, dir := range strings.Split(pathEnv, ";") {
		trimmed := strings.TrimSpace(dir)
		if trimmed == "" {
			continue
		}
		candidate := filepath.Join(trimmed, "php.exe")
		if fi, err := os.Stat(candidate); err == nil && !fi.IsDir() {
			alreadyFound := false
			for _, loc := range locations {
				if strings.EqualFold(loc, candidate) {
					alreadyFound = true
					break
				}
			}
			if !alreadyFound {
				locations = append(locations, candidate)
			}
		}
	}

	if len(locations) > 0 && strings.HasPrefix(strings.ToLower(locations[0]), normLink) {
		isPrimary = true
	}

	return PathStatus{
		CurrentLink:        curLink,
		IsInUserPath:       isInPath,
		ActivePhpLocations: locations,
		IsPrimary:          isPrimary,
	}
}

func broadcastSettingChange() {
	user32 := syscall.NewLazyDLL("user32.dll")
	sendMsg := user32.NewProc("SendMessageTimeoutW")
	envStr, _ := syscall.UTF16PtrFromString("Environment")
	sendMsg.Call(
		0xffff, // HWND_BROADCAST
		0x001a, // WM_SETTINGCHANGE
		0,
		uintptr(unsafe.Pointer(envStr)),
		0x0002, // SMTO_ABORTIFHUNG
		5000,
		0,
	)
}

func IsDirectoryInUserPath(targetDir string) bool {
	if strings.TrimSpace(targetDir) == "" {
		return false
	}
	normTarget := strings.ToLower(filepath.Clean(targetDir))
	k, err := registry.OpenKey(registry.CURRENT_USER, `Environment`, registry.QUERY_VALUE)
	if err != nil {
		return false
	}
	defer k.Close()

	userPath, _, _ := k.GetStringValue("Path")
	parts := strings.Split(userPath, ";")
	for _, p := range parts {
		trimmed := strings.TrimSpace(p)
		if trimmed != "" && strings.ToLower(filepath.Clean(trimmed)) == normTarget {
			return true
		}
	}
	return false
}

func AddDirectoryToUserPath(targetDir string) error {
	if strings.TrimSpace(targetDir) == "" {
		return nil
	}
	normTarget := strings.ToLower(filepath.Clean(targetDir))

	k, err := registry.OpenKey(registry.CURRENT_USER, `Environment`, registry.READ|registry.WRITE)
	if err != nil {
		return err
	}
	defer k.Close()

	userPath, _, _ := k.GetStringValue("Path")
	parts := strings.Split(userPath, ";")
	var cleaned []string
	for _, p := range parts {
		trimmed := strings.TrimSpace(p)
		if trimmed != "" && strings.ToLower(filepath.Clean(trimmed)) != normTarget {
			cleaned = append(cleaned, trimmed)
		}
	}

	newParts := append([]string{targetDir}, cleaned...)
	newPath := strings.Join(newParts, ";")

	if err := k.SetStringValue("Path", newPath); err != nil {
		return err
	}

	broadcastSettingChange()
	return nil
}

func RemoveDirectoryFromUserPath(targetDir string) error {
	if strings.TrimSpace(targetDir) == "" {
		return nil
	}
	normTarget := strings.ToLower(filepath.Clean(targetDir))

	k, err := registry.OpenKey(registry.CURRENT_USER, `Environment`, registry.READ|registry.WRITE)
	if err != nil {
		return err
	}
	defer k.Close()

	userPath, _, _ := k.GetStringValue("Path")
	parts := strings.Split(userPath, ";")
	var cleaned []string
	for _, p := range parts {
		trimmed := strings.TrimSpace(p)
		if trimmed != "" && strings.ToLower(filepath.Clean(trimmed)) != normTarget {
			cleaned = append(cleaned, trimmed)
		}
	}

	newPath := strings.Join(cleaned, ";")
	if err := k.SetStringValue("Path", newPath); err != nil {
		return err
	}

	broadcastSettingChange()
	return nil
}

func AddToUserPath() error {
	return AddDirectoryToUserPath(GetCurrentLink())
}

func RemoveFromUserPath() error {
	return RemoveDirectoryFromUserPath(GetCurrentLink())
}
