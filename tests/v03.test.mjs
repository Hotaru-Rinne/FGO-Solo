import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {
  customServant,
  newSession,
  newSettings,
  newEnemy,
} from "../src/model.js";
import { calculateTurn, mergedBuffs } from "../src/engine.js";
import { sortServants, migrateData } from "../src/catalog.js";
import {
  parseMooncellName,
  needsChineseName,
  supplementChineseName,
  mooncellName,
} from "../src/mooncell.js";
import {
  normalizeServant,
  importMissingServants,
} from "../src/atlas-import.js";
import { validateBackup } from "../src/validation.js";
const raw = () =>
  JSON.parse(fs.readFileSync(new URL("fixtures/100100.json", import.meta.url)));
const wiki = (id = 100100, name = "阿尔托莉雅·潘德拉贡") => ({
  query: {
    pages: {
      1: {
        title: name,
        revisions: [
          {
            slots: {
              main: {
                "*": `{{基础数值\n|序号=2\n|从者内部id=${id}\n|中文名=${name}\n|日文名=アルトリア\n}}\n{{宝具\n|中文名=不能使用这个名称\n}}`,
              },
            },
          },
        ],
      },
    },
  },
});
function setup() {
  const s = customServant("fixture"),
    st = newSession(s),
    settings = newSettings();
  st.extraAttack = 0;
  st.enemies[0].hp = 1e9;
  st.cards.forEach((c) => (c.kind = "none"));
  st.cards[0].kind = "arts";
  return { s, st, settings, run: () => calculateTurn(st, s, settings) };
}
test("默认4400，养成默认值可修改并按成长长度限制", () => {
  const s = customServant(),
    settings = newSettings();
  assert.equal(newSession(s).extraAttack, 4400);
  settings.defaults = { level: 100, npLevel: 2, extraAttack: 2200 };
  assert.deepEqual(
    (({ level, npLevel, extraAttack }) => ({ level, npLevel, extraAttack }))(
      newSession(s, settings),
    ),
    settings.defaults,
  );
  s.atkGrowth = [123, 456];
  assert.equal(newSession(s, settings).level, 2);
});
test("跨职阶按图鉴编号倒序且本体在前、变身形态紧随；缺少本体仍可选", () => {
  const list = [
    { id: 600710, collectionNo: 0 },
    { id: 100100, collectionNo: 2 },
    { id: 600705, collectionNo: 99 },
    { id: 600700, collectionNo: 81, transformIds: [600710] },
    { id: 2501500, collectionNo: 0 },
    { id: 2501400, collectionNo: 410, transformIds: [2501500] },
  ];
  assert.deepEqual(
    sortServants(list).map((s) => s.id),
    [2501400, 2501500, 600705, 600700, 600710, 100100],
  );
  assert.deepEqual(
    sortServants(list.filter((s) => s.id !== 600700))
      .slice(0, 4)
      .map((s) => s.id),
    [2501400, 2501500, 600705, 100100],
  );
  // A low internal ID with a newer collection number precedes a higher ID.
  const crossClass = [
    { id: 9900000, collectionNo: 10 },
    { id: 100100, collectionNo: 450 },
    { id: "custom-record" },
  ];
  assert.deepEqual(
    sortServants(crossClass).map((s) => s.id),
    [100100, 9900000, "custom-record"],
  );
  assert.equal(
    sortServants(list.filter((s) => s.id !== 600700)).at(-1).id,
    600710,
  );
});
test("Mooncell只使用内部ID匹配的基础中文名，拒绝错ID及模板代码", () => {
  assert.equal(parseMooncellName(wiki(), 100100).name, "阿尔托莉雅·潘德拉贡");
  assert.equal(parseMooncellName(wiki(200100), 100100), null);
  assert.equal(parseMooncellName(wiki(100100, "{{未知模板}}"), 100100), null);
  assert.equal(needsChineseName("アルトリア", "アルトリア", true), true);
  assert.equal(needsChineseName("苍崎青子", "蒼崎青子", true), false);
  assert.equal(needsChineseName("蒼崎青子", "蒼崎青子", false), true);
});
test("中文补全有匹配则替换，失败保留原名，不阻断从者获取", async () => {
  const r = raw(),
    s = normalizeServant(r);
  await supplementChineseName(s, r, {
    fetcher: async () => ({ ok: true, json: async () => wiki() }),
  });
  assert.equal(s.name, "阿尔托莉雅·潘德拉贡");
  const s2 = normalizeServant(r);
  await supplementChineseName(s2, r, {
    fetcher: async () => {
      throw Error("offline");
    },
  });
  assert.equal(s2.name, r.name);
  assert.match(s2.warnings.at(-1), /失败/);
  let calls = 0;
  await supplementChineseName(s, r, {
    names: { 100100: s.name },
    fetcher: async () => {
      calls++;
    },
  });
  assert.equal(calls, 0);
});
test("硬币三项随开关启用，修改一名从者不会影响另一名", () => {
  const x = setup();
  x.s.coinAttack = { saber: 30 };
  x.s.coinPassive = { extra: 15, criticalDamage: 11 };
  assert.equal(mergedBuffs(x.st, x.s, x.settings).extra, 0);
  const off = x.run().cards[0].damage;
  x.st.useCoinPassive = true;
  assert.equal(mergedBuffs(x.st, x.s, x.settings).extra, 15);
  assert.equal(mergedBuffs(x.st, x.s, x.settings).criticalDamage, 11);
  assert.equal(mergedBuffs(x.st, customServant(), x.settings).extra, 50);
  assert.ok(Math.abs(x.run().cards[0].damage - off * 1.3) < 2);
  x.st.useCoinPassive = false;
  assert.equal(x.run().cards[0].damage, off);
});
test("从Atlas保存满级硬币EX与暴伤为从者属性，未混入常态被动", () => {
  const s = normalizeServant(raw());
  assert.deepEqual(s.coinPassive, { extra: 50, criticalDamage: 30 });
  assert.equal(s.passives.extra, undefined);
  assert.equal(s.passives.criticalDamage, undefined);
});
test("A/C/固伤敌方填写等效于我方同类值，并支持全体攻击逐目标结算", () => {
  const a = setup(),
    b = setup();
  a.st.buffs.arts = 50;
  a.st.buffs.power = 30;
  a.st.buffs.flatDamage = 123;
  b.st.enemies[0].aDown = 50;
  b.st.enemies[0].cDown = 30;
  b.st.enemies[0].flatDamage = 123;
  assert.equal(a.run().cards[0].damage, b.run().cards[0].damage);
  assert.equal(a.run().cards[0].np, b.run().cards[0].np);
  assert.equal(a.run().cards[0].stars, b.run().cards[0].stars);
  const e = newEnemy(1);
  e.hp = 1e9;
  b.st.enemies.push(e);
  b.st.cards[0].allHalf = true;
  const r = b.run().cards[0];
  assert.equal(r.targets.length, 2);
  assert.ok(r.targets[0].damage > r.targets[1].damage);
  assert.ok(r.targets[0].np > r.targets[1].np);
});
test("我方降防+敌方降防+暴击降防-敌方加防合并封顶100", () => {
  const x = setup();
  x.st.cards[0].critical = true;
  Object.assign(x.st.buffs, { defenseDown: 40, criticalDefenseDown: 50 });
  Object.assign(x.st.enemies[0], { defenseDown: 90, defense: 30 });
  const capped = x.run().cards[0].damage;
  x.st.enemies[0].defenseDown = 40;
  assert.equal(x.run().cards[0].damage, capped);
  x.st.enemies[0].defenseDown = 0;
  assert.ok(x.run().cards[0].damage < capped);
});
test("D类为每目标宝具独立倍率，普通卡不生效，零伤害覆盖敌方固伤", () => {
  const x = setup();
  const before = x.run().cards[0].damage;
  x.st.enemies[0].npSpecial = 200;
  assert.equal(x.run().cards[0].damage, before);
  x.st.cards[0].kind = "np";
  x.s.noblePhantasms[0].type = "all";
  const e = newEnemy(1);
  e.hp = 1e9;
  x.st.enemies.push(e);
  const r = x.run().cards[0];
  assert.equal(r.targets[0].damage, r.targets[1].damage * 2);
  x.st.enemies[0].flatDamage = 999;
  x.st.cards[0].zeroDamage = true;
  assert.equal(x.run().cards[0].damage, 0);
});
test("旧备份迁移保留自定义硬币设置与全局D类，迁移重复执行不叠加", () => {
  const x = setup();
  const data = {
    format: "fgo-solo-backup",
    version: 1,
    session: x.st,
    settings: x.settings,
  };
  data.session.buffs.npSpecial = 175;
  delete data.session.enemies[0].npSpecial;
  data.settings.coinPassive = { extra: 35, criticalDamage: 20 };
  data.settings.coinClassAttack = { saber: -10, extraClasses: 7 };
  x.s.coinAttack = { saber: 30 };
  migrateData(data, [x.s]);
  migrateData(data, [x.s]);
  const s = data.settings.servantOverrides[x.s.id];
  assert.deepEqual(s.coinPassive, { extra: 35, criticalDamage: 20 });
  assert.equal(s.coinAttack.saber, 20);
  assert.equal(s.coinAttack.extraClasses, 7);
  assert.equal(data.session.enemies[0].npSpecial, 175);
  assert.equal(data.session.buffs.npSpecial, undefined);
  assert.equal(data.settings.coinPassive, undefined);
  validateBackup(data, [x.s]);
});
test("旧覆盖没有硬币值时继承原全局值，默认值与方向进入备份", () => {
  const x = setup();
  delete x.s.coinPassive;
  const data = {
    format: "fgo-solo-backup",
    version: 1,
    session: x.st,
    settings: x.settings,
  };
  data.settings.coinPassive = { extra: 35, criticalDamage: 20 };
  migrateData(data, [x.s]);
  assert.deepEqual(data.settings.servantOverrides[x.s.id].coinPassive, {
    extra: 35,
    criticalDamage: 20,
  });
  validateBackup(data, [x.s]);
  data.settings.defaults.level = 0;
  assert.throws(() => validateBackup(data, [x.s]), /默认养成/);
});
test("删除全部从者后的空库备份可以还原，不能引用已删除从者", () => {
  const x = setup();
  const data = {
    format: "fgo-solo-backup",
    version: 1,
    session: x.st,
    settings: x.settings,
  };
  data.settings.deletedServantIds = [String(x.s.id)];
  assert.throws(() => validateBackup(data, [x.s]), /不存在/);
  data.session.servantId = "";
  validateBackup(data, [x.s]);
});
test("增量获取发现新变身形态，已有本体时也可恢复单独删除的形态", async () => {
  const base = raw(),
    form = raw();
  form.id = 100101;
  form.collectionNo = 0;
  base.skills.push({
    functions: [
      {
        funcType: "transformServant",
        funcTargetType: "self",
        svals: [{ Value: form.id }],
      },
    ],
  });
  const saved = [];
  const fetcher = async (url) => ({
    ok: true,
    json: async () => (url.endsWith("/100101") ? form : base),
  });
  let report = await importMissingServants({
    existingIds: [],
    index: [{ id: base.id, type: "normal" }],
    names: { 100100: "本体", 100101: "变身" },
    fetcher,
    onServant: async (s) => saved.push(s),
  });
  assert.equal(report.added, 2);
  assert.deepEqual(saved[0].transformIds, [form.id]);
  report = await importMissingServants({
    existingIds: [base.id],
    index: [],
    relatedIds: [form.id],
    names: { 100101: "变身" },
    fetcher,
  });
  assert.equal(report.added, 1);
});

test("编号入口缺失时按内部ID查询Mooncell，不按相似名称匹配", async () => {
  const calls = [];
  const result = await mooncellName(
    { id: 100100, collectionNo: 2 },
    {
      fetcher: async (url) => {
        const p = new URL(url).searchParams;
        calls.push(p.get("action"));
        const data =
          p.get("action") === "ask"
            ? {
                query: {
                  results: {
                    x: { namespace: 0, fulltext: "阿尔托莉雅·潘德拉贡#特性" },
                  },
                },
              }
            : p.get("titles") === "从者002"
              ? { query: { pages: { "-1": { missing: "" } } } }
              : wiki();
        return { ok: true, json: async () => data };
      },
    },
  );
  assert.equal(result.name, "阿尔托莉雅·潘德拉贡");
  assert.deepEqual(calls, ["query", "ask", "query"]);
});
test("同页多个基础数值区块按内部ID选择对应变身名", () => {
  const data = wiki();
  const page = data.query.pages[1];
  page.revisions[0].slots.main["*"] +=
    "\n{{基础数值\n|从者内部id=600710\n|中文名=海德\n}}";
  assert.equal(parseMooncellName(data, 600710).name, "海德");
});
