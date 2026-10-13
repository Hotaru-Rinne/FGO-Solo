import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const envRoot = path.resolve(root, "../开发安装/环境");
const meta = JSON.parse(
  await fs.readFile(path.join(root, "package.json"), "utf8"),
);
const runtime = path.join(envRoot, "electron-44.7.0/runtime");
const target = path.join(root, "dist", `FGO-Solo-Windows-${meta.version}-x64`);
if (!target.startsWith(path.join(root, "dist") + path.sep))
  throw Error("Invalid build path");
await fs.access(path.join(runtime, "electron.exe"));
if (!process.argv.includes("--refresh")) {
  try {
    await fs.access(target);
    throw Error("Output exists; use --refresh to rebuild generated files");
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
} else {
  // Only the resolved generated output directory inside this project's dist is removed.
  await fs.rm(target, { recursive: true, force: true });
}
await fs.mkdir(target, { recursive: true });
await fs.cp(runtime, target, { recursive: true });
const exe = path.join(target, "一骑千筹.exe");
await fs.rename(path.join(target, "electron.exe"), exe);
await fs.rm(path.join(target, "resources/default_app.asar"), { force: true });
const appRoot = path.join(target, "resources/app");
await fs.mkdir(appRoot, { recursive: true });
for (const relative of ["src", "public", "index.html"])
  await fs.cp(path.join(root, relative), path.join(appRoot, relative), {
    recursive: true,
  });
await fs.mkdir(path.join(appRoot, "windows"), { recursive: true });
for (const file of ["main.cjs", "preload.cjs", "policy.cjs", "icon.ico"])
  await fs.copyFile(
    path.join(root, "windows", file),
    path.join(appRoot, "windows", file),
  );
await fs.writeFile(
  path.join(appRoot, "package.json"),
  JSON.stringify(
    {
      name: "fgo-solo-calculator",
      productName: "一骑千筹",
      version: meta.version,
      main: "windows/main.cjs",
      author: "瑩鈴音",
    },
    null,
    2,
  ),
);
const resourceTool = path.join(
  envRoot,
  "rcedit-5.0.2/package/bin/rcedit-x64.exe",
);
execFileSync(
  resourceTool,
  [
    exe,
    "--set-icon",
    path.join(root, "windows/icon.ico"),
    "--set-version-string",
    "ProductName",
    "一骑千筹",
    "--set-version-string",
    "FileDescription",
    "一骑千筹 · FGO 单挑计算器",
    "--set-version-string",
    "CompanyName",
    "瑩鈴音",
    "--set-version-string",
    "OriginalFilename",
    "一骑千筹.exe",
    "--set-file-version",
    meta.version + ".0",
    "--set-product-version",
    meta.version + ".0",
  ],
  { windowsHide: true },
);
await fs.copyFile(
  path.join(root, "docs/Windows使用说明.md"),
  path.join(target, "使用说明.txt"),
);
console.log("Windows application: " + exe);
