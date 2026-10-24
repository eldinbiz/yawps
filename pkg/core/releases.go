package core

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"regexp"
	"sort"
	"strconv"
	"strings"
	"time"
)

const (
	BaseReleasesURL = "https://windows.php.net/downloads/releases/"
	ReleasesJSONURL = "https://windows.php.net/downloads/releases/releases.json"
)

type ReleaseInfo struct {
	ID         string `json:"id"`
	Branch     string `json:"branch"`
	Version    string `json:"version"`
	Type       string `json:"type"`
	Compiler   string `json:"compiler"`
	Arch       string `json:"arch"`
	ZipName    string `json:"zipName"`
	URL        string `json:"url"`
	ArchiveURL string `json:"archiveUrl"`
	SHA256     string `json:"sha256"`
	Size       string `json:"size"`
}

type rawZipEntry struct {
	Path   string `json:"path"`
	Size   string `json:"size"`
	SHA256 string `json:"sha256"`
}

type rawBuildEntry struct {
	MTime string      `json:"mtime"`
	Zip   rawZipEntry `json:"zip"`
}

var (
	httpClient  = &http.Client{Timeout: 15 * time.Second}
	verRegex    = regexp.MustCompile(`^(\d+)\.(\d+)(?:\.(\d+))?`)
	flavorRegex = regexp.MustCompile(`(?i)^(nts|ts)-([a-z0-9]+)-(x64|x86)$`)
)

func CompareVersions(v1, v2 string) int {
	parts1 := parseVersionParts(v1)
	parts2 := parseVersionParts(v2)

	maxLen := len(parts1)
	if len(parts2) > maxLen {
		maxLen = len(parts2)
	}

	for i := 0; i < maxLen; i++ {
		p1, p2 := 0, 0
		if i < len(parts1) {
			p1 = parts1[i]
		}
		if i < len(parts2) {
			p2 = parts2[i]
		}
		if p1 != p2 {
			if p1 > p2 {
				return 1
			}
			return -1
		}
	}
	return 0
}

func parseVersionParts(v string) []int {
	clean := strings.TrimPrefix(strings.ToLower(v), "php-")
	tokens := strings.Split(clean, ".")
	parts := make([]int, 0, len(tokens))
	for _, tok := range tokens {
		// Stop at non-digits
		numStr := ""
		for _, ch := range tok {
			if ch >= '0' && ch <= '9' {
				numStr += string(ch)
			} else {
				break
			}
		}
		if numStr != "" {
			n, _ := strconv.Atoi(numStr)
			parts = append(parts, n)
		} else {
			parts = append(parts, 0)
		}
	}
	return parts
}

func FetchRemoteReleases() ([]ReleaseInfo, error) {
	req, err := http.NewRequest("GET", ReleasesJSONURL, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("User-Agent", "YAWPS/0.1.0")

	resp, err := httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to fetch PHP releases: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("failed to fetch PHP releases: HTTP %d", resp.StatusCode)
	}

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}

	// Dynamic JSON parsing: map[branch]map[string]json.RawMessage
	var rawData map[string]map[string]json.RawMessage
	if err := json.Unmarshal(body, &rawData); err != nil {
		return nil, fmt.Errorf("failed to parse releases json: %w", err)
	}

	var releases []ReleaseInfo
	for branch, branchData := range rawData {
		var versionStr string
		if vRaw, ok := branchData["version"]; ok {
			_ = json.Unmarshal(vRaw, &versionStr)
		}
		if versionStr == "" {
			continue
		}

		for key, rawVal := range branchData {
			if key == "version" || key == "source" || strings.Contains(key, "pack") {
				continue
			}

			matches := flavorRegex.FindStringSubmatch(key)
			if len(matches) < 4 {
				continue
			}

			relType := strings.ToLower(matches[1])
			compiler := strings.ToLower(matches[2])
			arch := strings.ToLower(matches[3])

			var build rawBuildEntry
			if err := json.Unmarshal(rawVal, &build); err != nil {
				continue
			}

			if build.Zip.Path == "" {
				continue
			}

			size := build.Zip.Size
			if size == "" {
				size = "Unknown"
			}

			id := fmt.Sprintf("php-%s-%s-%s", versionStr, relType, arch)

			releases = append(releases, ReleaseInfo{
				ID:         id,
				Branch:     branch,
				Version:    versionStr,
				Type:       relType,
				Compiler:   compiler,
				Arch:       arch,
				ZipName:    build.Zip.Path,
				URL:        BaseReleasesURL + build.Zip.Path,
				ArchiveURL: BaseReleasesURL + "archives/" + build.Zip.Path,
				SHA256:     build.Zip.SHA256,
				Size:       size,
			})
		}
	}

	sort.Slice(releases, func(i, j int) bool {
		return CompareVersions(releases[i].Version, releases[j].Version) > 0
	})

	return releases, nil
}

func FindRelease(query, relType, arch string) (*ReleaseInfo, error) {
	releases, err := FetchRemoteReleases()
	if err != nil {
		return nil, err
	}

	cleanQuery := strings.ToLower(strings.TrimPrefix(query, "php-"))
	if cleanQuery == "latest" {
		for _, r := range releases {
			if r.Type == relType && r.Arch == arch {
				return &r, nil
			}
		}
	}

	// 1. Exact match on ID
	for _, r := range releases {
		if strings.EqualFold(r.ID, query) {
			return &r, nil
		}
	}

	// 2. Exact match on Version
	for _, r := range releases {
		if strings.EqualFold(r.Version, cleanQuery) && r.Type == relType && r.Arch == arch {
			return &r, nil
		}
	}

	// 3. Branch match: e.g. "8.4" or "8.3" -> highest version in that branch
	for _, r := range releases {
		if (r.Branch == cleanQuery || strings.HasPrefix(r.Version, cleanQuery+".")) && r.Type == relType && r.Arch == arch {
			return &r, nil
		}
	}

	// 4. Prefix match on Version
	for _, r := range releases {
		if strings.HasPrefix(r.Version, cleanQuery) && r.Type == relType && r.Arch == arch {
			return &r, nil
		}
	}

	return nil, fmt.Errorf("no PHP release found matching query: '%s' (%s %s)", query, strings.ToUpper(relType), arch)
}
