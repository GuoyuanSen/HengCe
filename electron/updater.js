function versionParts(value) {
  const normalized = String(value || "")
    .trim()
    .replace(/^v/i, "")
    .split("-")[0];
  if (!/^\d+(?:\.\d+){0,3}$/.test(normalized)) return null;
  return normalized.split(".").map(Number);
}

function compareVersions(left, right) {
  const leftParts = versionParts(left);
  const rightParts = versionParts(right);
  if (!leftParts || !rightParts) return null;
  const length = Math.max(leftParts.length, rightParts.length);
  for (let index = 0; index < length; index += 1) {
    const difference = (leftParts[index] || 0) - (rightParts[index] || 0);
    if (difference) return difference > 0 ? 1 : -1;
  }
  return 0;
}

function releaseAssetName(platform, arch) {
  if (platform === "darwin" && arch === "arm64") {
    return "HengCe-Apple-Silicon.dmg";
  }
  if (platform === "win32" && arch === "x64") {
    return "HengCe-Windows-x64-Setup.exe";
  }
  return null;
}

function buildUpdateModel(release, currentVersion, platform, arch) {
  const assetName = releaseAssetName(platform, arch);
  const latestVersion = String(release?.tag_name || "").replace(/^v/i, "");
  const comparison = compareVersions(latestVersion, currentVersion);
  const assets = Array.isArray(release?.assets) ? release.assets : [];
  const asset = assets.find((item) => item?.name === assetName);
  const checksumAsset = assets.find(
    (item) => item?.name === `${assetName}.sha256`
  );
  const supported = Boolean(assetName);
  const downloadable = Boolean(asset && checksumAsset);
  return {
    currentVersion: String(currentVersion),
    latestVersion: latestVersion || String(currentVersion),
    tagName: String(release?.tag_name || ""),
    releaseName: String(release?.name || release?.tag_name || "最新版本"),
    releaseNotes: String(release?.body || "").trim(),
    releaseUrl: String(release?.html_url || ""),
    publishedAt: String(release?.published_at || ""),
    assetName,
    assetSize: Number(asset?.size || 0),
    supported,
    downloadable,
    available:
      !release?.draft &&
      !release?.prerelease &&
      comparison === 1 &&
      supported &&
      downloadable,
    _assetUrl: String(asset?.browser_download_url || ""),
    _checksumUrl: String(checksumAsset?.browser_download_url || "")
  };
}

function parseChecksum(text, expectedFileName) {
  for (const line of String(text || "").split(/\r?\n/)) {
    const match = line.trim().match(/^([a-f\d]{64})\s+\*?(.+)$/i);
    if (match && match[2].trim() === expectedFileName) {
      return match[1].toLowerCase();
    }
  }
  return null;
}

function publicUpdateModel(model) {
  const { _assetUrl, _checksumUrl, ...safe } = model;
  return safe;
}

module.exports = {
  buildUpdateModel,
  compareVersions,
  parseChecksum,
  publicUpdateModel,
  releaseAssetName,
  versionParts
};
