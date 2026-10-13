import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { createRequire } from "node:module";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import { sortServants } from "../src/catalog.js";
const require = createRequire(
  "C:/Users/Administrator/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/package.json",
);
const { chromium } = require("playwright");
const browser = await chromium.launch({
  headless: true,
  executablePath:
    "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
});
const context = await browser.newContext({
  viewport: { width: 390, height: 844 },
  acceptDownloads: true,
});
await context.addInitScript(() => {
  window.orientationCalls = [];
  window.Android = {
    setOrientation: (mode) => window.orientationCalls.push(mode),
  };
});
const page = await context.newPage(),
  errors = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("dialog", (d) => d.accept());
const input = (domain, path) =>
  page.locator(`[data-domain="${domain}"][data-path="${path}"]`);
const action = (n) => page.locator(`[data-action="${n}"]`);
const tab = (n) =>
  action("settings-tab").filter({ has: page.locator("nonexistent") });
const settingsTab = (n) =>
  page.locator(`[data-action="settings-tab"][data-value="${n}"]`);
const openSettings = () => page.locator("#open-settings").click();
const saved = () =>
  page.evaluate(() => JSON.parse(localStorage.getItem("fgo-solo-v1")));
const out = new URL("../docs/screenshots-v0.3/", import.meta.url);
await fs.mkdir(out, { recursive: true });
async function noOverflow(label) {
  const bad = await page.evaluate(() => ({
    width: innerWidth,
    scroll: document.documentElement.scrollWidth,
    modal: document.querySelector("#settings-dialog").open
      ? {
          client: document.querySelector("#settings-dialog").clientWidth,
          scroll: document.querySelector("#settings-dialog").scrollWidth,
        }
      : null,
  }));
  assert.ok(
    bad.scroll <= bad.width,
    `${label} page overflow ${JSON.stringify(bad)}`,
  );
  if (bad.modal)
    assert.ok(
      bad.modal.scroll <= bad.modal.client + 1,
      `${label} modal overflow ${JSON.stringify(bad)}`,
    );
}
try {
  const catalog = JSON.parse(
    await fs.readFile(
      new URL("../public/data/servants.json", import.meta.url),
      "utf8",
    ),
  );
  await page.goto("http://127.0.0.1:4173");
  await page.locator('[data-action="start-calculation"]').click();
  await page.waitForSelector(".servant-option");
  assert.equal(await input("session", "extraAttack").inputValue(), "4400");
  assert.equal(await input("session", "level").inputValue(), "120");
  assert.equal(await input("session", "npLevel").inputValue(), "5");
  const ids = await page
    .locator(".servant-option")
    .evaluateAll((els) => els.map((e) => e.dataset.value));
  assert.deepEqual(
    ids,
    sortServants(catalog).map((s) => String(s.id)),
  );
  for (const [base, form] of [
    [2501400, 2501500],
    [600700, 600710],
  ])
    assert.equal(ids.indexOf(String(form)), ids.indexOf(String(base)) + 1);
  assert.match(
    await page
      .locator(".check")
      .filter({ hasText: "从者硬币被动" })
      .innerText(),
    /30% 加攻/,
  );
  assert.deepEqual(await page.evaluate(() => window.orientationCalls), [
    "portrait",
  ]);
  await openSettings();
  await input("settings", "defaults.level").fill("100");
  await input("settings", "defaults.npLevel").selectOption("2");
  await input("settings", "defaults.extraAttack").fill("2200");
  await input("settings", "orientation").selectOption("landscape");
  assert.equal(
    (await page.evaluate(() => window.orientationCalls)).at(-1),
    "landscape",
  );
  await settingsTab("scores").click();
  assert.equal(
    await page.getByText("从者硬币被动（全局）", { exact: true }).count(),
    0,
  );
  assert.equal(await page.locator('[data-path^="coinPassive."]').count(), 0);
  await settingsTab("servants").click();
  assert.deepEqual(
    await input("editor-select", "id")
      .locator("option")
      .evaluateAll((es) => es.map((e) => e.value)),
    ids,
  );
  await input("editor-select", "id").selectOption("100100");
  await page.locator("summary").filter({ hasText: "内置被动数值" }).click();
  assert.equal(await input("editor", "coinPassive.extra").inputValue(), "50");
  assert.equal(
    await input("editor", "coinPassive.criticalDamage").inputValue(),
    "30",
  );
  assert.equal(await input("editor", "coinAttack.rider").inputValue(), "30");
  await input("editor", "coinPassive.extra").fill("20");
  await input("editor", "coinAttack.extraClasses").fill("12");
  await action("save-servant").click();
  await input("editor-select", "id").selectOption("2300900");
  await page.locator("summary").filter({ hasText: "内置被动数值" }).click();
  assert.equal(await input("editor", "coinPassive.extra").inputValue(), "50");
  await action("close-settings").click();
  await page
    .locator('[data-action="choose-servant"][data-value="100100"]')
    .click();
  assert.equal(await input("session", "level").inputValue(), "100");
  assert.equal(await input("session", "npLevel").inputValue(), "2");
  assert.equal(await input("session", "extraAttack").inputValue(), "2200");
  await input("session", "useCoinPassive").check();
  await action("next").click();
  assert.equal(await input("session", "buffs.npSpecial").count(), 0);
  await input("session", "cards.0.kind").selectOption("np");
  await action("next").click();
  await page.locator('[data-detail="enemy-debuff-0"] summary').click();
  for (const [k, v] of Object.entries({
    aDown: 50,
    defenseDown: 150,
    cDown: 30,
    npSpecial: 200,
    flatDamage: 100,
  }))
    await input("session", "enemies.0." + k).fill(String(v));
  await action("add-enemy").click();
  await page.locator('[data-detail="enemy-debuff-1"] summary').click();
  assert.equal(
    await input("session", "enemies.1.npSpecial").inputValue(),
    "100",
  );
  for (const [width, height] of [
    [320, 740],
    [390, 844],
    [844, 390],
    [1200, 800],
  ]) {
    await page.setViewportSize({ width, height });
    await noOverflow("enemy " + width);
    await page.screenshot({
      path: fileURLToPath(new URL(`enemies-${width}.png`, out)),
      fullPage: true,
    });
  }
  await action("calculate").click();
  await page.waitForSelector(".result-overview");
  for (const [width, height] of [
    [320, 740],
    [844, 390],
  ]) {
    await page.setViewportSize({ width, height });
    await noOverflow("result " + width);
  }
  await action("close-result").click();
  await action("next-turn").click();
  assert.equal((await saved()).session.enemies[0].aDown, 50);
  await page.reload();
  await page.locator('[data-action="start-calculation"]').click();
  await page.waitForSelector(".stepper");
  assert.equal((await saved()).settings.orientation, "landscape");
  await openSettings();
  await settingsTab("servants").click();
  await input("editor-select", "id").selectOption("100100");
  await action("delete-servant").click();
  assert.equal(
    await input("editor-select", "id")
      .locator('option[value="100100"]')
      .count(),
    0,
  );
  assert.ok((await saved()).settings.deletedServantIds.includes("100100"));
  assert.equal((await saved()).settings.servantOverrides["100100"], undefined);
  await action("close-settings").click();
  await page.reload();
  await page.locator('[data-action="start-calculation"]').click();
  await page.waitForSelector(".servant-option");
  assert.equal(
    await page
      .locator('[data-action="choose-servant"][data-value="100100"]')
      .count(),
    0,
  );
  const raw = JSON.parse(
    await fs.readFile(new URL("fixtures/100100.json", import.meta.url), "utf8"),
  );
  await page.route("https://api.atlasacademy.io/**", (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify(
        route.request().url().endsWith("basic_servant.json")
          ? [{ id: 100100, type: "normal" }]
          : raw,
      ),
    }),
  );
  await openSettings();
  await settingsTab("sync").click();
  await action("start-sync").click();
  await page.waitForFunction(() =>
    document
      .querySelector("#sync-progress")
      ?.textContent.includes("获取完成。"),
  );
  assert.match(await page.locator("#sync-progress").innerText(), /新增 1/);
  await action("close-settings").click();
  assert.equal(
    await page.locator('[data-value="100100"].servant-option').count(),
    1,
  );
  assert.ok(!(await saved()).settings.deletedServantIds.includes("100100"));
  await page.reload();
  await page.locator('[data-action="start-calculation"]').click();
  await page.waitForSelector(".servant-option");
  assert.equal(
    await page.locator('[data-value="100100"].servant-option').count(),
    1,
  );
  await openSettings();
  await settingsTab("servants").click();
  await action("new-servant").click();
  await input("editor", "name").fill("删除验证用从者");
  await action("save-servant").click();
  assert.ok(
    (await saved()).settings.customServants.some(
      (s) => s.name === "删除验证用从者",
    ),
  );
  await action("delete-servant").click();
  assert.ok(
    !(await saved()).settings.customServants.some(
      (s) => s.name === "删除验证用从者",
    ),
  );
  for (const [width, height] of [
    [320, 740],
    [390, 844],
    [844, 390],
  ]) {
    await page.setViewportSize({ width, height });
    await noOverflow("settings " + width);
  }
  await settingsTab("appearance").click();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: fileURLToPath(new URL("settings.png", out)),
    fullPage: true,
  });
  const downloadPromise = page.waitForEvent("download");
  await action("export-backup").click();
  const download = await downloadPromise;
  const backup = JSON.parse(await fs.readFile(await download.path(), "utf8"));
  assert.equal(backup.settings.defaults.extraAttack, 2200);
  assert.equal(backup.settings.orientation, "landscape");
  assert.equal(backup.session.enemies[0].npSpecial, 200);
  await page.locator("#backup-file").setInputFiles(await download.path());
  await page.waitForFunction(() =>
    document.querySelector("#toast").textContent.includes("备份导入完成"),
  );
  await action("close-settings").click();
  await page.locator('[data-action="step"][data-value="0"]').click();
  await page.screenshot({
    path: fileURLToPath(new URL("home.png", out)),
    fullPage: true,
  });
  // Real public Mooncell data through a native HTTP transport adapter. This
  // desktop's Chromium direct connection closes; Android uses HttpsURLConnection.
  // The test verifies JS parsing and integration, not the Android networking stack.
  await page.route("https://fgo.wiki/api.php*", async (route) => {
    const { stdout } = await promisify(execFile)(
      "curl.exe",
      [
        "--fail",
        "--silent",
        "--show-error",
        "--max-time",
        "30",
        route.request().url(),
      ],
      { maxBuffer: 4 * 1024 * 1024 },
    );
    await route.fulfill({
      contentType: "application/json",
      body: stdout,
      headers: { "Access-Control-Allow-Origin": "*" },
    });
  });
  const moon = await page.evaluate(async () => {
    const { mooncellName } = await import("/src/mooncell.js");
    return await mooncellName({ id: 100100, collectionNo: 2 });
  });
  assert.equal(moon?.name, "阿尔托莉雅·潘德拉贡");
  assert.deepEqual(errors, []);
  await fs.writeFile(
    new URL("../docs/ui-v0.3-report.json", import.meta.url),
    JSON.stringify(
      {
        passed: true,
        catalog: catalog.length,
        viewports: ["320x740", "390x844", "844x390", "1200x800"],
        mooncell: moon,
        mooncellTransport:
          "live HTTPS via curl adapter; desktop Chromium direct connection closes; Android native networking pending device test",
        errors,
      },
      null,
      2,
    ),
  );
  console.log(
    "v0.3 UI checks passed: ordering, transforms, defaults, per-servant coin, enemy debuffs, deletion, reimport, persistence, backup, orientation bridge, responsive layouts, live Mooncell",
  );
} finally {
  await browser.close();
}
