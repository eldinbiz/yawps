const BASE_RELEASES_URL = 'https://windows.php.net/downloads/releases/';
const RELEASES_JSON_URL = `${BASE_RELEASES_URL}releases.json`;

/**
 * Fetch and parse all releases from windows.php.net
 */
async function fetchReleases() {
  const response = await fetch(RELEASES_JSON_URL, {
    headers: {
      'User-Agent': 'YAWPS/0.1.0'
    }
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch PHP releases: HTTP ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  const releases = [];

  for (const [branch, branchData] of Object.entries(data)) {
    const version = branchData.version;
    if (!version) continue;

    for (const [key, buildData] of Object.entries(branchData)) {
      if (key === 'version' || key === 'source' || key.includes('pack')) continue;

      // Key format: e.g. "nts-vs16-x64", "ts-vc15-x86", "nts-vs17-x64"
      const match = key.match(/^(nts|ts)-([a-z0-9]+)-(x64|x86)$/i);
      if (!match) continue;

      const [, type, compiler, arch] = match;
      const zip = buildData.zip;
      if (!zip || !zip.path) continue;

      releases.push({
        branch,
        version,
        type: type.toLowerCase(), // 'nts' or 'ts'
        compiler,
        arch: arch.toLowerCase(), // 'x64' or 'x86'
        zipName: zip.path,
        url: `${BASE_RELEASES_URL}${zip.path}`,
        archiveUrl: `${BASE_RELEASES_URL}archives/${zip.path}`,
        sha256: zip.sha256 || null,
        size: zip.size || 'Unknown',
        mtime: buildData.mtime || null,
        id: `php-${version}-${type.toLowerCase()}-${arch.toLowerCase()}`
      });
    }
  }

  // Sort descending by version
  releases.sort((a, b) => compareVersions(b.version, a.version));
  return releases;
}

/**
 * Semantic version comparison
 */
function compareVersions(v1, v2) {
  const parts1 = v1.split('.').map(p => parseInt(p, 10) || 0);
  const parts2 = v2.split('.').map(p => parseInt(p, 10) || 0);
  const maxLen = Math.max(parts1.length, parts2.length);

  for (let i = 0; i < maxLen; i++) {
    const p1 = parts1[i] || 0;
    const p2 = parts2[i] || 0;
    if (p1 > p2) return 1;
    if (p1 < p2) return -1;
  }
  return 0;
}

/**
 * Find matching release by query (e.g. "8.3", "8.3.36", "latest")
 */
async function findRelease(query, { type = 'nts', arch = 'x64' } = {}) {
  const releases = await fetchReleases();
  const normalizedType = type.toLowerCase();
  const normalizedArch = arch.toLowerCase();

  const candidates = releases.filter(
    r => r.type === normalizedType && r.arch === normalizedArch
  );

  if (!query || query.toLowerCase() === 'latest') {
    return candidates[0] || null;
  }

  const cleanQuery = query.replace(/^php-/i, '').trim();

  // 1. Exact version match: e.g. "8.3.36"
  const exact = candidates.find(r => r.version === cleanQuery);
  if (exact) return exact;

  // 2. Branch match: e.g. "8.3" -> highest 8.3.x
  const branchMatches = candidates.filter(
    r => r.branch === cleanQuery || r.version.startsWith(`${cleanQuery}.`)
  );
  if (branchMatches.length > 0) {
    return branchMatches[0];
  }

  // 3. Match major version: e.g. "8" -> highest 8.x
  const majorMatches = candidates.filter(
    r => r.version.startsWith(`${cleanQuery}.`)
  );
  if (majorMatches.length > 0) {
    return majorMatches[0];
  }

  return null;
}

module.exports = {
  fetchReleases,
  findRelease,
  compareVersions
};
