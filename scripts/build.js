const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { spawnSync } = require("child_process");

const root = path.resolve(__dirname, "..");
const buildRoot = path.join(root, "build");
const stagingRoot = path.join(buildRoot, "staging");
const packageRoot = path.join(buildRoot, "package");
const distRoot = path.join(root, "dist");
const appName = "衡策";
const finalApp = path.join(distRoot, `${appName}.app`);
const finalDmg = path.join(distRoot, "HengCe-Apple-Silicon.dmg");
const finalChecksum = `${finalDmg}.sha256`;
const iconFile = path.join(root, "Resources", "AppIcon.icns");
const appVersion = require(path.join(root, "package.json")).version;

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: root,
    stdio: "inherit",
    ...options
  });
  if (result.status !== 0) {
    throw new Error(`${command} 执行失败，退出码 ${result.status}`);
  }
}

function tryRun(command, args, options = {}) {
  return spawnSync(command, args, {
    cwd: root,
    stdio: "inherit",
    ...options
  });
}

function copyIntoStaging(source, destination) {
  const target = path.join(stagingRoot, destination);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.cpSync(path.join(root, source), target, {
    recursive: true
  });
}

function prepareStaging() {
  const sourcePackage = JSON.parse(
    fs.readFileSync(path.join(root, "package.json"), "utf8")
  );
  const runtimePackage = {
    name: sourcePackage.name,
    version: sourcePackage.version,
    description: sourcePackage.description,
    author: sourcePackage.author,
    license: sourcePackage.license,
    main: sourcePackage.main
  };

  fs.mkdirSync(stagingRoot, { recursive: true });
  fs.writeFileSync(
    path.join(stagingRoot, "package.json"),
    `${JSON.stringify(runtimePackage, null, 2)}\n`
  );
  copyIntoStaging("electron", "electron");
  copyIntoStaging("src", "src");
  copyIntoStaging("Resources/AppIcon.png", "Resources/AppIcon.png");
  copyIntoStaging("LICENSE", "LICENSE");
  copyIntoStaging("THIRD_PARTY.md", "THIRD_PARTY.md");
  copyIntoStaging(
    "node_modules/lucide/LICENSE",
    "node_modules/lucide/LICENSE"
  );
  copyIntoStaging(
    "node_modules/lucide/dist/umd/lucide.min.js",
    "node_modules/lucide/dist/umd/lucide.min.js"
  );
}

function writeChecksum(file, destination) {
  const digest = crypto
    .createHash("sha256")
    .update(fs.readFileSync(file))
    .digest("hex");
  fs.writeFileSync(destination, `${digest}  ${path.basename(file)}\n`);
}

async function main() {
  const { packager } = await import("@electron/packager");
  const electronVersion = require("electron/package.json").version;
  fs.rmSync(buildRoot, { recursive: true, force: true });
  fs.rmSync(distRoot, { recursive: true, force: true });
  fs.mkdirSync(packageRoot, { recursive: true });
  fs.mkdirSync(distRoot, { recursive: true });
  prepareStaging();

  const appPaths = await packager({
    dir: stagingRoot,
    name: appName,
    platform: "darwin",
    arch: "arm64",
    electronVersion,
    electronZipDir: process.env.ELECTRON_ZIP_DIR || undefined,
    download: {
      cacheRoot:
        process.env.ELECTRON_CACHE || path.join(buildRoot, "electron-cache")
    },
    out: packageRoot,
    overwrite: true,
    icon: iconFile,
    appBundleId: "com.guoyuansen.hengce",
    appVersion,
    buildVersion: "13",
    appCategoryType: "public.app-category.finance",
    asar: true,
    prune: false
  });
  const outputDirectory = appPaths[0];
  const packagedApp = outputDirectory
    ? path.join(outputDirectory, `${appName}.app`)
    : null;
  if (!packagedApp || !fs.existsSync(packagedApp)) {
    throw new Error("Electron Packager 未返回有效的 .app 路径");
  }

  const infoPlist = path.join(packagedApp, "Contents", "Info.plist");
  const packagedIcon = path.join(packagedApp, "Contents", "Resources", "AppIcon.icns");
  fs.copyFileSync(iconFile, packagedIcon);
  run("/usr/bin/plutil", [
    "-replace",
    "CFBundleIconFile",
    "-string",
    "AppIcon.icns",
    infoPlist
  ]);
  [
    "NSAudioCaptureUsageDescription",
    "NSBluetoothAlwaysUsageDescription",
    "NSBluetoothPeripheralUsageDescription",
    "NSCameraUsageDescription",
    "NSMicrophoneUsageDescription"
  ].forEach((key) => {
    tryRun("/usr/bin/plutil", ["-remove", key, infoPlist]);
  });
  run("/usr/bin/plutil", [
    "-replace",
    "NSAppTransportSecurity.NSAllowsArbitraryLoads",
    "-bool",
    "NO",
    infoPlist
  ]);

  run("/usr/bin/codesign", [
    "--force",
    "--deep",
    "--sign",
    "-",
    packagedApp
  ]);
  run("/usr/bin/ditto", [packagedApp, finalApp]);

  const dmgRoot = path.join(buildRoot, "dmg");
  fs.mkdirSync(dmgRoot, { recursive: true });
  run("/usr/bin/ditto", [finalApp, path.join(dmgRoot, `${appName}.app`)]);
  fs.symlinkSync("/Applications", path.join(dmgRoot, "Applications"));
  const dmgResult = tryRun("/usr/bin/hdiutil", [
    "create",
    "-volname",
    appName,
    "-srcfolder",
    dmgRoot,
    "-ov",
    "-format",
    "UDZO",
    finalDmg
  ]);
  if (dmgResult.status !== 0) {
    console.warn("直接创建压缩 DMG 不可用，改用 HFS 映像后压缩。");
    const rawDmg = path.join(buildRoot, `${appName}-raw.dmg`);
    run("/usr/bin/hdiutil", [
      "makehybrid",
      "-hfs",
      "-hfs-volume-name",
      appName,
      "-o",
      rawDmg,
      dmgRoot
    ]);
    const convertResult = tryRun("/usr/bin/hdiutil", [
      "convert",
      rawDmg,
      "-format",
      "UDZO",
      "-o",
      finalDmg
    ]);
    if (convertResult.status !== 0) {
      console.warn("HFS 映像压缩失败，保留未压缩安装映像。");
      fs.renameSync(rawDmg, finalDmg);
    }
  }

  writeChecksum(finalDmg, finalChecksum);
  console.log(`\nBuilt: ${finalApp}`);
  console.log(`Built: ${finalDmg}`);
  console.log(`Built: ${finalChecksum}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
