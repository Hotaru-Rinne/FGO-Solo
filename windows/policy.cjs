const path = require("node:path");
const ORIGIN = "fgosolo://app";
function externalUrl(value) {
  if (typeof value !== "string" || value.length > 4096)
    throw Error("无效的外部链接");
  const url = new URL(value);
  if (
    !["https:", "http:"].includes(url.protocol) ||
    !url.hostname ||
    url.username ||
    url.password
  )
    throw Error("无效的外部链接");
  return url.href;
}
function apiUrl(value) {
  const url = new URL(externalUrl(value));
  if (url.protocol !== "https:" || url.port || url.hash)
    throw Error("不支持的数据请求");
  const atlas =
    url.hostname === "api.atlasacademy.io" &&
    /^\/(export\/JP\/basic_servant\.json|nice\/JP\/servant\/[0-9]+)$/.test(
      url.pathname,
    ) &&
    !url.search;
  const mooncell =
    url.hostname === "fgo.wiki" &&
    url.pathname === "/api.php" &&
    ["query", "ask"].includes(url.searchParams.get("action")) &&
    url.searchParams.get("format") === "json";
  const github =
    url.hostname === "api.github.com" &&
    /^\/repos\/[A-Za-z0-9-]+\/[A-Za-z0-9_.-]+\/releases\/latest$/.test(
      url.pathname,
    ) &&
    !url.search;
  if (!atlas && !mooncell && !github) throw Error("不支持的数据请求");
  return url.href;
}
function assetPath(value, root) {
  const url = new URL(value);
  if (
    url.protocol !== "fgosolo:" ||
    url.host !== "app" ||
    url.username ||
    url.password
  )
    throw Error("Invalid origin");
  const relative = decodeURIComponent(url.pathname);
  if (
    relative.includes("\\") ||
    relative.includes("\0") ||
    relative.split("/").includes("..")
  )
    throw Error("Invalid path");
  if (
    relative !== "/index.html" &&
    !relative.startsWith("/src/") &&
    !relative.startsWith("/public/")
  )
    throw Error("Not found");
  const result = path.resolve(root, "." + relative),
    base = path.resolve(root);
  if (!result.startsWith(base + path.sep)) throw Error("Invalid path");
  return result;
}
module.exports = { ORIGIN, externalUrl, apiUrl, assetPath };
