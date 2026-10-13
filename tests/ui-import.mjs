import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
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
const page = await context.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("dialog", (d) => d.accept());
const action = (n) => page.locator(`[data-action="${n}"]`),
  tab = (n) => page.locator(`[data-action="settings-tab"][data-value="${n}"]`),
  input = (domain, path) =>
    page.locator(`[data-domain="${domain}"][data-path="${path}"]`);
try {
  await page.goto("http://127.0.0.1:4173");
  await page.locator('[data-action="start-calculation"]').click();
  await page.waitForSelector(".servant-option");
  assert.equal(await input("session", "level").inputValue(), "120");
  assert.equal(await input("session", "npLevel").inputValue(), "5");
  assert.equal(await page.locator(".servant-option").count(), 474);
  await input("session", "useCoinPassive").check();
  await page.locator("#open-settings").click();
  await tab("scores").click();
  await page
    .locator("summary")
    .filter({ hasText: /^冠位职阶星图$/ })
    .click();
  await input("settings", "grandScores.saber.attack").fill("12");
  await input("score-select", "className").selectOption("rider");
  await page
    .locator("summary")
    .filter({ hasText: /^冠位职阶星图$/ })
    .click();
  assert.equal(
    await input("settings", "grandScores.rider.attack").inputValue(),
    "0",
  );
  await input("settings", "grandScores.rider.attack").fill("34");
  await input("score-select", "className").selectOption("saber");
  await page
    .locator("summary")
    .filter({ hasText: /^冠位职阶星图$/ })
    .click();
  assert.equal(
    await input("settings", "grandScores.saber.attack").inputValue(),
    "12",
  );
  await tab("servants").click();
  await input("editor-select", "id").selectOption("1000300");
  await page.locator("summary").filter({ hasText: "内置被动数值" }).click();
  assert.equal(await input("editor", "classAffinity.ruler").inputValue(), "50");
  assert.equal(await input("editor", "coinAttack.ruler").inputValue(), "30");
  await input("editor", "coinPassive.extra").fill("40");
  await input("editor", "coinAttack.extraClasses").fill("17");
  await input("editor", "coinAttack.ruler").fill("20");
  await action("save-servant").click();
  await input("editor-select", "id").selectOption("2300900");
  await page.locator("summary").filter({ hasText: "内置被动数值" }).click();
  assert.equal(await input("editor", "classAffinity.saber").inputValue(), "50");
  await input("editor-select", "id").selectOption("1100900");
  await input("np-candidate-1", "id").selectOption("1100998");
  assert.equal(
    await input("editor", "noblePhantasms.1.color").inputValue(),
    "quick",
  );
  await action("save-servant").click();
  await tab("sync").click();
  const fixture = JSON.parse(
    await fs.readFile(new URL("fixtures/100100.json", import.meta.url), "utf8"),
  );
  fixture.id = 77777701;
  fixture.name = "导入自动测试（不随应用发布）";
  await page.route("https://fgo.wiki/api.php*", (route) =>
    route.fulfill({ json: { query: { pages: {}, results: {} } } }),
  );
  let requests = 0;
  await page.route("https://api.atlasacademy.io/**", async (route) => {
    const url = route.request().url();
    if (url.includes("basic_servant"))
      await route.fulfill({
        json: [
          { id: 100100, type: "normal" },
          { id: 77777701, type: "normal" },
        ],
        headers: { "Access-Control-Allow-Origin": "*" },
      });
    else {
      requests++;
      await route.fulfill({
        json: fixture,
        headers: { "Access-Control-Allow-Origin": "*" },
      });
    }
  });
  await action("start-sync").click();
  await page.waitForFunction(() =>
    document.querySelector("#sync-progress")?.textContent.includes("获取完成"),
  );
  assert.match(await page.locator("#sync-progress").innerText(), /新增 1/);
  assert.equal(requests, 1);
  await action("start-sync").click();
  await page.waitForFunction(() =>
    document.querySelector("#sync-progress")?.textContent.includes("获取完成"),
  );
  assert.match(await page.locator("#sync-progress").innerText(), /新增 0/);
  assert.equal(requests, 1);
  await tab("appearance").click();
  const downloadP = page.waitForEvent("download");
  await action("export-backup").click();
  const download = await downloadP;
  const backup = JSON.parse(await fs.readFile(await download.path(), "utf8"));
  assert.equal(backup.downloadedServants.length, 1);
  assert.equal(
    backup.settings.servantOverrides["1000300"].coinAttack.extraClasses,
    17,
  );
  await action("close-settings").click();
  await page.reload();
  await page.locator('[data-action="start-calculation"]').click();
  await page.waitForSelector(".servant-option");
  assert.equal(await page.locator(".servant-option").count(), 475);
  await page.locator("#servant-search").fill("77777701");
  await page.locator(".servant-option").click();
  assert.equal(await input("session", "level").inputValue(), "120");
  assert.equal(await input("session", "npLevel").inputValue(), "5");
  await page.reload();
  await page.locator('[data-action="start-calculation"]').click();
  await page.waitForSelector(".identity");
  assert.match(await page.locator(".identity").innerText(), /导入自动测试/);
  await page.locator("#open-settings").click();
  await tab("appearance").click();
  await page.locator("#backup-file").setInputFiles({
    name: "roundtrip.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(backup)),
  });
  await page.waitForFunction(() =>
    document.querySelector("#toast").textContent.includes("导入完成"),
  );
  await tab("sync").click();
  await page.unroute("https://api.atlasacademy.io/**");
  await action("start-sync").click();
  await page.waitForFunction(
    () =>
      document
        .querySelector("#sync-progress")
        ?.textContent.includes("获取完成"),
    {},
    { timeout: 45000 },
  );
  const liveReport = await page.locator("#sync-progress").innerText();
  const liveDetail = await page.evaluate(async () => {
    const { atlasJson, normalizeServant } = await import(
      "/src/atlas-import.js"
    );
    const raw = await atlasJson("/nice/JP/servant/2301200");
    return normalizeServant(raw).passives.starsPerTurn;
  });
  assert.equal(liveDetail, 3);
  assert.match(liveReport, /新增 0/);
  await fs.mkdir(new URL("../docs/screenshots-v0.2/", import.meta.url), {
    recursive: true,
  });
  await page.screenshot({
    path: fileURLToPath(
      new URL("../docs/screenshots-v0.2/sync.png", import.meta.url),
    ),
  });
  await action("close-settings").click();
  await page.locator("#servant-search").fill("阿尔托莉雅");
  await page
    .locator('[data-action="choose-servant"][data-value="100100"]')
    .click();
  await page.screenshot({
    path: fileURLToPath(
      new URL("../docs/screenshots-v0.2/home.png", import.meta.url),
    ),
    fullPage: true,
  });
  assert.deepEqual(errors, []);
  console.log(
    "PASS V0.2 UI: defaults, coin, separate grand scores, affinity, NP candidate, import/skip/reload/backup, live Atlas index. " +
      liveReport,
  );
  await fs.writeFile(
    new URL("../docs/ui-v0.2-report.json", import.meta.url),
    JSON.stringify(
      { passed: true, errors, liveReport, date: new Date().toISOString() },
      null,
      2,
    ),
  );
} finally {
  await browser.close();
}
