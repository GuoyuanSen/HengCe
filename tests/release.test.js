const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const packageJson = require(path.join(root, "package.json"));
const windowsBuild = fs.readFileSync(
  path.join(root, "scripts", "build_windows.js"),
  "utf8"
);
const installer = fs.readFileSync(
  path.join(root, "scripts", "windows-installer.iss"),
  "utf8"
);
const workflow = fs.readFileSync(
  path.join(root, ".github", "workflows", "build-windows.yml"),
  "utf8"
);
const releaseWorkflow = fs.readFileSync(
  path.join(root, ".github", "workflows", "release.yml"),
  "utf8"
);
const macBuild = fs.readFileSync(path.join(root, "scripts", "build.js"), "utf8");

test("release version is synchronized for v0.6.0", () => {
  assert.equal(packageJson.version, "0.6.0");
  assert.match(packageJson.scripts["build:win"], /build_windows\.js/);
  assert.match(macBuild, /ELECTRON_ZIP_DIR/);
  assert.match(macBuild, /CFBundleIconFile/);
  assert.match(macBuild, /AppIcon\.icns/);
});

test("tag workflow builds both platforms and publishes release assets", () => {
  assert.match(releaseWorkflow, /tags:\s*\["v\*"\]/);
  assert.match(releaseWorkflow, /runs-on:\s*macos-14/);
  assert.match(releaseWorkflow, /runs-on:\s*windows-2022/);
  assert.match(releaseWorkflow, /gh release create/);
  assert.match(releaseWorkflow, /RELEASE_NOTES_\$\{GITHUB_REF_NAME\}\.md/);
  assert.match(releaseWorkflow, /contents:\s*write/);
});

test("Windows build targets x64 and emits installer and portable checksums", () => {
  assert.match(windowsBuild, /platform:\s*"win32"/);
  assert.match(windowsBuild, /arch:\s*"x64"/);
  assert.match(windowsBuild, /HengCe-Windows-x64-Setup\.exe/);
  assert.match(windowsBuild, /HengCe-Windows-x64-Portable\.zip/);
  assert.match(windowsBuild, /writeChecksum\(portableZip\)/);
  assert.match(windowsBuild, /writeChecksum\(installer\)/);
  assert.match(windowsBuild, /"requested-execution-level":\s*"asInvoker"/);
  assert.match(windowsBuild, /DLanguageFile/);
  assert.match(installer, /MessagesFile:\s*"\{#LanguageFile\}"/);
});

test("Windows installer preserves user data and avoids administrator rights", () => {
  assert.match(installer, /DefaultDirName=\{localappdata\}\\Programs\\HengCe/);
  assert.match(installer, /PrivilegesRequired=lowest/);
  assert.doesNotMatch(installer, /\[UninstallDelete\]/);
  assert.match(installer, /ArchitecturesAllowed=x64compatible/);
});

test("Windows workflow runs tests, smoke test, and artifact verification", () => {
  assert.match(workflow, /runs-on:\s*windows-2022/);
  assert.match(workflow, /pnpm test/);
  assert.match(workflow, /HENGCE_CAPTURE_PATH/);
  assert.match(workflow, /HENGCE_TRAY_SMOKE_PATH/);
  assert.match(workflow, /Tray smoke test failed/);
  assert.match(workflow, /actions\/upload-artifact@v4/);
  assert.match(workflow, /retention-days:\s*7/);
});
