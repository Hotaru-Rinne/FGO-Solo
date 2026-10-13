export const CLASS_NAMES = {
  saber: "Saber · 剑",
  archer: "Archer · 弓",
  lancer: "Lancer · 枪",
  rider: "Rider · 骑",
  caster: "Caster · 术",
  assassin: "Assassin · 杀",
  berserker: "Berserker · 狂",
  shielder: "Shielder · 盾",
  ruler: "Ruler · 裁",
  avenger: "Avenger · 仇",
  moonCancer: "Moon Cancer · 月",
  alterEgo: "Alter Ego · 丑",
  foreigner: "Foreigner · 降",
  pretender: "Pretender · 披",
  beast: "Beast · 兽（德拉科）",
  beastEresh: "Beast · 兽（艾蕾）",
  unBeastOlgaMarie: "UnBeast",
  other: "其他",
};
export const ATTR_NAMES = {
  sky: "天",
  earth: "地",
  human: "人",
  star: "星",
  beast: "兽",
};
export const COLOR_NAMES = {
  buster: "红卡",
  arts: "蓝卡",
  quick: "绿卡",
  extra: "EX 卡",
};
export const CARD_NAMES = {
  np: "宝具",
  ...COLOR_NAMES,
  allyBuster: "友方红卡",
  allyArts: "友方蓝卡",
  allyQuick: "友方绿卡",
  none: "无",
};
export const BUFF_GROUPS = [
  [
    "A",
    "卡色性能",
    [
      ["buster", "红卡性能"],
      ["arts", "蓝卡性能"],
      ["quick", "绿卡性能"],
      ["extra", "EX 卡性能"],
      ["busterDamage", "红卡伤害专用提升"],
      ["artsDamage", "蓝卡伤害专用提升"],
      ["quickDamage", "绿卡伤害专用提升"],
      ["extraDamage", "EX 卡伤害专用提升"],
    ],
  ],
  [
    "B",
    "攻击与降防",
    [
      ["attack", "攻击力提升"],
      ["defenseDown", "防御力下降"],
      ["criticalDefenseDown", "暴击防御力下降"],
    ],
  ],
  [
    "C",
    "威力提升",
    [
      ["npDamage", "宝具威力提升"],
      ["criticalDamage", "通用暴击威力"],
      ["busterCritical", "红卡暴击威力"],
      ["artsCritical", "蓝卡暴击威力"],
      ["quickCritical", "绿卡暴击威力"],
      ["power", "特攻状态"],
      ["npBoost", "宝具威力增幅"],
    ],
  ],
  [
    "other",
    "获取与固定值",
    [
      ["npGain", "NP 获取率"],
      ["starGain", "出星率"],
      ["flatDamage", "固定伤害", "点"],
      ["npPerTurn", "每回合 NP 变动", "%"],
      ["starsPerTurn", "每回合暴击星变动", "颗"],
    ],
  ],
  [
    "special",
    "宝具调整",
    [
      ["npExtra", "额外宝具倍率"],
      ["npOcExtra", "额外宝具 OC 倍率"],
    ],
  ],
];
export const PASSIVE_FIELDS = [
  ["attack", "攻击力提升"],
  ["power", "通用威力提升"],
  ["buster", "红卡性能"],
  ["arts", "蓝卡性能"],
  ["quick", "绿卡性能"],
  ["extra", "EX 卡性能"],
  ["criticalDamage", "通用暴击威力"],
  ["busterCritical", "红卡暴击威力"],
  ["artsCritical", "蓝卡暴击威力"],
  ["quickCritical", "绿卡暴击威力"],
  ["npDamage", "宝具威力提升"],
  ["flatDamage", "固定伤害", "点"],
  ["npGain", "NP 获取率"],
  ["npPerTurn", "每回合 NP 获取"],
  ["starGain", "出星率"],
  ["starsPerTurn", "每回合暴击星获取", "颗"],
  ...["buster", "arts", "quick", "extra"].flatMap((c) => [
    [`${c}Star`, `${COLOR_NAMES[c]}出星率`],
    [`${c}Np`, `${COLOR_NAMES[c]} NP 获取率`],
  ]),
];
export const CARD_FIELDS = [
  ["a", "A 类额外增益"],
  ["b", "B 类额外增益"],
  ["c", "C 类额外增益"],
  ["flatDamage", "固定伤害", "点"],
  ["npGain", "NP 获取率"],
  ["starGain", "出星率"],
  ["resistance", "通用伤害耐性"],
  ["attack", "额外 ATK", "点"],
  ["fixedStars", "固定出星", "颗"],
  ["fixedNp", "固定 NP 获取"],
  ["commandRandom", "纹章随机数消耗", "次"],
  ["random", "伤害随机数", "倍", 1],
];
export const ENEMY_FIELDS = [
  ["hp", "当前 HP", "点", 100000],
  ["resistance", "通用伤害耐性"],
  ["criticalResistance", "暴击伤害耐性"],
  ["npResistance", "宝具伤害耐性"],
  ["busterResistance", "红卡耐性"],
  ["artsResistance", "蓝卡耐性"],
  ["quickResistance", "绿卡耐性"],
  ["extraResistance", "EX 卡耐性"],
  ["flatReduction", "固定伤害减免", "点"],
  ["defense", "防御力提升"],
  ["npDown", "NP 获取率下降"],
  ["starDown", "出星率下降"],
];
export const ENEMY_DEBUFF_FIELDS = [
  ["aDown", "A 类减益"],
  ["defenseDown", "降防"],
  ["cDown", "C 类减益"],
  ["npSpecial", "D 类特攻", "%", 100],
  ["flatDamage", "固定伤害", "点"],
];
export const DEFAULT_BUILD = { level: 120, npLevel: 5, extraAttack: 4400 };
export const CARD_SWITCHES = [
  ["resetOverkill", "重置鞭尸", "本卡结算前，将所有敌人的鞭尸伤害累计清零。"],
  ["forceOverkill", "强制鞭尸", "本卡所有命中直接获得鞭尸补正。"],
  [
    "extraOcHits",
    "追加宝具 OC Hit",
    "仅宝具生效，使用设置中的 OC 追加段 Hit 分布。",
  ],
  ["noNp", "不参与 NP 回收", "只关闭命中回收，保留固定 NP 获取。"],
  [
    "allHalf",
    "全体攻击",
    "攻击全部敌人，每个目标的伤害、命中 NP 和出星减半；固定 NP/星整卡加一次。",
  ],
  [
    "zeroDamage",
    "伤害始终为 0",
    "含固定伤害在内归零，命中回收和产星仍照常结算。",
  ],
];
export const isAreaCommand = (card) =>
  card.kind !== "np" && card.kind !== "none" && !!card.allHalf;
export const cardSwitchApplies = (key, kind) =>
  kind !== "none" &&
  (key !== "allHalf" || kind !== "np") &&
  (key !== "extraOcHits" || kind === "np");
export const FULL_CLASS_SCORE = {
  busterDamage: 20,
  artsDamage: 20,
  quickDamage: 20,
  extra: 50,
  criticalDamage: 10,
  busterCritical: 20,
  artsCritical: 40,
  quickCritical: 60,
  npDamage: 10,
  starGain: 50,
};
export const FULL_GRAND_SCORE = {
  busterDamage: 50,
  artsDamage: 50,
  quickDamage: 50,
  npPerTurn: 10,
  extra: 200,
};
export const GRAND_SCORE_DEFAULTS_VERSION = 1;
export const n = (value) =>
  Number.isFinite(Number(value)) ? Number(value) : 0;
export function newEnemy(index = 0) {
  return {
    id: `enemy-${Date.now()}-${index}`,
    name: `敌人${["一", "二", "三", "四", "五", "六"][index]}`,
    className: "saber",
    attribute: "human",
    ...Object.fromEntries(
      [...ENEMY_FIELDS, ...ENEMY_DEBUFF_FIELDS].map(([key, , , value]) => [
        key,
        value ?? 0,
      ]),
    ),
    undead: false,
    customClass: false,
    classMultiplier: 1,
    resetOnDeath: false,
  };
}
export function newCard(index = 0, target = "") {
  return {
    kind: index === 3 ? "extra" : ["buster", "arts", "quick"][index],
    target,
    critical: false,
    ...Object.fromEntries(
      CARD_FIELDS.map(([key, , , value]) => [key, value ?? 0]),
    ),
    ...Object.fromEntries(CARD_SWITCHES.map(([key]) => [key, false])),
  };
}
export function buildDefaults(servant, settings = {}) {
  const defaults = { ...DEFAULT_BUILD, ...settings.defaults };
  return {
    level: Math.max(
      1,
      Math.min(
        Math.floor(n(defaults.level)),
        servant?.atkGrowth?.length ?? 120,
      ),
    ),
    npLevel: Math.max(1, Math.min(5, Math.floor(n(defaults.npLevel)))),
    extraAttack: n(defaults.extraAttack),
  };
}
export function newSession(servant, settings = {}) {
  const enemy = newEnemy();
  return {
    version: 1,
    step: 0,
    turn: 1,
    servantId: servant?.id ?? 100100,
    ...buildDefaults(servant, settings),
    useClassScore: false,
    useGrandScore: false,
    useCoinPassive: false,
    buffs: {
      ...Object.fromEntries(
        BUFF_GROUPS.flatMap((g) => g[2]).map(([key, , , value]) => [
          key,
          value ?? 0,
        ]),
      ),
      npVariant: 0,
    },
    cards: Array.from({ length: 4 }, (_, i) => newCard(i, enemy.id)),
    enemies: [enemy],
    receivedNp: 0,
  };
}
export function newSettings() {
  return {
    classScores: Object.fromEntries(
      Object.keys(CLASS_NAMES).map((c) => [c, { ...FULL_CLASS_SCORE }]),
    ),
    grandScores: Object.fromEntries(
      Object.keys(CLASS_NAMES).map((c) => [c, { ...FULL_GRAND_SCORE }]),
    ),
    grandScoreDefaultsVersion: GRAND_SCORE_DEFAULTS_VERSION,
    defaults: { ...DEFAULT_BUILD },
    orientation: "portrait",
    updateRepository: "",
    deletedServantIds: [],
    servantOverrides: {},
    customServants: [],
    backgroundOpacity: 18,
  };
}
export function customServant(id = `custom-${Date.now()}`) {
  return {
    id,
    name: "自定义从者",
    className: "saber",
    attribute: "human",
    defaultLevel: 120,
    atkGrowth: Array(120).fill(10000),
    starRate: 10,
    hits: { buster: [100], arts: [100], quick: [100], extra: [100] },
    npRates: { buster: 0.5, arts: 0.5, quick: 0.5, extra: 0.5 },
    passives: {},
    classAffinity: {},
    coinAttack: {},
    coinPassive: { extra: 50, criticalDamage: 30 },
    noblePhantasms: [
      {
        name: "自定义宝具",
        color: "arts",
        type: "single",
        multipliers: [900, 1200, 1350, 1425, 1500],
        npRate: 0.5,
        hits: [100],
        ocHits: [],
      },
    ],
    source: "用户自定义（请编辑基础数据）",
  };
}
