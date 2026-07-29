const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const root = path.resolve(__dirname, "..");
const buildRoot = path.join(root, "build");
const packageRoot = path.join(buildRoot, "package");
const distRoot = path.join(root, "dist");
const appName = "衡策";
const finalApp = path.join(distRoot, `${appName}.app`);
const finalDmg = path.join(distRoot, `${appName}-Apple-Silicon.dmg`);
const iconFile = path.join(root, "Resources", "AppIcon.icns");

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

async function main() {
  const { packager } = await import("@electron/packager");
  fs.rmSync(buildRoot, { recursive: true, force: true });
  fs.rmSync(distRoot, { recursive: true, force: true });
  fs.mkdirSync(packageRoot, { recursive: true });
  fs.mkdirSync(distRoot, { recursive: true });

  const appPaths = await packager({
    dir: root,
    name: appName,
    platform: "darwin",
    arch: "arm64",
    out: packageRoot,
    overwrite: true,
    icon: iconFile,
    appBundleId: "com.guoyuansen.hengce",
    appVersion: "0.1.1",
    buildVersion: "2",
    appCategoryType: "public.app-category.finance",
    asar: true,
    prune: true,
    ignore: [
      /^\/\.build/,
      /^\/\.git/,
      /^\/build/,
      /^\/dist/,
      /^\/tests/,
      /^\/scripts\/build\.js$/,
      /\.dmg$/
    ]
  });
  const outputDirectory = appPaths[0];
  const packagedApp = outputDirectory
    ? path.join(outputDirectory, `${appName}.app`)
    : null;
  if (!packagedApp || !fs.existsSync(packagedApp)) {
    throw new Error("Electron Packager 未返回有效的 .app 路径");
  }

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
    console.warn("压缩 DMG 不可用，改用无需挂载设备的 HFS 映像。");
    run("/usr/bin/hdiutil", [
      "makehybrid",
      "-hfs",
      "-hfs-volume-name",
      appName,
      "-o",
      finalDmg,
      dmgRoot
    ]);
  }

  console.log(`\nBuilt: ${finalApp}`);
  console.log(`Built: ${finalDmg}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
