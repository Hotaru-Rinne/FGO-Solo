import {
  CLASS_NAMES,
  ATTR_NAMES,
  CARD_FIELDS,
  CARD_SWITCHES,
  ENEMY_FIELDS,
  ENEMY_DEBUFF_FIELDS,
  BUFF_GROUPS,
  n,
} from "./model.js";
export function validateServant(s) {
  if (
    !s ||
    typeof s.name !== "string" ||
    !s.name.trim() ||
    !CLASS_NAMES[s.className] ||
    !ATTR_NAMES[s.attribute]
  )
    throw new Error("请填写名称、职阶与副属性。");
  if (
    !Array.isArray(s.atkGrowth) ||
    s.atkGrowth.length < 1 ||
    s.atkGrowth.length > 200 ||
    s.atkGrowth.some((x) => !Number.isFinite(x) || x < 0)
  )
    throw new Error("ATK 成长表须为 1～200 个非负数。");
  if (
    !Number.isInteger(s.defaultLevel) ||
    s.defaultLevel < 1 ||
    s.defaultLevel > s.atkGrowth.length
  )
    throw new Error("默认等级超出成长表范围。");
  for (const [label, dist] of Object.entries(s.hits ?? {})) {
    validateHits(dist, label);
  }
  if (
    !s.hits ||
    !["buster", "arts", "quick", "extra"].every(
      (c) =>
        s.hits[c]?.length &&
        Number.isFinite(s.npRates?.[c]) &&
        s.npRates[c] >= 0,
    )
  )
    throw new Error("请补全四类卡的 Hit 分布及 NP 率。");
  if (!Number.isFinite(s.starRate) || s.starRate < 0)
    throw new Error("基础出星率须为非负数。");
  if (
    !Array.isArray(s.noblePhantasms) ||
    s.noblePhantasms.length < 1 ||
    s.noblePhantasms.length > 2
  )
    throw new Error("须配置 1～2 个宝具。");
  for (const np of s.noblePhantasms) {
    if (
      !["buster", "arts", "quick"].includes(np.color) ||
      !["single", "all", "support"].includes(np.type)
    )
      throw new Error("宝具颜色或类型无效。");
    if (!Number.isFinite(np.npRate) || np.npRate < 0)
      throw new Error("宝具 NP 率无效。");
    if (
      np.multipliers?.length !== 5 ||
      np.multipliers.some((x) => !Number.isFinite(x) || x < 0)
    )
      throw new Error("宝具倍率须填写 5 个非负数。");
    if (np.type !== "support") validateHits(np.hits, "宝具");
    if (np.ocHits?.length) validateHits(np.ocHits, "OC 追加");
  }
  for (const [key, value] of Object.entries({
    ...s.classAffinity,
    ...s.coinAttack,
  })) {
    if (
      (!CLASS_NAMES[key] &&
        !(key === "extraClasses" && key in (s.coinAttack ?? {}))) ||
      !Number.isFinite(value) ||
      value < -100
    )
      throw new Error("额外职阶相性无效。");
  }
  for (const value of Object.values(s.passives ?? {}))
    if (!Number.isFinite(value)) throw new Error("被动数值无效。");
  for (const value of Object.values(s.coinPassive ?? {}))
    if (!Number.isFinite(value)) throw new Error("硬币被动数值无效。");
}
function validateHits(dist, label) {
  if (
    !Array.isArray(dist) ||
    !dist.length ||
    dist.length > 100 ||
    dist.some((x) => !Number.isFinite(x) || x < 0) ||
    dist.reduce((a, b) => a + b, 0) <= 0
  )
    throw new Error(`${label} Hit 分布须为非负数且至少有一项大于 0。`);
}
export function validateBackup(data, builtins) {
  if (
    data?.format !== "fgo-solo-backup" ||
    data.version !== 1 ||
    !data.session ||
    !data.settings
  )
    throw new Error("这不是受支持的一骑千筹计算器备份。");
  if (/"(?:__proto__|constructor|prototype)"\s*:/.test(JSON.stringify(data)))
    throw new Error("备份含无效字段。");
  const st = data.settings,
    ss = data.session;
  if (
    !Array.isArray(st.customServants) ||
    st.customServants.length > 2000 ||
    !st.servantOverrides ||
    !st.classScores ||
    !st.grandScores
  )
    throw new Error("设置数据不完整。");
  for (const s of [...st.customServants, ...Object.values(st.servantOverrides)])
    validateServant(s);
  if (
    !Number.isFinite(st.backgroundOpacity) ||
    st.backgroundOpacity < 0 ||
    st.backgroundOpacity > 65
  )
    throw new Error("背景清晰度无效。");
  if (
    !Number.isInteger(ss.step) ||
    ss.step < 0 ||
    ss.step > 4 ||
    !Number.isInteger(ss.turn) ||
    ss.turn < 1 ||
    !ss.buffs ||
    !Array.isArray(ss.cards) ||
    ss.cards.length !== 4 ||
    !Array.isArray(ss.enemies) ||
    ss.enemies.length < 1 ||
    ss.enemies.length > 6
  )
    throw new Error("计算信息不完整。");
  for (const [i, c] of ss.cards.entries())
    if (
      !(
        i === 3
          ? ["none", "extra"]
          : [
              "np",
              "buster",
              "arts",
              "quick",
              "allyBuster",
              "allyArts",
              "allyQuick",
              "none",
            ]
      ).includes(c.kind)
    )
      throw new Error("指令卡类型无效。");
  if (new Set(ss.enemies.map((e) => e.id)).size !== ss.enemies.length)
    throw new Error("敌人 ID 重复。");
  for (const e of ss.enemies)
    if (!CLASS_NAMES[e.className] || !ATTR_NAMES[e.attribute])
      throw new Error("敌方职阶或副属性无效。");
  const downloaded = data.downloadedServants ?? [];
  if (!Array.isArray(downloaded) || downloaded.length > 3000)
    throw new Error("新增从者库无效");
  for (const s of downloaded) validateServant(s);
  if (new Set(downloaded.map((s) => String(s.id))).size !== downloaded.length)
    throw new Error("新增从者ID重复");
  const catalog = [
    ...new Map(
      [...builtins, ...downloaded].map((s) => [String(s.id), s]),
    ).values(),
    ...st.customServants,
  ];
  if (new Set(catalog.map((s) => String(s.id))).size !== catalog.length)
    throw new Error("从者 ID 重复。");
  for (const [id, entry] of Object.entries(st.servantOverrides))
    if (String(entry.id) !== id || !catalog.some((s) => String(s.id) === id))
      throw new Error("从者覆盖数据的 ID 不匹配。");
  if (
    st.deletedServantIds &&
    (!Array.isArray(st.deletedServantIds) ||
      st.deletedServantIds.some((id) => typeof id !== "string"))
  )
    throw new Error("已删除从者记录无效。");
  const list = catalog
    .filter((s) => !(st.deletedServantIds ?? []).includes(String(s.id)))
    .map((s) => st.servantOverrides[s.id] ?? s);
  const selected = list.find((s) => String(s.id) === String(ss.servantId));
  if (!selected && !(list.length === 0 && ss.step === 0 && ss.servantId === ""))
    throw new Error("备份中的从者不存在。");
  if (!Number.isInteger(n(ss.npLevel)) || ss.npLevel < 1 || ss.npLevel > 5)
    throw new Error("宝具等级无效。"); // Draft sessions may deliberately contain incomplete NP2/OC configuration.
  validateNumbers(ss, st);
  if (
    data.background &&
    (!/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(
      data.background,
    ) ||
      data.background.length > 12e6)
  )
    throw new Error("背景图片数据无效。");
}

function validateNumbers(session, settings) {
  const walk = (value) => {
    if (typeof value === "number" && !Number.isFinite(value))
      throw new Error("备份含无效数值。");
    if (value && typeof value === "object")
      for (const child of Object.values(value)) walk(child);
  };
  walk(session);
  walk(settings);
  if (settings.updateRepository !== undefined && (typeof settings.updateRepository !== "string" || settings.updateRepository.length > 300))
    throw new Error("更新仓库配置无效。");
  if (
    settings.defaults &&
    (!Number.isInteger(settings.defaults.level) ||
      settings.defaults.level < 1 ||
      settings.defaults.level > 200 ||
      !Number.isInteger(settings.defaults.npLevel) ||
      settings.defaults.npLevel < 1 ||
      settings.defaults.npLevel > 5 ||
      !Number.isFinite(settings.defaults.extraAttack))
  )
    throw new Error("默认养成配置无效。");
  if (
    settings.orientation &&
    !["portrait", "landscape", "auto"].includes(settings.orientation)
  )
    throw new Error("屏幕方向无效。");
  if (settings.coinClassAttack)
    for (const [key, value] of Object.entries(settings.coinClassAttack))
      if (
        (!CLASS_NAMES[key] && key !== "extraClasses") ||
        typeof value !== "number"
      )
        throw new Error("硬币对职阶加攻无效。");
  if (settings.coinPassive)
    for (const value of Object.values(settings.coinPassive))
      if (typeof value !== "number" || !Number.isFinite(value))
        throw new Error("硬币被动数值无效。");
  for (const key of ["level", "extraAttack", "receivedNp"])
    if (typeof session[key] !== "number")
      throw new Error("计算输入必须为数值。");
  for (const [key] of BUFF_GROUPS.flatMap((g) => g[2]))
    if (typeof session.buffs[key] !== "number")
      throw new Error("增益字段不完整。");
  for (const card of session.cards) {
    for (const [key] of CARD_FIELDS)
      if (typeof card[key] !== "number") throw new Error("单卡数值不完整。");
    for (const [key] of CARD_SWITCHES)
      if (typeof card[key] !== "boolean") throw new Error("单卡开关无效。");
    if (!session.enemies.some((e) => e.id === card.target))
      throw new Error("指令卡目标不存在。");
  }
  for (const enemy of session.enemies) {
    if (typeof enemy.id !== "string" || typeof enemy.name !== "string")
      throw new Error("敌人名称或 ID 无效。");
    for (const [key] of [...ENEMY_FIELDS, ...ENEMY_DEBUFF_FIELDS])
      if (typeof enemy[key] !== "number") throw new Error("敌人数值不完整。");
  }

  for (const [key, value] of Object.entries(session.buffs))
    if (typeof value !== "number") throw new Error("增益字段必须为数值。");
  for (const maps of [settings.classScores, settings.grandScores])
    for (const buffs of Object.values(maps))
      for (const value of Object.values(buffs))
        if (typeof value !== "number" || !Number.isFinite(value))
          throw new Error("星图数值无效。");
}
