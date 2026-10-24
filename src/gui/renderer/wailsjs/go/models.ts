export namespace core {
	
	export class CleanupResult {
	    baseDirDeleted: boolean;
	    pathRemoved: boolean;
	    junctionRemoved: boolean;
	
	    static createFrom(source: any = {}) {
	        return new CleanupResult(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.baseDirDeleted = source["baseDirDeleted"];
	        this.pathRemoved = source["pathRemoved"];
	        this.junctionRemoved = source["junctionRemoved"];
	    }
	}
	export class ComposerGlobalPackage {
	    name: string;
	    version: string;
	    constraint: string;
	    description: string;
	    homepage: string;
	    license: string[];
	    binaries: string[];
	    time: string;
	    isOutdated: boolean;
	    latest: string;
	
	    static createFrom(source: any = {}) {
	        return new ComposerGlobalPackage(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.version = source["version"];
	        this.constraint = source["constraint"];
	        this.description = source["description"];
	        this.homepage = source["homepage"];
	        this.license = source["license"];
	        this.binaries = source["binaries"];
	        this.time = source["time"];
	        this.isOutdated = source["isOutdated"];
	        this.latest = source["latest"];
	    }
	}
	export class ComposerOperationResult {
	    success: boolean;
	    output: string;
	    error?: string;
	
	    static createFrom(source: any = {}) {
	        return new ComposerOperationResult(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.success = source["success"];
	        this.output = source["output"];
	        this.error = source["error"];
	    }
	}
	export class ComposerStatus {
	    installed: boolean;
	    version: string;
	    releaseDate: string;
	    location: string;
	    pharPath: string;
	    isYawpsManaged: boolean;
	    latestVersion: string;
	    isUpToDate: boolean;
	    activePhp: string;
	    activePhpPath: string;
	    composerHome: string;
	    globalBinDir: string;
	    isBinInPath: boolean;
	    isGlobalBinInPath: boolean;
	    packagesCount: number;
	
	    static createFrom(source: any = {}) {
	        return new ComposerStatus(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.installed = source["installed"];
	        this.version = source["version"];
	        this.releaseDate = source["releaseDate"];
	        this.location = source["location"];
	        this.pharPath = source["pharPath"];
	        this.isYawpsManaged = source["isYawpsManaged"];
	        this.latestVersion = source["latestVersion"];
	        this.isUpToDate = source["isUpToDate"];
	        this.activePhp = source["activePhp"];
	        this.activePhpPath = source["activePhpPath"];
	        this.composerHome = source["composerHome"];
	        this.globalBinDir = source["globalBinDir"];
	        this.isBinInPath = source["isBinInPath"];
	        this.isGlobalBinInPath = source["isGlobalBinInPath"];
	        this.packagesCount = source["packagesCount"];
	    }
	}
	export class ComposerUninstallResult {
	    success: boolean;
	    executablesDeleted: boolean;
	    pathCleaned: boolean;
	    cacheDeleted: boolean;
	    packagesPurged: boolean;
	    globalBinPathRemoved: boolean;
	    deletedPaths: string[];
	    message: string;
	
	    static createFrom(source: any = {}) {
	        return new ComposerUninstallResult(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.success = source["success"];
	        this.executablesDeleted = source["executablesDeleted"];
	        this.pathCleaned = source["pathCleaned"];
	        this.cacheDeleted = source["cacheDeleted"];
	        this.packagesPurged = source["packagesPurged"];
	        this.globalBinPathRemoved = source["globalBinPathRemoved"];
	        this.deletedPaths = source["deletedPaths"];
	        this.message = source["message"];
	    }
	}
	export class ExtensionInfo {
	    id: string;
	    name: string;
	    dll: string;
	    category: string;
	    description: string;
	    isZend: boolean;
	    enabled: boolean;
	
	    static createFrom(source: any = {}) {
	        return new ExtensionInfo(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.name = source["name"];
	        this.dll = source["dll"];
	        this.category = source["category"];
	        this.description = source["description"];
	        this.isZend = source["isZend"];
	        this.enabled = source["enabled"];
	    }
	}
	export class ReleaseInfo {
	    id: string;
	    branch: string;
	    version: string;
	    type: string;
	    compiler: string;
	    arch: string;
	    zipName: string;
	    url: string;
	    archiveUrl: string;
	    sha256: string;
	    size: string;
	
	    static createFrom(source: any = {}) {
	        return new ReleaseInfo(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.branch = source["branch"];
	        this.version = source["version"];
	        this.type = source["type"];
	        this.compiler = source["compiler"];
	        this.arch = source["arch"];
	        this.zipName = source["zipName"];
	        this.url = source["url"];
	        this.archiveUrl = source["archiveUrl"];
	        this.sha256 = source["sha256"];
	        this.size = source["size"];
	    }
	}
	export class InstallResult {
	    targetDir: string;
	    alreadyInstalled: boolean;
	    release?: ReleaseInfo;
	
	    static createFrom(source: any = {}) {
	        return new InstallResult(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.targetDir = source["targetDir"];
	        this.alreadyInstalled = source["alreadyInstalled"];
	        this.release = this.convertValues(source["release"], ReleaseInfo);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class PathStatus {
	    currentLink: string;
	    isInUserPath: boolean;
	    activePhpLocations: string[];
	    isPrimary: boolean;
	
	    static createFrom(source: any = {}) {
	        return new PathStatus(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.currentLink = source["currentLink"];
	        this.isInUserPath = source["isInUserPath"];
	        this.activePhpLocations = source["activePhpLocations"];
	        this.isPrimary = source["isPrimary"];
	    }
	}
	
	export class VersionInfo {
	    id: string;
	    path: string;
	    version: string;
	    type: string;
	    arch: string;
	    isActive: boolean;
	    phpExe: string;
	    phpIni: string;
	
	    static createFrom(source: any = {}) {
	        return new VersionInfo(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.path = source["path"];
	        this.version = source["version"];
	        this.type = source["type"];
	        this.arch = source["arch"];
	        this.isActive = source["isActive"];
	        this.phpExe = source["phpExe"];
	        this.phpIni = source["phpIni"];
	    }
	}
	export class UninstallResult {
	    success: boolean;
	    target?: VersionInfo;
	    wasActive: boolean;
	    switchedTo?: VersionInfo;
	    deletedCacheFiles: string[];
	
	    static createFrom(source: any = {}) {
	        return new UninstallResult(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.success = source["success"];
	        this.target = this.convertValues(source["target"], VersionInfo);
	        this.wasActive = source["wasActive"];
	        this.switchedTo = this.convertValues(source["switchedTo"], VersionInfo);
	        this.deletedCacheFiles = source["deletedCacheFiles"];
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class UpdateItem {
	    currentVersion: string;
	    latestVersion: string;
	    release?: ReleaseInfo;
	    hasUpdate: boolean;
	
	    static createFrom(source: any = {}) {
	        return new UpdateItem(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.currentVersion = source["currentVersion"];
	        this.latestVersion = source["latestVersion"];
	        this.release = this.convertValues(source["release"], ReleaseInfo);
	        this.hasUpdate = source["hasUpdate"];
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	
	export class WindowsVersionInfo {
	    isWindows: boolean;
	    isSupported: boolean;
	    major: number;
	    minor: number;
	    build: number;
	    kernel: string;
	    osName: string;
	    errorMessage: string;
	
	    static createFrom(source: any = {}) {
	        return new WindowsVersionInfo(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.isWindows = source["isWindows"];
	        this.isSupported = source["isSupported"];
	        this.major = source["major"];
	        this.minor = source["minor"];
	        this.build = source["build"];
	        this.kernel = source["kernel"];
	        this.osName = source["osName"];
	        this.errorMessage = source["errorMessage"];
	    }
	}

}

export namespace main {
	
	export class StateResult {
	    current?: core.VersionInfo;
	    installed: core.VersionInfo[];
	    pathStatus: core.PathStatus;
	    osInfo: core.WindowsVersionInfo;
	    currentLink: string;
	
	    static createFrom(source: any = {}) {
	        return new StateResult(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.current = this.convertValues(source["current"], core.VersionInfo);
	        this.installed = this.convertValues(source["installed"], core.VersionInfo);
	        this.pathStatus = this.convertValues(source["pathStatus"], core.PathStatus);
	        this.osInfo = this.convertValues(source["osInfo"], core.WindowsVersionInfo);
	        this.currentLink = source["currentLink"];
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class SwitchResult {
	    success: boolean;
	    target?: core.VersionInfo;
	    current?: core.VersionInfo;
	    pathStatus: core.PathStatus;
	
	    static createFrom(source: any = {}) {
	        return new SwitchResult(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.success = source["success"];
	        this.target = this.convertValues(source["target"], core.VersionInfo);
	        this.current = this.convertValues(source["current"], core.VersionInfo);
	        this.pathStatus = this.convertValues(source["pathStatus"], core.PathStatus);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}

}

