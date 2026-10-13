import test from "node:test";
import assert from "node:assert/strict";
import {
  CLASS_NAMES,
  FULL_GRAND_SCORE,
  newSettings,
  customServant,
  newSession,
} from "../src/model.js";
import { migrateData } from "../src/catalog.js";
import { calculateTurn, mergedBuffs } from "../src/engine.js";
const expected = {
  busterDamage: 50,
  artsDamage: 50,
  quickDamage: 50,
  npPerTurn: 10,
  extra: 200,
};
test("every selectable class receives independent grand defaults", () => {
  const settings = newSettings();
  assert.deepEqual(FULL_GRAND_SCORE, expected);
  for (const cls of Object.keys(CLASS_NAMES))
    assert.deepEqual(settings.grandScores[cls], expected);
  settings.grandScores.saber.extra = 0;
  assert.equal(settings.grandScores.rider.extra, 200);
  assert.equal(newSettings().grandScores.saber.extra, 200);
});
test("legacy placeholders upgrade once without erasing custom buffs or other inputs", () => {
  const data = {
    settings: {
      grandScores: { saber: { busterDamage: 0, artsDamage: 25, attack: 12 } },
    },
  };
  migrateData(data);
  assert.deepEqual(data.settings.grandScores.saber, {
    ...expected,
    artsDamage: 25,
    attack: 12,
  });
  for (const cls of Object.keys(CLASS_NAMES).filter((c) => c !== "saber"))
    assert.deepEqual(data.settings.grandScores[cls], expected);
  const once = structuredClone(data);
  migrateData(data);
  assert.deepEqual(data, once);
  data.settings.grandScores.saber.extra = 0;
  migrateData(data);
  assert.equal(data.settings.grandScores.saber.extra, 0);
});
test("new settings and imported current backups retain intentionally disabled grand fields", () => {
  const data = { settings: newSettings() };
  data.settings.grandScores.saber = Object.fromEntries(
    Object.keys(expected).map((k) => [k, 0]),
  );
  const before = structuredClone(data);
  migrateData(data);
  assert.deepEqual(data, before);
});
test("grand defaults are gated and class-specific; missing class falls back to defaults", () => {
  const s = customServant(),
    session = newSession(s),
    settings = newSettings();
  assert.equal(mergedBuffs(session, s, settings).extra, 0);
  session.useGrandScore = true;
  for (const [key, value] of Object.entries(expected))
    assert.equal(mergedBuffs(session, s, settings)[key], value);
  settings.grandScores.saber.npPerTurn = 7;
  assert.equal(mergedBuffs(session, s, settings).npPerTurn, 7);
  s.className = "rider";
  assert.equal(mergedBuffs(session, s, settings).npPerTurn, 10);
  delete settings.grandScores.rider;
  assert.equal(mergedBuffs(session, s, settings).extra, 200);
});
test("damage-only RGB buffs leave hit NP and stars unchanged; turn NP added once", () => {
  for (const kind of ["buster", "arts", "quick", "np"]) {
    const s = customServant(),
      session = newSession(s),
      settings = newSettings();
    session.enemies[0].hp = 1e9;
    session.cards.forEach((c) => (c.kind = "none"));
    session.cards[0].kind = kind;
    const off = calculateTurn(session, s, settings);
    session.useGrandScore = true;
    const on = calculateTurn(session, s, settings);
    assert.ok(on.cards[0].damage > off.cards[0].damage, kind);
    assert.equal(on.cards[0].np, off.cards[0].np, kind);
    assert.equal(on.cards[0].stars, off.cards[0].stars, kind);
    assert.equal(on.extras.turnNp, 10);
    assert.ok(Math.abs(on.totals.np - off.totals.np - 10) < 1e-9);
  }
});
test("EX performance increases EX damage, hit NP and stars", () => {
  const s = customServant(),
    session = newSession(s),
    settings = newSettings();
  session.enemies[0].hp = 1e9;
  session.cards.forEach((c) => (c.kind = "none"));
  session.cards[3].kind = "extra";
  const off = calculateTurn(session, s, settings);
  session.useGrandScore = true;
  const on = calculateTurn(session, s, settings);
  for (const key of ["damage", "np", "stars"])
    assert.ok(on.cards[3][key] > off.cards[3][key], key);
});
