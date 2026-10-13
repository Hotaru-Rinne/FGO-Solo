import { CLASS_RELATIONS } from "./relations.js";
import {
  n,
  FULL_CLASS_SCORE,
  FULL_GRAND_SCORE,
  isAreaCommand,
} from "./model.js";
const f = Math.fround;
const mul = (...values) => values.reduce((a, b) => f(a * f(b)), f(1));
const pct = (value) => f(n(value) / 100);
const bonus = (value) => f(1 + pct(value));
export const CLASS_ATTACK = {
  archer: 0.95,
  lancer: 1.05,
  caster: 0.9,
  assassin: 0.9,
  berserker: 1.1,
  ruler: 1.1,
  avenger: 1.1,
};
export const CLASS_NP = {
  caster: 1.2,
  moonCancer: 1.2,
  rider: 1.1,
  assassin: 0.9,
  berserker: 0.8,
};
export const CLASS_STARS = {
  archer: 5,
  alterEgo: 5,
  lancer: -5,
  rider: 10,
  assassin: -10,
  avenger: -10,
  pretender: -10,
  foreigner: 20,
};
const DAMAGE = {
  buster: [1.5, 1.8, 2.1],
  arts: [1, 1.2, 1.4],
  quick: [0.8, 0.96, 1.12],
  extra: [1, 1, 1, 1],
};
const NP = {
  buster: [0, 0, 0],
  arts: [3, 4.5, 6],
  quick: [1, 1.5, 2],
  extra: [1, 1, 1, 1],
};
const STARS = {
  buster: [0.1, 0.15, 0.2],
  arts: [0, 0, 0],
  quick: [0.8, 1.3, 1.8],
  extra: [1, 1, 1, 1],
};
export function attributeMultiplier(actor, target) {
  if (actor === target) return 1;
  if (
    (actor === "star" && target === "beast") ||
    (actor === "beast" && target === "star")
  )
    return 1.1;
  const cycle = { sky: "earth", earth: "human", human: "sky" };
  return cycle[actor] === target ? 1.1 : cycle[target] === actor ? 0.9 : 1;
}
export function classMultiplier(actor, enemy, affinity = {}) {
  return enemy.customClass
    ? n(enemy.classMultiplier)
    : (CLASS_RELATIONS[actor]?.[enemy.className] ?? 1) *
        (1 + n(affinity[enemy.className]) / 100);
}
export function coinAttackBonus(session, servant, settings, enemyClass) {
  if (!session.useCoinPassive) return 0;
  const standard = [
    "saber",
    "archer",
    "lancer",
    "rider",
    "caster",
    "assassin",
    "berserker",
    "other",
  ];
  return (
    n(servant.coinAttack?.[enemyClass]) +
    (standard.includes(enemyClass) ? 0 : n(servant.coinAttack?.extraClasses))
  );
}
export function baseAttack(servant, level) {
  return n(
    servant.atkGrowth[
      Math.max(
        0,
        Math.min(servant.atkGrowth.length - 1, Math.floor(n(level)) - 1),
      )
    ],
  );
}
export function mergedBuffs(session, servant, settings) {
  const result = {};
  const maps = [servant.passives, session.buffs];
  if (session.useCoinPassive)
    maps.push(servant.coinPassive ?? { extra: 50, criticalDamage: 30 });
  if (session.useClassScore)
    maps.push(settings.classScores?.[servant.className] ?? FULL_CLASS_SCORE);
  if (session.useGrandScore)
    maps.push(settings.grandScores?.[servant.className] ?? FULL_GRAND_SCORE);
  for (const map of maps)
    for (const [key, value] of Object.entries(map ?? {}))
      result[key] = n(result[key]) + n(value);
  return result;
}
export function cardColor(card, servant, session) {
  if (card.kind === "np")
    return servant.noblePhantasms[n(session.buffs.npVariant)]?.color ?? "arts";
  if (card.kind.startsWith("ally")) return card.kind.slice(4).toLowerCase();
  return card.kind;
}
export function chainInfo(session, servant) {
  const firstThree = session.cards.slice(0, 3),
    colors = firstThree.map((c) => cardColor(c, servant, session));
  const complete = firstThree.every((c) => c.kind !== "none");
  const same = complete && new Set(colors).size === 1;
  const mighty =
    complete && ["buster", "arts", "quick"].every((c) => colors.includes(c));
  const first = colors[0];
  return {
    colors,
    same,
    mighty,
    colorBrave: same && firstThree.every((c) => !c.kind.startsWith("ally")),
    hasOwnCard: firstThree.some(
      (c) => c.kind !== "none" && !c.kind.startsWith("ally"),
    ),
    buster: same && first === "buster",
    arts: same && first === "arts",
    quick: same && first === "quick",
    redFirst: first === "buster" || mighty,
    blueFirst: first === "arts" || mighty,
    greenFirst: first === "quick" || mighty,
  };
}
// NP is kept in integer 0.01% units between the two truncations and when summed.
export function npPerHit({
  rate,
  cardValue,
  blueFirst = false,
  cardBuff = 0,
  enemyModifier = 1,
  gainBuff = 0,
  critical = false,
  overkill = false,
  half = false,
}) {
  const cardTerm = f(
    (blueFirst ? 1 : 0) + mul(cardValue, Math.max(bonus(cardBuff), 0)),
  );
  const raw = mul(
    Math.round(n(rate) * 100),
    cardTerm,
    enemyModifier,
    Math.max(bonus(gainBuff), 0),
    critical ? 2 : 1,
    half ? 0.5 : 1,
  );
  return Math.max(0, Math.floor(mul(Math.floor(raw), overkill ? 1.5 : 1)));
}
export function starsPerHit({
  rate,
  cardValue,
  greenFirst = false,
  cardBuff = 0,
  enemyRate = 0,
  starBuff = 0,
  critical = false,
  overkill = false,
  half = false,
}) {
  // Decimal normalization avoids threshold drift at e.g. exactly 100%.
  const raw =
    n(rate) / 100 +
    (greenFirst ? 0.2 : 0) +
    cardValue * Math.max(1 + cardBuff / 100, 0) +
    enemyRate / 100 +
    starBuff / 100 +
    (critical ? 0.2 : 0) +
    (overkill ? 0.3 : 0);
  const chance =
    Math.round(Math.max(0, Math.min(3, raw)) * (half ? 0.5 : 1) * 1e9) / 1e9;
  return { expected: chance, random: Math.min(3, Math.floor(chance) + 1) };
}
export function splitDamage(total, distribution) {
  let used = 0;
  return distribution.map((weight, index) => {
    const damage =
      index === distribution.length - 1
        ? Math.max(0, total - used)
        : Math.floor(
            (total * n(weight)) / distribution.reduce((a, b) => a + n(b), 0),
          );
    used += damage;
    return damage;
  });
}
export function damageForCard({
  session,
  servant,
  buffs,
  card,
  enemy,
  index,
  chain,
  color,
  isNp,
  npMultiplier = 100,
  ocSegment = false,
  hitScale = 1,
}) {
  if (card.zeroDamage) return 0;
  const critical = card.critical && !isNp && card.kind !== "extra";
  const atk = Math.max(
    0,
    baseAttack(servant, session.level) +
      n(session.extraAttack) +
      n(card.attack),
  );
  const colorBuff =
    n(buffs[color]) +
    n(buffs[color + "Damage"]) +
    n(card.a) -
    n(enemy[color + "Resistance"]) +
    n(enemy.aDown);
  const cardValue = DAMAGE[color]?.[isNp ? 0 : index] ?? 1;
  const cardTerm = f(
    (!isNp && chain.redFirst ? 0.5 : 0) +
      mul(cardValue, Math.max(bonus(colorBuff), 0)),
  );
  const netDefenseDown = Math.min(
    100,
    n(buffs.defenseDown) +
      n(enemy.defenseDown) +
      (critical ? n(buffs.criticalDefenseDown) : 0) -
      n(enemy.defense),
  );
  const attackTerm = Math.max(
    bonus(n(buffs.attack) + n(card.b) + netDefenseDown),
    0,
  );
  const power =
    n(buffs.power) +
    n(enemy.cDown) +
    n(card.c) +
    (critical ? n(buffs.criticalDamage) + n(buffs[color + "Critical"]) : 0) +
    (isNp ? n(buffs.npDamage) * (1 + n(buffs.npBoost) / 100) : 0);
  const resist =
    n(enemy.resistance) +
    n(card.resistance) +
    (critical ? n(enemy.criticalResistance) : 0) +
    (isNp ? n(enemy.npResistance) : 0);
  const raw = mul(
    atk,
    isNp ? npMultiplier / 100 : 1,
    cardTerm,
    CLASS_ATTACK[servant.className] ?? 1,
    classMultiplier(servant.className, enemy, servant.classAffinity),
    attributeMultiplier(servant.attribute, enemy.attribute),
    n(card.random),
    0.23,
    attackTerm,
    critical ? 2 : 1,
    card.kind === "extra" ? (chain.colorBrave ? 3.5 : 2) : 1,
    Math.max(1 - resist / 100, 0),
    Math.max(bonus(power), 0.001),
    isNp ? n(enemy.npSpecial ?? 100) / 100 : 1,
    hitScale,
  );
  const fixed = ocSegment
    ? 0
    : n(buffs.flatDamage) +
      n(card.flatDamage) +
      n(enemy.flatDamage) -
      n(enemy.flatReduction);
  const redChain = !isNp && color === "buster" && chain.buster ? atk * 0.2 : 0;
  return Math.floor(
    Math.max(
      0,
      (raw + fixed + redChain) * (!isNp && isAreaCommand(card) ? 0.5 : 1),
    ),
  );
}
export function validateSession(session, servant) {
  const errors = [];
  if (!servant) return ["请选择从者。"];
  if (
    !Number.isInteger(n(session.level)) ||
    n(session.level) < 1 ||
    n(session.level) > servant.atkGrowth.length
  )
    errors.push(`从者等级须为 1～${servant.atkGrowth.length} 的整数。`);
  if (
    !Number.isInteger(n(session.npLevel)) ||
    n(session.npLevel) < 1 ||
    n(session.npLevel) > 5
  )
    errors.push("宝具等级须为 1～5。");
  if (!session.enemies.length || session.enemies.length > 6)
    errors.push("敌人数量须为 1～6。");
  for (const enemy of session.enemies) {
    if (!enemy.name?.trim()) errors.push("敌人名称不能为空。");
    if (n(enemy.hp) < 0) errors.push(`${enemy.name}的 HP 不能小于 0。`);
    if (enemy.customClass && n(enemy.classMultiplier) < 0)
      errors.push("职阶倍率不能小于 0。");
  }
  const variant = servant.noblePhantasms[n(session.buffs.npVariant)];
  for (const [index, card] of session.cards.entries()) {
    if (card.kind === "none") continue;
    if (!session.enemies.some((e) => e.id === card.target))
      errors.push(`指令卡 ${index + 1} 的目标无效。`);
    if (n(card.random) < 0)
      errors.push(`指令卡 ${index + 1} 的伤害随机数不能小于 0。`);
    if (
      card.kind !== "np" &&
      (n(card.commandRandom) < 0 || !Number.isInteger(n(card.commandRandom)))
    )
      errors.push("纹章随机数消耗须为非负整数。");
    if (card.kind === "np" && !variant)
      errors.push("尚未配置所选宝具，请在设置中补充宝具 2 数据。");
    if (card.kind === "np" && card.extraOcHits && !variant?.ocHits?.length)
      errors.push(
        `指令卡 ${index + 1} 开启了 OC 追加 Hit，但该宝具未配置 OC Hit 分布。`,
      );
  }
  return [...new Set(errors)];
}
export function calculateTurn(session, servant, settings) {
  const errors = validateSession(session, servant);
  if (errors.length) throw new Error(errors.join("\n"));
  const buffs = mergedBuffs(session, servant, settings),
    chain = chainInfo(session, servant);
  const runtime = new Map(
    session.enemies.map((enemy) => [
      enemy.id,
      { enemy, hp: n(enemy.hp), counter: 0, announced: false, damage: 0 },
    ]),
  );
  const reset = () => {
    for (const r of runtime.values()) {
      r.counter = 0;
      r.announced = false;
    }
  };
  const output = [];
  let totalNp = 0,
    totalStars = 0,
    totalRandom = 0;
  for (const [index, card] of session.cards.entries()) {
    const result = {
      index,
      kind: card.kind,
      color: cardColor(card, servant, session),
      targets: [],
      damage: 0,
      np: 0,
      stars: 0,
      random: 0,
      fixedNp: 0,
      fixedStars: 0,
    };
    output.push(result);
    if (card.kind === "none") continue;
    if (card.resetOverkill) reset();
    const isNp = card.kind === "np",
      isAlly = card.kind.startsWith("ally"),
      color = result.color;
    const np = servant.noblePhantasms[n(session.buffs.npVariant)];
    if (isNp) reset();
    const half = isAreaCommand(card);
    const all = half || (isNp && np.type === "all");
    const targets = all ? [...runtime.values()] : [runtime.get(card.target)];
    let deathReset = false;
    for (const state of targets) {
      const enemy = state.enemy,
        hpAtStart = state.hp;
      const targetResult = {
        id: enemy.id,
        name: enemy.name,
        damage: 0,
        np: 0,
        stars: 0,
        random: 0,
        overkillStart: null,
        hits: [],
      };
      result.targets.push(targetResult);
      if (isAlly) {
        targetResult.damage = card.zeroDamage
          ? 0
          : Math.max(0, Math.floor(n(card.flatDamage) * (half ? 0.5 : 1)));
        state.counter += targetResult.damage;
      } else if (!(isNp && np.type === "support")) {
        const critical = card.critical && !isNp && card.kind !== "extra";
        const position = isNp ? 0 : index;
        const colorBuff =
          n(buffs[color]) +
          n(card.a) -
          n(enemy[color + "Resistance"]) +
          n(enemy.aDown);
        const npRate = isNp
          ? (np.npRates?.[n(session.npLevel) - 1] ?? np.npRate)
          : servant.npRates[color];
        const gainBuff =
          n(buffs.npGain) +
          n(buffs[color + "Np"]) +
          n(card.npGain) -
          n(enemy.npDown);
        const starBuff =
          n(buffs.starGain) +
          n(buffs[color + "Star"]) +
          n(card.starGain) -
          n(enemy.starDown);
        const baseMultiplier = isNp
          ? n(np.multipliers[n(session.npLevel) - 1]) +
            n(buffs.npExtra) +
            (card.extraOcHits ? 0 : n(buffs.npOcExtra))
          : 100;
        const segments = [
          {
            hits: isNp ? np.hits : servant.hits[color],
            multiplier: baseMultiplier,
            oc: false,
          },
        ];
        if (isNp && card.extraOcHits)
          segments.push({
            hits: np.ocHits,
            multiplier: n(buffs.npOcExtra),
            oc: true,
          });
        let hitIndex = 0;
        for (const segment of segments) {
          const damage = damageForCard({
            session,
            servant,
            buffs: {
              ...buffs,
              attack:
                n(buffs.attack) +
                coinAttackBonus(session, servant, settings, enemy.className),
            },
            card,
            enemy,
            index,
            chain,
            color,
            isNp,
            npMultiplier: segment.multiplier,
            ocSegment: segment.oc,
            hitScale: (segment.hits ?? []).reduce((a, b) => a + n(b), 0) / 100,
          });
          const hitDamage = splitDamage(damage, segment.hits ?? []);
          for (const dealt of hitDamage) {
            hitIndex++;
            state.counter += dealt;
            const overkill = card.forceOverkill || state.counter >= hpAtStart;
            if (overkill && !state.announced) {
              targetResult.overkillStart = hitIndex;
              state.announced = true;
            }
            const npUnits = card.noNp
              ? 0
              : npPerHit({
                  rate: npRate,
                  cardValue: NP[color]?.[position] ?? 1,
                  blueFirst: !isNp && chain.blueFirst,
                  cardBuff: colorBuff,
                  enemyModifier:
                    (CLASS_NP[enemy.className] ?? 1) * (enemy.undead ? 1.2 : 1),
                  gainBuff,
                  critical,
                  overkill,
                  half,
                });
            const stars = starsPerHit({
              rate: servant.starRate,
              cardValue: STARS[color]?.[position] ?? 1,
              greenFirst: !isNp && chain.greenFirst,
              cardBuff: colorBuff,
              enemyRate: CLASS_STARS[enemy.className] ?? 0,
              starBuff,
              critical,
              overkill,
              half,
            });
            targetResult.damage += dealt;
            targetResult.np += npUnits;
            targetResult.stars += stars.expected;
            targetResult.random += stars.random;
            targetResult.hits.push({
              damage: dealt,
              np: npUnits / 100,
              stars: stars.expected,
              overkill,
            });
          }
        }
      }
      state.damage += targetResult.damage;
      state.hp = Math.max(0, hpAtStart - targetResult.damage);
      if (hpAtStart > 0 && state.hp === 0 && enemy.resetOnDeath)
        deathReset = true;
      result.damage += targetResult.damage;
      result.np += targetResult.np;
      result.stars += targetResult.stars;
      result.random += targetResult.random;
      targetResult.np /= 100;
    }
    // Flat gains belong to the card, never to each AOE target. Ally cards do not generate NP/RNG.
    result.fixedNp = isAlly ? 0 : Math.round(n(card.fixedNp) * 100);
    result.fixedStars = n(card.fixedStars);
    result.np += result.fixedNp;
    result.stars += result.fixedStars;
    if (!isAlly && !isNp) result.random += n(card.commandRandom);
    totalNp += result.np;
    totalStars += result.stars;
    totalRandom += result.random;
    result.np /= 100;
    result.fixedNp /= 100;
    if (deathReset) {
      reset();
      result.deathReset = true;
    }
  }
  const chainNp = chain.arts && chain.hasOwnCard ? 20 : 0,
    chainStars = chain.quick ? 20 : 0;
  const turnNp = n(buffs.npPerTurn),
    turnStars = n(buffs.starsPerTurn),
    receivedNp = n(session.receivedNp);
  return {
    cards: output,
    chain,
    totals: {
      damage: output.reduce((sum, c) => sum + c.damage, 0),
      np: (totalNp + Math.round((chainNp + turnNp + receivedNp) * 100)) / 100,
      stars: Math.round((totalStars + chainStars + turnStars) * 1e6) / 1e6,
      random: totalRandom,
    },
    extras: { chainNp, chainStars, turnNp, turnStars, receivedNp },
    enemies: [...runtime.values()].map((s) => ({
      id: s.enemy.id,
      name: s.enemy.name,
      damage: s.damage,
      startHp: n(s.enemy.hp),
      remainingHp: s.hp,
    })),
    turn: session.turn,
  };
}
export function nextTurn(session, result) {
  const next = structuredClone(session);
  next.step = 1;
  next.turn++;
  for (const enemy of next.enemies) {
    const r = result.enemies.find((e) => e.id === enemy.id);
    if (r) enemy.hp = r.remainingHp;
  }
  return next;
}
