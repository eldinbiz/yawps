package core

import (
	"fmt"
	"os"
	"path/filepath"
	"regexp"
	"sort"
	"strings"
)

type ExtMeta struct {
	Name     string
	Category string
	Desc     string
	IsZend   bool
}

var ExtensionMetadata = map[string]ExtMeta{
	"curl":        {Name: "cURL", Category: "Network", Desc: "HTTP/HTTPS requests, REST API client, file transfers"},
	"openssl":     {Name: "OpenSSL", Category: "Security", Desc: "Cryptographic functions, TLS/SSL streams, HTTPS"},
	"mbstring":    {Name: "MBString", Category: "String", Desc: "Multibyte string support (UTF-8, Unicode)"},
	"fileinfo":    {Name: "FileInfo", Category: "File System", Desc: "Detects file MIME types securely"},
	"gd":          {Name: "GD Library", Category: "Media", Desc: "Image creation, resizing, cropping (JPEG, PNG, WebP)"},
	"intl":        {Name: "Intl (ICU)", Category: "Localization", Desc: "Internationalization, number/date formatting, collations"},
	"zip":         {Name: "Zip", Category: "Compression", Desc: "Read and write ZIP archives"},
	"bz2":         {Name: "Bzip2", Category: "Compression", Desc: "Bzip2 compression support"},
	"pdo_mysql":   {Name: "PDO MySQL", Category: "Database", Desc: "Database driver for MySQL / MariaDB via PDO"},
	"mysqli":      {Name: "MySQLi", Category: "Database", Desc: "Improved MySQL driver (procedural & OOP)"},
	"pdo_sqlite":  {Name: "PDO SQLite", Category: "Database", Desc: "SQLite 3 database driver via PDO"},
	"sqlite3":     {Name: "SQLite 3", Category: "Database", Desc: "SQLite database engine"},
	"pdo_pgsql":   {Name: "PDO PostgreSQL", Category: "Database", Desc: "PostgreSQL database driver via PDO"},
	"pgsql":       {Name: "PostgreSQL", Category: "Database", Desc: "Native PostgreSQL client driver"},
	"sodium":      {Name: "Sodium", Category: "Security", Desc: "Modern cryptography (Argon2, ChaCha20, Poly1305)"},
	"exif":        {Name: "EXIF", Category: "Media", Desc: "Read EXIF metadata from photos/camera images"},
	"ftp":         {Name: "FTP", Category: "Network", Desc: "File Transfer Protocol client functions"},
	"soap":        {Name: "SOAP", Category: "Network", Desc: "SOAP XML web services client and server"},
	"sockets":     {Name: "Sockets", Category: "Network", Desc: "Low-level socket communication"},
	"xmlrpc":      {Name: "XML-RPC", Category: "Network", Desc: "XML-RPC protocol functions"},
	"xsl":         {Name: "XSL", Category: "XML", Desc: "XSL transformations using libxslt"},
	"tidy":        {Name: "Tidy", Category: "Markup", Desc: "Clean and repair HTML/XML documents"},
	"ffi":         {Name: "FFI", Category: "Advanced", Desc: "Foreign Function Interface (call C functions from PHP)"},
	"opcache":     {Name: "Zend OPcache", Category: "Performance", Desc: "Precompiled script bytecode caching in shared memory", IsZend: true},
	"xdebug":      {Name: "Xdebug", Category: "Debugging", Desc: "Step debugger and profiler for PHP", IsZend: true},
}

type ExtensionInfo struct {
	ID          string `json:"id"`
	Name        string `json:"name"`
	DLL         string `json:"dll"`
	Category    string `json:"category"`
	Description string `json:"description"`
	IsZend      bool   `json:"isZend"`
	Enabled     bool   `json:"enabled"`
}

func ResolveVersionDir(versionId string) (string, error) {
	if versionId == "" || versionId == "current" {
		cur := GetCurrentVersion()
		if cur == nil {
			return "", fmt.Errorf("no active PHP version selected")
		}
		return cur.Path, nil
	}

	direct := filepath.Join(GetVersionsDir(), versionId)
	if fi, err := os.Stat(direct); err == nil && fi.IsDir() {
		return direct, nil
	}

	installed := GetInstalledVersions()
	for _, v := range installed {
		if strings.EqualFold(v.ID, versionId) || strings.EqualFold(v.Version, versionId) {
			return v.Path, nil
		}
	}

	return "", fmt.Errorf("PHP version '%s' not found", versionId)
}

func GetExtensions(versionId string) ([]ExtensionInfo, error) {
	vDir, err := ResolveVersionDir(versionId)
	if err != nil {
		return nil, err
	}

	phpIniPath := filepath.Join(vDir, "php.ini")
	iniContent := ""
	if b, err := os.ReadFile(phpIniPath); err == nil {
		iniContent = string(b)
	}

	extDir := filepath.Join(vDir, "ext")
	availableDlls := make(map[string]string)

	if entries, err := os.ReadDir(extDir); err == nil {
		for _, e := range entries {
			name := e.Name()
			if strings.HasSuffix(strings.ToLower(name), ".dll") {
				baseName := strings.TrimSuffix(name, filepath.Ext(name))
				baseName = strings.TrimPrefix(baseName, "php_")
				availableDlls[strings.ToLower(baseName)] = name
			}
		}
	}

	// OPcache check
	if _, ok := availableDlls["opcache"]; !ok {
		if _, err := os.Stat(filepath.Join(extDir, "php_opcache.dll")); err == nil {
			availableDlls["opcache"] = "php_opcache.dll"
		} else if _, err := os.Stat(filepath.Join(vDir, "php_opcache.dll")); err == nil {
			availableDlls["opcache"] = "php_opcache.dll"
		}
	}

	var list []ExtensionInfo
	for id, dll := range availableDlls {
		meta, ok := ExtensionMetadata[id]
		if !ok {
			meta = ExtMeta{
				Name:     strings.ToUpper(id),
				Category: "General",
				Desc:     fmt.Sprintf("PHP extension (%s)", dll),
			}
		}

		isZend := meta.IsZend || id == "opcache" || id == "xdebug"
		enabled := false

		if isZend {
			re := regexp.MustCompile(fmt.Sprintf(`(?mi)^\s*zend_extension\s*=\s*["']?(?:php_)?%s(?:\.dll)?["']?`, regexp.QuoteMeta(id)))
			enabled = re.MatchString(iniContent)
		} else {
			re := regexp.MustCompile(fmt.Sprintf(`(?mi)^\s*extension\s*=\s*["']?(?:php_)?%s(?:\.dll)?["']?`, regexp.QuoteMeta(id)))
			enabled = re.MatchString(iniContent)
		}

		list = append(list, ExtensionInfo{
			ID:          id,
			Name:        meta.Name,
			DLL:         dll,
			Category:    meta.Category,
			Description: meta.Desc,
			IsZend:      isZend,
			Enabled:     enabled,
		})
	}

	sort.Slice(list, func(i, j int) bool {
		if list[i].Category != list[j].Category {
			return list[i].Category < list[j].Category
		}
		return list[i].Name < list[j].Name
	})

	return list, nil
}

func SetExtensionStatus(versionId, extId string, enable bool) error {
	vDir, err := ResolveVersionDir(versionId)
	if err != nil {
		return err
	}

	phpIniPath := filepath.Join(vDir, "php.ini")
	b, err := os.ReadFile(phpIniPath)
	if err != nil {
		return fmt.Errorf("php.ini not found in %s", vDir)
	}
	content := string(b)

	cleanId := strings.ToLower(strings.TrimSuffix(strings.TrimPrefix(extId, "php_"), ".dll"))
	meta := ExtensionMetadata[cleanId]
	directiveKey := "extension"
	if meta.IsZend || cleanId == "opcache" || cleanId == "xdebug" {
		directiveKey = "zend_extension"
	}

	activePattern := regexp.MustCompile(fmt.Sprintf(`(?mi)^(\s*%s\s*=\s*["']?(?:php_)?%s(?:\.dll)?["']?.*)$`, regexp.QuoteMeta(directiveKey), regexp.QuoteMeta(cleanId)))
	commentedPattern := regexp.MustCompile(fmt.Sprintf(`(?mi)^(\s*;\s*%s\s*=\s*["']?(?:php_)?%s(?:\.dll)?["']?.*)$`, regexp.QuoteMeta(directiveKey), regexp.QuoteMeta(cleanId)))

	if enable {
		if activePattern.MatchString(content) {
			return nil // already enabled
		}
		if commentedPattern.MatchString(content) {
			content = commentedPattern.ReplaceAllStringFunc(content, func(m string) string {
				re := regexp.MustCompile(`^\s*;\s*`)
				return re.ReplaceAllString(m, "")
			})
		} else {
			marker := "; Module Settings ;"
			if strings.Contains(content, marker) {
				content = strings.Replace(content, marker, fmt.Sprintf("%s=%s\r\n\r\n%s", directiveKey, cleanId, marker), 1)
			} else {
				content += fmt.Sprintf("\r\n%s=%s\r\n", directiveKey, cleanId)
			}
		}
	} else {
		if activePattern.MatchString(content) {
			content = activePattern.ReplaceAllString(content, ";$1")
		}
	}

	return os.WriteFile(phpIniPath, []byte(content), 0644)
}

func GetDirectives(versionId string) (map[string]string, error) {
	vDir, err := ResolveVersionDir(versionId)
	if err != nil {
		return nil, err
	}

	phpIniPath := filepath.Join(vDir, "php.ini")
	b, err := os.ReadFile(phpIniPath)
	if err != nil {
		return nil, fmt.Errorf("php.ini not found")
	}
	content := string(b)

	result := map[string]string{
		"memory_limit":        "128M",
		"upload_max_filesize": "2M",
		"post_max_size":       "8M",
		"max_execution_time":  "30",
		"display_errors":      "Off",
		"date.timezone":       "UTC",
		"opcache.enable":      "1",
	}

	keys := []string{"memory_limit", "upload_max_filesize", "post_max_size", "max_execution_time", "display_errors", "date.timezone", "opcache.enable"}
	for _, k := range keys {
		re := regexp.MustCompile(fmt.Sprintf(`(?mi)^\s*%s\s*=\s*["']?([^;\r\n"']+)["']?`, regexp.QuoteMeta(k)))
		matches := re.FindStringSubmatch(content)
		if len(matches) > 1 {
			result[k] = strings.TrimSpace(matches[1])
		}
	}

	return result, nil
}

func UpdateDirectives(versionId string, updates map[string]string) error {
	vDir, err := ResolveVersionDir(versionId)
	if err != nil {
		return err
	}

	phpIniPath := filepath.Join(vDir, "php.ini")
	b, err := os.ReadFile(phpIniPath)
	if err != nil {
		return fmt.Errorf("php.ini not found")
	}
	content := string(b)

	for k, v := range updates {
		// Active pattern: k = ...
		reActive := regexp.MustCompile(fmt.Sprintf(`(?mi)^(\s*%s\s*=).*$`, regexp.QuoteMeta(k)))
		// Commented pattern: ;k = ...
		reCommented := regexp.MustCompile(fmt.Sprintf(`(?mi)^(\s*;\s*%s\s*=).*$`, regexp.QuoteMeta(k)))

		if reActive.MatchString(content) {
			content = reActive.ReplaceAllString(content, fmt.Sprintf("%s = %s", k, v))
		} else if reCommented.MatchString(content) {
			content = reCommented.ReplaceAllString(content, fmt.Sprintf("%s = %s", k, v))
		} else {
			content += fmt.Sprintf("\r\n%s = %s\r\n", k, v)
		}
	}

	return os.WriteFile(phpIniPath, []byte(content), 0644)
}
