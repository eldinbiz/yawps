package main

import (
	"context"
	"os/exec"
	"yawps/pkg/core"

	"github.com/wailsapp/wails/v2/pkg/runtime"
)

// App struct
type App struct {
	ctx context.Context
}

// NewApp creates a new App application struct
func NewApp() *App {
	return &App{}
}

// startup is called when the app starts. The context is saved
// so we can call the runtime methods
func (a *App) startup(ctx context.Context) {
	a.ctx = ctx
}

type StateResult struct {
	Current     *core.VersionInfo       `json:"current"`
	Installed   []core.VersionInfo      `json:"installed"`
	PathStatus  core.PathStatus         `json:"pathStatus"`
	OsInfo      core.WindowsVersionInfo `json:"osInfo"`
	CurrentLink string                  `json:"currentLink"`
}

type SwitchResult struct {
	Success    bool              `json:"success"`
	Target     *core.VersionInfo `json:"target"`
	Current    *core.VersionInfo `json:"current"`
	PathStatus core.PathStatus   `json:"pathStatus"`
}

func (a *App) GetState() StateResult {
	installed := core.GetInstalledVersions()
	if installed == nil {
		installed = []core.VersionInfo{}
	}
	pathStatus := core.CheckPathStatus()
	if pathStatus.ActivePhpLocations == nil {
		pathStatus.ActivePhpLocations = []string{}
	}
	return StateResult{
		Current:     core.GetCurrentVersion(),
		Installed:   installed,
		PathStatus:  pathStatus,
		OsInfo:      core.GetWindowsVersionInfo(),
		CurrentLink: core.GetCurrentLink(),
	}
}

func (a *App) FetchRemoteReleases() ([]core.ReleaseInfo, error) {
	releases, err := core.FetchRemoteReleases()
	if err != nil {
		return []core.ReleaseInfo{}, err
	}
	if releases == nil {
		return []core.ReleaseInfo{}, nil
	}
	return releases, nil
}

func (a *App) SwitchVersion(versionId string) (SwitchResult, error) {
	target, err := core.SwitchVersion(versionId)
	if err != nil {
		return SwitchResult{Success: false}, err
	}
	return SwitchResult{
		Success:    true,
		Target:     target,
		Current:    core.GetCurrentVersion(),
		PathStatus: core.CheckPathStatus(),
	}, nil
}

func (a *App) InstallVersion(options map[string]interface{}) (*core.InstallResult, error) {
	onProgress := func(p core.ProgressInfo) {
		if a.ctx != nil {
			runtime.EventsEmit(a.ctx, "install-progress", map[string]interface{}{
				"stage":         p.Stage,
				"percent":       p.Percent,
				"message":       p.Message,
				"receivedBytes": p.ReceivedBytes,
				"totalBytes":    p.TotalBytes,
			})
		}
	}

	// Check if release object is provided
	if relRaw, ok := options["release"].(map[string]interface{}); ok && relRaw != nil {
		rel := &core.ReleaseInfo{
			ID:         getString(relRaw, "id"),
			Branch:     getString(relRaw, "branch"),
			Version:    getString(relRaw, "version"),
			Type:       getString(relRaw, "type"),
			Compiler:   getString(relRaw, "compiler"),
			Arch:       getString(relRaw, "arch"),
			ZipName:    getString(relRaw, "zipName"),
			URL:        getString(relRaw, "url"),
			ArchiveURL: getString(relRaw, "archiveUrl"),
			SHA256:     getString(relRaw, "sha256"),
			Size:       getString(relRaw, "size"),
		}
		return core.InstallRelease(rel, onProgress)
	}

	query := getString(options, "query")
	relType := getString(options, "type")
	if relType == "" {
		relType = "nts"
	}
	arch := getString(options, "arch")
	if arch == "" {
		arch = "x64"
	}

	return core.InstallVersion(query, relType, arch, onProgress)
}

func (a *App) CheckUpdates() []core.UpdateItem {
	updates, err := core.CheckUpdates()
	if err != nil || updates == nil {
		return []core.UpdateItem{}
	}
	return updates
}

func (a *App) UpdateVersion(versionId string) (*core.InstallResult, error) {
	onProgress := func(p core.ProgressInfo) {
		if a.ctx != nil {
			runtime.EventsEmit(a.ctx, "update-progress", map[string]interface{}{
				"stage":         p.Stage,
				"percent":       p.Percent,
				"message":       p.Message,
				"receivedBytes": p.ReceivedBytes,
				"totalBytes":    p.TotalBytes,
			})
		}
	}
	return core.UpdateVersion(versionId, onProgress)
}

func (a *App) GetExtensions(versionId string) []core.ExtensionInfo {
	list, err := core.GetExtensions(versionId)
	if err != nil || list == nil {
		return []core.ExtensionInfo{}
	}
	return list
}

func (a *App) SetExtensionStatus(payload map[string]interface{}) ([]core.ExtensionInfo, error) {
	versionId := getString(payload, "versionId")
	extensionId := getString(payload, "extensionId")
	enabled, _ := payload["enabled"].(bool)

	if err := core.SetExtensionStatus(versionId, extensionId, enabled); err != nil {
		return nil, err
	}
	return core.GetExtensions(versionId)
}

func (a *App) GetDirectives(versionId string) map[string]string {
	directives, err := core.GetDirectives(versionId)
	if err != nil {
		return map[string]string{}
	}
	return directives
}

func (a *App) UpdateDirectives(payload map[string]interface{}) (bool, error) {
	versionId := getString(payload, "versionId")
	updatesRaw, _ := payload["updates"].(map[string]interface{})
	updates := make(map[string]string)
	for k, v := range updatesRaw {
		if strVal, ok := v.(string); ok {
			updates[k] = strVal
		}
	}
	if err := core.UpdateDirectives(versionId, updates); err != nil {
		return false, err
	}
	return true, nil
}

func (a *App) FixPath() core.PathStatus {
	_ = core.AddToUserPath()
	return core.CheckPathStatus()
}

func (a *App) RemovePath() core.PathStatus {
	_ = core.RemoveFromUserPath()
	return core.CheckPathStatus()
}

func (a *App) OpenFolder(targetPath string) bool {
	if targetPath == "" {
		targetPath = core.GetVersionsDir()
	}
	cmd := exec.Command("explorer.exe", targetPath)
	_ = cmd.Start()
	return true
}

func (a *App) UninstallVersion(payload map[string]interface{}) (*core.UninstallResult, error) {
	versionId := getString(payload, "versionId")
	cleanCache, _ := payload["cleanCache"].(bool)
	return core.UninstallVersion(versionId, cleanCache)
}

func (a *App) FullCleanup(payload map[string]interface{}) core.CleanupResult {
	purgeAll, _ := payload["purgeAll"].(bool)
	return core.FullCleanup(purgeAll)
}

func getString(m map[string]interface{}, key string) string {
	if val, ok := m[key].(string); ok {
		return val
	}
	return ""
}
