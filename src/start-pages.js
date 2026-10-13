import { DOWNLOAD_LABEL } from "./platform.js";
import { GUIDE_SECTIONS } from "./guide.js";
import { RELEASE_CONFIG } from "./release-config.js";

export const EXTERNAL_LINKS = {
  commandCodeReference: {
    name: "阅读枫百云的 B站专栏",
    url: "https://www.bilibili.com/opus/1112832155317174297?spm_id_from=333.1387.0.0",
  },
  mooncell: { name: "Mooncell", url: "https://fgo.wiki/w/%E9%A6%96%E9%A1%B5" },
  atlas: { name: "Atlas Academy", url: "https://apps.atlasacademy.io/db/" },
  chaldea: { name: "Chaldea", url: "http://www.chaldea.center/zh/" },
  official: {
    name: "B站官号主页",
    url: "https://space.bilibili.com/233108841",
  },
  author: {
    name: "作者 B站主页",
    url: "https://space.bilibili.com/3546774813804562?spm_id_from=333.1391.0.0",
  },
  reference: {
    name: "项目参考",
    url: "https://www.bilibili.com/opus/832816681519677444?spm_id_from=333.1387.0.0",
  },
};

export function referenceContent(text, escape) {
  return text
    .trim()
    .split(/\n\s*\n/)
    .filter(Boolean)
    .map((block) =>
      /^\d随机数的效果：$/.test(block.trim())
        ? "<h2>" + escape(block.trim()) + "</h2>"
        : "<p>" + escape(block.trim()) + "</p>",
    )
    .join("");
}

export function startPage({
  view,
  escape,
  button,
  settings,
  referenceText,
  updateResult,
  updateStatus,
  checking,
}) {
  const nav = (title, parent = "home") =>
    `<div class="document-nav">${button("navigate", "← 返回", "secondary", `data-value="${parent}"`)}<span>一骑千筹 · FGO 计算器</span></div><h1>${title}</h1>`;
  const entry = (key, title, description, icon) =>
    `<button class="menu-entry" data-action="navigate" data-value="${key}"><span class="menu-symbol" aria-hidden="true">${icon}</span><span><strong>${title}</strong><small>${description}</small></span><span aria-hidden="true">›</span></button>`;
  const link = (key) =>
    button(
      "open-external",
      `${escape(EXTERNAL_LINKS[key].name)} <span aria-hidden="true">↗</span>`,
      "link-entry",
      `data-value="${key}"`,
    );
  if (view === "home")
    return `<section class="start-hero"><p class="eyebrow">FGO / SOLO CALCULATOR</p><h1>一骑千筹</h1>${button("start-calculation", "开始计算 →", "primary start-primary")}<p class="hint">保留当前计算数据，从选择从者开始。</p></section><nav class="start-menu" aria-label="开始菜单">${entry("guide", "使用文档", "从者数据、配置填写与计算选项", "☷")}${entry("knowledge", "知识速查", "按主题快速查阅", "⌕")}${entry("links", "其他链接速转", "用手机默认浏览器打开常用网站", "↗")}${entry("author", "作者信息", "作者主页与项目参考", "◇")}</nav><div class="version-bar"><span>版本 ${RELEASE_CONFIG.version}</span>${button("navigate", "检查更新", "text-button", 'data-value="updates"')}</div>`;
  if (view === "guide")
    return `<div class="document-page">${nav("使用文档")}<nav class="panel document-index" aria-label="文档目录">${GUIDE_SECTIONS.map((s) => button("guide-section", s.title, "text-button", `data-value="${s.id}"`)).join("")}</nav>${GUIDE_SECTIONS.map((s) => `<section id="guide-${s.id}" class="panel guide-section"><h2>${s.title}</h2>${s.paragraphs.map((p) => `<p>${escape(p)}</p>`).join("")}</section>`).join("")}</div>`;
  if (view === "knowledge")
    return `<div class="document-page">${nav("知识速查")}<nav class="start-menu">${entry("random-reference", "纹章效果随机数速查", "", "☷")}</nav></div>`;
  if (view === "random-reference")
    return `<div class="document-page">${nav("纹章效果随机数速查", "knowledge")}<article class="panel reference-document reference-prose" aria-label="纹章效果随机数速查正文">${referenceContent(referenceText, escape)}</article><section class="panel reference-source"><p>以上内容来自于B站UP主枫百云的专栏：</p>${link("commandCodeReference")}</section></div>`;
  if (view === "links")
    return `<div class="document-page">${nav("其他链接速转")}<p class="intro">所有链接由手机默认浏览器打开。</p><section class="panel link-list">${["mooncell", "atlas", "chaldea", "official"].map(link).join("")}</section></div>`;
  if (view === "author")
    return `<div class="document-page">${nav("作者信息")}<section class="panel"><p class="eyebrow">AUTHOR</p><h2>瑩鈴音</h2><div class="link-list">${link("author")}<div class="author-row"><span>项目 GitHub 地址</span>${RELEASE_CONFIG.repository ? button("project-repository", "GitHub ↗", "text-button") : ""}</div>${link("reference")}</div></section></div>`;
  if (view === "updates") {
    const source = settings.updateRepository || RELEASE_CONFIG.repository;
    return `<div class="document-page">${nav("检查更新")}<section class="panel"><h2>当前版本 ${RELEASE_CONFIG.version}</h2><p class="intro">手动检查 GitHub 最新正式版本，下载和安装由浏览器与系统处理。</p><label class="field"><span>项目 GitHub 仓库</span><div class="input-wrap"><input type="text" autocomplete="off" autocapitalize="none" spellcheck="false" aria-label="项目 GitHub 仓库" data-domain="settings" data-path="updateRepository" value="${escape(source)}" placeholder="用户名/仓库名 或 GitHub 仓库地址" ${checking ? "disabled" : ""}></div></label>${!source ? '<p class="hint">项目仓库尚未创建，暂时无法检查实际版本。创建后在这里填入仓库地址即可使用。</p>' : ""}<p class="notice" id="update-status" role="status">${escape(updateStatus || "尚未检查更新。")}</p><div class="button-row">${button("check-update", checking ? "正在检查…" : "检查更新", "primary", checking ? "disabled" : "")}${checking ? button("cancel-update", "取消", "secondary") : ""}</div></section>${updateResult ? `<section class="panel" id="update-result"><h2>${escape(updateResult.available ? "发现新版本 " + updateResult.version : "当前已是最新版本")}</h2><p class="hint">仓库：${escape(updateResult.repository)} · 最新正式版：${escape(updateResult.version)}</p>${updateResult.available && !updateResult.hasDownload ? `<p class="notice">该发布尚未附加 ${DOWNLOAD_LABEL}，暂时无法从此发布下载安装。</p>` : ""}${updateResult.notes ? `<pre class="release-notes">${escape(updateResult.notes)}</pre>` : ""}${updateResult.available ? button("open-release", "用浏览器查看新版", "secondary") : ""}</section>` : ""}</div>`;
  }
  return "";
}
