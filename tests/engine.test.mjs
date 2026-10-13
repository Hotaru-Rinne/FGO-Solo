import test from "node:test";
import assert from "node:assert/strict";
import {
  customServant,
  newSession,
  newSettings,
  newEnemy,
} from "../src/model.js";
import {
  attributeMultiplier,
  baseAttack,
  classMultiplier,
  calculateTurn,
  nextTurn,
  npPerHit,
  starsPerHit,
  splitDamage,
  mergedBuffs,
  validateSession,
} from "../src/engine.js";
function setup() {
  const servant = customServant("fixture");
  servant.name = "测试专用";
  servant.attribute = "human";
  const state = newSession(servant);
  state.extraAttack = 0;
  state.npLevel = 1;
  state.cards.forEach((c) => (c.kind = "none"));
  state.cards[0].kind = "buster";
  state.enemies[0].className = "saber";
  state.enemies[0].attribute = "human";
  state.enemies[0].hp = 1e9;
  const settings = newSettings();
  return {
    servant,
    state,
    settings,
    run() {
      return calculateTurn(state, servant, settings);
    },
  };
}
test("副属性循环、逆向、同属性与星兽", () => {
  assert.equal(attributeMultiplier("sky", "earth"), 1.1);
  assert.equal(attributeMultiplier("earth", "human"), 1.1);
  assert.equal(attributeMultiplier("human", "sky"), 1.1);
  assert.equal(attributeMultiplier("earth", "sky"), 0.9);
  assert.equal(attributeMultiplier("star", "beast"), 1.1);
  assert.equal(attributeMultiplier("beast", "star"), 1.1);
  assert.equal(attributeMultiplier("human", "human"), 1);
  assert.equal(attributeMultiplier("star", "earth"), 1);
});
test("官方职阶相性与自定义覆盖", () => {
  assert.equal(classMultiplier("saber", { className: "lancer" }), 2);
  assert.equal(classMultiplier("berserker", { className: "saber" }), 1.5);
  assert.equal(classMultiplier("saber", { className: "other" }), 1);
  assert.equal(
    classMultiplier("saber", {
      className: "lancer",
      customClass: true,
      classMultiplier: 0.7,
    }),
    0.7,
  );
});
test("ATK 成长按等级索引", () =>
  assert.equal(baseAttack({ atkGrowth: [100, 150, 250] }, 2), 150));
test("NP 单精度黄金样例：766 而非 767", () =>
  assert.equal(
    npPerHit({
      rate: 0.25,
      cardValue: 6,
      blueFirst: true,
      cardBuff: 80,
      gainBuff: 30,
      critical: true,
    }),
    766,
  ));
test("NP 第二次截断：766 ×1.5 =1149", () =>
  assert.equal(
    npPerHit({
      rate: 0.25,
      cardValue: 6,
      blueFirst: true,
      cardBuff: 80,
      gainBuff: 30,
      critical: true,
      overkill: true,
    }),
    1149,
  ));
test("NP 两次截断不能合并：234.9→234→351", () =>
  assert.equal(npPerHit({ rate: 0.5, cardValue: 4.698, overkill: true }), 351));
test("NP 第二次截断舍弃半个内部单位", () =>
  assert.equal(npPerHit({ rate: 2.35, cardValue: 1, overkill: true }), 352));
test("暴击在第一次截断之前", () =>
  assert.equal(
    npPerHit({ rate: 0.5, cardValue: 4.698, critical: true, overkill: true }),
    703,
  ));
test("红卡可借蓝首回收，蓝首不吃色放", () =>
  assert.equal(
    npPerHit({ rate: 0.5, cardValue: 0, blueFirst: true, cardBuff: 200 }),
    50,
  ));
test("Hit 最后一下承担余数", () =>
  assert.deepEqual(splitDamage(101, [33, 67]), [33, 68]));
test("伤害基础：10000 ATK 红首红卡 =4600", () => {
  const x = setup();
  assert.equal(x.run().cards[0].damage, 4600);
});
test("红首 0.5 不受红放放大", () => {
  const x = setup();
  x.state.buffs.buster = 50;
  assert.equal(x.run().cards[0].damage, 6325);
});
test("仅净降防上限100，攻击力不被限幅", () => {
  const x = setup();
  x.state.buffs.defenseDown = 300;
  assert.equal(x.run().cards[0].damage, 9200);
  x.state.enemies[0].defense = 250;
  assert.equal(x.run().cards[0].damage, 6900);
  x.state.buffs.attack = 1000;
  assert.equal(x.run().cards[0].damage, 52900);
});
test("暴击降防只作用于暴击", () => {
  const x = setup();
  x.state.buffs.criticalDefenseDown = 50;
  assert.equal(x.run().cards[0].damage, 4600);
  x.state.cards[0].critical = true;
  assert.equal(x.run().cards[0].damage, 13800);
});
test("NP宝威与普通特攻同区，宝威增幅不放大特攻", () => {
  const x = setup();
  x.state.cards[0].kind = "np";
  x.state.buffs.npDamage = 50;
  x.state.buffs.power = 100;
  x.state.buffs.npBoost = 100;
  x.state.enemies[0].npSpecial = 150;
  assert.equal(x.run().cards[0].damage, 93150);
});
test("额外宝具倍率与 OC 倍率加算", () => {
  const x = setup();
  x.state.cards[0].kind = "np";
  x.state.buffs.npExtra = 100;
  x.state.buffs.npOcExtra = 200;
  assert.equal(x.run().cards[0].damage, 27600);
});
test("宝具2的卡色、倍率、NP率独立使用", () => {
  const x = setup();
  x.servant.noblePhantasms.push({
    name: "二",
    color: "quick",
    type: "single",
    multipliers: [100, 200, 300, 400, 500],
    npRate: 1,
    hits: [100],
    ocHits: [],
  });
  x.state.buffs.npVariant = 1;
  x.state.cards[0].kind = "np";
  const r = x.run();
  assert.equal(r.cards[0].damage, 1840);
  assert.equal(r.cards[0].np, 1);
});
test("伤害专用魔放不增加NP或产星", () => {
  const x = setup();
  x.state.cards[0].kind = "quick";
  const a = x.run();
  x.state.buffs.quickDamage = 100;
  const b = x.run();
  assert.equal(b.cards[0].np, a.cards[0].np);
  assert.equal(b.cards[0].stars, a.cards[0].stars);
  assert.ok(b.cards[0].damage > a.cards[0].damage);
});
test("被动性能与单卡A参与回收", () => {
  const x = setup();
  x.state.cards[0].kind = "arts";
  x.servant.passives.arts = 20;
  x.state.cards[0].a = 30;
  assert.equal(x.run().cards[0].np, 2.75);
});
test("单卡固定ATK叠加在成长及额外ATK之上", () => {
  const x = setup();
  x.state.extraAttack = 1000;
  x.state.cards[0].attack = 2000;
  assert.equal(x.run().cards[0].damage, 5980);
});
test("101% 出星的3Hit加纹章1→随机数7", () => {
  const x = setup();
  x.state.cards[0].kind = "arts";
  x.servant.hits.arts = [33, 33, 34];
  x.servant.starRate = 101;
  x.state.cards[0].commandRandom = 1;
  assert.equal(x.run().cards[0].random, 7);
  assert.ok(Math.abs(x.run().cards[0].stars - 3.03) < 1e-9);
});
test("产星率边界与自然每Hit上限", () => {
  assert.equal(starsPerHit({ rate: 99.9, cardValue: 0 }).random, 1);
  assert.equal(starsPerHit({ rate: 101, cardValue: 0 }).random, 2);
  assert.equal(starsPerHit({ rate: 1000, cardValue: 0 }).expected, 3);
  assert.equal(starsPerHit({ rate: 1000, cardValue: 0 }).random, 3);
});
test("击杀的Hit本身获得鞭尸补正（相等边界）", () => {
  const x = setup();
  x.state.cards[0].kind = "arts";
  x.servant.hits.arts = [33, 67];
  x.state.enemies[0].hp = 2300;
  const r = x.run();
  assert.equal(r.cards[0].targets[0].overkillStart, 2);
  assert.deepEqual(
    r.cards[0].targets[0].hits.map((h) => h.overkill),
    [false, true],
  );
});
test("鞭尸bug：前卡40000，下一卡24000，敌人还活着但第三Hit触发", () => {
  const x = setup();
  x.servant.atkGrowth.fill(0);
  x.state.enemies[0].hp = 100000;
  x.state.cards[0].flatDamage = 40000;
  x.state.cards[1].kind = "arts";
  x.state.cards[1].flatDamage = 24000;
  x.servant.hits.arts = [33, 33, 34];
  const r = x.run();
  assert.equal(r.enemies[0].remainingHp, 36000);
  assert.equal(r.cards[1].targets[0].overkillStart, 3);
  assert.equal(r.cards[1].np, 7.87);
});
test("手动重置可以消除提前鞭尸", () => {
  const x = setup();
  x.servant.atkGrowth.fill(0);
  x.state.enemies[0].hp = 100000;
  x.state.cards[0].flatDamage = 60000;
  x.state.cards[1].kind = "arts";
  x.state.cards[1].flatDamage = 1000;
  assert.equal(x.run().cards[1].targets[0].overkillStart, 1);
  x.state.cards[1].resetOverkill = true;
  assert.equal(x.run().cards[1].targets[0].overkillStart, null);
});
test("宝具开始重置前卡鞭尸累计", () => {
  const x = setup();
  x.servant.atkGrowth.fill(0);
  x.state.enemies[0].hp = 100000;
  x.state.cards[0].flatDamage = 60000;
  x.state.cards[1].kind = "np";
  x.state.cards[1].flatDamage = 1000;
  assert.equal(x.run().cards[1].targets[0].overkillStart, null);
});
test("强制鞭尸且仅首次显示；手动重置可再显示", () => {
  const x = setup();
  x.state.cards[0].forceOverkill = true;
  x.state.cards[1].kind = "arts";
  x.state.cards[1].forceOverkill = true;
  assert.equal(x.run().cards[0].targets[0].overkillStart, 1);
  assert.equal(x.run().cards[1].targets[0].overkillStart, null);
  x.state.cards[1].resetOverkill = true;
  assert.equal(x.run().cards[1].targets[0].overkillStart, 1);
});
test("已死亡的目标继续被攻击", () => {
  const x = setup();
  x.state.enemies[0].hp = 0;
  x.state.cards[0].kind = "arts";
  assert.equal(x.run().cards[0].np, 3);
  assert.equal(x.run().enemies[0].remainingHp, 0);
});
test("伤害为零覆盖固伤，但仍能回收产星", () => {
  const x = setup();
  x.state.cards[0].kind = "arts";
  x.state.cards[0].zeroDamage = true;
  x.state.cards[0].flatDamage = 900;
  x.state.buffs.flatDamage = 200;
  const r = x.run();
  assert.equal(r.cards[0].damage, 0);
  assert.equal(r.cards[0].np, 2);
  assert.equal(r.cards[0].stars, 0.1);
});
test("不参与NP回收仍计固定NP", () => {
  const x = setup();
  x.state.cards[0].kind = "arts";
  x.state.cards[0].noNp = true;
  x.state.cards[0].fixedNp = 12.34;
  assert.equal(x.run().cards[0].np, 12.34);
});
test("全体攻击减半逐目标结算，固定收益整卡一次", () => {
  const x = setup();
  x.state.cards[0].kind = "arts";
  x.state.cards[0].fixedNp = 5;
  x.state.cards[0].fixedStars = 7;
  x.state.cards[0].commandRandom = 2;
  const normal = x.run().cards[0];
  const e = newEnemy(1);
  e.hp = 1e9;
  x.state.enemies.push(e);
  x.state.cards[0].allHalf = true;
  const r = x.run().cards[0];
  assert.equal(r.targets.length, 2);
  assert.equal(r.damage, normal.damage);
  assert.equal(r.np, normal.np);
  assert.ok(Math.abs(r.stars - normal.stars) < 1e-9);
  assert.equal(r.random, 4);
});
test("全体宝具对全部目标，不自动减半", () => {
  const x = setup();
  x.state.cards[0].kind = "np";
  x.servant.noblePhantasms[0].type = "all";
  const one = x.run().cards[0].damage;
  const e = newEnemy(1);
  e.hp = 1e9;
  x.state.enemies.push(e);
  assert.equal(x.run().cards[0].damage, one * 2);
});
test("死亡触发在全体卡后清空所有敌人累计", () => {
  const x = setup();
  x.servant.atkGrowth.fill(0);
  const a = x.state.enemies[0];
  a.hp = 10;
  a.resetOnDeath = true;
  const b = newEnemy(1);
  b.hp = 100000;
  x.state.enemies.push(b);
  x.state.cards[0].allHalf = true;
  x.state.cards[0].flatDamage = 120000;
  x.state.cards[1].kind = "arts";
  x.state.cards[1].target = b.id;
  x.state.cards[1].flatDamage = 1000;
  const r = x.run();
  assert.equal(r.cards[0].deathReset, true);
  assert.equal(r.cards[1].targets[0].overkillStart, null);
  a.resetOnDeath = false;
  assert.equal(x.run().cards[1].targets[0].overkillStart, 1);
});
test("友方卡只贡献固定伤害、星与Chain，不计NP和随机数", () => {
  const x = setup();
  x.state.cards[0].kind = "allyArts";
  x.state.cards[0].flatDamage = 123;
  x.state.cards[0].fixedStars = 5;
  x.state.cards[0].fixedNp = 20;
  x.state.cards[0].commandRandom = 99;
  const r = x.run();
  assert.equal(r.cards[0].damage, 123);
  assert.equal(r.cards[0].np, 0);
  assert.equal(r.cards[0].random, 0);
  assert.equal(r.cards[0].stars, 5);
});
test("Mighty Chain 同时提供蓝首和绿首", () => {
  const x = setup();
  x.state.cards[1].kind = "arts";
  x.state.cards[2].kind = "quick";
  const r = x.run();
  assert.equal(r.chain.mighty, true);
  assert.equal(r.cards[0].np, 0.5);
  assert.equal(r.cards[0].stars, 0.4);
});
test("Arts Chain 与回合/碰瓷收益只加一次", () => {
  const x = setup();
  x.state.cards.slice(0, 3).forEach((c) => (c.kind = "arts"));
  x.state.buffs.npPerTurn = -2;
  x.state.buffs.starsPerTurn = 3;
  x.state.receivedNp = 12;
  const r = x.run();
  assert.equal(r.extras.chainNp, 20);
  assert.equal(r.totals.np, 38.25);
  assert.equal(r.totals.stars, 3.3);
});
test("Quick Chain固定20星，EX可自由使用", () => {
  const x = setup();
  x.state.cards.slice(0, 3).forEach((c) => (c.kind = "quick"));
  assert.equal(x.run().extras.chainStars, 20);
  x.state.cards.forEach((c) => (c.kind = "none"));
  x.state.cards[3].kind = "extra";
  assert.equal(x.run().cards[3].damage, 4600);
});
test("普通星图满级值与冠位独立开关", () => {
  const x = setup();
  x.state.useClassScore = true;
  let b = mergedBuffs(x.state, x.servant, x.settings);
  assert.equal(b.busterDamage, 20);
  assert.equal(b.extra, 50);
  assert.equal(b.quickCritical, 60);
  assert.equal(b.npDamage, 10);
  x.settings.grandScores.saber.attack = 17;
  assert.equal(b.attack, 0);
  x.state.useGrandScore = true;
  b = mergedBuffs(x.state, x.servant, x.settings);
  assert.equal(b.attack, 17);
});
test("OC追加段增加独立Hit，NP回收对各Hit截断", () => {
  const x = setup();
  x.state.cards[0].kind = "np";
  x.servant.noblePhantasms[0].hits = [50, 50];
  x.servant.noblePhantasms[0].ocHits = [100];
  x.state.buffs.npOcExtra = 100;
  x.state.cards[0].extraOcHits = true;
  const r = x.run();
  assert.equal(r.cards[0].targets[0].hits.length, 3);
  assert.equal(r.cards[0].damage, 23000);
  assert.equal(r.cards[0].np, 4.5);
});
test("NP2缺失/OC分布缺失显示明确错误", () => {
  const x = setup();
  x.state.cards[0].kind = "np";
  x.state.buffs.npVariant = 1;
  assert.throws(() => x.run(), /宝具 2/);
  x.state.buffs.npVariant = 0;
  x.state.cards[0].extraOcHits = true;
  assert.throws(() => x.run(), /OC Hit/);
});
test("下一回合扣血但不更改原输入，保留buff与逐卡配置", () => {
  const x = setup();
  x.state.enemies[0].hp = 100;
  x.state.buffs.attack = 20;
  x.state.cards[0].commandRandom = 1;
  const r = x.run(),
    next = nextTurn(x.state, r);
  assert.equal(next.enemies[0].hp, 0);
  assert.equal(x.state.enemies[0].hp, 100);
  assert.equal(next.turn, 2);
  assert.equal(next.step, 1);
  assert.equal(next.buffs.attack, 20);
  assert.equal(next.cards[0].commandRandom, 1);
});
test("六个目标上限及无效目标校验", () => {
  const x = setup();
  x.state.cards[0].target = "missing";
  assert.match(validateSession(x.state, x.servant).join(), /目标无效/);
});

test("Melt 官方浮点样例：第三绿卡蓝首暴击，回收1243", () =>
  assert.equal(
    npPerHit({
      rate: 0.92,
      cardValue: 2,
      blueFirst: true,
      cardBuff: 188,
      critical: true,
    }),
    1243,
  ));
test("含友方卡的同色Chain不将自由EX变为同人同色加成", () => {
  const x = setup();
  x.state.cards[0].kind = "allyQuick";
  x.state.cards[1].kind = "quick";
  x.state.cards[2].kind = "quick";
  x.state.cards[3].kind = "extra";
  assert.equal(x.run().cards[3].damage, 4600);
});
test("三张友方蓝卡不会给未参与的计算从者20NP", () => {
  const x = setup();
  x.state.cards.slice(0, 3).forEach((c) => (c.kind = "allyArts"));
  assert.equal(x.run().totals.np, 0);
});
test("不同目标分别保存鞭尸累计", () => {
  const x = setup();
  x.servant.atkGrowth.fill(0);
  x.state.enemies[0].hp = 100000;
  const e = newEnemy(1);
  e.hp = 100000;
  x.state.enemies.push(e);
  x.state.cards[0].flatDamage = 60000;
  x.state.cards[1].kind = "arts";
  x.state.cards[1].target = e.id;
  x.state.cards[1].flatDamage = 1000;
  x.state.cards[2].kind = "quick";
  x.state.cards[2].flatDamage = 1000;
  const r = x.run();
  assert.equal(r.cards[1].targets[0].overkillStart, null);
  assert.equal(r.cards[2].targets[0].overkillStart, 1);
});
test("通用伤害耐性不削减NP回收，卡色耐性会削减", () => {
  const x = setup();
  x.state.cards[0].kind = "arts";
  x.state.enemies[0].resistance = 50;
  assert.equal(x.run().cards[0].np, 2);
  x.state.enemies[0].artsResistance = 50;
  assert.equal(x.run().cards[0].np, 1.25);
});
test("1000%色放不套用游戏Buff上限", () => {
  const x = setup();
  x.state.cards[0].kind = "arts";
  x.state.buffs.arts = 1000;
  assert.equal(x.run().cards[0].np, 17);
  assert.equal(x.run().cards[0].damage, 25300);
});

test("C区保留0.001的结算下限，不额外施加上限", () => {
  const x = setup();
  x.state.cards[0].c = -200;
  assert.equal(x.run().cards[0].damage, 4);
});

test("新建计算默认120级、宝具5级，硬币默认关闭", () => {
  const s = newSession(customServant());
  assert.equal(s.level, 120);
  assert.equal(s.npLevel, 5);
  assert.equal(s.useCoinPassive, false);
});
test("硬币被动按从者修改且只在启用时生效", () => {
  const x = setup();
  x.state.cards[3].kind = "extra";
  const before = x.run();
  x.state.useCoinPassive = true;
  let b = mergedBuffs(x.state, x.servant, x.settings);
  assert.equal(b.extra, 50);
  assert.equal(b.criticalDamage, 30);
  assert.ok(x.run().cards[3].damage > before.cards[3].damage);
  x.servant.coinPassive.extra = 25;
  assert.equal(mergedBuffs(x.state, x.servant, x.settings).extra, 25);
  x.servant.className = "rider";
  assert.equal(mergedBuffs(x.state, x.servant, x.settings).extra, 25);
});
test("冠位星图职阶独立，切换不串值", () => {
  const x = setup();
  x.state.useGrandScore = true;
  x.settings.grandScores.saber.attack = 12;
  x.settings.grandScores.rider.attack = 34;
  assert.equal(mergedBuffs(x.state, x.servant, x.settings).attack, 12);
  x.servant.className = "rider";
  assert.equal(mergedBuffs(x.state, x.servant, x.settings).attack, 34);
});
test("被动职阶相性50%为原倍率乘1.5，自定义优先", () => {
  assert.equal(
    classMultiplier("alterEgo", { className: "ruler" }, { ruler: 50 }),
    1.5,
  );
  assert.equal(
    classMultiplier("moonCancer", { className: "saber" }, { saber: 50 }),
    1.5,
  );
  assert.equal(
    classMultiplier("saber", { className: "lancer" }, { lancer: 50 }),
    3,
  );
  assert.equal(
    classMultiplier(
      "saber",
      { className: "lancer", customClass: true, classMultiplier: 2.7 },
      { lancer: 50 },
    ),
    2.7,
  );
});

test("非100的游戏Hit总权重缩放伤害但保留命中数", () => {
  const x = setup();
  x.servant.hits.arts = [33, 33, 51];
  x.state.cards[0].kind = "arts";
  const r = x.run();
  assert.equal(r.cards[0].damage, 2691);
  assert.equal(r.cards[0].targets[0].hits.length, 3);
  assert.equal(
    r.cards[0].targets[0].hits.reduce((n, h) => n + h.damage, 0),
    2691,
  );
});
