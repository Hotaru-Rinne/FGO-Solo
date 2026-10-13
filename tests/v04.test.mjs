import test from "node:test";
import assert from "node:assert/strict";
import {
  customServant,
  newSession,
  newSettings,
  newEnemy,
} from "../src/model.js";
import { calculateTurn } from "../src/engine.js";
import { parseNumericInput } from "../src/numeric-input.js";
import {
  parseRepository,
  compareVersions,
  checkForUpdate as checkUpdate,
  externalUrl,
} from "../src/updates.js";

const checkForUpdate = (repo, options = {}) =>
  checkUpdate(repo, { currentVersion: "0.4.0", ...options });

function setup(kind = "np", type = "single") {
  const s = customServant("fixture"),
    st = newSession(s),
    settings = newSettings();
  st.cards.forEach((c) => (c.kind = "none"));
  st.cards[0].kind = kind;
  st.enemies.push(newEnemy(1));
  st.enemies.forEach((e) => (e.hp = 5000));
  s.noblePhantasms[0].type = type;
  s.noblePhantasms[0].ocHits = [33, 67];
  st.buffs.npOcExtra = 200;
  return {
    s,
    st,
    card: st.cards[0],
    run: () => calculateTurn(st, s, settings),
  };
}
for (const type of ["single", "all", "support"])
  for (const oc of [false, true]) {
    test(`宝具 ${type} OC=${oc} 忽略残留全体攻击、暴击和纹章次数`, () => {
      const x = setup("np", type);
      x.card.extraOcHits = oc;
      x.card.fixedStars = 5;
      x.card.fixedNp = 10;
      const before = x.run();
      x.card.allHalf = true;
      x.card.critical = true;
      x.card.commandRandom = 7;
      assert.deepEqual(x.run(), before);
      assert.equal(before.cards[0].targets.length, type === "all" ? 2 : 1);
    });
  }
for (const kind of ["arts", "extra"])
  test(`${kind} 仍逐目标半伤，固定收益整卡一次`, () => {
    const x = setup(kind);
    x.st.enemies.forEach((e) => (e.hp = 1e9));
    if (kind === "extra") {
      x.card.kind = "none";
      x.card = x.st.cards[3];
      x.card.kind = "extra";
    }
    const before = x.run().cards[kind === "extra" ? 3 : 0];
    x.card.allHalf = true;
    x.card.fixedNp = 10;
    x.card.fixedStars = 5;
    const after = x.run().cards[kind === "extra" ? 3 : 0];
    assert.equal(after.targets.length, 2);
    assert.ok(Math.abs(after.targets[0].damage * 2 - before.damage) <= 2);
    assert.equal(after.fixedNp, 10);
    assert.equal(after.fixedStars, 5);
    assert.ok(after.targets[0].np <= before.np / 2);
  });
test("小数输入保留中间态，支持手机逗号与全角数值", () => {
  for (const [s, v] of [
    ["1.", 1],
    ["1.2", 1.2],
    ["1,5", 1.5],
    ["１．２", 1.2],
    [".5", 0.5],
    ["-2.5", -2.5],
    ["0", 0],
  ])
    assert.equal(parseNumericInput(s), v);
  for (const s of ["", ".", "-", "1.2.3", "1e5", "Infinity", "abc"])
    assert.equal(parseNumericInput(s), null);
});
test("敌方1.2/1.5自定义倍率真实参与伤害", () => {
  const x = setup("arts");
  x.st.enemies[0].customClass = true;
  x.st.enemies[0].classMultiplier = 1.2;
  const a = x.run().cards[0].damage;
  x.st.enemies[0].classMultiplier = 1.5;
  const b = x.run().cards[0].damage;
  assert.ok(Math.abs(b - a * 1.25) <= 2);
});
test("GitHub仓库地址与稳定版本数值比较", () => {
  assert.equal(
    parseRepository("https://github.com/owner/FGO-Solo.git/"),
    "owner/FGO-Solo",
  );
  for (const s of [
    "http://github.com/a/b",
    "https://evil.com/a/b",
    "a/b/c",
    "https://github.com/a/b?x=1",
    "https://user@github.com/a/b",
  ])
    assert.throws(() => parseRepository(s));
  assert.equal(compareVersions("v0.10.0", "0.9.9"), 1);
  assert.equal(compareVersions("v0.4.0", "0.4.0+build"), 0);
  assert.equal(compareVersions("0.3.9", "0.4.0"), -1);
  assert.throws(() => compareVersions("0.4.1-beta", "0.4.0"));
  assert.throws(() => externalUrl("javascript:alert(1)"));
  assert.throws(() => externalUrl("https://user:pass@example.com"));
});
const release = (tag = "v0.4.1") => ({
  tag_name: tag,
  body: "<script>bad()</script>",
  assets: [{ name: "app.apk", state: "uploaded" }],
  html_url: "https://evil.com",
});
const fetcher =
  (data, status = 200) =>
  async () => ({ ok: status === 200, status, json: async () => data });
test("新版、同版、旧版；发布链接从仓库构造且记录APK状态", async () => {
  for (const tag of ["v0.4.1", "v0.4.0", "v0.3.0"]) {
    const r = await checkForUpdate("owner/repo", {
      fetcher: fetcher(release(tag)),
    });
    assert.equal(r.available, tag === "v0.4.1");
    assert.equal(r.url, `https://github.com/owner/repo/releases/tag/${tag}`);
    assert.equal(r.hasApk, true);
  }
  assert.equal(
    (
      await checkForUpdate("owner/repo", {
        fetcher: fetcher({ ...release(), assets: [] }),
      })
    ).hasApk,
    false,
  );
});
test("未发布、限流、网络故障、预发布和取消均明确提示", async () => {
  for (const [status, pattern] of [
    [404, /正式 Release/],
    [403, /受限/],
    [429, /受限/],
    [500, /失败/],
  ])
    await assert.rejects(
      checkForUpdate("owner/repo", { fetcher: fetcher({}, status) }),
      pattern,
    );
  await assert.rejects(
    checkForUpdate("owner/repo", {
      fetcher: async () => {
        throw new TypeError("network");
      },
    }),
    /网络/,
  );
  await assert.rejects(
    checkForUpdate("owner/repo", {
      fetcher: fetcher({ ...release(), prerelease: true }),
    }),
    /正式版本/,
  );
  const c = new AbortController();
  const pending = checkForUpdate("owner/repo", {
    signal: c.signal,
    fetcher: (_, { signal }) =>
      new Promise((_, reject) =>
        signal.addEventListener("abort", () => reject(new Error("aborted"))),
      ),
  });
  c.abort();
  await assert.rejects(pending, /取消/);
});
