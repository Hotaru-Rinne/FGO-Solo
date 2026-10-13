import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {
  normalizeServant,
  parsePassives,
  importMissingServants,
  atlasJson,
} from "../src/atlas-import.js";
import { coinAttackBonus, calculateTurn } from "../src/engine.js";
import { newSession, newSettings, customServant } from "../src/model.js";
const fixture = (id) =>
  JSON.parse(
    fs.readFileSync(new URL(`fixtures/${id}.json`, import.meta.url), "utf8"),
  );
test("原初之一只排除千年城魔放，保留阵地作成12蓝放", () => {
  const s = normalizeServant(fixture(2300500));
  assert.equal(s.passives.arts, 12);
  assert.equal(s.passives.buster, undefined);
  assert.equal(s.passives.quick, undefined);
  assert.equal(
    s.passiveAudit.filter(
      (a) => a.skill.includes("原初") && a.status === "excluded",
    ).length,
    3,
  );
});
test("逆光EX不展开毅力触发的技能", () => {
  const s = normalizeServant(fixture(4000100));
  assert.equal(s.passives.buster, undefined);
  assert.equal(s.passives.npPerTurn, undefined);
  assert.equal(s.passives.arts, 10);
  assert.equal(
    s.passiveAudit.find((a) => a.skill.includes("逆光")).status,
    "excluded",
  );
});
test("妖怪袭名混合效果：3星录入、水边2星排除", () => {
  const s = normalizeServant(fixture(2301200));
  assert.equal(s.passives.starsPerTurn, 3);
  const rows = s.passiveAudit.filter((a) => a.skill.includes("探偵"));
  assert.equal(rows.filter((a) => a.status === "included").length, 1);
  assert.equal(rows.filter((a) => a.status === "excluded").length, 1);
});
test("杀生院与CIEL的职阶相性覆盖映射正确", () => {
  assert.equal(normalizeServant(fixture(1000300)).classAffinity.ruler, 50);
  assert.equal(normalizeServant(fixture(2300900)).classAffinity.saber, 50);
});
test("硬币加攻与普通被动分离，提取满级30%", () => {
  const s = normalizeServant(fixture(100100));
  assert.deepEqual(s.coinAttack, { rider: 30 });
  assert.equal(s.passives.extra, undefined);
  assert.equal(s.passives.criticalDamage, undefined);
  assert.equal(s.passives.quick, 8);
});
test("硬币对职阶与EX项相加，七骑及其他排除EX", () => {
  const s = customServant();
  s.coinAttack = { ruler: 30, rider: 30 };
  const state = newSession(s),
    settings = newSettings();
  s.coinAttack.ruler = 20;
  s.coinAttack.extraClasses = 7;
  assert.equal(coinAttackBonus(state, s, settings, "ruler"), 0);
  state.useCoinPassive = true;
  assert.equal(coinAttackBonus(state, s, settings, "ruler"), 27);
  assert.equal(coinAttackBonus(state, s, settings, "rider"), 30);
  assert.equal(coinAttackBonus(state, s, settings, "other"), 0);
  assert.equal(coinAttackBonus(state, s, settings, "shielder"), 7);
  assert.equal(coinAttackBonus(state, s, settings, "unBeastOlgaMarie"), 7);
});
test("硬币职阶加攻进入B区并只作用于目标职阶", () => {
  const s = customServant();
  s.attribute = "human";
  s.coinAttack = { rider: 30 };
  const st = newSession(s),
    settings = newSettings();
  st.cards.forEach((c) => (c.kind = "none"));
  st.extraAttack = 0;
  st.cards[0].kind = "buster";
  st.enemies[0].className = "rider";
  st.enemies[0].hp = 1e7;
  st.useCoinPassive = true;
  assert.equal(calculateTurn(st, s, settings).cards[0].damage, 5980);
  st.enemies[0].className = "saber";
  assert.equal(calculateTurn(st, s, settings).cards[0].damage, 4600);
});
test("陈宫额外OC伤害段保留Hit分布及OC倍率表", () => {
  const s = normalizeServant(fixture(504400));
  assert.deepEqual(s.noblePhantasms[0].ocHits, [10, 20, 30, 40]);
  assert.equal(s.noblePhantasms[0].ocMultipliers[1][0], 225);
});
test("最新强化宝具优先并保留120级成长", () => {
  const s = normalizeServant(fixture(100100));
  assert.equal(s.noblePhantasms[0].id, 100102);
  assert.deepEqual(s.noblePhantasms[0].multipliers, [400, 500, 550, 575, 600]);
  assert.equal(s.atkGrowth.length, 120);
});
test("回合/场地/概率/次数/未知脚本条件均不当作常态录入", () => {
  for (const mutate of [
    (f) => (f.svals[0].Rate = 800),
    (f) => (f.svals[0].Turn = 3),
    (f) => (f.svals[0].Count = 1),
    (f) => (f.svals[0].OnField = 2),
    (f) => (f.buffs[0].script = { unknownCondition: 1 }),
    (f) => (f.script = { condition: 1 }),
  ]) {
    const s = fixture(100100);
    mutate(s.classPassive[1].functions[0]);
    assert.equal(parsePassives(s).passives.quick, undefined);
  }
});
test("已有ID跳过，不请求、不写入，重复索引也去重", async () => {
  const raw = fixture(100100),
    calls = [],
    saved = [];
  const report = await importMissingServants({
    existingIds: [2300500],
    names: {100100: "阿尔托莉雅·潘德拉贡"},
    index: [
      { id: 2300500, type: "normal" },
      { id: 100100, type: "normal" },
      { id: 100100, type: "normal" },
      { id: 9, type: "enemyCollectionDetail" },
    ],
    fetcher: async (url) => {
      calls.push(url);
      return { ok: true, json: async () => raw };
    },
    onServant: async (s) => saved.push(s),
  });
  assert.equal(report.added, 1);
  assert.equal(calls.length, 1);
  assert.equal(saved.length, 1);
  assert.equal(report.total, 1);
});
test("一个从者解析失败不阻断其他项，保留失败原因", async () => {
  const good = fixture(100100);
  const report = await importMissingServants({
    existingIds: [],
    index: [
      { id: 100100, type: "normal" },
      { id: 111, type: "normal" },
    ],
    fetcher: async (url) => ({
      ok: true,
      json: async () =>
        url.endsWith("/111") ? { id: 111, type: "normal" } : good,
    }),
  });
  assert.equal(report.added, 1);
  assert.equal(report.failed.length, 1);
  assert.equal(report.failed[0].id, 111);
});
test("停止获取保留此前记录，并允许按ID续传", async () => {
  const ctrl = new AbortController();
  const report = await importMissingServants({
    existingIds: [],
    index: [{ id: 100100, type: "normal" }],
    signal: ctrl.signal,
    fetcher: async () => ({ ok: true, json: async () => fixture(100100) }),
    onServant: async () => ctrl.abort(),
  });
  assert.equal(report.added, 1);
  assert.equal(report.cancelled, true);
});
test("存储失败不计为成功", async () => {
  const report = await importMissingServants({
    existingIds: [],
    index: [{ id: 100100, type: "normal" }],
    fetcher: async () => ({ ok: true, json: async () => fixture(100100) }),
    onServant: async () => {
      throw new Error("quota");
    },
  });
  assert.equal(report.added, 0);
  assert.equal(report.failed[0].message, "quota");
});
test("请求地址白名单拒绝非Atlas数据路由", async () => {
  await assert.rejects(atlasJson("/other"), /不允许/);
});
test("ID不匹配不录入", async () => {
  const report = await importMissingServants({
    existingIds: [],
    index: [{ id: 111, type: "normal" }],
    fetcher: async () => ({ ok: true, json: async () => fixture(100100) }),
  });
  assert.equal(report.added, 0);
  assert.match(report.failed[0].message, /ID/);
});
test("全量内置从者均可按默认配置计算，不产生NaN", () => {
  const all = JSON.parse(
    fs.readFileSync(
      new URL("../public/data/servants.json", import.meta.url),
      "utf8",
    ),
  );
  assert.equal(all.length, 474);
  for (const s of all) {
    const state = newSession(s);
    state.cards[0].kind = "np";
    state.useCoinPassive = true;
    const result = calculateTurn(state, s, newSettings());
    assert.ok(Number.isFinite(result.totals.damage), s.name);
    assert.ok(Number.isFinite(result.totals.np), s.name);
  }
});

test("自身在场的全队常驻效果计入自身，其他队友专有效果不计", () => {
  const raw = fixture(100100);
  const f = raw.classPassive[1].functions[0];
  f.funcTargetType = "ptFull";
  f.svals[0].OnField = 1;
  assert.equal(parsePassives(raw).passives.quick, 8);
  f.funcTargetType = "ptOtherFull";
  assert.equal(parsePassives(raw).passives.quick, undefined);
});
