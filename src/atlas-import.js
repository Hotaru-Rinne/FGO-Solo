import { dataFetch } from "./data-fetch.js";
import { CLASS_NAMES } from "./model.js";
import { CLASS_RELATIONS } from "./relations.js";
import { validateServant } from "./validation.js";
import { supplementChineseName } from "./mooncell.js";
export const ATLAS_ROOT = "https://api.atlasacademy.io";
const COLOR = { 1: "arts", 2: "buster", 3: "quick", 4: "extra" };
const CARD_TRAITS = {
  cardArts: "arts",
  cardBuster: "buster",
  cardQuick: "quick",
  cardExtra: "extra",
};
const CLASS_TRAITS = {
  classSaber: "saber",
  classArcher: "archer",
  classLancer: "lancer",
  classRider: "rider",
  classCaster: "caster",
  classAssassin: "assassin",
  classBerserker: "berserker",
  classShielder: "shielder",
  classRuler: "ruler",
  classAvenger: "avenger",
  classMoonCancer: "moonCancer",
  classAlterEgo: "alterEgo",
  classForeigner: "foreigner",
  classPretender: "pretender",
  classBeastDraco: "beast",
  classBeastEresh: "beastEresh",
  classUnBeastOlgaMarie: "unBeastOlgaMarie",
};
const FIELD_TYPES = {
  upCommandall: "color",
  upCommandatk: "colorDamage",
  upCriticaldamage: "criticalDamage",
  upNpdamage: "npDamage",
  addDamage: "flatDamage",
  upDropnp: "npGain",
  regainNp: "npPerTurn",
  upCriticalpoint: "starGain",
  regainStar: "starsPerTurn",
  upAtk: "attack",
  upDamage: "power",
  upCommandnp: "colorNp",
  upCommandstar: "colorStar",
};
const SAFE_BUFF_SCRIPTS = new Set(["ProgressSelfTurn"]);
const SAFE_SVAL_KEYS = new Set([
  "Rate",
  "Turn",
  "Count",
  "Value",
  "ShowState",
  "ShowQuestNoEffect",
  "UnSubState",
  "NotRemoveOnShift",
  "ForceAddState",
  "SetPassiveFrame",
  "HideMiss",
  "HideNoEffect",
  "OnField",
]);
const list = (x) => (Array.isArray(x) ? x : []);
const nonempty = (x) => x && Object.keys(x).length > 0;
function traitNames(traits) {
  return list(traits).map((t) => (typeof t === "object" ? t.name : String(t)));
}
function constantConditions(
  skill,
  fn,
  buff,
  { classTargets = false, relation = false } = {},
) {
  if (list(skill.actIndividuality).length || nonempty(skill.script))
    return "技能带发动条件";
  if (!["addState", "addStateShort"].includes(fn.funcType))
    return "不是常驻数值效果";
  if (!["self", "ptFull"].includes(fn.funcTargetType))
    return "不是直接作用于自身的常驻效果";
  if (
    list(fn.functvals).length ||
    list(fn.funcquestTvals).length ||
    list(fn.overWriteTvalsList).length ||
    nonempty(fn.script)
  )
    return "函数含对象/任务/脚本条件";
  const v = fn.svals?.[0] ?? {};
  if (v.Rate !== 1000 || v.Turn !== -1 || v.Count !== -1)
    return "有概率、持续时间或次数限制";
  if (v.OnField !== undefined && v.OnField !== 1) return "特殊在场条件";
  if (Object.keys(v).some((k) => !SAFE_SVAL_KEYS.has(k)))
    return "存在附加发动条件或特殊数值参数";
  if (
    Object.keys(buff.script ?? {}).some(
      (k) => !SAFE_BUFF_SCRIPTS.has(k) && !(relation && k === "relationId"),
    )
  )
    return "场地、状态或其他条件脚本";
  const self = list(buff.ckSelfIndv),
    op = list(buff.ckOpIndv);
  if (self.some((t) => t.negative || !CARD_TRAITS[t.name]))
    return "自身特性或状态条件";
  if (
    op.length &&
    (!classTargets || op.some((t) => t.negative || !CLASS_TRAITS[t.name]))
  )
    return "限定对象特性";
  const allowed = new Set([
    "canBeInBattle",
    ...Object.keys(CARD_TRAITS),
    ...(classTargets ? Object.keys(CLASS_TRAITS) : []),
  ]);
  if (list(buff.tvals).some((t) => t.negative || !allowed.has(t.name)))
    return "包含不能视为常态的判定条件";
  return null;
}
export function parsePassives(raw) {
  const passives = {},
    classAffinity = {},
    coinAttack = {},
    audit = [];
  const record = (skill, buff, status, reason, field, value) =>
    audit.push({
      skill: skill.name,
      skillId: skill.id,
      effect: buff.name ?? buff.type,
      type: buff.type,
      status,
      reason,
      ...(field ? { field, value } : {}),
    });
  const seen = new Set();
  for (const skill of list(raw.classPassive)) {
    if (seen.has(skill.id)) continue;
    seen.add(skill.id);
    for (const fn of list(skill.functions))
      for (const buff of list(fn.buffs)) {
        const relation = buff.type === "overwriteClassRelation";
        const key = FIELD_TYPES[buff.type];
        if (!key && !relation) {
          record(
            skill,
            buff,
            "excluded",
            /Function|guts|continue|turnend/i.test(buff.type)
              ? "触发型效果，不展开其内部技能"
              : "不属于计算器的常态数值项",
          );
          continue;
        }
        const reason = constantConditions(skill, fn, buff, { relation });
        if (reason) {
          record(skill, buff, "excluded", reason);
          continue;
        }
        if (relation) {
          const relationMap = buff.script?.relationId?.atkSide?.[raw.className];
          if (!relationMap) {
            record(skill, buff, "review", "未识别当前职阶的相性覆盖");
            continue;
          }
          for (const [target, entry] of Object.entries(relationMap)) {
            if (
              !CLASS_NAMES[target] ||
              entry.type !== "overwriteForce" ||
              !Number.isFinite(entry.damageRate)
            ) {
              record(skill, buff, "review", "未识别相性覆盖类型");
              continue;
            }
            const base = CLASS_RELATIONS[raw.className]?.[target] ?? 1;
            classAffinity[target] =
              Math.round((entry.damageRate / 1000 / base - 1) * 1000000) /
              10000;
            record(
              skill,
              buff,
              "included",
              "常驻职阶攻击相性",
              `classAffinity.${target}`,
              classAffinity[target],
            );
          }
          continue;
        }
        const traits = [...list(buff.ckSelfIndv), ...list(buff.tvals)];
        const colors = [
          ...new Set(traits.map((t) => CARD_TRAITS[t.name]).filter(Boolean)),
        ];
        if (colors.length > 1) {
          record(skill, buff, "review", "同一效果具有多个卡色条件，需核对");
          continue;
        }
        const color = colors[0];
        let field = key;
        if (
          key === "color" ||
          key === "colorDamage" ||
          key === "colorNp" ||
          key === "colorStar"
        ) {
          if (!color) {
            record(skill, buff, "review", "未识别卡色");
            continue;
          }
          field =
            color +
            {
              color: "",
              colorDamage: "Damage",
              colorNp: "Np",
              colorStar: "Star",
            }[key];
        } else if (color) {
          field =
            key === "criticalDamage"
              ? color + "Critical"
              : key === "npGain"
                ? color + "Np"
                : key === "starGain"
                  ? color + "Star"
                  : null;
        }
        if (!field) {
          record(skill, buff, "review", "该数值项不支持卡色限制");
          continue;
        }
        const value = fn.svals[0].Value;
        if (!Number.isFinite(value)) {
          record(skill, buff, "review", "数值缺失");
          continue;
        }
        const unit =
          field === "flatDamage" || field === "starsPerTurn"
            ? 1
            : field === "npPerTurn"
              ? 100
              : 10;
        const normalized = value / unit;
        passives[field] = (passives[field] ?? 0) + normalized;
        record(
          skill,
          buff,
          "included",
          "直接、无限期、无条件数值",
          field,
          normalized,
        );
      }
  }
  for (const append of list(raw.appendPassive)) {
    if (append.num !== 102) continue;
    const skill = append.skill;
    for (const original of list(skill?.functions)) {
      const fn = { ...original, svals: [original.svals?.at(-1)] };
      for (const buff of list(fn.buffs)) {
        if (buff.type !== "upAtk") {
          record(
            skill,
            buff,
            "excluded",
            "非对职阶加攻；不把狂阶暴击耐性录为攻击力",
          );
          continue;
        }
        // Enemy Beast variants outside this app's selectable classes are harmlessly ignored.
        const names = traitNames(buff.ckOpIndv);
        const mapped = names.map((t) => CLASS_TRAITS[t]).filter(Boolean);
        if (!mapped.length) {
          record(skill, buff, "review", "攻击适性没有可匹配的目标职阶");
          continue;
        }
        const clean = {
          ...buff,
          script: { ...buff.script },
          ckOpIndv: list(buff.ckOpIndv).filter((t) => CLASS_TRAITS[t.name]),
          tvals: list(buff.tvals).filter((t) => CLASS_TRAITS[t.name]),
        };
        if (clean.script.INDIVIDUALITIE?.id === raw.id)
          delete clean.script.INDIVIDUALITIE;
        const reason = constantConditions(skill, fn, clean, {
          classTargets: true,
        });
        if (reason) {
          record(skill, buff, "excluded", reason);
          continue;
        }
        const value = fn.svals[0].Value / 10;
        if (!Number.isFinite(value)) {
          record(skill, buff, "review", "攻击适性数值缺失");
          continue;
        }
        for (const target of new Set(mapped))
          coinAttack[target] = (coinAttack[target] ?? 0) + value;
        record(
          skill,
          buff,
          "included",
          "硬币开关控制的满级攻击适性",
          `coinAttack.${mapped.join(",")}`,
          value,
        );
      }
    }
  }
  return { passives, classAffinity, coinAttack, passiveAudit: audit };
}
function npType(np) {
  const damage = list(np.functions).find((f) =>
    f.funcType.startsWith("damageNp"),
  );
  return !damage
    ? "support"
    : damage.funcTargetType === "enemyAll"
      ? "all"
      : "single";
}
function selectNps(raw, warnings) {
  const all = list(raw.noblePhantasms).filter((np) => COLOR[np.card]);
  const primary =
    all
      .filter((np) => np.num === 1)
      .sort((a, b) => b.priority - a.priority || b.id - a.id)[0] ?? all[0];
  if (!primary) throw new Error("没有可用宝具数据");
  const explicit = list(primary.script?.tdTypeChangeIDs)
    .map((id) => all.find((n) => n.id === id))
    .filter(Boolean);
  let candidates;
  if (explicit.length)
    candidates = [primary, ...explicit.filter((n) => n.id !== primary.id)];
  else {
    const groups = new Map();
    for (const np of all.filter((n) => n.num === 1)) {
      const key = np.card + "-" + npType(np);
      const prior = groups.get(key);
      if (!prior || np.priority > prior.priority) groups.set(key, np);
    }
    candidates = [...groups.values()].sort((a, b) => a.priority - b.priority);
  }
  if (candidates.length > 2)
    warnings.push(
      "此从者有超过两种可切换宝具，已保留全部候选数据；在设置中选择宝具2使用的形态。",
    );
  return candidates;
}
function convertNp(np, warnings) {
  const damage = list(np.functions).filter((f) =>
    f.funcType.startsWith("damageNp"),
  );
  const main = damage[0];
  if (main && !["enemy", "enemyAll"].includes(main.funcTargetType))
    warnings.push(`宝具 ${np.name} 有特殊攻击对象，请核对。`);
  if (damage.length > 2)
    warnings.push(`宝具 ${np.name} 有超过两个伤害段，请手动核对。`);
  if (main && main.funcType !== "damageNp")
    warnings.push(
      `宝具 ${np.name} 的特殊机制（${main.funcType}）不会自动触发；请按实际情况填写额外倍率、特攻或敌方数据。`,
    );
  const multiplier = main
    ? list(main.svals).map((v) => v.Value / 10)
    : [0, 0, 0, 0, 0];
  if (multiplier.length !== 5 || multiplier.some((v) => !Number.isFinite(v)))
    throw new Error("宝具倍率数据不完整");
  const npRates = list(np.npGain?.np).map((x) => x / 100);
  if (new Set(npRates).size > 1)
    warnings.push(`宝具 ${np.name} 的NP率随宝具等级变化，已分别保存。`);
  const extra = damage[1];
  return {
    id: np.id,
    name: np.name,
    color: COLOR[np.card],
    type: npType(np),
    multipliers: multiplier,
    npRate: npRates[0] ?? 0,
    npRates,
    hits: np.npDistribution,
    ocHits: extra ? np.npDistribution : [],
    ocMultipliers: extra
      ? ["svals", "svals2", "svals3", "svals4", "svals5"].map((k) =>
          list(extra[k]).map((v) => v.Value / 10),
        )
      : [],
    sourceType: main?.funcType ?? "support",
  };
}
export function normalizeServant(
  raw,
  { names = {}, importedAt = new Date().toISOString() } = {},
) {
  if (!raw || !["normal", "heroine"].includes(raw.type))
    throw new Error("不是可用从者");
  if (!Number.isSafeInteger(raw.id)) throw new Error("从者ID无效");
  const warnings = [],
    parsed = parsePassives(raw);
  let className = raw.className;
  if (className === "loreGrandCaster") className = "caster";
  if (!CLASS_NAMES[className])
    throw new Error(`尚未支持的职阶 ${className}，请先扩展职阶数据`);
  if (!list(raw.appendPassive).length)
    warnings.push(
      "数据源未提供此形态的硬币技能；对职阶攻击适性未自动录入，可在从者数据中手动补充。",
    );
  for (const [card, hits] of Object.entries(raw.hitsDistribution ?? {}))
    if (hits.reduce((a, b) => a + b, 0) !== 100)
      warnings.push(
        "卡片 " +
          card +
          " 的原始Hit权重合计不是100；保留原始分布，并按总权重缩放命中伤害。",
      );
  const npCandidates = selectNps(raw, warnings).map((np) =>
    convertNp(np, warnings),
  );
  const coinPassive = { extra: 50, criticalDamage: 30 };
  for (const [num, field, type] of [
    [100, "extra", "upCommandall"],
    [103, "criticalDamage", "upCriticaldamage"],
  ]) {
    const skill = list(raw.appendPassive).find((a) => a.num === num)?.skill;
    const fn = list(skill?.functions).find(
      (f) =>
        f.funcTargetType === "self" &&
        list(f.buffs).some((b) => b.type === type),
    );
    if (Number.isFinite(fn?.svals?.at(-1)?.Value))
      coinPassive[field] = fn.svals.at(-1).Value / 10;
  }
  const firstRaw = raw.noblePhantasms.find(
    (np) => np.id === npCandidates[0].id,
  );
  const rates = Object.fromEntries(
    ["buster", "arts", "quick", "extra"].map((c) => [
      c,
      firstRaw.npGain?.[c]?.[0] / 100,
    ]),
  );
  const name =
    (names[raw.id] ?? raw.name) +
    (raw.collectionNo === 0 ? "〔变身形态〕" : "");
  const s = {
    id: raw.id,
    collectionNo: raw.collectionNo,
    transformIds: [
      ...new Set(
        [
          ...list(raw.skills),
          ...list(raw.noblePhantasms),
          ...list(raw.classPassive),
        ]
          .flatMap((skill) => list(skill.functions))
          .filter(
            (fn) =>
              fn.funcType === "transformServant" &&
              fn.funcTargetType === "self",
          )
          .flatMap((fn) => list(fn.svals).map((v) => v.Value))
          .filter((id) => Number.isSafeInteger(id) && id !== raw.id),
      ),
    ],
    name,
    originalName: raw.name,
    className,
    attribute: raw.attribute,
    defaultLevel: Math.min(120, raw.atkGrowth?.length ?? 120),
    atkGrowth: raw.atkGrowth,
    starRate: raw.starGen / 10,
    hits: Object.fromEntries(
      Object.entries(COLOR).map(([key, color]) => [
        color,
        raw.hitsDistribution?.[key],
      ]),
    ),
    npRates: rates,
    ...parsed,
    coinPassive,
    noblePhantasms: npCandidates.slice(0, 2),
    npCandidates,
    warnings,
    source: `Atlas Academy JP · ID ${raw.id} · ${importedAt.slice(0, 10)}`,
    importedAt,
    importVersion: 2,
  };
  validateServant(s);
  return s;
}

export async function atlasJson(
  path,
  { signal, fetcher = dataFetch, attempts = 3 } = {},
) {
  if (
    !/^\/(export\/(JP|CN)\/basic_servant\.json|nice\/JP\/servant\/\d+)$/.test(
      path,
    )
  )
    throw new Error("不允许的数据地址");
  for (let attempt = 0; attempt < attempts; attempt++) {
    signal?.throwIfAborted();
    const controller = new AbortController();
    const onAbort = () => controller.abort();
    signal?.addEventListener("abort", onAbort, { once: true });
    const timer = setTimeout(() => controller.abort(), 25000);
    try {
      const response = await fetcher(ATLAS_ROOT + path, {
        signal: controller.signal,
      });
      if (!response.ok) throw new Error(`Atlas HTTP ${response.status}`);
      return await response.json();
    } catch (error) {
      if (signal?.aborted) throw new DOMException("已停止", "AbortError");
      if (attempt === attempts - 1) throw error;
      await new Promise((resolve, reject) => {
        const onStop = () => {
          clearTimeout(wait);
          reject(new DOMException("已停止", "AbortError"));
        };
        const wait = setTimeout(
          () => {
            signal?.removeEventListener("abort", onStop);
            resolve();
          },
          500 * (attempt + 1),
        );
        signal?.addEventListener("abort", onStop, { once: true });
      });
    } finally {
      clearTimeout(timer);
      signal?.removeEventListener("abort", onAbort);
    }
  }
}
export async function importMissingServants({
  existingIds,
  names = {},
  signal,
  fetcher = dataFetch,
  onProgress = () => {},
  onServant = async () => {},
  index,
  relatedIds = [],
}) {
  const report = {
    added: 0,
    skipped: 0,
    failed: [],
    review: 0,
    processed: 0,
    total: 0,
    cancelled: false,
  };
  const known = new Set([...existingIds].map(String));
  const entries =
    index ??
    (await atlasJson("/export/JP/basic_servant.json", { signal, fetcher }));
  if (!Array.isArray(entries)) throw new Error("Atlas索引格式无效");
  const queue = [];
  const seen = new Set();
  for (const entry of [
    ...entries,
    ...relatedIds.map((id) => ({ id, type: "normal", name: "变身形态" })),
  ]) {
    if (!["normal", "heroine"].includes(entry.type)) continue;
    if (seen.has(String(entry.id))) continue;
    seen.add(String(entry.id));
    if (known.has(String(entry.id))) {
      report.skipped++;
      continue;
    }
    known.add(String(entry.id));
    queue.push(entry);
  }
  report.total = queue.length;
  onProgress({ ...report });
  let cursor = 0;
  async function worker() {
    while (cursor < queue.length && !signal?.aborted) {
      const entry = queue[cursor++];
      try {
        const raw = await atlasJson(`/nice/JP/servant/${entry.id}`, {
          signal,
          fetcher,
        });
        if (raw.id !== entry.id) throw new Error("返回从者ID与请求不一致");
        const s = normalizeServant(raw, { names });
        await supplementChineseName(s, raw, { names, signal, fetcher });
        for (const id of s.transformIds) {
          if (!known.has(String(id))) {
            known.add(String(id));
            queue.push({ id, name: s.name + "的变身形态" });
            report.total = queue.length;
          }
        }
        signal?.throwIfAborted();
        await onServant(s);
        report.added++;
        if (
          s.warnings.length ||
          s.passiveAudit.some((a) => a.status === "review")
        )
          report.review++;
      } catch (error) {
        if (signal?.aborted) break;
        report.failed.push({
          id: entry.id,
          name: entry.name,
          message: error.message,
        });
      }
      report.processed++;
      onProgress({ ...report, failed: [...report.failed] });
    }
  }
  await Promise.all([worker(), worker()]);
  report.cancelled = !!signal?.aborted;
  onProgress({ ...report });
  return report;
}
