import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {
  normalizeServant,
  parsePassives,
  importMissingServants,
} from "../src/atlas-import.js";
const raw = () =>
  JSON.parse(
    fs.readFileSync(new URL("fixtures/100100.json", import.meta.url), "utf8"),
  );
const latest = (s) =>
  s.noblePhantasms
    .filter((n) => n.num === 1)
    .sort((a, b) => b.priority - a.priority || b.id - a.id)[0];

test("Unknown future servant: explicit NP change IDs retain same-color same-target variants", () => {
  const s = raw();
  s.id = 77770001;
  s.name = "Future servant";
  const primary = latest(s),
    alternate = structuredClone(primary);
  alternate.id = 777701;
  alternate.num = 2;
  alternate.npDistribution = [25, 75];
  alternate.functions
    .find((f) => f.funcType.startsWith("damageNp"))
    .svals.forEach((v) => (v.Value += 1000));
  primary.script = { ...primary.script, tdTypeChangeIDs: [alternate.id] };
  s.noblePhantasms.push(alternate);
  const parsed = normalizeServant(s);
  assert.equal(parsed.noblePhantasms.length, 2);
  assert.deepEqual(parsed.noblePhantasms[1].hits, [25, 75]);
  assert.equal(
    parsed.noblePhantasms[1].multipliers[0],
    parsed.noblePhantasms[0].multipliers[0] + 100,
  );
});

test("NP fallback distinguishes colors but cannot infer unlinked same-color same-type alternatives", () => {
  const s = raw(),
    primary = latest(s),
    alternate = structuredClone(primary);
  alternate.id = 777702;
  alternate.card = 1;
  alternate.priority = primary.priority + 1;
  s.noblePhantasms.push(alternate);
  assert.equal(normalizeServant(s).noblePhantasms.length, 2);
  alternate.card = primary.card;
  assert.equal(normalizeServant(s).noblePhantasms.length, 1);
});

test("Future mixed passive: unconditional part retained, field-dependent part excluded", () => {
  const s = raw(),
    skill = structuredClone(s.classPassive[1]);
  skill.id = 77770002;
  skill.name = "Future mixed passive";
  const condition = structuredClone(skill.functions[0]);
  condition.buffs[0].script = { fieldRequired: 12345 };
  condition.svals[0].Value = 300;
  skill.functions.push(condition);
  s.classPassive = [skill];
  s.appendPassive = [];
  const parsed = parsePassives(s);
  assert.equal(parsed.passives.quick, 8);
  assert.equal(
    parsed.passiveAudit.filter((a) => a.status === "included").length,
    1,
  );
  assert.equal(
    parsed.passiveAudit.filter((a) => a.status === "excluded").length,
    1,
  );
  skill.script = { unknownCondition: 1 };
  assert.equal(parsePassives(s).passives.quick, undefined);
});

test("Future transform target is fetched even when absent from the servant index", async () => {
  const base = raw(),
    form = raw();
  base.id = 77770003;
  form.id = 77770004;
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
  const report = await importMissingServants({
    existingIds: [],
    names: { [base.id]: "base", [form.id]: "form" },
    index: [{ id: base.id, type: "normal" }],
    fetcher: async (url) => ({
      ok: true,
      json: async () => (url.endsWith("/" + form.id) ? form : base),
    }),
    onServant: async (s) => saved.push(s),
  });
  assert.equal(report.added, 2);
  assert.deepEqual(report.failed, []);
  assert.deepEqual(saved.find((s) => s.id === base.id).transformIds, [form.id]);
  assert.ok(saved.some((s) => s.id === form.id));
});
