import { IS_WINDOWS, DEVICE_NAME } from "./platform.js";
import { RELEASE_CONFIG } from "./release-config.js";
import {
  CLASS_NAMES,
  ATTR_NAMES,
  COLOR_NAMES,
  BUFF_GROUPS,
  PASSIVE_FIELDS,
} from "./model.js";
export function settingsView({
  editor,
  settings,
  settingsTab,
  scoreClass,
  allServants,
  escape,
  field,
  select,
  fieldList,
  button,
  csvField,
  syncReport,
  syncStatus,
  syncing,
}) {
  function editorPanel() {
    const e = editor;
    if (!e)
      return `<section class="panel empty">从者库为空。</section>${button("new-servant", "＋ 新增自定义从者", "secondary")}`;
    return `<div class="form-grid">${select(
      "id",
      "选择要编辑的从者",
      { id: e.id },
      allServants().map((s) => [s.id, `${s.name} · ${s.id}`]),
      "editor-select",
    )}${button("new-servant", "＋ 新增自定义从者", "secondary")}</div><p class="hint">编辑后点击保存才会生效。被动在计算页自动应用，不重复显示。</p><section class="panel"><h3>基础信息</h3><div class="divider"></div><div class="form-grid">${field("name", "从者名称", e, "editor", "", { type: "text" })}${select("className", "职阶", e, CLASS_NAMES, "editor")}${select("attribute", "副属性", e, ATTR_NAMES, "editor")}${field("starRate", "基础出星率", e, "editor")}${field("npRates.buster", "红卡基础 NP 率", e, "editor")}${field("npRates.arts", "蓝卡基础 NP 率", e, "editor")}${field("npRates.quick", "绿卡基础 NP 率", e, "editor")}${field("npRates.extra", "EX 卡基础 NP 率", e, "editor")}</div><div class="divider"></div>${csvField("atkGrowth", "ATK 成长表（第 1 项对应 Lv.1，逗号分隔）")}<details class="small-details"><summary>普通指令卡 Hit 分布</summary><div class="form-grid">${Object.entries(
      COLOR_NAMES,
    )
      .map(([c, label]) =>
        csvField("hits." + c, label + " Hit 权重（通常合计 100）"),
      )
      .join(
        "",
      )}</div></details></section>${e.noblePhantasms.map((np, i) => `<section class="panel"><div class="panel-head"><h3>宝具 ${i + 1}</h3>${i === 1 ? button("remove-np2", "移除宝具 2", "delete") : ""}</div><div class="form-grid">${e.npCandidates?.length ? select("id", "使用的数据形态", np, Object.fromEntries(e.npCandidates.map((c) => [c.id, c.name + " · " + COLOR_NAMES[c.color]])), "np-candidate-" + i) : ""}${field(`noblePhantasms.${i}.name`, "宝具名称", e, "editor", "", { type: "text" })}${select(`noblePhantasms.${i}.color`, "宝具颜色", e, { buster: "红卡", arts: "蓝卡", quick: "绿卡" }, "editor")}${select(`noblePhantasms.${i}.type`, "宝具类型", e, { single: "单体", all: "群体", support: "辅助" }, "editor")}${field(`noblePhantasms.${i}.npRate`, "宝具基础 NP 率", e, "editor")}</div><div class="divider"></div>${csvField(`noblePhantasms.${i}.multipliers`, "宝具 1～5 级倍率（百分数，共 5 项）")}<div class="form-grid">${csvField(`noblePhantasms.${i}.hits`, "宝具 Hit 分布")}${csvField(`noblePhantasms.${i}.ocHits`, "OC 追加 Hit 分布（无则留空）")}</div></section>`).join("")}${e.noblePhantasms.length < 2 ? button("add-np2", "＋ 配置宝具 2", "secondary") : ""}<details class="panel accordion"><summary><span class="section-letter">P</span>内置被动数值</summary><div class="accordion-body"><div class="form-grid">${fieldList(PASSIVE_FIELDS, "passives.", e, "editor")}</div><div class="divider"></div><h3>对各职阶的额外攻击相性</h3><p class="hint">填写额外相性百分比；50 表示原职阶倍率 ×1.5。只对指定目标职阶生效。敌人自定义职阶倍率优先。</p><div class="form-grid">${fieldList(
      Object.entries(CLASS_NAMES).map(([key, name]) => [key, name]),
      "classAffinity.",
      e,
      "editor",
    )}</div><div class="divider"></div><h3>从者硬币被动</h3><p class="hint">以下三类增益仅在首页勾选硬币被动后生效。默认 EX 卡性能 50%、暴击威力 30%；对职阶攻击适性从数据源读取，通常为 30%，狂阶暴击耐性不计入。对 EX 职阶项排除七骑和“其他”。</p><div class="form-grid">${fieldList(
      [
        ["extra", "硬币 EX 卡性能"],
        ["criticalDamage", "硬币暴击威力"],
      ],
      "coinPassive.",
      e,
      "editor",
    )}</div><div class="divider"></div><div class="form-grid">${fieldList(
      [
        ...Object.entries(CLASS_NAMES).map(([key, name]) => [
          key,
          "对 " + name + " 加攻",
        ]),
        ["extraClasses", "对 EX 职阶额外加攻"],
      ],
      "coinAttack.",
      e,
      "editor",
    )}</div></div></details><div class="button-row">${button("save-servant", "保存从者数据")}${button("reset-servant", "撤销本地覆盖", "secondary")}${button("delete-servant", "删除此从者", "danger")}</div>${auditPanel(e)}<p class="hint">当前数据来源：${escape(e.source ?? "用户自定义")}</p>`;
  }
  const scoreFields = [
    ...BUFF_GROUPS.filter((g) => g[0] !== "special")
      .flatMap((g) => g[2])
      .filter(([k]) => k !== "npSpecial"),
    ...PASSIVE_FIELDS.filter(([k]) => k.endsWith("Star") || k.endsWith("Np")),
  ];
  function settingsBody() {
    if (settingsTab === "sync") return syncPanel();
    if (settingsTab === "servants") return editorPanel();
    if (settingsTab === "scores")
      return `<div class="form-grid">${select("className", "设置职阶", { className: scoreClass }, CLASS_NAMES, "score-select")}</div><p class="hint">普通与冠位职阶星图均按上方职阶独立保存。按实际解锁程度填写，仅在选人页勾选对应星图时应用。宝具威力增幅等未提供的增益保持 0。</p>${[
        ["classScores", "普通职阶星图"],
        ["grandScores", "冠位职阶星图"],
      ]
        .map(
          ([key, label]) =>
            `<details class="panel accordion" ${key === "classScores" ? "open" : ""}><summary>${label}</summary><div class="accordion-body"><div class="form-grid">${fieldList(scoreFields, `${key}.${scoreClass}.`, settings, "settings")}</div></div></details>`,
        )
        .join(
          "",
        )}<div class="button-row">${button("reset-score", "恢复当前职阶默认值", "secondary")}</div>`;
    if (settingsTab === "help")
      return `<section class="panel"><h3>计算约定</h3><p class="intro">所有百分比字段填百分数，如 50 表示 50%。伤害随机数默认 1.000，职阶克制使用倍数。</p><p class="intro">只有净降防设 100% 的增益上限；其他增益不封顶。伤害与命中回收最低为 0，每 Hit 自然产星仍按游戏的 0～3 星规则结算，固定出星不受此限制。</p><p class="intro">鞭尸按每个目标逐 Hit 判断。普通卡保留累计伤害；宝具开始、手动重置和死亡重置会清零。手动强制鞭尸只作用于该张卡。</p><p class="intro">职阶自动填入通用 NP 与产星补正；个别副本敌人的隐藏参数可能不同，可用敌方 NP/出星下降（允许负值）手动校正。</p><p class="intro">宝具及主动技能的附加效果不自动发动，请手动填写。OC 等级不单独维护：填写 OC 额外倍率、宝具特攻等数值来模拟当前状态。</p><p class="intro">进入下一回合只扣除敌人 HP，保留全部填写值；请按实际情况更新增益与碰瓷 NP。不会自动扣减技能持续回合或记录 NP 库存。</p><p class="hint">版本 ${RELEASE_CONFIG.version} · 使用文档可从开始界面打开<br>数据依据：Atlas Academy 日服结构化数据。被动按效果逐项识别，仅录入常态数值。</p></section>`;
    return `<section class="panel"><h3>默认养成配置</h3><p class="hint">用于新计算和切换从者。不会改动当前回合已填写的养成数据；等级超出从者成长表时取最高可用等级。</p><div class="form-grid">${field("defaults.level", "默认从者等级", settings, "settings", "级", { min: 1, max: 200 })}${select("defaults.npLevel", "默认宝具等级", settings, { 1: "宝具 1 级", 2: "宝具 2 级", 3: "宝具 3 级", 4: "宝具 4 级", 5: "宝具 5 级" }, "settings")}${field("defaults.extraAttack", "默认额外 ATK", settings, "settings", "点")}</div></section>${IS_WINDOWS ? `<section class="panel"><h3>桌面窗口</h3><p class="hint">拖动窗口边缘调整大小，双击标题栏最大化；F11 切换全屏。窗口大小与位置会保存。</p></section>` : `<section class="panel"><h3>屏幕方向</h3>${select("orientation", "屏幕方向", settings, { portrait: "竖屏（默认）", landscape: "横屏", auto: "跟随手机方向设置" }, "settings")}<p class="hint">安卓应用启动默认竖屏，可按手机使用习惯调整；设置会保存。浏览器预览跟随窗口尺寸。</p></section>`}<section class="panel"><div class="panel-head"><h3>背景图片</h3><span class="tag">仅保存在本机</span></div><p class="intro">从${DEVICE_NAME}选择喜欢的图片，作为计算器背景。</p><div class="button-row">${button("pick-background", "导入图片")}${button("remove-background", "移除背景", "secondary")}</div><div class="divider"></div><label class="field"><span>背景清晰度 <b id="opacity-value">${settings.backgroundOpacity}%</b></span><input type="range" min="0" max="65" value="${settings.backgroundOpacity}" data-domain="settings" data-path="backgroundOpacity" aria-label="背景清晰度" style="width:100%;accent-color:var(--accent)"></label><p class="hint">降低清晰度可让填写内容更易阅读。图片不上传服务器。</p></section><section class="panel"><h3>数据备份</h3><p class="intro">备份包括本次计算、从者编辑、星图设置与背景图片。</p><div class="button-row">${button("export-backup", "导出备份", "secondary")}${button("import-backup", "导入备份", "secondary")}</div><p class="hint">导入前会检查格式，确认后替换当前配置。</p></section><section class="panel"><h3>离线工作</h3><p class="hint">所有计算均在本机进行。内置从者数据可离线计算；仅手动获取新增从者时连接 Atlas Academy，必要时向 Mooncell 补全中文名。已有 ID 会跳过，不覆盖手动修改。</p></section>`;
  }

  function auditPanel(e) {
    return (
      '<details class="panel accordion"><summary>数据识别记录</summary><div class="accordion-body">' +
      (e.warnings ?? [])
        .map((w) => '<p class="notice">' + escape(w) + "</p>")
        .join("") +
      (e.passiveAudit ?? [])
        .map(
          (a) =>
            '<div class="damage-line"><div>' +
            escape(a.skill) +
            "<small>" +
            escape(a.effect) +
            " · " +
            escape(a.reason) +
            "</small></div><span>" +
            ({ included: "已录入", excluded: "已排除", review: "需核对" }[
              a.status
            ] ?? "") +
            (a.value !== undefined ? " " + escape(a.value) : "") +
            "</span></div>",
        )
        .join("") +
      "</div></details>"
    );
  }
  function syncPanel() {
    return (
      '<section class="panel"><h3>Atlas Academy · 日服从者</h3><p class="intro">获取与 Atlas 从者数据库同源的结构化数据。按从者 ID 跳过已有记录，保留你的手动修改。网络中断或停止后，已成功录入的从者仍可使用。</p><p id="sync-progress" class="notice" role="status">' +
      escape(syncStatus) +
      '</p><div class="button-row">' +
      button(
        "start-sync",
        "获取新增从者",
        "primary",
        syncing ? "disabled" : "",
      ) +
      button("stop-sync", "停止", "secondary", syncing ? "" : "disabled") +
      '</div><p class="hint">只录入直接、无限期、无条件的自身被动；条件或触发效果逐项排除。职阶攻击适性单独归入硬币被动。可在“从者数据 → 数据识别记录”查看录入及排除原因。</p><p class="hint">采用日服强化后的宝具数据；中文名优先使用简中名称对照；未翻译的名称向 Mooncell 查询，并核对从者内部 ID，查不到时保留原名。特殊宝具效果需按实际情况填写；多于两种宝具形态可在从者设置中选择。</p></section>' +
      (syncReport?.failed?.length
        ? '<section class="panel"><h3>本次未录入</h3>' +
          syncReport.failed
            .map(
              (f) =>
                '<p class="hint">' +
                escape(f.name) +
                "（" +
                f.id +
                "）：" +
                escape(f.message) +
                "</p>",
            )
            .join("") +
          "</section>"
        : "")
    );
  }
  return settingsBody();
}
