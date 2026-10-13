import {
  CLASS_NAMES,
  ATTR_NAMES,
  COLOR_NAMES,
  CARD_NAMES,
  BUFF_GROUPS,
  CARD_FIELDS,
  ENEMY_FIELDS,
  ENEMY_DEBUFF_FIELDS,
  CARD_SWITCHES,
  cardSwitchApplies,
  n,
} from "./model.js";
import { baseAttack, chainInfo, CLASS_NP, CLASS_STARS } from "./engine.js";
export function createPages({
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
}) {
  function selectPage() {
    const s = servant();
    if (!s)
      return (
        header(
          "SOLO / PREPARATION",
          "从者库为空",
          "请在设置中获取从者，或新增自定义从者。",
        ) +
        '<section class="panel empty">从者数据已清空。点击右上角设置继续。</section>' +
        footer(
          "",
          button("navigate", "返回开始界面", "secondary", 'data-value="home"'),
        )
      );
    return (
      header(
        "SOLO / PREPARATION",
        "选择出战从者",
        "选择从者与养成配置，开始本回合的计算。",
      ) +
      `<div class="layout"><div class="stack"><section class="panel"><div class="panel-head"><h2>选择从者</h2><span class="panel-number">01 / SERVANT</span></div><div class="search"><input id="servant-search" type="search" placeholder="搜索从者名称或 ID" value="${escape(search)}" aria-label="搜索从者"></div><div class="servant-list" id="servant-list">${servantList()}</div><p class="hint">当前可选 <strong>${allServants().length} 名从者</strong>。数据源为 Atlas Academy 日服；设置中可获取新增从者或编辑数据。</p></section><section class="panel"><div class="panel-head"><h2>养成与宝具</h2><span class="panel-number">02 / BUILD</span></div><div class="form-grid three">${field("level", "从者等级", session, "session", "级", { min: 1, max: s.atkGrowth.length })}${select("npLevel", "宝具等级", session, { 1: "宝具 1 级", 2: "宝具 2 级", 3: "宝具 3 级", 4: "宝具 4 级", 5: "宝具 5 级" })}${field("extraAttack", "额外 ATK", session, "session", "点")}</div><p class="hint">额外 ATK 填写芙芙、礼装等局外养成提供的攻击力总和。</p></section></div><div class="stack"><section class="panel identity"><p class="eyebrow">YOUR SERVANT</p><h2>${escape(s.name)}</h2><p class="meta">${escape(CLASS_NAMES[s.className] ?? s.className)} · ${ATTR_NAMES[s.attribute]}属性</p><div class="stats"><div><span>成长 ATK</span><strong id="base-attack">${fmt(baseAttack(s, session.level), 0)}</strong></div><div><span>总 ATK</span><strong id="total-attack">${fmt(baseAttack(s, session.level) + n(session.extraAttack), 0)}</strong></div></div><p class="hint">等级成长表自动取值 · 内置被动自动生效</p></section><section class="panel"><div class="panel-head"><h2>职阶星图</h2><span class="panel-number">03 / CLASS SCORE</span></div>${check("useClassScore", "启用职阶星图", session, "session", "默认满级数值，可在设置中按职阶调整。")}${check("useGrandScore", "启用冠位职阶星图", session, "session", "各职阶独立保存：伤害专用红／蓝／绿魔放各 50%，每回合 NP 获取 10%，EX 卡性能 200%。可在设置中调整。")}${check("useCoinPassive", "从者硬币被动", session, "session", "启用该从者的 EX 卡性能、暴击威力和对某职阶 30% 加攻（具体目标及数值以从者数据为准，狂阶除外）。可在设置中单独修改。")}<div class="divider"></div><p class="hint">本次计算始终使用当前选择的星图配置。回到此页可随时修改。</p></section></div></div>` +
      footer(
        "配置自动保存<br><strong>离线可用 · 数据仅存本机</strong>",
        button("navigate", "返回开始界面", "secondary", 'data-value="home"') +
          button("next", "配置我方 →"),
      )
    );
  }
  function servantList() {
    const q = search.trim().toLowerCase();
    return (
      allServants()
        .filter(
          (s) =>
            (s.name + " " + (s.originalName ?? "")).toLowerCase().includes(q) ||
            String(s.id).includes(q),
        )
        .map(
          (s) =>
            `<button class="servant-option ${String(session.servantId) === String(s.id) ? "selected" : ""}" data-action="choose-servant" data-value="${escape(s.id)}"><span class="servant-icon">◇</span><span><strong>${escape(s.name)}</strong><small>${escape(CLASS_NAMES[s.className] ?? s.className)} · ${escape(s.id)}</small></span>${String(session.servantId) === String(s.id) ? '<span class="selected-tick">✓</span>' : ""}</button>`,
        )
        .join("") ||
      '<div class="empty">没有匹配的从者。可在设置中新增自定义从者。</div>'
    );
  }
  function buffSection([id, title, fields]) {
    const count = fields.filter(
      ([key, , , def]) => n(session.buffs[key]) !== (def ?? 0),
    ).length;
    return `<details class="panel accordion" data-detail="buff-${id}" ${id === "A" ? "open" : ""}><summary><span class="section-letter">${id.length === 1 ? id : "＋"}</span>${title}${count ? `<span class="filled">${count} 项已填</span>` : ""}</summary><div class="accordion-body"><div class="form-grid">${fieldList(fields, "buffs.")}${id === "special" ? select("buffs.npVariant", "宝具类型切换", session, { 0: "宝具 1", 1: "宝具 2" }) : ""}</div>${id === "A" ? '<p class="hint">“伤害专用提升”仅影响伤害，不改变 NP 回收与产星。</p>' : id === "B" ? '<p class="hint">仅净降防设上限：防御下降＋适用暴击降防－敌方防御提升，最高 100%。</p>' : id === "C" ? '<p class="hint">宝具威力增幅以百分比填写，例如 100% 将宝具威力提升量翻倍。</p>' : id === "D" ? '<p class="hint">无宝具特攻时填 100%；150% 特攻填 150。</p>' : id === "special" ? '<p class="hint">额外宝具倍率、OC 倍率均与宝具倍率加算。勾选追加 OC Hit 后，OC 倍率用于独立追加伤害段。</p>' : ""}</div></details>`;
  }
  function cards() {
    return session.cards
      .map(
        (card, i) =>
          `<section class="panel command ${card.kind}"><div class="panel-head"><div class="card-label"><b>0${i + 1}</b><span>${i === 3 ? "EX 指令卡" : `指令卡 ${i + 1}`}</span></div><span class="panel-number">${card.kind === "none" ? "未使用" : card.kind === "np" ? "NOBLE PHANTASM" : "COMMAND CARD"}</span></div><div class="form-grid">${select(`cards.${i}.kind`, "指令卡类型", session, i === 3 ? { extra: "EX 卡", none: "无" } : { np: "宝具", buster: "红卡", arts: "蓝卡", quick: "绿卡", allyBuster: "友方红卡", allyArts: "友方蓝卡", allyQuick: "友方绿卡", none: "无" })}${select(`cards.${i}.target`, "攻击目标", session, Object.fromEntries(session.enemies.map((e) => [e.id, e.name])))}</div>${["buster", "arts", "quick"].includes(card.kind) ? check(`cards.${i}.critical`, "暴击", session) : ""}${
            card.kind === "none"
              ? '<p class="hint">本位置不参与伤害、回收和 Chain 判定。</p>'
              : `<details class="small-details" data-detail="card-${i}"><summary>单卡增益与特殊选项${CARD_FIELDS.some(([key, , , def]) => (key !== "commandRandom" || card.kind !== "np") && n(card[key]) !== (def ?? 0)) || CARD_SWITCHES.some(([key]) => cardSwitchApplies(key, card.kind) && card[key]) ? " · 已配置" : ""}</summary><div class="form-grid">${fieldList(
                  CARD_FIELDS.filter(
                    ([key]) => key !== "commandRandom" || card.kind !== "np",
                  ),
                  `cards.${i}.`,
                )}</div><div class="switch-grid">${CARD_SWITCHES.filter(
                  ([key]) => cardSwitchApplies(key, card.kind),
                )
                  .map(([key, label, help]) =>
                    check(`cards.${i}.${key}`, label, session, "session", help),
                  )
                  .join("")}</div></details>`
          }${card.kind.startsWith("ally") ? '<p class="hint">仅参与卡序与 Chain；贡献由固定伤害、固定出星录入。不计 NP 或随机数。</p>' : ""}</section>`,
      )
      .join("");
  }
  function buffsPage() {
    const s = servant(),
      chain = chainInfo(session, s);
    return (
      header(
        "TURN / ALLY",
        "配置本回合的指令卡",
        "通用增益作用于本回合；单卡设置可模拟纹章与关卡机制。",
      ) +
      `<div class="mini-summary"><span>${escape(s.name)} · Lv.${session.level}</span><span>ATK ${fmt(baseAttack(s, session.level) + n(session.extraAttack), 0)}</span><span>宝具 ${session.npLevel} 级</span>${session.useClassScore ? "<span>职阶星图已启用</span>" : ""}${session.useGrandScore ? "<span>冠位星图已启用</span>" : ""}</div><div class="buff-layout"><div class="stack">${BUFF_GROUPS.slice(0, 3).map(buffSection).join("")}</div><div class="stack">${BUFF_GROUPS.slice(3).map(buffSection).join("")}</div></div><div class="section-header"><h2>出牌顺序</h2><span class="tag">${chain.mighty ? "Mighty Chain" : chain.same ? `${COLOR_NAMES[chain.colors[0]]} Chain` : "自由配置"}</span></div><div class="card-grid">${cards()}</div><section class="panel" style="margin-top:16px"><div class="form-grid">${field("receivedNp", "本回合碰瓷 NP 获取", session)}</div><p class="hint">手动填写本回合受敌方攻击获得的 NP，在最终汇总中计入一次。</p></section>` +
      footer(
        `第 ${session.turn} 回合<br><strong>增益输入会保留到下一回合</strong>`,
        button("previous", "上一步", "secondary") +
          button("next", "配置敌方 →"),
      )
    );
  }
  function enemyPage() {
    return (
      header(
        "TURN / ENEMY",
        "设定你的对手",
        "每个目标单独结算伤害、回收与鞭尸；最多添加 6 名敌人。",
      ) +
      `<div class="enemy-list">${session.enemies
        .map(
          (enemy, i) =>
            `<section class="panel enemy-panel"><div class="panel-head"><input class="enemy-name" type="text" data-domain="session" data-path="enemies.${i}.name" value="${escape(enemy.name)}" aria-label="敌人 ${i + 1} 名称" maxlength="40">${i > 0 ? button("delete-enemy", "删除", "delete", `data-value="${i}"`) : '<span class="panel-number">ENEMY 01</span>'}</div><div class="form-grid">${select(`enemies.${i}.className`, "职阶", session, CLASS_NAMES)}${select(`enemies.${i}.attribute`, "副属性", session, ATTR_NAMES)}${field(`enemies.${i}.hp`, "当前 HP", session, "session", "点", { min: 0 })}</div><p class="hint">职阶补正已应用：NP ×${CLASS_NP[enemy.className] ?? 1} · 出星率 ${CLASS_STARS[enemy.className] ?? 0}%</p><details class="small-details" data-detail="enemy-${i}"><summary>敌方增益与耐性</summary><div class="form-grid advanced-enemy">${fieldList(
              ENEMY_FIELDS.filter(([key]) => key !== "hp"),
              `enemies.${i}.`,
            )}</div><p class="hint">通用、暴击、宝具伤害耐性仅影响伤害；卡色耐性影响对应卡的伤害、NP 回收与产星。</p></details><details class="small-details" data-detail="enemy-debuff-${i}"><summary>敌方减益与 D 类特攻</summary><div class="form-grid advanced-enemy">${fieldList(ENEMY_DEBUFF_FIELDS, `enemies.${i}.`)}</div><p class="hint">填写正值，效果等同于攻击此目标时的我方增益：A 类同时影响伤害、回收与产星，C 类加入威力乘区。降防与我方降防合并后扣除加防，最高 100%。D 类仅作用于宝具，无特攻填 100，150% 特攻填 150。固定伤害只对当前目标加算。</p></details><div class="divider"></div>${check(`enemies.${i}.undead`, "死灵补正", session, "session", "在职阶 NP 补正基础上再乘 1.2。")}${check(`enemies.${i}.customClass`, "自定义职阶克制倍率", session, "session", "只替换职阶相性，保留我方职阶攻击补正与副属性相性。")}${enemy.customClass ? `<div class="form-grid">${field(`enemies.${i}.classMultiplier`, "职阶克制倍率", session, "session", "倍", { min: 0 })}</div>` : ""}${check(`enemies.${i}.resetOnDeath`, "死亡后重置鞭尸", session, "session", "本卡击杀此目标后，清空所有敌人的鞭尸伤害累计。")}</section>`,
        )
        .join(
          "",
        )}${session.enemies.length < 6 ? button("add-enemy", "＋ 追加新敌人", "add-enemy") : '<p class="hint">已达到 6 名敌人的上限。</p>'}</div>` +
      footer(
        `${session.enemies.length} 名敌人<br><strong>允许继续攻击 HP 为 0 的目标</strong>`,
        button("previous", "上一步", "secondary") +
          button("calculate", "开始计算 →"),
      )
    );
  }
  function metric(value, label, unit = "") {
    return `<div><small>${label}</small><strong>${fmt(value)}${unit}</strong></div>`;
  }
  function resultsPage() {
    return (
      header(
        "TURN / RESULT",
        `第 ${session.turn} 回合 · 计算结果`,
        "逐卡查看收益，确认后可继续下一回合。",
      ) +
      `<div class="result-layout"><div class="stack">${result.cards.map((card) => `<section class="panel result-card command ${card.kind}"><div class="panel-head"><div class="card-label"><b>0${card.index + 1}</b><span>${CARD_NAMES[card.kind]}</span></div><span class="panel-number">${card.kind === "none" ? "未使用" : `随机数 ${card.random}`}</span></div>${card.kind === "none" ? '<p class="hint">本位置未参与计算。</p>' : `<div class="result-metrics">${metric(card.damage, "伤害")}${metric(card.np, "NP 获取", "%")}${metric(card.stars, "预计暴击星", " 颗")}</div>${card.targets.map((target) => `<div class="target-row"><div class="target-title">${escape(target.name)}</div>${card.targets.length > 1 ? `<div class="result-metrics">${metric(target.damage, "伤害")}${metric(target.np, "命中 NP", "%")}${metric(target.stars, "命中预计星", " 颗")}</div>` : ""}${card.targets.length > 1 ? `<p class="hint">产星随机数消耗 ${target.random} 次</p>` : ""}${target.overkillStart !== null ? `<span class="overkill">第 ${target.overkillStart} Hit 开始鞭尸</span>` : ""}</div>`).join("")}<div class="result-foot"><span>随机数消耗 ${card.random} 次</span>${card.fixedNp ? `<span>固定 NP ${fmt(card.fixedNp)}%</span>` : ""}${card.fixedStars ? `<span>固定出星 ${fmt(card.fixedStars)} 颗</span>` : ""}</div>${card.deathReset ? '<p class="notice">本卡触发敌人死亡效果：所有目标的鞭尸累计已重置。</p>' : ""}`}</section>`).join("")}</div><div class="stack"><section class="panel result-overview"><p class="eyebrow">TURN TOTAL</p><h2>本回合总收益</h2><div class="result-stats"><div><small>NP 获取</small><strong>${fmt(result.totals.np)}</strong><i>%</i></div><div><small>预计暴击星</small><strong>${fmt(result.totals.stars)}</strong><i>颗</i></div><div><small>随机数消耗</small><strong>${result.totals.random}</strong></div></div></section><section class="panel"><h3>对各目标的伤害</h3>${
        result.enemies
          .filter((enemy) => enemy.damage > 0)
          .map(
            (enemy) =>
              `<div class="damage-line"><div>${escape(enemy.name)}<small>剩余 HP ${fmt(enemy.remainingHp, 0)}</small></div><strong>${fmt(enemy.damage, 0)}</strong></div>`,
          )
          .join("") || '<p class="hint">本回合未造成伤害。</p>'
      }</section><section class="panel"><h3>汇总补充</h3><div class="damage-line"><span>碰瓷 NP 获取</span><span>${fmt(result.extras.receivedNp)}%</span></div><div class="damage-line"><span>每回合 NP 变动</span><span>${fmt(result.extras.turnNp)}%</span></div><div class="damage-line"><span>每回合暴击星变动</span><span>${fmt(result.extras.turnStars)} 颗</span></div><div class="damage-line"><span>Chain 奖励</span><span>${result.extras.chainNp ? `${result.extras.chainNp}% NP` : result.extras.chainStars ? `${result.extras.chainStars} 星` : "无"}</span></div><p class="hint">以上已计入总收益。预计暴击星是期望值；随机数仅统计产星和纹章。固定收益每卡只加一次。</p></section></div></div>` +
      footer(
        "逐 Hit 回收 · 两次截断<br><strong>尚未扣除敌人 HP</strong>",
        button("previous", "上一步", "secondary") +
          button("close-result", "关闭结果"),
      )
    );
  }
  function completionPage() {
    return (
      header(
        "TURN / CONTINUE",
        "接下来，继续战斗。",
        "本回合结果已保留；点击进入下一回合才会扣除敌人 HP。",
      ) +
      `<section class="panel completion" style="max-width:540px;margin-left:auto;margin-right:auto"><div class="completion-mark">✓</div><h2>第 ${session.turn} 回合计算完成</h2><p>NP 获取 ${fmt(result?.totals.np)}% · 预计暴击星 ${fmt(result?.totals.stars)} 颗</p>${button("next-turn", "进入下一回合 →")}${button("back-enemies", "返回上一页 · 敌方配置", "secondary")}${button("reset-session", "清空所有计算信息", "danger")}<p class="hint">清空仅重置本次计算，保留从者数据库、星图设置与背景图片。</p></section>`
    );
  }

  return {
    selectPage,
    buffsPage,
    enemyPage,
    resultsPage,
    completionPage,
    servantList,
  };
}
