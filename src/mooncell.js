import { dataFetch } from "./data-fetch.js";
export const MOONCELL_API = "https://fgo.wiki/api.php";

// Kanji-only Japanese names are also eligible when no Chinese source matched.
export function needsChineseName(name, originalName, hasChineseSource) {
  return (
    /[\u3040-\u30ff\uff66-\uff9f]/u.test(name) ||
    (!hasChineseSource && name === originalName)
  );
}

export function parseMooncellName(data, id) {
  for (const page of Object.values(data?.query?.pages ?? {})) {
    const source = page.revisions?.[0]?.slots?.main?.["*"] ?? "";
    // Restrict to the servant stats template, before NP/skill names further down.
    for (const match of source.matchAll(
      /\{\{基础数值\s*\n([\s\S]*?)(?=\n\}\}|\n==)/gu,
    )) {
      const stats = match[1];
      const internalId = stats.match(
        /\|从者内部id\s*=\s*(\d+)\s*(?=\n|\|)/iu,
      )?.[1];
      if (internalId !== String(id)) continue;
      const name = stats.match(/\|中文名\s*=\s*([^\n|]+)/u)?.[1]?.trim();
      if (name && !/[{}<>\[\]\u3040-\u30ff]/u.test(name) && name.length <= 150)
        return { name, page: page.title };
    }
  }
  return null;
}

export async function mooncellName(raw, { fetcher = dataFetch, signal } = {}) {
  if (!Number.isSafeInteger(raw.id) || raw.id <= 0) return null;
  const params = new URLSearchParams({
    action: "query",
    format: "json",
    origin: "*",
    redirects: "1",
    titles: "从者" + String(raw.collectionNo).padStart(3, "0"),
    prop: "revisions",
    rvprop: "content",
    rvslots: "main",
  });
  const controller = new AbortController();
  signal?.throwIfAborted();
  const stop = () => controller.abort();
  signal?.addEventListener("abort", stop, { once: true });
  const timeout = setTimeout(stop, 30000);
  try {
    const request = async (params) => {
      const response = await fetcher(MOONCELL_API + "?" + params, {
        signal: controller.signal,
      });
      if (!response.ok) throw new Error("Mooncell HTTP " + response.status);
      const data = await response.json();
      if (data.error) throw new Error(data.error.info ?? "Mooncell 返回错误");
      return data;
    };
    if (Number.isInteger(raw.collectionNo) && raw.collectionNo > 0) {
      const direct = parseMooncellName(await request(params), raw.id);
      if (direct) return direct;
    }
    const found = await request(
      new URLSearchParams({
        action: "ask",
        format: "json",
        origin: "*",
        query: `[[从者内部id::${raw.id}]]|limit=10`,
      }),
    );
    const titles = [
      ...new Set(
        Object.values(found.query?.results ?? {})
          .filter((p) => p.namespace === 0)
          .map((p) => p.fulltext?.split("#")[0])
          .filter(Boolean),
      ),
    ].slice(0, 5);
    if (!titles.length) return null;
    params.set("titles", titles.join("|"));
    return parseMooncellName(await request(params), raw.id);
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener("abort", stop);
  }
}

export async function supplementChineseName(
  servant,
  raw,
  { names = {}, ...options } = {},
) {
  if (!needsChineseName(names[raw.id] ?? raw.name, raw.name, !!names[raw.id]))
    return servant;
  try {
    const result = await mooncellName(raw, options);
    if (result) {
      servant.name =
        result.name + (raw.collectionNo === 0 ? "〔变身形态〕" : "");
      servant.nameSource = {
        provider: "Mooncell",
        page: result.page,
        matchedId: raw.id,
      };
    } else
      servant.warnings.push("Mooncell 暂无与内部 ID 匹配的中文名，保留原名。");
  } catch (error) {
    if (options.signal?.aborted) throw error;
    servant.warnings.push("Mooncell 名称补全失败，保留原名：" + error.message);
  }
  return servant;
}
