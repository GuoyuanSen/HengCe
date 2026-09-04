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

function shouldQuitAfterOpeningUpdate(platform) {
  return platform === "darwin" || platform === "win32";
}

function releaseFromLatestUrl(value, repositoryUrl = "https://github.com/GuoyuanSen/HengCe") {
  const match = String(value || "").match(/\/releases\/tag\/(v?\d+(?:\.\d+){1,3})(?:[/?#]|$)/i);
  if (!match) return null;
  const tagName = match[1].startsWith("v") ? match[1] : `v${match[1]}`;
  const downloadBase = `${repositoryUrl}/releases/download/${tagName}`;
  const assetNames = [
    "HengCe-Apple-Silicon.dmg",
    "HengCe-Apple-Silicon.dmg.sha256",
    "HengCe-Windows-x64-Setup.exe",
    "HengCe-Windows-x64-Setup.exe.sha256"
  ];
  return {
    tag_name: tagName,
    name: `衡策 ${tagName}`,
    body: "",
    html_url: `${repositoryUrl}/releases/tag/${tagName}`,
    published_at: "",
    draft: false,
    prerelease: false,
    assets: assetNames.map((name) => ({
      name,
      size: 0,
      browser_download_url: `${downloadBase}/${name}`
    }))
  };
}

function releaseFromAtom(value, repositoryUrl = "https://github.com/GuoyuanSen/HengCe") {
  const decoded = String(value || "").replaceAll("&amp;", "&");
  const match = decoded.match(/https:\/\/github\.com\/GuoyuanSen\/HengCe\/releases\/tag\/v?\d+(?:\.\d+){1,3}/i);
  return match ? releaseFromLatestUrl(match[0], repositoryUrl) : null;
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
    currentAhead: comparison === -1,
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
  releaseFromAtom,
  releaseFromLatestUrl,
  releaseAssetName,
  shouldQuitAfterOpeningUpdate,
  versionParts
};
