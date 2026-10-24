package core

import (
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
)

type CleanupResult struct {
	BaseDirDeleted  bool `json:"baseDirDeleted"`
	PathRemoved     bool `json:"pathRemoved"`
	JunctionRemoved bool `json:"junctionRemoved"`
}

type UninstallResult struct {
	Success           bool         `json:"success"`
	Target            *VersionInfo `json:"target"`
	WasActive         bool         `json:"wasActive"`
	SwitchedTo        *VersionInfo `json:"switchedTo"`
	DeletedCacheFiles []string     `json:"deletedCacheFiles"`
}

func CleanCachedArchives(versionNum string) ([]string, error) {
	_ = EnsureDirectories()
	dDir := GetDownloadsDir()
	entries, err := os.ReadDir(dDir)
	if err != nil {
		return nil, err
	}

	var deleted []string
	for _, e := range entries {
		name := e.Name()
		if !strings.HasSuffix(strings.ToLower(name), ".zip") {
			continue
		}
		if versionNum != "" && !strings.Contains(strings.ToLower(name), strings.ToLower(versionNum)) {
			continue
		}
		fullPath := filepath.Join(dDir, name)
		if err := os.Remove(fullPath); err == nil {
			deleted = append(deleted, fullPath)
		}
	}
	return deleted, nil
}

func UninstallVersion(versionId string, cleanCache bool) (*UninstallResult, error) {
	installed := GetInstalledVersions()
	var target *VersionInfo
	for _, v := range installed {
		if strings.EqualFold(v.ID, versionId) || strings.EqualFold(v.Version, versionId) {
			targetCopy := v
			target = &targetCopy
			break
		}
	}

	if target == nil {
		return nil, fmt.Errorf("version '%s' is not installed", versionId)
	}

	cur := GetCurrentVersion()
	curLink := GetCurrentLink()
	wasActive := cur != nil && strings.EqualFold(cur.ID, target.ID)

	var switchedTo *VersionInfo

	// If currently active
	if wasActive {
		// Try switching to another installed version
		var alternative *VersionInfo
		for _, v := range installed {
			if !strings.EqualFold(v.ID, target.ID) {
				altCopy := v
				alternative = &altCopy
				break
			}
		}

		if alternative != nil {
			switchedTo, _ = SwitchVersion(alternative.ID)
		} else {
			// Unlink junction
			cmd := exec.Command("cmd.exe", "/c", "rmdir", curLink)
			_ = cmd.Run()
			_ = os.Remove(curLink)
		}
	}

	// Delete target folder
	if err := os.RemoveAll(target.Path); err != nil {
		return nil, fmt.Errorf("failed to delete version directory: %w", err)
	}

	var deletedCacheFiles []string
	if cleanCache {
		deletedCacheFiles, _ = CleanCachedArchives(target.Version)
	}
	if deletedCacheFiles == nil {
		deletedCacheFiles = []string{}
	}

	return &UninstallResult{
		Success:           true,
		Target:            target,
		WasActive:         wasActive,
		SwitchedTo:        switchedTo,
		DeletedCacheFiles: deletedCacheFiles,
	}, nil
}

func FullCleanup(purgeAll bool) CleanupResult {
	curLink := GetCurrentLink()
	cmd := exec.Command("cmd.exe", "/c", "rmdir", curLink)
	_ = cmd.Run()
	_ = os.Remove(curLink)

	_ = RemoveFromUserPath()

	baseDeleted := false
	if purgeAll {
		bDir := GetBaseDir()
		if err := os.RemoveAll(bDir); err == nil {
			baseDeleted = true
		}
	}

	return CleanupResult{
		BaseDirDeleted:  baseDeleted,
		PathRemoved:     true,
		JunctionRemoved: true,
	}
}
