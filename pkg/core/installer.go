package core

import (
	"archive/zip"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"regexp"
	"strings"
	"time"
)

type ProgressInfo struct {
	Stage         string `json:"stage"`
	Percent       int    `json:"percent"`
	Message       string `json:"message"`
	ReceivedBytes int64  `json:"receivedBytes"`
	TotalBytes    int64  `json:"totalBytes"`
}

type ProgressCallback func(p ProgressInfo)

type InstallResult struct {
	TargetDir        string       `json:"targetDir"`
	AlreadyInstalled bool         `json:"alreadyInstalled"`
	Release          *ReleaseInfo `json:"release"`
}

func downloadFileWithProgress(url, targetPath string, onProgress ProgressCallback, fallbackURL string) error {
	client := &http.Client{Timeout: 30 * time.Minute}
	req, err := http.NewRequest("GET", url, nil)
	if err != nil {
		return err
	}
	req.Header.Set("User-Agent", "YAWPS/0.1.0")

	resp, err := client.Do(req)
	if err != nil || resp.StatusCode != http.StatusOK {
		if resp != nil {
			resp.Body.Close()
		}
		if fallbackURL != "" {
			reqFb, fbErr := http.NewRequest("GET", fallbackURL, nil)
			if fbErr == nil {
				reqFb.Header.Set("User-Agent", "YAWPS/0.1.0")
				respFb, doFbErr := client.Do(reqFb)
				if doFbErr == nil && respFb.StatusCode == http.StatusOK {
					resp = respFb
				} else {
					if respFb != nil {
						respFb.Body.Close()
					}
					return fmt.Errorf("failed to download from primary and archive URLs")
				}
			}
		} else {
			return fmt.Errorf("download failed: %w", err)
		}
	}
	defer resp.Body.Close()

	totalSize := resp.ContentLength
	out, err := os.Create(targetPath)
	if err != nil {
		return err
	}
	defer out.Close()

	buf := make([]byte, 64*1024)
	var downloaded int64
	lastUpdate := time.Now()

	for {
		n, readErr := resp.Body.Read(buf)
		if n > 0 {
			if _, wErr := out.Write(buf[:n]); wErr != nil {
				return wErr
			}
			downloaded += int64(n)

			if time.Since(lastUpdate) > 100*time.Millisecond || readErr != nil {
				percent := 0
				if totalSize > 0 {
					percent = int((downloaded * 90) / totalSize)
				}
				mbDownloaded := float64(downloaded) / (1024 * 1024)
				mbTotal := float64(totalSize) / (1024 * 1024)
				msg := fmt.Sprintf("Downloading... %.1f MB / %.1f MB (%d%%)", mbDownloaded, mbTotal, percent)
				if onProgress != nil {
					onProgress(ProgressInfo{
						Stage:         "downloading",
						Percent:       percent,
						Message:       msg,
						ReceivedBytes: downloaded,
						TotalBytes:    totalSize,
					})
				}
				lastUpdate = time.Now()
			}
		}
		if readErr != nil {
			if readErr == io.EOF {
				break
			}
			return readErr
		}
	}

	return nil
}

func computeSHA256(filePath string) (string, error) {
	f, err := os.Open(filePath)
	if err != nil {
		return "", err
	}
	defer f.Close()

	hasher := sha256.New()
	if _, err := io.Copy(hasher, f); err != nil {
		return "", err
	}
	return hex.EncodeToString(hasher.Sum(nil)), nil
}

func unzipFile(srcZip, destDir string) error {
	r, err := zip.OpenReader(srcZip)
	if err != nil {
		return err
	}
	defer r.Close()

	if err := os.MkdirAll(destDir, 0755); err != nil {
		return err
	}

	for _, f := range r.File {
		fPath := filepath.Join(destDir, f.Name)
		// Check for Zip Slip
		if !strings.HasPrefix(filepath.Clean(fPath), filepath.Clean(destDir)+string(os.PathSeparator)) {
			continue
		}

		if f.FileInfo().IsDir() {
			_ = os.MkdirAll(fPath, 0755)
			continue
		}

		if err := os.MkdirAll(filepath.Dir(fPath), 0755); err != nil {
			return err
		}

		outFile, err := os.OpenFile(fPath, os.O_WRONLY|os.O_CREATE|os.O_TRUNC, f.Mode())
		if err != nil {
			return err
		}

		rc, err := f.Open()
		if err != nil {
			outFile.Close()
			return err
		}

		_, err = io.Copy(outFile, rc)
		outFile.Close()
		rc.Close()
		if err != nil {
			return err
		}
	}
	return nil
}

func configureDefaultPhpIni(versionDir string) error {
	iniPath := filepath.Join(versionDir, "php.ini")
	if _, err := os.Stat(iniPath); err == nil {
		return nil
	}

	devIni := filepath.Join(versionDir, "php.ini-development")
	prodIni := filepath.Join(versionDir, "php.ini-production")

	sourcePath := devIni
	if _, err := os.Stat(sourcePath); os.IsNotExist(err) {
		sourcePath = prodIni
	}

	if _, err := os.Stat(sourcePath); os.IsNotExist(err) {
		return nil
	}

	contentBytes, err := os.ReadFile(sourcePath)
	if err != nil {
		return err
	}
	content := string(contentBytes)

	// Uncomment extension_dir = "ext"
	extDirRegex := regexp.MustCompile(`(?m)^;\s*extension_dir\s*=\s*"ext"`)
	content = extDirRegex.ReplaceAllString(content, `extension_dir = "ext"`)

	return os.WriteFile(iniPath, []byte(content), 0644)
}

func InstallRelease(release *ReleaseInfo, onProgress ProgressCallback) (*InstallResult, error) {
	_ = EnsureDirectories()
	targetDir := filepath.Join(GetVersionsDir(), release.ID)
	zipPath := filepath.Join(GetDownloadsDir(), release.ZipName)

	phpExe := filepath.Join(targetDir, "php.exe")
	if _, err := os.Stat(phpExe); err == nil {
		if onProgress != nil {
			onProgress(ProgressInfo{
				Stage:   "completed",
				Percent: 100,
				Message: fmt.Sprintf("PHP %s is already installed.", release.Version),
			})
		}
		return &InstallResult{
			TargetDir:        targetDir,
			AlreadyInstalled: true,
			Release:          release,
		}, nil
	}

	// Download archive if not present
	if _, err := os.Stat(zipPath); os.IsNotExist(err) {
		if onProgress != nil {
			onProgress(ProgressInfo{
				Stage:   "downloading",
				Percent: 0,
				Message: fmt.Sprintf("Downloading %s...", release.ZipName),
			})
		}
		if err := downloadFileWithProgress(release.URL, zipPath, onProgress, release.ArchiveURL); err != nil {
			return nil, err
		}
	}

	// Check SHA256 if available
	if release.SHA256 != "" {
		if onProgress != nil {
			onProgress(ProgressInfo{
				Stage:   "verifying",
				Percent: 92,
				Message: "Verifying checksum...",
			})
		}
		hash, err := computeSHA256(zipPath)
		if err == nil && !strings.EqualFold(hash, release.SHA256) {
			_ = os.Remove(zipPath)
			return nil, fmt.Errorf("checksum mismatch for %s", release.ZipName)
		}
	}

	// Extract
	if onProgress != nil {
		onProgress(ProgressInfo{
			Stage:   "extracting",
			Percent: 95,
			Message: fmt.Sprintf("Extracting to %s...", release.ID),
		})
	}
	if err := unzipFile(zipPath, targetDir); err != nil {
		return nil, fmt.Errorf("extraction failed: %w", err)
	}

	// Configure php.ini
	_ = configureDefaultPhpIni(targetDir)

	if onProgress != nil {
		onProgress(ProgressInfo{
			Stage:   "completed",
			Percent: 100,
			Message: fmt.Sprintf("PHP %s (%s) installed successfully!", release.Version, strings.ToUpper(release.Type)),
		})
	}

	return &InstallResult{
		TargetDir:        targetDir,
		AlreadyInstalled: false,
		Release:          release,
	}, nil
}

func InstallVersion(query, relType, arch string, onProgress ProgressCallback) (*InstallResult, error) {
	if onProgress != nil {
		onProgress(ProgressInfo{
			Stage:   "resolving",
			Percent: 5,
			Message: fmt.Sprintf("Resolving PHP release '%s'...", query),
		})
	}
	rel, err := FindRelease(query, relType, arch)
	if err != nil {
		return nil, err
	}
	return InstallRelease(rel, onProgress)
}
