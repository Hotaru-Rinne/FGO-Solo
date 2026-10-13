import {
  DEFAULT_BUILD,
  ENEMY_DEBUFF_FIELDS,
  CLASS_NAMES,
  FULL_GRAND_SCORE,
  GRAND_SCORE_DEFAULTS_VERSION,
} from "./model.js";

export function sortServants(rows) {
  const parent = new Map();
  const ids = new Set(rows.map((s) => String(s.id)));
  for (const s of rows)
    if (s.collectionNo > 0)
      for (const id of s.transformIds ?? [])
        if (ids.has(String(id)) && String(id) !== String(s.id))
          parent.set(String(id), s);
  const compare = (a, b) => {
    // Atlas's collection number spans all classes; internal IDs do not.
    // Records without a number stay selectable after numbered servants.
    const collection = (s) =>
      Number(s.collectionNo) > 0 ? Number(s.collectionNo) : 0;
    const order = collection(b) - collection(a);
    if (order) return order;
    const an = Number(a.id),
      bn = Number(b.id);
    if (Number.isFinite(an) && Number.isFinite(bn)) return bn - an;
    if (Number.isFinite(an)) return -1;
    if (Number.isFinite(bn)) return 1;
    return String(b.id).localeCompare(String(a.id), "zh-CN", { numeric: true });
  };
  return [...rows].sort((a, b) => {
    if (String(a.id) === String(b.id)) return 0;
    const rootA = parent.get(String(a.id)) ?? a;
    const rootB = parent.get(String(b.id)) ?? b;
    if (String(rootA.id) !== String(rootB.id)) return compare(rootA, rootB);
    if (a === rootA) return -1;
    if (b === rootB) return 1;
    return compare(a, b);
  });
}

// Upgrade old sessions without changing the user's current build or combat inputs.
export function migrateData(data, catalog = []) {
  const settings = data?.settings;
  if (settings) {
    // Pre-0.4.3 grand scores used empty/zero placeholders. Upgrade once;
    // preserve nonzero custom values and respect later explicit zero edits.
    if (
      (settings.grandScoreDefaultsVersion ?? 0) < GRAND_SCORE_DEFAULTS_VERSION
    ) {
      settings.grandScores ??= {};
      if (
        typeof settings.grandScores !== "object" ||
        Array.isArray(settings.grandScores)
      )
        throw new Error("冠位职阶星图格式无效。");
      for (const className of Object.keys(CLASS_NAMES)) {
        const score = (settings.grandScores[className] ??= {});
        if (typeof score !== "object" || Array.isArray(score))
          throw new Error("冠位职阶星图格式无效。");
        for (const [key, value] of Object.entries(FULL_GRAND_SCORE))
          if (score[key] === undefined || score[key] === 0) score[key] = value;
      }
      settings.grandScoreDefaultsVersion = GRAND_SCORE_DEFAULTS_VERSION;
    }
    settings.defaults = { ...DEFAULT_BUILD, ...settings.defaults };
    settings.orientation ??= "portrait";
    settings.updateRepository ??= "";
    settings.deletedServantIds ??= [];
    const oldCoin = settings.coinPassive;
    const oldAttack = settings.coinClassAttack;
    const adjusted =
      (oldCoin && (oldCoin.extra !== 50 || oldCoin.criticalDamage !== 30)) ||
      Object.values(oldAttack ?? {}).some((v) => v !== 0);
    const records = new Map(
      [
        ...catalog,
        ...(data.downloadedServants ?? []),
        ...(settings.customServants ?? []),
      ].map((s) => [String(s.id), s]),
    );
    for (const [id, original] of records) {
      const override = settings.servantOverrides?.[id];
      if (adjusted || override) {
        const s = structuredClone(override ?? original);
        s.coinPassive = override?.coinPassive ?? {
          extra: oldCoin?.extra ?? s.coinPassive?.extra ?? 50,
          criticalDamage:
            oldCoin?.criticalDamage ?? s.coinPassive?.criticalDamage ?? 30,
        };
        if (oldAttack) {
          s.coinAttack = { ...s.coinAttack };
          for (const [key, value] of Object.entries(oldAttack))
            if (value) s.coinAttack[key] = (s.coinAttack[key] ?? 0) + value;
        }
        (settings.servantOverrides ??= {})[id] = s;
      }
    }
    for (const s of [
      ...(settings.customServants ?? []),
      ...(data.downloadedServants ?? []),
    ])
      s.coinPassive ??= {
        extra: oldCoin?.extra ?? 50,
        criticalDamage: oldCoin?.criticalDamage ?? 30,
      };
    delete settings.coinPassive;
    delete settings.coinClassAttack;
  }
  if (data?.session) {
    data.session.useCoinPassive ??= false;
    for (const enemy of data.session.enemies ?? []) {
      for (const [key, , , value] of ENEMY_DEBUFF_FIELDS)
        enemy[key] ??=
          key === "npSpecial"
            ? (data.session.buffs?.npSpecial ?? 100)
            : (value ?? 0);
    }
    if (data.session.buffs) delete data.session.buffs.npSpecial;
  }
  return data;
}
