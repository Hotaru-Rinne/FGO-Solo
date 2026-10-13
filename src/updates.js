import { PLATFORM } from "./platform.js";
import { dataFetch } from "./data-fetch.js";
import { RELEASE_CONFIG } from "./release-config.js";

export function parseRepository(value) {
  let repo = String(value ?? "").trim();
  if (!repo) return "";
  if (repo.startsWith("https://")) {
    const url = new URL(repo);
    if (
      url.hostname !== "github.com" ||
      url.port ||
      url.username ||
      url.password ||
      url.search ||
      url.hash
    )
      throw new Error("请填写 GitHub 仓库地址或 用户名/仓库名。");
    repo = url.pathname.replace(/^\/+|\/+$/g, "");
  }
  repo = repo.replace(/\.git$/, "");
  if (
    !/^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})\/[A-Za-z0-9_.-]+$/.test(repo) ||
    [".", ".."].includes(repo.split("/")[1])
  )
    throw new Error("请填写 GitHub 仓库地址或 用户名/仓库名。");
  return repo;
}

export function versionParts(version) {
  const match = String(version)
    .trim()
    .match(/^v?(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:\+[0-9A-Za-z.-]+)?$/);
  if (!match)
    throw new Error("发布标签须为 v主版本.次版本.修订号，例如 v0.4.1。");
  const parts = match.slice(1, 4).map(Number);
  if (parts.some((v) => !Number.isSafeInteger(v)))
    throw new Error("版本号过大。");
  return parts;
}
export function compareVersions(left, right) {
  const a = versionParts(left),
    b = versionParts(right);
  for (let i = 0; i < 3; i++) if (a[i] !== b[i]) return a[i] > b[i] ? 1 : -1;
  return 0;
}

export async function checkForUpdate(
  repository,
  {
    fetcher = dataFetch,
    signal,
    currentVersion = RELEASE_CONFIG.version,
    platform = PLATFORM,
  } = {},
) {
  const repo = parseRepository(repository);
  if (!repo) throw new Error("尚未设置项目 GitHub 仓库，请先填写仓库地址。");
  const controller = new AbortController();
  signal?.throwIfAborted();
  const stop = () => controller.abort();
  signal?.addEventListener("abort", stop, { once: true });
  const timer = setTimeout(stop, 15000);
  try {
    const response = await fetcher(
      `https://api.github.com/repos/${repo}/releases/latest`,
      {
        signal: controller.signal,
        headers: { Accept: "application/vnd.github+json" },
        cache: "no-store",
      },
    );
    if (response.status === 404)
      throw new Error("仓库不存在、不是公开仓库，或还没有正式 Release。");
    if ([403, 429].includes(response.status))
      throw new Error("GitHub 请求受限，请稍后重试。");
    if (!response.ok)
      throw new Error(`GitHub 请求失败（${response.status}）。`);
    const release = await response.json();
    if (!release || release.draft || release.prerelease)
      throw new Error("没有可用的正式版本。");
    const comparison = compareVersions(release.tag_name, currentVersion);
    // Construct the trusted repository URL instead of opening URLs from release text.
    const url = `https://github.com/${repo}/releases/tag/${encodeURIComponent(release.tag_name)}`;
    const assets = (Array.isArray(release.assets) ? release.assets : []).filter(
      (a) => a.state === "uploaded" && /\.apk$/i.test(a.name ?? ""),
    );
    return {
      repository: repo,
      available: comparison > 0,
      version: release.tag_name,
      currentVersion,
      notes:
        typeof release.body === "string" ? release.body.slice(0, 20000) : "",
      title:
        typeof release.name === "string"
          ? release.name.slice(0, 200)
          : release.tag_name,
      url,
      hasApk: assets.length > 0,
      hasDownload:
        platform === "windows"
          ? (Array.isArray(release.assets) ? release.assets : []).some(
              (a) =>
                a.state === "uploaded" &&
                (/\.exe$/i.test(a.name ?? "") ||
                  /(?:windows|win[-_]?x64).*\.zip$/i.test(a.name ?? "")),
            )
          : assets.length > 0,
      checkedAt: new Date().toISOString(),
    };
  } catch (error) {
    if (controller.signal.aborted)
      throw new Error(
        signal?.aborted ? "已取消更新检查。" : "检查超时，请检查网络后重试。",
      );
    if (error instanceof TypeError)
      throw new Error("无法连接 GitHub，请检查网络后重试。");
    throw error;
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", stop);
  }
}

export function externalUrl(value) {
  const url = new URL(value);
  if (
    !["http:", "https:"].includes(url.protocol) ||
    !url.hostname ||
    url.username ||
    url.password
  )
    throw new Error("无效的外部链接。");
  return url.href;
}
