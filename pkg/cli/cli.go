package cli

import (
	"fmt"
	"os"
	"os/exec"
	"strings"
	"yawps/pkg/core"
)

func Run(args []string) bool {
	if len(args) == 0 {
		return false // Launch GUI
	}

	cmd := strings.ToLower(args[0])

	switch cmd {
	case "gui", "ui":
		return false // Launch GUI

	case "list", "ls":
		handleList()
		return true

	case "list-remote", "available":
		handleListRemote(args[1:])
		return true

	case "install":
		handleInstall(args[1:])
		return true

	case "use":
		handleUse(args[1:])
		return true

	case "current":
		handleCurrent()
		return true

	case "update":
		handleUpdate(args[1:])
		return true

	case "ext":
		handleExt(args[1:])
		return true

	case "env":
		handleEnv(args[1:])
		return true

	case "cache":
		handleCache(args[1:])
		return true

	case "cleanup":
		handleCleanup(args[1:])
		return true

	case "uninstall", "remove":
		handleUninstall(args[1:])
		return true

	case "help", "--help", "-h":
		printHelp()
		return true

	case "version", "--version", "-v":
		fmt.Println("YAWPS v0.1.0 (Yet Another Windows PHP Switcher)")
		return true

	default:
		fmt.Printf("Unknown command: %s\nRun 'yawps --help' for available commands.\n", cmd)
		return true
	}
}

func handleList() {
	installed := core.GetInstalledVersions()
	if len(installed) == 0 {
		fmt.Println("\nNo PHP versions installed yet.")
		fmt.Println("Run 'yawps install <version>' to install one (e.g. yawps install 8.3).")
		return
	}

	fmt.Println("\n📦 Installed PHP Versions:")
	for _, v := range installed {
		activeMarker := "  "
		tag := ""
		if v.IsActive {
			activeMarker = "★ "
			tag = " (active)"
		}
		fmt.Printf(" %s%-16s %-6s %-5s %s%s\n", activeMarker, v.ID, strings.ToUpper(v.Type), v.Arch, v.Path, tag)
	}
	fmt.Println("")
}

func handleListRemote(args []string) {
	relType := "nts"
	arch := "x64"

	for _, a := range args {
		if a == "--ts" {
			relType = "ts"
		} else if a == "--x86" {
			arch = "x86"
		}
	}

	fmt.Println("\n🔍 Fetching official PHP releases from windows.php.net...")
	releases, err := core.FetchRemoteReleases()
	if err != nil {
		fmt.Printf("Error fetching releases: %v\n", err)
		return
	}

	fmt.Printf("\nAvailable Official Releases (%s %s):\n", strings.ToUpper(relType), arch)
	count := 0
	for _, r := range releases {
		if r.Type == relType && r.Arch == arch {
			fmt.Printf("  • %-12s (PHP %s, %s)\n", r.ID, r.Version, r.Compiler)
			count++
			if count >= 15 {
				break
			}
		}
	}
	fmt.Printf("\nShowing top %d %s x64 releases. Use --ts for Thread Safe.\n\n", count, strings.ToUpper(relType))
}

func handleInstall(args []string) {
	if len(args) == 0 {
		fmt.Println("Usage: yawps install <version> [--ts] [--x86]")
		return
	}

	query := args[0]
	relType := "nts"
	arch := "x64"

	for _, a := range args[1:] {
		if a == "--ts" {
			relType = "ts"
		} else if a == "--x86" {
			arch = "x86"
		}
	}

	fmt.Printf("\n⚡ Starting installation for PHP '%s' (%s %s)...\n", query, strings.ToUpper(relType), arch)

	onProgress := func(p core.ProgressInfo) {
		fmt.Printf("\r[%3d%%] %-60s", p.Percent, p.Message)
	}

	res, err := core.InstallVersion(query, relType, arch, onProgress)
	fmt.Println("")

	if err != nil {
		fmt.Printf("\n❌ Installation failed: %v\n\n", err)
		return
	}

	if res.AlreadyInstalled {
		fmt.Printf("\nℹ PHP %s is already installed in %s\n\n", res.Release.Version, res.TargetDir)
	} else {
		fmt.Printf("\n✔ Successfully installed PHP %s in %s\n", res.Release.Version, res.TargetDir)
	}

	// Switch to it
	_, _ = core.SwitchVersion(res.Release.ID)
	fmt.Printf("★ Switched active PHP to: %s\n\n", res.Release.ID)
}

func handleUse(args []string) {
	if len(args) == 0 {
		fmt.Println("Usage: yawps use <version>")
		return
	}
	target, err := core.SwitchVersion(args[0])
	if err != nil {
		fmt.Printf("\n❌ Error: %v\n\n", err)
		return
	}
	fmt.Printf("\n✔ Active PHP switched to: %s (%s)\n\n", target.ID, target.Path)
}

func handleCurrent() {
	cur := core.GetCurrentVersion()
	if cur == nil {
		fmt.Println("\nNo PHP version currently active. Use 'yawps use <version>' to activate one.")
		return
	}

	fmt.Printf("\n★ Active PHP Version: %s\n", cur.ID)
	fmt.Printf("  Junction: %s -> %s\n\n", core.GetCurrentLink(), cur.Path)

	// Run php -v
	cmd := exec.Command(cur.PhpExe, "-v")
	cmd.Stdout = os.Stdout
	cmd.Stderr = os.Stderr
	_ = cmd.Run()
	fmt.Println("")
}

func handleUpdate(args []string) {
	fmt.Println("\n🔍 Checking for official patch updates...")
	updates, err := core.CheckUpdates()
	if err != nil {
		fmt.Printf("Error checking updates: %v\n", err)
		return
	}

	if len(updates) == 0 {
		fmt.Println("✔ All installed PHP versions are up to date!")
		return
	}

	for _, u := range updates {
		fmt.Printf("  • %s -> %s available\n", u.CurrentVersion, u.LatestVersion)
	}
	fmt.Println("")
}

func handleExt(args []string) {
	if len(args) == 0 || args[0] == "list" {
		versionId := ""
		if len(args) > 1 {
			versionId = args[1]
		}
		exts, err := core.GetExtensions(versionId)
		if err != nil {
			fmt.Printf("Error: %v\n", err)
			return
		}
		fmt.Println("\n🧩 PHP Extensions:")
		for _, e := range exts {
			status := "○ disabled"
			if e.Enabled {
				status = "● enabled "
			}
			fmt.Printf("  [%s] %-14s (%s - %s)\n", status, e.ID, e.Category, e.Name)
		}
		fmt.Println("")
		return
	}

	sub := args[0]
	if sub == "enable" || sub == "disable" {
		if len(args) < 2 {
			fmt.Printf("Usage: yawps ext %s <extension> [version]\n", sub)
			return
		}
		extName := args[1]
		versionId := ""
		if len(args) > 2 {
			versionId = args[2]
		}

		enable := sub == "enable"
		err := core.SetExtensionStatus(versionId, extName, enable)
		if err != nil {
			fmt.Printf("Error: %v\n", err)
			return
		}
		action := "Disabled"
		if enable {
			action = "Enabled"
		}
		fmt.Printf("\n✔ %s extension '%s'.\n\n", action, extName)
		return
	}

	fmt.Println("Usage: yawps ext [list|enable|disable] <extension> [version]")
}

func handleEnv(args []string) {
	if len(args) == 0 || args[0] == "check" || args[0] == "status" {
		status := core.CheckPathStatus()
		osInfo := core.GetWindowsVersionInfo()

		fmt.Println("\n🌐 Windows & PATH Status:")
		fmt.Printf("Operating System: %s (%s) ✔ Supported (Windows 10+)\n", osInfo.OSName, osInfo.Kernel)
		fmt.Printf("Current Junction: %s\n", status.CurrentLink)
		inPathStr := "✖ No"
		if status.IsInUserPath {
			inPathStr = "✔ Yes"
		}
		fmt.Printf("In User PATH:     %s\n", inPathStr)
		fmt.Println("Active 'where php':")
		if len(status.ActivePhpLocations) > 0 {
			for _, loc := range status.ActivePhpLocations {
				isOurs := strings.HasPrefix(strings.ToLower(loc), strings.ToLower(status.CurrentLink))
				note := "(external)"
				if isOurs {
					note = "(managed by YAWPS)"
				}
				fmt.Printf("  - %s %s\n", loc, note)
			}
		} else {
			fmt.Println("  No php.exe detected in PATH.")
		}
		fmt.Println("")
		return
	}

	if args[0] == "fix" {
		if err := core.AddToUserPath(); err != nil {
			fmt.Printf("Error: %v\n", err)
			return
		}
		fmt.Println("\n✔ Successfully added to User PATH! New terminals will pick up changes immediately.")
	} else if args[0] == "remove" || args[0] == "unlink" {
		if err := core.RemoveFromUserPath(); err != nil {
			fmt.Printf("Error: %v\n", err)
			return
		}
		fmt.Println("\n✔ Removed YAWPS current junction from User PATH.")
	}
}

func handleCache(args []string) {
	if len(args) > 0 && args[0] == "clean" {
		deleted, err := core.CleanCachedArchives("")
		if err != nil {
			fmt.Printf("Error: %v\n", err)
			return
		}
		fmt.Printf("\n✔ Deleted %d cached zip archive(s).\n\n", len(deleted))
	}
}

func handleUninstall(args []string) {
	if len(args) == 0 {
		fmt.Println("Usage: yawps uninstall <version> [--clean-cache]")
		return
	}
	cleanCache := false
	for _, a := range args[1:] {
		if a == "--clean-cache" {
			cleanCache = true
		}
	}
	res, err := core.UninstallVersion(args[0], cleanCache)
	if err != nil {
		fmt.Printf("Error: %v\n", err)
		return
	}
	msg := fmt.Sprintf("\n✔ Successfully uninstalled PHP %s.", res.Target.Version)
	if res.SwitchedTo != nil {
		msg += fmt.Sprintf(" (Switched active to %s)", res.SwitchedTo.Version)
	}
	fmt.Println(msg)
	fmt.Println("")
}

func handleCleanup(args []string) {
	purgeAll := false
	for _, a := range args {
		if a == "--purge" || a == "--all" {
			purgeAll = true
		}
	}
	res := core.FullCleanup(purgeAll)
	fmt.Println("\n✨ YAWPS cleanup completed successfully!")
	fmt.Println("✔ Removed from Windows User PATH.")
	if res.BaseDirDeleted {
		fmt.Println("✔ Deleted " + core.GetBaseDir() + " directory.")
	}
	fmt.Println("")
}

func printHelp() {
	fmt.Print(`
⚡ YAWPS - Yet Another Windows PHP Switcher

Usage: yawps [command] [options]

Commands:
  list, ls                              List all installed PHP versions
  list-remote, available [--ts]         List available PHP versions from windows.php.net
  install <version> [--ts] [--x86]      Download, install, and configure a PHP version
  use <version>                         Switch the active PHP version
  current                               Show active version and run php -v
  update [version]                      Check and install patch updates
  ext list [version]                    List available extensions
  ext enable <ext> [version]            Enable an extension in php.ini
  ext disable <ext> [version]           Disable an extension in php.ini
  env check                             Check PATH and junction health
  env fix                               Add YAWPS current junction to User PATH
  env remove                            Remove from User PATH
  cache clean                           Clean downloaded zip archives
  uninstall <version> [--clean-cache]   Uninstall an installed PHP version
  cleanup [--purge]                     Decouple PATH, unlink junction, and purge data
  gui, ui                               Launch the dedicated Desktop Window GUI
  help, --help                          Show this help message
`)
}
