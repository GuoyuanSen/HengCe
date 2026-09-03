const test = require("node:test");
const assert = require("node:assert/strict");
const {
  buildUpdateModel,
  compareVersions,
  parseChecksum,
  releaseAssetName,
  shouldQuitAfterOpeningUpdate
} = require("../electron/updater.js");

test("compares semantic release versions without string ordering errors", () => {
  assert.equal(compareVersions("v0.3.10", "0.3.9"), 1);
  assert.equal(compareVersions("0.3.2", "0.3.2"), 0);
  assert.equal(compareVersions("0.3.1", "0.3.2"), -1);
  assert.equal(compareVersions("not-a-version", "0.3.2"), null);
});

test("macOS and Windows quit after opening a verified installer", () => {
  assert.equal(shouldQuitAfterOpeningUpdate("darwin"), true);
  assert.equal(shouldQuitAfterOpeningUpdate("win32"), true);
  assert.equal(shouldQuitAfterOpeningUpdate("linux"), false);
});

test("selects the signed release installer for each supported platform", () => {
  assert.equal(releaseAssetName("darwin", "arm64"), "HengCe-Apple-Silicon.dmg");
  assert.equal(releaseAssetName("win32", "x64"), "HengCe-Windows-x64-Setup.exe");
  assert.equal(releaseAssetName("linux", "x64"), null);
});

test("requires both installer and checksum before offering an update", () => {
  const release = {
    tag_name: "v0.3.3",
    name: "衡策 v0.3.3",
    body: "更新说明",
    html_url: "https://github.com/GuoyuanSen/HengCe/releases/tag/v0.3.3",
    assets: [
      { name: "HengCe-Apple-Silicon.dmg", size: 100, browser_download_url: "https://example.test/app.dmg" },
      { name: "HengCe-Apple-Silicon.dmg.sha256", size: 91, browser_download_url: "https://example.test/app.sha256" }
    ]
  };
  const model = buildUpdateModel(release, "0.3.2", "darwin", "arm64");
  assert.equal(model.available, true);
  assert.equal(model.assetName, "HengCe-Apple-Silicon.dmg");
  assert.equal(model._checksumUrl, "https://example.test/app.sha256");
});

test("parses only the checksum for the expected installer", () => {
  const digest = "a".repeat(64);
  assert.equal(parseChecksum(`${digest}  HengCe-Apple-Silicon.dmg\n`, "HengCe-Apple-Silicon.dmg"), digest);
  assert.equal(parseChecksum(`${digest}  other.dmg\n`, "HengCe-Apple-Silicon.dmg"), null);
});
