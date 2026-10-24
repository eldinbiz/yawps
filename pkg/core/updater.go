package core

import (
	"fmt"
	"strings"
)

type UpdateItem struct {
	CurrentVersion string       `json:"currentVersion"`
	LatestVersion  string       `json:"latestVersion"`
	Release        *ReleaseInfo `json:"release"`
	HasUpdate      bool         `json:"hasUpdate"`
}

func CheckUpdates() ([]UpdateItem, error) {
	installed := GetInstalledVersions()
	if len(installed) == 0 {
		return []UpdateItem{}, nil
	}

	releases, err := FetchRemoteReleases()
	if err != nil {
		return []UpdateItem{}, err
	}

	updates := make([]UpdateItem, 0)
	for _, inst := range installed {
		parts := strings.Split(inst.Version, ".")
		branch := inst.Version
		if len(parts) >= 2 {
			branch = parts[0] + "." + parts[1]
		}

		for _, rel := range releases {
			if strings.HasPrefix(rel.Version, branch+".") && rel.Type == inst.Type && rel.Arch == inst.Arch {
				if CompareVersions(rel.Version, inst.Version) > 0 {
					rCopy := rel
					updates = append(updates, UpdateItem{
						CurrentVersion: inst.ID,
						LatestVersion:  rel.Version,
						Release:        &rCopy,
						HasUpdate:      true,
					})
				}
				break
			}
		}
	}

	return updates, nil
}

func UpdateVersion(versionId string, onProgress ProgressCallback) (*InstallResult, error) {
	updates, err := CheckUpdates()
	if err != nil {
		return nil, err
	}

	var targetUpdate *UpdateItem
	for _, u := range updates {
		if strings.EqualFold(u.CurrentVersion, versionId) || strings.Contains(u.CurrentVersion, versionId) {
			targetUpdate = &u
			break
		}
	}

	if targetUpdate == nil || targetUpdate.Release == nil {
		return nil, fmt.Errorf("no patch updates available for %s", versionId)
	}

	// 1. Get old extensions
	oldExts, _ := GetExtensions(versionId)
	oldDirectives, _ := GetDirectives(versionId)

	// 2. Install new release
	res, err := InstallRelease(targetUpdate.Release, onProgress)
	if err != nil {
		return nil, err
	}

	// 3. Migrate extensions to new version
	newId := targetUpdate.Release.ID
	for _, ext := range oldExts {
		if ext.Enabled {
			_ = SetExtensionStatus(newId, ext.ID, true)
		}
	}
	if len(oldDirectives) > 0 {
		_ = UpdateDirectives(newId, oldDirectives)
	}

	// 4. If old version was active, switch to new
	cur := GetCurrentVersion()
	if cur != nil && strings.EqualFold(cur.ID, targetUpdate.CurrentVersion) {
		_, _ = SwitchVersion(newId)
	}

	return res, nil
}
