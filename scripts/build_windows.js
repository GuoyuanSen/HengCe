const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { spawnSync } = require("child_process");

const root = path.resolve(__dirname, "..");
const buildRoot = path.join(root, "build", "windows");
const stagingRoot = path.join(buildRoot, "staging");
const packageRoot = path.join(buildRoot, "package");
const distRoot = path.join(root, "dist");
const packageJson = require(path.join(root, "package.json"));
const appName = "HengCe";
const iconFile = path.join(root, "Resources", "AppIcon.ico");
const portableZip = path.join(distRoot, "HengCe-Windows-x64-Portable.zip");
const installer = path.join(distRoot, "HengCe-Windows-x64-Setup.exe");

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

function copyIntoStaging(source, destination) {
  const target = path.join(stagingRoot, destination);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.cpSync(path.join(root, source), target, { recursive: true });
}

function prepareStaging() {
  const runtimePackage = {
    name: packageJson.name,
    version: packageJson.version,
    description: packageJson.description,
    author: packageJson.author,
    license: packageJson.license,
    main: packageJson.main
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
  copyIntoStaging("node_modules/lucide/LICENSE", "node_modules/lucide/LICENSE");
  copyIntoStaging(
    "node_modules/lucide/dist/umd/lucide.min.js",
    "node_modules/lucide/dist/umd/lucide.min.js"
  );
}

function writeChecksum(file) {
  const digest = crypto
    .createHash("sha256")
    .update(fs.readFileSync(file))
    .digest("hex");
  fs.writeFileSync(`${file}.sha256`, `${digest}  ${path.basename(file)}\n`);
}

function findInnoSetup() {
  const candidates = [
    process.env.ISCC_PATH,
    "C:\\Program Files (x86)\\Inno Setup 6\\ISCC.exe",
    "C:\\Program Files\\Inno Setup 6\\ISCC.exe"
  ].filter(Boolean);
  const executable = candidates.find((candidate) => fs.existsSync(candidate));
  if (!executable) {
    throw new Error("未找到 Inno Setup 6，请设置 ISCC_PATH");
  }
  return executable;
}

async function main() {
  if (process.platform !== "win32") {
    throw new Error("Windows 安装包必须在 Windows 环境构建");
  }

  const { packager } = await import("@electron/packager");
  const electronVersion = require("electron/package.json").version;
  fs.rmSync(buildRoot, { recursive: true, force: true });
  fs.mkdirSync(packageRoot, { recursive: true });
  fs.mkdirSync(distRoot, { recursive: true });
  [portableZip, `${portableZip}.sha256`, installer, `${installer}.sha256`]
    .forEach((file) => fs.rmSync(file, { force: true }));
  prepareStaging();

  const appPaths = await packager({
    dir: stagingRoot,
    name: appName,
    executableName: appName,
    platform: "win32",
    arch: "x64",
    electronVersion,
    download: {
      cacheRoot:
        process.env.ELECTRON_CACHE || path.join(buildRoot, "electron-cache")
    },
    out: packageRoot,
    overwrite: true,
    icon: iconFile,
    appVersion: packageJson.version,
    asar: true,
    prune: false,
    win32metadata: {
      CompanyName: "GuoyuanSen",
      FileDescription: "衡策 A股量化研究工具",
      InternalName: appName,
      OriginalFilename: `${appName}.exe`,
      ProductName: "衡策",
      "requested-execution-level": "asInvoker"
    }
  });

  const packagedDirectory = appPaths[0];
  const packagedExecutable = packagedDirectory
    ? path.join(packagedDirectory, `${appName}.exe`)
    : null;
  if (!packagedExecutable || !fs.existsSync(packagedExecutable)) {
    throw new Error("Electron Packager 未返回有效的 Windows 可执行文件");
  }

  run("7z", [
    "a",
    "-tzip",
    "-mx=9",
    portableZip,
    path.join(packagedDirectory, "*")
  ]);
  run(findInnoSetup(), [
    `/DAppVersion=${packageJson.version}`,
    `/DSourceDir=${packagedDirectory}`,
    `/DOutputDir=${distRoot}`,
    `/DIconFile=${iconFile}`,
    path.join(root, "scripts", "windows-installer.iss")
  ]);

  if (!fs.existsSync(installer)) {
    throw new Error("Inno Setup 未生成预期安装包");
  }
  writeChecksum(portableZip);
  writeChecksum(installer);

  console.log(`\nBuilt: ${installer}`);
  console.log(`Built: ${installer}.sha256`);
  console.log(`Built: ${portableZip}`);
  console.log(`Built: ${portableZip}.sha256`);
  console.log(`Packaged executable: ${packagedExecutable}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
