package core

import (
	"bufio"
	"context"
	"crypto/tls"
	"encoding/json"
	"fmt"
	"io"
	"net"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"strconv"
	"strings"
	"sync"
	"time"
)

type ComposerStatus struct {
	Installed         bool     `json:"installed"`
	Version           string   `json:"version"`
	ReleaseDate       string   `json:"releaseDate"`
	Location          string   `json:"location"`
	PharPath          string   `json:"pharPath"`
	IsYawpsManaged    bool     `json:"isYawpsManaged"`
	LatestVersion     string   `json:"latestVersion"`
	IsUpToDate        bool     `json:"isUpToDate"`
	ActivePhp         string   `json:"activePhp"`
	ActivePhpPath     string   `json:"activePhpPath"`
	ComposerHome      string   `json:"composerHome"`
	GlobalBinDir      string   `json:"globalBinDir"`
	IsBinInPath       bool     `json:"isBinInPath"`
	IsGlobalBinInPath bool     `json:"isGlobalBinInPath"`
	PackagesCount     int      `json:"packagesCount"`
}

type ComposerGlobalPackage struct {
	Name        string   `json:"name"`
	Version     string   `json:"version"`
	Constraint  string   `json:"constraint"`
	Description string   `json:"description"`
	Homepage    string   `json:"homepage"`
	License     []string `json:"license"`
	Binaries    []string `json:"binaries"`
	Time        string   `json:"time"`
	IsOutdated  bool     `json:"isOutdated"`
	Latest      string   `json:"latest"`
}

type ComposerOperationResult struct {
	Success bool   `json:"success"`
	Output  string `json:"output"`
	Error   string `json:"error,omitempty"`
}

type ComposerUninstallOptions struct {
	RemoveBin               bool `json:"removeBin"`
	RemoveFromPath          bool `json:"removeFromPath"`
	CleanCache              bool `json:"cleanCache"`
	PurgePackages           bool `json:"purgePackages"`
	RemoveGlobalBinFromPath bool `json:"removeGlobalBinFromPath"`
}

type ComposerUninstallResult struct {
	Success              bool     `json:"success"`
	ExecutablesDeleted   bool     `json:"executablesDeleted"`
	PathCleaned          bool     `json:"pathCleaned"`
	CacheDeleted         bool     `json:"cacheDeleted"`
	PackagesPurged       bool     `json:"packagesPurged"`
	GlobalBinPathRemoved bool     `json:"globalBinPathRemoved"`
	DeletedPaths         []string `json:"deletedPaths"`
	Message              string   `json:"message"`
}

// GetComposerHome resolves the home directory where global packages and config are stored
func GetComposerHome() string {
	if custom := os.Getenv("COMPOSER_HOME"); custom != "" {
		return filepath.Clean(custom)
	}

	userProfile := os.Getenv("USERPROFILE")
	if userProfile == "" {
		home, _ := os.UserHomeDir()
		userProfile = home
	}

	dotComposer := filepath.Join(userProfile, ".composer")
	appdataComposer := filepath.Join(os.Getenv("APPDATA"), "Composer")

	// If .composer has composer.json or composer.lock, or already exists, prefer it
	if fi, err := os.Stat(dotComposer); err == nil && fi.IsDir() {
		return dotComposer
	}

	// If %APPDATA%\Composer exists
	if os.Getenv("APPDATA") != "" {
		if fi, err := os.Stat(appdataComposer); err == nil && fi.IsDir() {
			return appdataComposer
		}
	}

	return dotComposer
}

// GetComposerGlobalBinDir returns the global bin directory
func GetComposerGlobalBinDir() string {
	return filepath.Join(GetComposerHome(), "vendor", "bin")
}

// FindComposerExecutable locates composer.bat and composer.phar
func FindComposerExecutable() (composerBat string, composerPhar string, isYawpsManaged bool) {
	// 1. Check YAWPS managed location
	yawpsBin := GetBinDir()
	yawpsPhar := filepath.Join(yawpsBin, "composer.phar")
	yawpsBat := filepath.Join(yawpsBin, "composer.bat")

	if _, err := os.Stat(yawpsPhar); err == nil {
		composerPhar = yawpsPhar
		if _, err := os.Stat(yawpsBat); err == nil {
			composerBat = yawpsBat
		}
		return composerBat, composerPhar, true
	}

	// 2. Check if composer is in PATH
	if path, err := exec.LookPath("composer.bat"); err == nil {
		composerBat = path
		pharCandidate := filepath.Join(filepath.Dir(path), "composer.phar")
		if _, err := os.Stat(pharCandidate); err == nil {
			composerPhar = pharCandidate
		}
		return composerBat, composerPhar, false
	}

	if path, err := exec.LookPath("composer"); err == nil {
		composerBat = path
		pharCandidate := filepath.Join(filepath.Dir(path), "composer.phar")
		if _, err := os.Stat(pharCandidate); err == nil {
			composerPhar = pharCandidate
		}
		return composerBat, composerPhar, false
	}

	// 3. Check known standard Windows locations
	candidates := []string{
		`C:\ProgramData\ComposerSetup\bin\composer.bat`,
		filepath.Join(os.Getenv("APPDATA"), "Composer", "vendor", "bin", "composer.bat"),
		filepath.Join(os.Getenv("USERPROFILE"), "scoop", "shims", "composer.exe"),
		`C:\ProgramData\chocolatey\bin\composer.bat`,
	}

	for _, cand := range candidates {
		if fi, err := os.Stat(cand); err == nil && !fi.IsDir() {
			composerBat = cand
			pharCandidate := filepath.Join(filepath.Dir(cand), "composer.phar")
			if _, err := os.Stat(pharCandidate); err == nil {
				composerPhar = pharCandidate
			}
			return composerBat, composerPhar, false
		}
	}

	return "", "", false
}

// FetchLatestComposerVersion fetches the latest stable Composer version metadata from getcomposer.org
func FetchLatestComposerVersion() (string, string, error) {
	dialer := &net.Dialer{
		Timeout:   3 * time.Second,
		KeepAlive: 30 * time.Second,
	}

	transport := &http.Transport{
		DialContext: func(ctx context.Context, network, addr string) (net.Conn, error) {
			// Enforce IPv4 to avoid IPv6 hang on Windows systems without active IPv6 routes
			return dialer.DialContext(ctx, "tcp4", addr)
		},
		TLSNextProto:          make(map[string]func(authority string, c *tls.Conn) http.RoundTripper),
		ResponseHeaderTimeout: 3 * time.Second,
	}

	client := &http.Client{
		Transport: transport,
		Timeout:   4 * time.Second,
	}

	req, err := http.NewRequest("GET", "https://getcomposer.org/versions", nil)
	if err != nil {
		return "", "", err
	}
	req.Header.Set("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) YAWPS/1.0")

	resp, err := client.Do(req)
	if err != nil {
		return "", "", err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return "", "", fmt.Errorf("HTTP error %d", resp.StatusCode)
	}

	var data struct {
		Stable []struct {
			Version string `json:"version"`
			Path    string `json:"path"`
		} `json:"stable"`
	}

	if err := json.NewDecoder(resp.Body).Decode(&data); err != nil {
		return "", "", err
	}

	if len(data.Stable) > 0 {
		return data.Stable[0].Version, data.Stable[0].Path, nil
	}

	return "", "", fmt.Errorf("no stable releases found")
}

// compareVersions compares two semver strings: returns 1 if v1 > v2, -1 if v1 < v2, 0 if v1 == v2
func compareVersions(v1, v2 string) int {
	clean := func(v string) []int {
		v = strings.TrimPrefix(strings.TrimSpace(v), "v")
		parts := strings.Split(v, "-")[0]
		nums := []int{}
		for _, seg := range strings.Split(parts, ".") {
			n, _ := strconv.Atoi(seg)
			nums = append(nums, n)
		}
		for len(nums) < 3 {
			nums = append(nums, 0)
		}
		return nums
	}

	nums1 := clean(v1)
	nums2 := clean(v2)

	for i := 0; i < len(nums1) && i < len(nums2); i++ {
		if nums1[i] > nums2[i] {
			return 1
		}
		if nums1[i] < nums2[i] {
			return -1
		}
	}
	return 0
}

var (
	ansiRegex            = regexp.MustCompile(`\[[0-9;]*[a-zA-Z]`)
	composerVersionRegex = regexp.MustCompile(`(?i)Composer (?:version )?([0-9]+\.[0-9]+(?:\.[0-9]+)?(?:-[a-zA-Z0-9.]+)?)(?: \(([^\)]+)\))? ([0-9]{4}-[0-9]{2}-[0-9]{2})?`)
)

// GetComposerStatus returns current full status of Composer on the machine
func GetComposerStatus() (*ComposerStatus, error) {
	_ = EnsureDirectories()

	composerBat, composerPhar, isYawpsManaged := FindComposerExecutable()
	isInstalled := composerBat != "" || composerPhar != ""

	composerHome := GetComposerHome()
	globalBinDir := GetComposerGlobalBinDir()
	isBinInPath := IsDirectoryInUserPath(GetBinDir())
	isGlobalBinInPath := IsDirectoryInUserPath(globalBinDir)

	activePhp := ""
	activePhpPath := ""
	cur := GetCurrentVersion()
	if cur != nil {
		activePhp = fmt.Sprintf("PHP %s (%s %s)", cur.Version, strings.ToUpper(cur.Type), cur.Arch)
		activePhpPath = cur.PhpExe
	}

	var version string
	var releaseDate string
	var latestVersion string

	var wg sync.WaitGroup

	// 1. Fetch latest version online in parallel
	wg.Add(1)
	go func() {
		defer wg.Done()
		if lv, _, err := FetchLatestComposerVersion(); err == nil {
			latestVersion = lv
		}
	}()

	// 2. Extract local Composer version in parallel
	if isInstalled {
		wg.Add(1)
		go func() {
			defer wg.Done()
			var cmd *exec.Cmd
			if cur != nil && cur.PhpExe != "" && composerPhar != "" {
				cmd = exec.Command(cur.PhpExe, composerPhar, "--version", "--no-ansi")
			} else if composerBat != "" {
				cmd = exec.Command("cmd.exe", "/c", composerBat, "--version", "--no-ansi")
			}

			if cmd != nil {
				cmd.Env = os.Environ()
				cmd.Env = append(cmd.Env, "PATH="+GetCurrentLink()+";"+GetBinDir()+";"+os.Getenv("PATH"))
				if out, err := cmd.Output(); err == nil {
					cleanOut := ansiRegex.ReplaceAllString(string(out), "")
					matches := composerVersionRegex.FindStringSubmatch(cleanOut)
					if len(matches) > 1 {
						version = matches[1]
					}
					if len(matches) > 3 && matches[3] != "" {
						releaseDate = matches[3]
					}
				}
			}
		}()
	}

	wg.Wait()

	isUpToDate := false
	if isInstalled && version != "" && latestVersion != "" {
		isUpToDate = compareVersions(version, latestVersion) >= 0
	}

	packages, _ := GetComposerGlobalPackages()

	status := &ComposerStatus{
		Installed:         isInstalled,
		Version:           version,
		ReleaseDate:       releaseDate,
		Location:          composerBat,
		PharPath:          composerPhar,
		IsYawpsManaged:    isYawpsManaged,
		LatestVersion:     latestVersion,
		IsUpToDate:        isUpToDate,
		ActivePhp:         activePhp,
		ActivePhpPath:     activePhpPath,
		ComposerHome:      composerHome,
		GlobalBinDir:      globalBinDir,
		IsBinInPath:       isBinInPath,
		IsGlobalBinInPath: isGlobalBinInPath,
		PackagesCount:     len(packages),
	}

	return status, nil
}

// InstallComposer downloads and sets up Composer cleanly in YAWPS
func InstallComposer(onProgress func(ProgressInfo)) (*ComposerOperationResult, error) {
	cur := GetCurrentVersion()
	if cur == nil || cur.PhpExe == "" {
		return nil, fmt.Errorf("no active PHP version selected. Please install or switch to a PHP version first")
	}

	binDir := GetBinDir()
	if err := os.MkdirAll(binDir, 0755); err != nil {
		return nil, fmt.Errorf("failed to create bin directory: %w", err)
	}

	if onProgress != nil {
		onProgress(ProgressInfo{Stage: "Fetching Composer metadata", Percent: 5, Message: "Checking latest official Composer release..."})
	}

	latestVer, path, _ := FetchLatestComposerVersion()
	downloadUrl := "https://getcomposer.org/download/latest-stable/composer.phar"
	if path != "" {
		downloadUrl = "https://getcomposer.org" + path
	}

	if onProgress != nil {
		msg := "Downloading composer.phar..."
		if latestVer != "" {
			msg = fmt.Sprintf("Downloading Composer v%s...", latestVer)
		}
		onProgress(ProgressInfo{Stage: "Downloading Composer", Percent: 15, Message: msg})
	}

	client := &http.Client{Timeout: 3 * time.Minute}
	req, err := http.NewRequest("GET", downloadUrl, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("User-Agent", "YAWPS-PHP-Switcher")

	resp, err := client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to download composer.phar: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("download failed with HTTP %d", resp.StatusCode)
	}

	pharPath := filepath.Join(binDir, "composer.phar")
	tmpPath := pharPath + ".tmp"

	out, err := os.Create(tmpPath)
	if err != nil {
		return nil, fmt.Errorf("failed to create file %s: %w", tmpPath, err)
	}

	totalBytes := resp.ContentLength
	var receivedBytes int64
	buf := make([]byte, 32*1024)

	for {
		nr, er := resp.Body.Read(buf)
		if nr > 0 {
			nw, ew := out.Write(buf[0:nr])
			if ew != nil {
				out.Close()
				_ = os.Remove(tmpPath)
				return nil, ew
			}
			receivedBytes += int64(nw)
			if totalBytes > 0 && onProgress != nil {
				pct := int(float64(receivedBytes) / float64(totalBytes) * 70.0) // 15% -> 85%
				onProgress(ProgressInfo{
					Stage:         "Downloading Composer",
					Percent:       15 + pct,
					ReceivedBytes: receivedBytes,
					TotalBytes:    totalBytes,
					Message:       fmt.Sprintf("Downloaded %.1f MB of %.1f MB", float64(receivedBytes)/(1024*1024), float64(totalBytes)/(1024*1024)),
				})
			}
		}
		if er != nil {
			if er != io.EOF {
				out.Close()
				_ = os.Remove(tmpPath)
				return nil, er
			}
			break
		}
	}
	out.Close()

	// Replace existing composer.phar atomically
	_ = os.Remove(pharPath)
	if err := os.Rename(tmpPath, pharPath); err != nil {
		return nil, fmt.Errorf("failed to finalize composer.phar: %w", err)
	}

	if onProgress != nil {
		onProgress(ProgressInfo{Stage: "Setting up wrappers", Percent: 90, Message: "Generating composer.bat and PATH integration..."})
	}

	// Create composer.bat wrapper
	batPath := filepath.Join(binDir, "composer.bat")
	batContent := "@echo off\r\nphp \"%~dp0composer.phar\" %*\r\n"
	if err := os.WriteFile(batPath, []byte(batContent), 0755); err != nil {
		return nil, fmt.Errorf("failed to create composer.bat: %w", err)
	}

	// Create composer sh wrapper (useful for Git Bash, MinGW, etc.)
	shPath := filepath.Join(binDir, "composer")
	shContent := "#!/usr/bin/env sh\n\"$(dirname -- \"$0\")/composer.phar\" \"$@\"\n"
	_ = os.WriteFile(shPath, []byte(shContent), 0755)

	// Ensure binDir is in User PATH
	if !IsDirectoryInUserPath(binDir) {
		_ = AddDirectoryToUserPath(binDir)
	}

	// Also ensure Composer Global Bin directory is in PATH so global package tools work out-of-the-box
	globalBin := GetComposerGlobalBinDir()
	_ = os.MkdirAll(globalBin, 0755)
	if !IsDirectoryInUserPath(globalBin) {
		_ = AddDirectoryToUserPath(globalBin)
	}

	// Verify installation
	cmd := exec.Command(cur.PhpExe, pharPath, "--version")
	cmd.Env = os.Environ()
	cmd.Env = append(cmd.Env, "PATH="+GetCurrentLink()+";"+binDir+";"+os.Getenv("PATH"))
	cmdOut, err := cmd.CombinedOutput()
	outputStr := strings.TrimSpace(string(cmdOut))
	if err != nil {
		return &ComposerOperationResult{
			Success: false,
			Output:  outputStr,
			Error:   err.Error(),
		}, nil
	}

	if onProgress != nil {
		onProgress(ProgressInfo{Stage: "Installation complete", Percent: 100, Message: outputStr})
	}

	return &ComposerOperationResult{
		Success: true,
		Output:  outputStr,
	}, nil
}

// UpdateComposer updates Composer to the latest stable release
func UpdateComposer(onProgress func(ProgressInfo)) (*ComposerOperationResult, error) {
	_, composerPhar, isYawpsManaged := FindComposerExecutable()

	// If YAWPS managed, we can simply download the latest phar directly
	if isYawpsManaged || composerPhar != "" {
		return InstallComposer(onProgress)
	}

	// If external composer exists, run composer self-update
	cmd := exec.Command("cmd.exe", "/c", "composer", "self-update")
	cmd.Env = os.Environ()
	cmd.Env = append(cmd.Env, "PATH="+GetCurrentLink()+";"+GetBinDir()+";"+os.Getenv("PATH"))

	out, err := cmd.CombinedOutput()
	outStr := strings.TrimSpace(string(out))
	if err != nil {
		return &ComposerOperationResult{
			Success: false,
			Output:  outStr,
			Error:   err.Error(),
		}, nil
	}

	return &ComposerOperationResult{
		Success: true,
		Output:  outStr,
	}, nil
}

// UninstallComposer removes installed composer cleanly based on user selections
func UninstallComposer(opts ComposerUninstallOptions) (*ComposerUninstallResult, error) {
	result := &ComposerUninstallResult{
		Success:      true,
		DeletedPaths: []string{},
	}

	binDir := GetBinDir()
	composerBat, composerPhar, _ := FindComposerExecutable()
	composerHome := GetComposerHome()
	globalBinDir := GetComposerGlobalBinDir()

	// 1. Remove executables
	if opts.RemoveBin {
		// Clean YAWPS bin files
		targets := []string{
			filepath.Join(binDir, "composer.phar"),
			filepath.Join(binDir, "composer.bat"),
			filepath.Join(binDir, "composer"),
		}
		if composerPhar != "" && !strings.HasPrefix(strings.ToLower(composerPhar), strings.ToLower(binDir)) {
			targets = append(targets, composerPhar)
		}
		if composerBat != "" && !strings.HasPrefix(strings.ToLower(composerBat), strings.ToLower(binDir)) {
			// Don't delete ProgramData/ComposerSetup without uninstaller, only local shims
			if !strings.Contains(strings.ToLower(composerBat), "programdata") {
				targets = append(targets, composerBat)
			}
		}

		for _, t := range targets {
			if _, err := os.Stat(t); err == nil {
				if err := os.Remove(t); err == nil {
					result.DeletedPaths = append(result.DeletedPaths, t)
				}
			}
		}

		// If binDir is now empty, remove directory
		if entries, err := os.ReadDir(binDir); err == nil && len(entries) == 0 {
			_ = os.Remove(binDir)
		}

		result.ExecutablesDeleted = true
	}

	// 2. Remove YAWPS bin from User PATH
	if opts.RemoveFromPath {
		if err := RemoveDirectoryFromUserPath(binDir); err == nil {
			result.PathCleaned = true
		}
	}

	// 3. Clear cache
	if opts.CleanCache {
		cachePaths := []string{
			filepath.Join(os.Getenv("LOCALAPPDATA"), "Composer", "cache"),
			filepath.Join(composerHome, "cache"),
		}
		for _, cp := range cachePaths {
			if _, err := os.Stat(cp); err == nil {
				if err := os.RemoveAll(cp); err == nil {
					result.DeletedPaths = append(result.DeletedPaths, cp)
				}
			}
		}
		result.CacheDeleted = true
	}

	// 4. Purge packages
	if opts.PurgePackages {
		vendorDir := filepath.Join(composerHome, "vendor")
		lockFile := filepath.Join(composerHome, "composer.lock")
		jsonFile := filepath.Join(composerHome, "composer.json")

		if _, err := os.Stat(vendorDir); err == nil {
			if err := os.RemoveAll(vendorDir); err == nil {
				result.DeletedPaths = append(result.DeletedPaths, vendorDir)
			}
		}
		if _, err := os.Stat(lockFile); err == nil {
			if err := os.Remove(lockFile); err == nil {
				result.DeletedPaths = append(result.DeletedPaths, lockFile)
			}
		}
		if _, err := os.Stat(jsonFile); err == nil {
			_ = os.WriteFile(jsonFile, []byte("{}\n"), 0644)
			result.DeletedPaths = append(result.DeletedPaths, jsonFile+" (reset to empty)")
		}

		result.PackagesPurged = true
	}

	// 5. Remove global bin from User PATH
	if opts.RemoveGlobalBinFromPath {
		if err := RemoveDirectoryFromUserPath(globalBinDir); err == nil {
			result.GlobalBinPathRemoved = true
		}
	}

	result.Message = fmt.Sprintf("Composer uninstallation completed. %d items cleaned.", len(result.DeletedPaths))
	return result, nil
}

// GetComposerGlobalPackages lists globally installed PHP packages from Composer
func GetComposerGlobalPackages() ([]ComposerGlobalPackage, error) {
	bat, phar, _ := FindComposerExecutable()
	if bat == "" && phar == "" {
		return []ComposerGlobalPackage{}, nil
	}

	composerHome := GetComposerHome()
	lockPath := filepath.Join(composerHome, "composer.lock")
	jsonPath := filepath.Join(composerHome, "composer.json")

	packageMap := make(map[string]*ComposerGlobalPackage)

	// 1. Read composer.lock for exact locked packages
	if lockBytes, err := os.ReadFile(lockPath); err == nil {
		var lockData struct {
			Packages []struct {
				Name        string          `json:"name"`
				Version     string          `json:"version"`
				Description string          `json:"description"`
				Homepage    string          `json:"homepage"`
				License     json.RawMessage `json:"license"`
				Bin         json.RawMessage `json:"bin"`
				Time        string          `json:"time"`
			} `json:"packages"`
		}

		if err := json.Unmarshal(lockBytes, &lockData); err == nil {
			for _, p := range lockData.Packages {
				var licList []string
				if len(p.License) > 0 {
					_ = json.Unmarshal(p.License, &licList)
				}

				var binList []string
				if len(p.Bin) > 0 {
					var rawBins []string
					if err := json.Unmarshal(p.Bin, &rawBins); err == nil {
						for _, b := range rawBins {
							binList = append(binList, filepath.Base(b))
						}
					}
				}

				pkg := &ComposerGlobalPackage{
					Name:        p.Name,
					Version:     p.Version,
					Description: p.Description,
					Homepage:    p.Homepage,
					License:     licList,
					Binaries:    binList,
					Time:        p.Time,
				}
				packageMap[strings.ToLower(p.Name)] = pkg
			}
		}
	}

	// 2. Read composer.json for user required constraints
	if jsonBytes, err := os.ReadFile(jsonPath); err == nil {
		var jsonData struct {
			Require map[string]string `json:"require"`
		}
		if err := json.Unmarshal(jsonBytes, &jsonData); err == nil {
			for name, constraint := range jsonData.Require {
				lowerName := strings.ToLower(name)
				if existing, ok := packageMap[lowerName]; ok {
					existing.Constraint = constraint
				} else {
					// Package in require but not yet locked
					packageMap[lowerName] = &ComposerGlobalPackage{
						Name:        name,
						Version:     "(Not installed)",
						Constraint:  constraint,
						Description: "Required in composer.json but not yet downloaded",
					}
				}
			}
		}
	}

	list := make([]ComposerGlobalPackage, 0, len(packageMap))
	for _, p := range packageMap {
		list = append(list, *p)
	}

	return list, nil
}

// RunComposerCommand executes a composer command with streaming progress logging
func RunComposerCommand(args []string, onProgress func(string)) (*ComposerOperationResult, error) {
	cur := GetCurrentVersion()
	if cur == nil || cur.PhpExe == "" {
		return nil, fmt.Errorf("no active PHP version selected. Please select a PHP version in YAWPS first")
	}

	_, composerPhar, _ := FindComposerExecutable()
	var cmd *exec.Cmd

	if composerPhar != "" {
		cmdArgs := append([]string{composerPhar}, args...)
		cmd = exec.Command(cur.PhpExe, cmdArgs...)
	} else {
		cmd = exec.Command("cmd.exe", append([]string{"/c", "composer"}, args...)...)
	}

	cmd.Env = os.Environ()
	cmd.Env = append(cmd.Env, "PATH="+GetCurrentLink()+";"+GetBinDir()+";"+os.Getenv("PATH"))
	cmd.Env = append(cmd.Env, "COMPOSER_HOME="+GetComposerHome())

	stdoutPipe, err := cmd.StdoutPipe()
	if err != nil {
		return nil, err
	}
	stderrPipe, err := cmd.StderrPipe()
	if err != nil {
		return nil, err
	}

	if err := cmd.Start(); err != nil {
		return nil, fmt.Errorf("failed to start composer command: %w", err)
	}

	var outputBuilder strings.Builder

	readScanner := func(r io.Reader) {
		scanner := bufio.NewScanner(r)
		for scanner.Scan() {
			text := scanner.Text()
			outputBuilder.WriteString(text + "\n")
			if onProgress != nil {
				onProgress(text)
			}
		}
	}

	go readScanner(stdoutPipe)
	go readScanner(stderrPipe)

	err = cmd.Wait()
	fullOutput := outputBuilder.String()

	if err != nil {
		return &ComposerOperationResult{
			Success: false,
			Output:  fullOutput,
			Error:   err.Error(),
		}, nil
	}

	return &ComposerOperationResult{
		Success: true,
		Output:  fullOutput,
	}, nil
}

// InstallComposerGlobalPackage installs a global package via composer
func InstallComposerGlobalPackage(pkgName string, version string, onProgress func(string)) (*ComposerOperationResult, error) {
	spec := strings.TrimSpace(pkgName)
	if spec == "" {
		return nil, fmt.Errorf("package name cannot be empty")
	}
	if version != "" {
		spec = spec + ":" + strings.TrimSpace(version)
	}

	args := []string{"global", "require", spec, "--no-interaction"}
	return RunComposerCommand(args, onProgress)
}

// RemoveComposerGlobalPackages removes one or more global packages via composer
func RemoveComposerGlobalPackages(pkgNames []string, onProgress func(string)) (*ComposerOperationResult, error) {
	var valid []string
	for _, p := range pkgNames {
		p = strings.TrimSpace(p)
		if p != "" {
			valid = append(valid, p)
		}
	}
	if len(valid) == 0 {
		return nil, fmt.Errorf("no package names provided for removal")
	}

	args := append([]string{"global", "remove"}, valid...)
	args = append(args, "--no-interaction")
	return RunComposerCommand(args, onProgress)
}

// RemoveComposerGlobalPackage removes a global package via composer
func RemoveComposerGlobalPackage(pkgName string, onProgress func(string)) (*ComposerOperationResult, error) {
	pkgName = strings.TrimSpace(pkgName)
	if pkgName == "" {
		return nil, fmt.Errorf("package name cannot be empty")
	}
	return RemoveComposerGlobalPackages([]string{pkgName}, onProgress)
}

// UpdateComposerGlobalPackages updates one or more global packages or all global packages
func UpdateComposerGlobalPackages(pkgNames []string, onProgress func(string)) (*ComposerOperationResult, error) {
	var valid []string
	for _, p := range pkgNames {
		p = strings.TrimSpace(p)
		if p != "" {
			valid = append(valid, p)
		}
	}
	var args []string
	if len(valid) > 0 {
		args = append([]string{"global", "update"}, valid...)
		args = append(args, "--no-interaction")
	} else {
		args = []string{"global", "update", "--no-interaction"}
	}
	return RunComposerCommand(args, onProgress)
}

// UpdateComposerGlobalPackage updates a global package or all global packages
func UpdateComposerGlobalPackage(pkgName string, onProgress func(string)) (*ComposerOperationResult, error) {
	if strings.TrimSpace(pkgName) == "" {
		return UpdateComposerGlobalPackages(nil, onProgress)
	}
	return UpdateComposerGlobalPackages([]string{pkgName}, onProgress)
}

// ToggleComposerGlobalBinPath adds or removes composer global bin from user PATH
func ToggleComposerGlobalBinPath(enable bool) (bool, error) {
	binDir := GetComposerGlobalBinDir()
	_ = os.MkdirAll(binDir, 0755)

	if enable {
		err := AddDirectoryToUserPath(binDir)
		return IsDirectoryInUserPath(binDir), err
	} else {
		err := RemoveDirectoryFromUserPath(binDir)
		return IsDirectoryInUserPath(binDir), err
	}
}
