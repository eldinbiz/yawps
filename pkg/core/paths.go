package core

import (
	"os"
	"path/filepath"
)

var (
	baseDir      string
	binDir       string
	versionsDir  string
	currentLink  string
	downloadsDir string
	configFile   string
)

func init() {
	homeEnv := os.Getenv("YAWPS_HOME")
	if homeEnv == "" {
		homeEnv = os.Getenv("WIN_PHP_HOME")
	}

	if homeEnv != "" {
		baseDir = filepath.Clean(homeEnv)
	} else {
		userProfile := os.Getenv("USERPROFILE")
		if userProfile == "" {
			home, _ := os.UserHomeDir()
			userProfile = home
		}

		yawpsDir := filepath.Join(userProfile, ".yawps")
		legacyDir := filepath.Join(userProfile, ".win-php")

		// Prefer legacy .win-php if it already exists and .yawps does not yet
		if info, err := os.Stat(legacyDir); err == nil && info.IsDir() {
			if _, errYawps := os.Stat(yawpsDir); os.IsNotExist(errYawps) {
				baseDir = legacyDir
			} else {
				baseDir = yawpsDir
			}
		} else {
			baseDir = yawpsDir
		}
	}

	binDir = filepath.Join(baseDir, "bin")
	versionsDir = filepath.Join(baseDir, "versions")
	currentLink = filepath.Join(baseDir, "current")
	downloadsDir = filepath.Join(baseDir, "downloads")
	configFile = filepath.Join(baseDir, "config.json")
}

func GetBaseDir() string {
	return baseDir
}

func GetBinDir() string {
	return binDir
}

func GetVersionsDir() string {
	return versionsDir
}

func GetCurrentLink() string {
	return currentLink
}

func GetDownloadsDir() string {
	return downloadsDir
}

func GetConfigFile() string {
	return configFile
}

func EnsureDirectories() error {
	for _, dir := range []string{baseDir, binDir, versionsDir, downloadsDir} {
		if err := os.MkdirAll(dir, 0755); err != nil {
			return err
		}
	}
	return nil
}
