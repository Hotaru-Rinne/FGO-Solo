import test from "node:test";
import assert from "node:assert/strict";
import { customServant, newSession, newSettings } from "../src/model.js";
import { validateBackup, validateServant } from "../src/validation.js";
function data() {
  const servant = customServant("fixture");
  return {
    servant,
    backup: {
      format: "fgo-solo-backup",
      version: 1,
      session: newSession(servant),
      settings: newSettings(),
      background: null,
    },
  };
}
test("完整备份可导入", () => {
  const { servant, backup } = data();
  assert.doesNotThrow(() => validateBackup(backup, [servant]));
});
test("未配置宝具2的草稿仍可恢复，不抹除用户设置", () => {
  const { servant, backup } = data();
  backup.session.buffs.npVariant = 1;
  backup.session.cards[0].kind = "np";
  assert.doesNotThrow(() => validateBackup(backup, [servant]));
});
test("非本程序备份拒绝", () =>
  assert.throws(
    () => validateBackup({ version: 2 }, []),
    /不受支持|不是受支持/,
  ));
test("无效Hit分布拒绝", () => {
  const s = customServant();
  s.hits.arts = [0, 0];
  assert.throws(() => validateServant(s), /大于 0/);
});
test("无效成长和NP率拒绝", () => {
  const s = customServant();
  s.atkGrowth[0] = -1;
  assert.throws(() => validateServant(s), /成长表/);
  s.atkGrowth[0] = 1;
  s.npRates.arts = -1;
  assert.throws(() => validateServant(s), /NP 率/);
});
test("备份的远程背景URL拒绝", () => {
  const { servant, backup } = data();
  backup.background = "https://example.com/pic.jpg";
  assert.throws(() => validateBackup(backup, [servant]), /背景图片/);
});
test("设置中非数字增益拒绝", () => {
  const { servant, backup } = data();
  backup.settings.classScores.saber.arts = "oops";
  assert.throws(() => validateBackup(backup, [servant]), /星图数值/);
});
test("重复敌人ID拒绝", () => {
  const { servant, backup } = data();
  backup.session.enemies.push(structuredClone(backup.session.enemies[0]));
  assert.throws(() => validateBackup(backup, [servant]), /ID 重复/);
});
test("原型污染字段拒绝", () => {
  const { servant, backup } = data();
  backup.settings.servantOverrides = JSON.parse('{"__proto__":{}}');
  assert.throws(() => validateBackup(backup, [servant]), /无效字段/);
});
