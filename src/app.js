import { platformText } from "./platform.js";
import { importMissingServants } from "./atlas-import.js";
import { sortServants, migrateData } from "./catalog.js";
import { settingsView } from "./settings-view.js";
import { createPages } from "./pages.js";
import { validateServant, validateBackup } from "./validation.js";
import { parseNumericInput } from "./numeric-input.js";
import { startPage, EXTERNAL_LINKS } from "./start-pages.js";
import { RELEASE_CONFIG } from "./release-config.js";
import { checkForUpdate, parseRepository, externalUrl } from "./updates.js";
import {
  CLASS_NAMES,
  ATTR_NAMES,
  COLOR_NAMES,
  CARD_NAMES,
  BUFF_GROUPS,
  PASSIVE_FIELDS,
  CARD_FIELDS,
  ENEMY_FIELDS,
  CARD_SWITCHES,
  FULL_CLASS_SCORE,
  FULL_GRAND_SCORE,
  newSession,
  buildDefaults,
  newSettings,
  newEnemy,
  customServant,
  n,
} from "./model.js";
import {
  baseAttack,
  calculateTurn,
  nextTurn,
  chainInfo,
  validateSession,
  CLASS_NP,
  CLASS_STARS,
} from "./engine.js";
import {
  loadLocal,
  saveLocal,
  getBackground,
  setBackground,
  prepareImage,
  getImportedServants,
  storeImportedServant,
  replaceImportedServants,
} from "./storage.js";
const $ = (selector) => document.querySelector(selector);
const escape = (value) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const fmt = (value, digits = 2) =>
  n(value).toLocaleString("zh-CN", { maximumFractionDigits: digits });
let builtins = [],
  downloadedServants = [],
  syncController = null,
  syncReport = null,
  syncStatus = "尚未检查更新",
  session,
  settings,
  result = null,
  settingsTab = "appearance",
  scoreClass = "saber",
  editor = null,
  editorDirty = false,
  search = "",
  view = "home",
  referenceText = "",
  updateResult = null,
  updateStatus = "",
  updateController = null,
  toastTimer;
const baseCatalog = () => [
  ...new Map(
    [...builtins, ...downloadedServants].map((s) => [String(s.id), s]),
  ).values(),
];
const allServants = () =>
  sortServants(
    [...baseCatalog(), ...settings.customServants]
      .filter((s) => !settings.deletedServantIds.includes(String(s.id)))
      .map((s) => ({
        ...s,
        ...settings.servantOverrides[s.id],
        transformIds:
          settings.servantOverrides[s.id]?.transformIds ?? s.transformIds,
      })),
  );
const servant = () =>
  allServants().find((s) => String(s.id) === String(session.servantId)) ??
  allServants()[0];
function toast(message) {
  $("#toast").textContent = message;
  $("#toast").classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => $("#toast").classList.remove("show"), 4000);
}
function persist() {
  try {
    saveLocal(session, settings);
  } catch {
    toast("本机存储空间不足，本次输入可能无法保存。请导出备份。");
  }
}
function getPath(object, path) {
  return path.split(".").reduce((v, k) => v?.[k], object);
}
function setPath(object, path, value) {
  const keys = path.split(".");
  if (keys.some((k) => ["__proto__", "prototype", "constructor"].includes(k)))
    throw new Error("无效字段");
  let cursor = object;
  for (let i = 0; i < keys.length - 1; i++)
    cursor = cursor[keys[i]] ??= /^[0-9]+$/.test(keys[i + 1]) ? [] : {};
  cursor[keys.at(-1)] = value;
}
function field(
  key,
  label,
  object,
  domain = "session",
  unit = "%",
  options = {},
) {
  const value = getPath(object, key) ?? options.default ?? 0;
  const numeric = options.type !== "text";
  const decimalKey = key.endsWith(".classMultiplier");
  return `<label class="field"><span>${escape(label)}</span><div class="input-wrap"><input type="text" ${numeric ? 'inputmode="decimal" data-numeric="true" autocomplete="off"' : ""} data-domain="${domain}" data-path="${key}" value="${escape(value)}" aria-label="${escape(label)}">${unit ? `<i>${escape(unit)}</i>` : ""}${decimalKey ? '<button type="button" class="decimal-key" data-action="decimal-point" aria-label="插入小数点">.</button>' : ""}</div>${decimalKey ? '<small class="hint">例如 1.2 或 1.5；可点右侧“.”输入小数点。</small>' : ""}</label>`;
}
function select(key, label, object, choices, domain = "session") {
  const value = getPath(object, key);
  return `<label class="field"><span>${escape(label)}</span><div class="input-wrap"><select data-domain="${domain}" data-path="${key}" aria-label="${escape(label)}">${(Array.isArray(
    choices,
  )
    ? choices
    : Object.entries(choices)
  )
    .map(
      ([v, text]) =>
        `<option value="${escape(v)}" ${String(v) === String(value) ? "selected" : ""}>${escape(text)}</option>`,
    )
    .join("")}</select></div></label>`;
}
function check(key, label, object, domain = "session", help = "") {
  return `<label class="check"><input type="checkbox" data-domain="${domain}" data-path="${key}" ${getPath(object, key) ? "checked" : ""}><span class="check-text">${escape(label)}${help ? `<small>${escape(help)}</small>` : ""}</span></label>`;
}
function fieldList(fields, prefix, object = session, domain = "session") {
  return fields
    .map(([key, label, unit]) =>
      field(prefix + key, label, object, domain, unit ?? "%"),
    )
    .join("");
}
function header(eyebrow, title, description) {
  return `<div class="page-head"><div><p class="eyebrow">${eyebrow}</p><h1>${title}</h1></div><span class="tag">第 ${session.turn} 回合</span></div><p class="intro">${description}</p>`;
}
function steps() {
  return `<nav class="stepper" aria-label="计算步骤">${["选择从者", "我方配置", "敌方配置", "计算结果"].map((label, i) => `<button class="step ${Math.min(session.step, 3) === i ? "active" : i < session.step ? "done" : ""}" data-action="step" data-value="${i}" ${i === 3 && session.step < 3 ? "disabled" : ""}><b>${i < session.step ? "✓" : i + 1}</b>${label}</button>`).join("")}</nav>`;
}
function footer(left, right) {
  return `<footer class="footer"><div class="footer-inner"><div class="footer-copy">${left}</div><div class="footer-actions">${right}</div></div></footer>`;
}
function button(action, text, style = "primary", extra = "") {
  return `<button type="button" class="${style}" data-action="${action}" ${extra}>${text}</button>`;
}
function render(preserve = false) {
  $("#go-home").hidden = view === "home";
  if (view !== "calculator") {
    const y = scrollY;
    $("#app").innerHTML = platformText(
      startPage({
        view,
        escape,
        button,
        settings,
        referenceText,
        updateResult,
        updateStatus,
        checking: !!updateController,
      }),
    );
    if (preserve) scrollTo(0, y);
    else scrollTo(0, 0);
    persist();
    return;
  }
  if (!servant()) {
    session.step = 0;
    session.servantId = "";
    result = null;
  }
  const y = scrollY;
  const open = new Map(
    [...document.querySelectorAll("details[data-detail]")].map((el) => [
      el.dataset.detail,
      el.open,
    ]),
  );
  if (session.step >= 3 && !result)
    result = calculateTurn(session, servant(), settings);
  const pages = createPages({
    session,
    servant,
    allServants,
    search,
    result,
    escape,
    fmt,
    field,
    select,
    check,
    fieldList,
    header,
    footer,
    button,
  });
  $("#app").innerHTML =
    steps() +
    [
      pages.selectPage,
      pages.buffsPage,
      pages.enemyPage,
      pages.resultsPage,
      pages.completionPage,
    ][session.step]();
  if (preserve) {
    for (const el of document.querySelectorAll("details[data-detail]"))
      if (open.has(el.dataset.detail)) el.open = open.get(el.dataset.detail);
    scrollTo(0, y);
  } else scrollTo(0, 0);
  persist();
}
function effectiveEditor() {
  return (editor ??= structuredClone(servant()));
}
function csvField(path, label, object = editor) {
  return `<label class="field"><span>${escape(label)}</span><textarea rows="${path === "atkGrowth" ? 4 : 2}" data-domain="editor" data-path="${path}" data-csv="true" aria-label="${escape(label)}">${escape((getPath(object, path) ?? []).join(", "))}</textarea></label>`;
}
function renderSettings() {
  if (settingsTab === "servants") effectiveEditor();
  const top = $("#settings-dialog").scrollTop;
  $("#settings-content").innerHTML =
    `<div class="modal-top"><h2>设置</h2>${button("close-settings", "完成", "secondary")}</div><div class="modal-body"><nav class="tabs">${[
      ["appearance", "外观与备份"],
      ["servants", "从者数据"],
      ["scores", "职阶星图"],
      ["sync", "从者数据获取"],
      ["help", "使用说明"],
    ]
      .map(([id, label]) =>
        button(
          "settings-tab",
          label,
          id === settingsTab ? "active" : "",
          `data-value="${id}"`,
        ),
      )
      .join(
        "",
      )}</nav>${settingsView({ editor, settings, settingsTab, scoreClass, allServants, escape, field, select, fieldList, button, csvField, syncReport, syncStatus, syncing: !!syncController })}</div>`;
  $("#settings-dialog").scrollTop = top;
}
function applyBackground(data) {
  $("#background").style.backgroundImage = data ? `url("${data}")` : "none";
  $("#background").style.opacity = settings.backgroundOpacity / 100;
}
async function exportBackup() {
  const data = JSON.stringify(
    {
      format: "fgo-solo-backup",
      version: 1,
      session,
      settings,
      downloadedServants,
      background: await getBackground(),
    },
    null,
    2,
  );
  const filename = `FGO一骑千筹备份-${new Date().toISOString().slice(0, 10)}.json`;
  if (window.Desktop?.exportBackup) {
    const saved = await window.Desktop.exportBackup(filename, data);
    toast(saved.cancelled ? "已取消保存。" : "备份已保存。");
    return;
  } else if (window.Android?.exportBackup) {
    window.Android.exportBackup(filename, data);
  } else {
    const url = URL.createObjectURL(
      new Blob([data], { type: "application/json" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  }
  toast("备份已准备，请选择保存位置。");
}
async function importBackup(file) {
  if (file.size > 20 * 1024 * 1024) throw new Error("备份文件不能超过 20 MB。");
  if (syncController) throw new Error("请先停止从者数据获取，再导入备份。");
  const data = JSON.parse(await file.text());
  migrateData(data, builtins);
  validateBackup(data, builtins);
  if (!confirm("导入会替换当前计算、从者编辑、星图设置与背景。是否继续？"))
    return;
  const oldSession = session,
    oldSettings = settings,
    oldDownloaded = downloadedServants,
    oldResult = result,
    oldBackground = await getBackground();
  try {
    session = data.session;
    settings = data.settings;
    downloadedServants = data.downloadedServants ?? [];
    await replaceImportedServants(downloadedServants);
    await setBackground(data.background ?? null);
    result = null;
    if (session.step >= 3) {
      try {
        result = calculateTurn(session, servant(), settings);
      } catch {
        session.step = 1;
      }
    }
    persist();
    applyBackground(data.background);
    applyOrientation();
    editor = null;
    editorDirty = false;
    render();
    renderSettings();
    toast("备份导入完成。");
  } catch (error) {
    session = oldSession;
    settings = oldSettings;
    downloadedServants = oldDownloaded;
    await replaceImportedServants(oldDownloaded);
    result = oldResult;
    await setBackground(oldBackground);
    applyBackground(oldBackground);
    persist();
    throw error;
  }
}
async function action(name, value) {
  switch (name) {
    case "navigate":
      if (
        ![
          "home",
          "guide",
          "knowledge",
          "random-reference",
          "links",
          "author",
          "updates",
        ].includes(value)
      )
        return;
      view = value;
      render();
      if (view === "random-reference") {
        try {
          const response = await fetch("public/docs/command-code-random.txt");
          if (!response.ok) throw new Error("无法读取速查文档。");
          referenceText = await response.text();
          if (view === "random-reference") render(true);
        } catch (error) {
          toast(error.message);
        }
      }
      break;
    case "start-calculation":
      view = "calculator";
      session.step = 0;
      result = null;
      render();
      break;
    case "guide-section":
      document
        .getElementById("guide-" + value)
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
      break;
    case "open-external":
      if (EXTERNAL_LINKS[value]) openExternal(EXTERNAL_LINKS[value].url);
      break;
    case "project-repository":
      if (RELEASE_CONFIG.repository)
        openExternal(
          "https://github.com/" + parseRepository(RELEASE_CONFIG.repository),
        );
      break;
    case "check-update":
      await checkUpdates();
      break;
    case "cancel-update":
      updateController?.abort();
      break;
    case "open-release":
      if (updateResult?.available) openExternal(updateResult.url);
      break;
    case "decimal-point":
      break; // Handled with the originating input by the click listener.
    case "start-sync":
      await startSync();
      break;
    case "stop-sync":
      syncController?.abort();
      break;
    case "next":
      if (!servant()) throw new Error("请先获取或新增从者。");
      if (session.step === 0) {
        const errors = validateSession(session, servant()).filter((e) =>
          e.includes("等级"),
        );
        if (errors.length) throw new Error(errors.join("\n"));
      }
      session.step = Math.min(2, session.step + 1);
      render();
      break;
    case "previous":
      session.step = Math.max(0, session.step - 1);
      result = null;
      render();
      break;
    case "step":
      if (!servant()) throw new Error("请先获取或新增从者。");
      if (n(value) === 3) {
        result = calculateTurn(session, servant(), settings);
      }
      session.step = n(value);
      render();
      break;
    case "choose-servant":
      session.servantId = value;
      Object.assign(session, buildDefaults(servant(), settings));
      session.buffs.npVariant = 0;
      result = null;
      render(true);
      break;
    case "calculate":
      result = calculateTurn(session, servant(), settings);
      session.step = 3;
      render();
      break;
    case "close-result":
      session.step = 4;
      render();
      break;
    case "next-turn":
      session = nextTurn(session, result);
      result = null;
      render();
      break;
    case "back-enemies":
      session.step = 2;
      result = null;
      render();
      break;
    case "reset-session":
      if (
        confirm("清空本次从者选择、Buff、指令卡与敌人信息？设置和背景会保留。")
      ) {
        session = newSession(allServants()[0], settings);
        result = null;
        search = "";
        render();
      }
      break;
    case "add-enemy":
      if (session.enemies.length < 6) {
        session.enemies.push(newEnemy(session.enemies.length));
        render(true);
      }
      break;
    case "delete-enemy":
      if (n(value) > 0) {
        const removed = session.enemies.splice(n(value), 1)[0];
        for (const card of session.cards)
          if (card.target === removed.id) card.target = session.enemies[0].id;
        render(true);
      }
      break;
    case "close-settings":
      if (editorDirty && !confirm("从者数据尚未保存，确定放弃本次编辑？"))
        return;
      $("#settings-dialog").close();
      break;
    case "settings-tab":
      settingsTab = value;
      renderSettings();
      break;
    case "new-servant":
      editor = customServant();
      editorDirty = true;
      renderSettings();
      break;
    case "delete-servant": {
      if (syncController) throw new Error("请先停止从者数据获取，再删除从者。");
      if (!allServants().some((s) => String(s.id) === String(editor.id)))
        throw new Error("这个从者尚未保存。");
      if (
        !confirm(
          `删除「${editor.name}」的从者数据和本地修改？之后可通过获取新增从者重新录入。`,
        )
      )
        return;
      const id = String(editor.id);
      const remaining = downloadedServants.filter((s) => String(s.id) !== id);
      await replaceImportedServants(remaining);
      downloadedServants = remaining;
      settings.customServants = settings.customServants.filter(
        (s) => String(s.id) !== id,
      );
      delete settings.servantOverrides[id];
      settings.deletedServantIds = [
        ...new Set([...settings.deletedServantIds, id]),
      ];
      if (String(session.servantId) === id) {
        const next = allServants()[0];
        session.servantId = next?.id ?? "";
        if (next) Object.assign(session, buildDefaults(next, settings));
        session.buffs.npVariant = 0;
        session.step = 0;
      }
      editor = allServants()[0] ? structuredClone(allServants()[0]) : null;
      editorDirty = false;
      result = null;
      persist();
      renderSettings();
      render(true);
      toast("从者已删除。");
      break;
    }
    case "add-np2":
      editorDirty = true;
      editor.noblePhantasms.push(
        structuredClone(customServant().noblePhantasms[0]),
      );
      renderSettings();
      break;
    case "remove-np2":
      editorDirty = true;
      editor.noblePhantasms.splice(1);
      renderSettings();
      break;
    case "save-servant":
      validateServant(editor);
      if (
        ![...baseCatalog(), ...settings.customServants].some(
          (s) => String(s.id) === String(editor.id),
        )
      )
        settings.customServants.push(structuredClone(editor));
      else settings.servantOverrides[editor.id] = structuredClone(editor);
      if (!session.servantId) session = newSession(editor, settings);
      persist();
      editorDirty = false;
      toast("从者数据已保存。");
      renderSettings();
      break;
    case "reset-servant":
      if (confirm("撤销该从者的本地覆盖，恢复原始录入数据？")) {
        delete settings.servantOverrides[editor.id];
        editor = structuredClone(
          [...baseCatalog(), ...settings.customServants].find(
            (s) => String(s.id) === String(editor.id),
          ) ?? servant(),
        );
        persist();
        editorDirty = false;
        renderSettings();
      }
      break;
    case "reset-score":
      settings.classScores[scoreClass] = { ...FULL_CLASS_SCORE };
      settings.grandScores[scoreClass] = { ...FULL_GRAND_SCORE };
      persist();
      renderSettings();
      toast("当前职阶已恢复默认值。");
      break;
    case "pick-background":
      $("#background-file").click();
      break;
    case "remove-background":
      await setBackground(null);
      applyBackground(null);
      toast("背景图片已移除。");
      break;
    case "export-backup":
      await exportBackup();
      break;
    case "import-backup":
      $("#backup-file").click();
      break;
  }
}
document.addEventListener("click", (event) => {
  const target = event.target.closest("[data-action]");
  if (target?.dataset.action === "decimal-point") {
    const input = target.closest(".input-wrap").querySelector("input");
    const start = input.selectionStart ?? input.value.length,
      end = input.selectionEnd ?? start;
    const next = input.value.slice(0, start) + "." + input.value.slice(end);
    if ((next.match(/\./g) ?? []).length <= 1) {
      input.value = next;
      input.focus();
      input.setSelectionRange(start + 1, start + 1);
      updateField(input);
    }
    return;
  }
  if (
    target &&
    ["calculate", "next", "save-servant", "close-settings"].includes(
      target.dataset.action,
    )
  ) {
    const scope = $("#settings-dialog").open
      ? $("#settings-content")
      : $("#app");
    const invalid = scope.querySelector('[data-numeric][aria-invalid="true"]');
    if (invalid) {
      invalid.focus();
      toast("请填写有效数值，支持小数，例如 1.2。");
      return;
    }
  }
  if (target && !target.disabled)
    action(target.dataset.action, target.dataset.value).catch((error) =>
      toast(error.message),
    );
});
document.addEventListener("pointerdown", (event) => {
  if (event.target.closest('[data-action="decimal-point"]'))
    event.preventDefault();
});
function updateField(target) {
  const { domain, path } = target.dataset;
  if (!domain || !path) return;
  if (domain === "editor-select") {
    if (editorDirty && !confirm("从者数据尚未保存，确定切换？")) {
      renderSettings();
      return;
    }
    editorDirty = false;
    editor = structuredClone(
      allServants().find((s) => String(s.id) === target.value),
    );
    renderSettings();
    return;
  }
  if (domain.startsWith("np-candidate-")) {
    const i = Number(domain.split("-").at(-1));
    const candidate = editor.npCandidates?.find(
      (np) => String(np.id) === target.value,
    );
    if (candidate) {
      editor.noblePhantasms[i] = structuredClone(candidate);
      editorDirty = true;
      renderSettings();
    }
    return;
  }
  if (domain === "score-select") {
    scoreClass = target.value;
    renderSettings();
    return;
  }
  const object =
    domain === "settings" ? settings : domain === "editor" ? editor : session;
  let value =
    target.type === "checkbox"
      ? target.checked
      : target.tagName === "SELECT"
        ? target.value
        : target.type === "number" || target.type === "range"
          ? n(target.value)
          : target.value;
  if (target.dataset.numeric) {
    const parsed = parseNumericInput(target.value);
    target.setAttribute("aria-invalid", parsed === null ? "true" : "false");
    if (parsed === null) return;
    value = parsed;
  }
  if (target.dataset.csv)
    value = target.value.trim()
      ? target.value
          .trim()
          .split(/[,，\s]+/)
          .map(Number)
      : [];
  if (["buffs.npVariant", "npLevel", "defaults.npLevel"].includes(path))
    value = n(value);
  if (domain === "settings" && path === "defaults.level")
    value = Math.max(1, Math.min(200, Math.floor(n(value))));
  setPath(object, path, value);
  if (domain === "settings" && path === "updateRepository") {
    updateController?.abort();
    updateResult = null;
    updateStatus = "仓库地址已修改，请重新检查更新。";
    $("#update-status").textContent = updateStatus;
    $("#update-result")?.remove();
  }
  if (domain === "editor") {
    editorDirty = true;
    if (/^noblePhantasms\.\d+\.npRate$/.test(path)) {
      const i = Number(path.split(".")[1]);
      editor.noblePhantasms[i].npRates = Array(5).fill(value);
    }
  }
  if (domain !== "editor") {
    persist();
    result = null;
  }
  if (domain === "settings" && path === "backgroundOpacity") {
    $("#background").style.opacity = value / 100;
    if ($("#opacity-value")) $("#opacity-value").textContent = value + "%";
  }
  if (domain === "settings" && path === "orientation") applyOrientation();
  if (domain === "session" && session.step === 0) {
    if ($("#base-attack"))
      $("#base-attack").textContent = fmt(
        baseAttack(servant(), session.level),
        0,
      );
    if ($("#total-attack"))
      $("#total-attack").textContent = fmt(
        baseAttack(servant(), session.level) + n(session.extraAttack),
        0,
      );
  }
}
document.addEventListener("input", (event) => {
  const target = event.target;
  if (target.id === "servant-search") {
    search = target.value;
    $("#servant-list").innerHTML = createPages({
      session,
      servant,
      allServants,
      search,
      escape,
    }).servantList();
    return;
  }
  if (target.tagName !== "SELECT" && target.type !== "checkbox")
    updateField(target);
});
document.addEventListener("change", (event) => {
  const target = event.target;
  if (target.tagName === "SELECT" || target.type === "checkbox") {
    updateField(target);
    if (target.dataset.domain === "session") render(true);
  }
});
document.addEventListener("focusout", (event) => {
  const target = event.target;
  if (target.dataset?.numeric && !target.value.trim()) {
    target.value = "0";
    updateField(target);
  }
});
$("#go-home").addEventListener("click", () => {
  view = "home";
  render();
});
$("#open-settings").addEventListener("click", () => {
  editor = null;
  editorDirty = false;
  renderSettings();
  $("#settings-dialog").showModal();
});
$("#settings-dialog").addEventListener("cancel", (event) => {
  if (editorDirty && !confirm("从者数据尚未保存，确定放弃本次编辑？"))
    event.preventDefault();
});
$("#settings-dialog").addEventListener("close", () => {
  editorDirty = false;
  result = null;
  if (session.step >= 3) {
    try {
      result = calculateTurn(session, servant(), settings);
    } catch {
      session.step = 1;
    }
  }
  render(true);
});
$("#background-file").addEventListener("change", async (event) => {
  const file = event.target.files[0];
  if (!file) return;
  try {
    const image = await prepareImage(file);
    await setBackground(image);
    applyBackground(image);
    toast("背景图片已保存。");
  } catch (error) {
    toast(error.message);
  }
  event.target.value = "";
});
$("#backup-file").addEventListener("change", async (event) => {
  const file = event.target.files[0];
  if (!file) return;
  try {
    await importBackup(file);
  } catch (error) {
    toast("导入失败：" + error.message);
  }
  event.target.value = "";
});
window.handleNativeBack = () => {
  if ($("#settings-dialog").open) {
    if (editorDirty && !confirm("从者数据尚未保存，确定放弃本次编辑？"))
      return true;
    $("#settings-dialog").close();
    return true;
  }
  if (view !== "calculator") {
    if (view === "home") return false;
    view = view === "random-reference" ? "knowledge" : "home";
    render();
    return true;
  }
  if (session.step > 0) {
    session.step--;
    result = null;
    render();
    return true;
  }
  view = "home";
  render();
  return true;
};
async function init() {
  builtins = await fetch("public/data/servants.json").then((r) => {
    if (!r.ok) throw new Error("无法读取离线从者数据");
    return r.json();
  });
  try {
    downloadedServants = await getImportedServants();
  } catch {
    toast("本地新增从者库读取失败，将使用内置数据。");
  }
  settings = newSettings();
  session = newSession(sortServants(builtins)[0], settings);
  const saved = loadLocal();
  if (saved) {
    try {
      migrateData({ ...saved, downloadedServants }, [
        ...builtins,
        ...downloadedServants,
      ]);
      validateBackup(
        { format: "fgo-solo-backup", ...saved, downloadedServants },
        builtins,
      );
      settings = saved.settings;
      session = saved.session;
    } catch {
      toast("已恢复默认配置：本机存档不完整，可从备份重新导入。");
    }
  }
  if (session.step >= 3) {
    try {
      result = calculateTurn(session, servant(), settings);
    } catch {
      session.step = 1;
    }
  }
  render();
  applyOrientation();
  try {
    applyBackground(await getBackground());
  } catch {
    toast("背景存储暂不可用，计算功能不受影响。");
  }
}
init().catch((error) => {
  $("#app").innerHTML =
    `<section class="panel error-box">启动失败：${escape(error.message)}。请重新打开应用。</section>`;
});

function applyOrientation() {
  window.Android?.setOrientation?.(settings.orientation);
}

function openExternal(value) {
  const url = externalUrl(value);
  if (window.Desktop?.openExternal)
    window.Desktop.openExternal(url).catch((error) => toast(error.message));
  else if (window.Android?.openExternal) window.Android.openExternal(url);
  else window.open(url, "_blank", "noopener,noreferrer");
}
async function checkUpdates() {
  if (updateController) return;
  const repo = parseRepository(
    settings.updateRepository || RELEASE_CONFIG.repository,
  );
  if (!repo) throw new Error("请先填写项目 GitHub 仓库地址。");
  settings.updateRepository = repo;
  persist();
  updateController = new AbortController();
  const controller = updateController;
  updateStatus = "正在检查 GitHub 正式版本…";
  updateResult = null;
  render(true);
  try {
    const result = await checkForUpdate(repo, { signal: controller.signal });
    updateResult = result;
    updateStatus = result.available
      ? "发现新版本。"
      : "检查完成，当前无需更新。";
  } catch (error) {
    updateStatus = error.message;
  } finally {
    updateController = null;
    if (view === "updates") render(true);
  }
}

async function startSync() {
  if (syncController) return;
  syncController = new AbortController();
  syncStatus = "正在获取日服从者索引…";
  syncReport = null;
  renderSettings();
  const signal = syncController.signal;
  try {
    let names = {};
    try {
      names = await fetch("public/data/names-cn.json").then((r) => r.json());
    } catch {}
    syncReport = await importMissingServants({
      existingIds: allServants().map((s) => s.id),
      relatedIds: [
        ...new Set(baseCatalog().flatMap((s) => s.transformIds ?? [])),
      ],
      names,
      signal,
      onServant: async (s) => {
        await storeImportedServant(s);
        downloadedServants = [
          ...downloadedServants.filter((x) => String(x.id) !== String(s.id)),
          s,
        ];
        settings.deletedServantIds = settings.deletedServantIds.filter(
          (id) => id !== String(s.id),
        );
        if (!servant()) {
          session = newSession(s, settings);
        } else if (!session.servantId) session.servantId = s.id;
        persist();
      },
      onProgress: (r) => {
        syncReport = r;
        syncStatus =
          "已处理 " +
          r.processed +
          "/" +
          r.total +
          "；新增 " +
          r.added +
          "；跳过已有 " +
          r.skipped +
          "；失败 " +
          r.failed.length;
        const label = $("#sync-progress");
        if (label) label.textContent = syncStatus;
      },
    });
    syncStatus =
      (syncReport.cancelled ? "已停止，可继续获取。" : "获取完成。") +
      " 新增 " +
      syncReport.added +
      "，已有跳过 " +
      syncReport.skipped +
      "，失败 " +
      syncReport.failed.length +
      "。";
  } catch (error) {
    syncStatus = signal.aborted
      ? "已停止。已录入的数据会保留。"
      : "获取失败：" + error.message + "。已有数据不受影响，可重试。";
  } finally {
    syncController = null;
    if ($("#settings-dialog").open && settingsTab === "sync") renderSettings();
    else toast(syncStatus);
    render(true);
  }
}
