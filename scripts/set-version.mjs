import fs from "node:fs";
import { versionParts, compareVersions } from "../src/updates.js";
const root = new URL("../", import.meta.url);
const [version, codeText] = process.argv.slice(2);
if (!version || !codeText)
  throw new Error("用法：node scripts/set-version.mjs 0.4.1 5");
versionParts(version);
if (!/^\d+\.\d+\.\d+$/.test(version))
  throw new Error("版本名不要带 v 或构建后缀。");
const code = Number(codeText);
const packageFile = new URL("package.json", root),
  manifestFile = new URL("android/AndroidManifest.xml", root),
  configFile = new URL("src/release-config.js", root);
const pkg = JSON.parse(fs.readFileSync(packageFile, "utf8"));
let manifest = fs.readFileSync(manifestFile, "utf8"),
  config = fs.readFileSync(configFile, "utf8");
const oldCode = Number(manifest.match(/android:versionCode="(\d+)"/)[1]);
if (
  !Number.isSafeInteger(code) ||
  code <= oldCode ||
  code > 2100000000 ||
  compareVersions(version, pkg.version) <= 0
)
  throw new Error("版本名和 Android 版本序号都必须大于当前版本。");
pkg.version = version;
manifest = manifest
  .replace(/android:versionName="[^"]+"/, `android:versionName="${version}"`)
  .replace(/android:versionCode="\d+"/, `android:versionCode="${code}"`);
config = config.replace(/version:\s*"[^"]+"/, `version: "${version}"`);
fs.writeFileSync(packageFile, JSON.stringify(pkg, null, 2) + "\n");
fs.writeFileSync(manifestFile, manifest);
fs.writeFileSync(configFile, config);
console.log(`版本更新为 ${version}，Android 版本序号 ${code}。`);
