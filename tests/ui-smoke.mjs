import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
const require = createRequire(
  "C:/Users/Administrator/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/package.json",
);
const { chromium } = require("playwright");
const root = new URL("../", import.meta.url).pathname.replace(
  /^\/([A-Z]:)/,
  "$1",
);
const out = new URL("../docs/screenshots/", import.meta.url);
await fs.mkdir(out, { recursive: true });
const browser = await chromium.launch({
  headless: true,
  executablePath:
    "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
});
const context = await browser.newContext({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 1,
  acceptDownloads: true,
});
const page = await context.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("dialog", (d) => d.accept());
const action = (name) => page.locator(`[data-action="${name}"]`);
const path = (key) =>
  page.locator(`[data-domain="session"][data-path="${key}"]`);
async function noOverflow(label) {
  const dimensions = await page.evaluate(() => ({
    width: innerWidth,
    scroll: document.documentElement.scrollWidth,
  }));
  assert.ok(
    dimensions.scroll <= dimensions.width,
    `${label} horizontal overflow: ${JSON.stringify(dimensions)}`,
  );
}
try {
  await page.goto("http://127.0.0.1:4173");
  await page.locator('[data-action="start-calculation"]').click();
  await page.waitForSelector(".servant-option");
  await page
    .locator('[data-action="choose-servant"][data-value="100100"]')
    .click();
  await noOverflow("home");
  await page.screenshot({
    path: fileURLToPath(new URL("01-mobile-home.png", out)),
    fullPage: true,
  });
  await path("level").fill("120");
  await path("extraAttack").fill("2000");
  assert.match(await page.locator("#total-attack").innerText(), /[0-9]/);
  await action("next").click();
  await path("buffs.buster").fill("50");
  await path("cards.0.kind").selectOption("np");
  await page.locator('[data-detail="card-0"] summary').click();
  await path("cards.0.fixedStars").fill("5");
  await noOverflow("buffs");
  await action("next").click();
  await path("enemies.0.name").fill("训练目标 A");
  await path("enemies.0.hp").fill("20000");
  await path("enemies.0.className").selectOption("lancer");
  await action("add-enemy").click();
  await path("enemies.1.name").fill("训练目标 B");
  await path("enemies.1.hp").fill("90000");
  await path("enemies.1.className").selectOption("caster");
  await noOverflow("enemies");
  await action("calculate").click();
  await page.waitForSelector(".result-overview");
  assert.equal(await page.locator(".result-card").count(), 4);
  assert.equal(
    await page.locator(".result-card").first().locator(".target-title").count(),
    2,
  );
  await noOverflow("results");
  await page.screenshot({
    path: fileURLToPath(new URL("02-mobile-results.png", out)),
    fullPage: true,
  });
  const firstResults = await page.locator(".result-overview").innerText();
  await page.reload();
  await page.locator('[data-action="start-calculation"]').click();
  await action("next").click();
  await action("next").click();
  await action("calculate").click();
  await page.waitForSelector(".result-overview");
  assert.equal(
    await page.locator(".result-overview").innerText(),
    firstResults,
  );
  await action("close-result").click();
  await action("next-turn").click();
  assert.match(await page.locator(".tag").first().innerText(), /2/);
  assert.equal(await path("buffs.buster").inputValue(), "50");
  await page.locator("#open-settings").click();
  const svg = Buffer.from(
    '<svg xmlns="http://www.w3.org/2000/svg" width="640" height="960"><rect width="640" height="960" fill="#89bfa5"/><circle cx="320" cy="280" r="160" fill="#e8d1a2"/></svg>',
  );
  await page.locator("#background-file").setInputFiles({
    name: "test-background.svg",
    mimeType: "image/svg+xml",
    buffer: svg,
  });
  await page.waitForFunction(() =>
    document
      .querySelector("#background")
      .style.backgroundImage.startsWith("url("),
  );
  const downloadPromise = page.waitForEvent("download");
  await action("export-backup").click();
  const download = await downloadPromise;
  const backup = JSON.parse(await fs.readFile(await download.path(), "utf8"));
  assert.equal(backup.format, "fgo-solo-backup");
  assert.ok(backup.background.startsWith("data:image/jpeg"));
  await action("settings-tab")
    .filter({ hasText: /^从者数据$/ })
    .click();
  await action("new-servant").click();
  await page
    .locator('[data-domain="editor"][data-path="name"]')
    .fill("测试双宝具从者");
  await action("add-np2").click();
  await page
    .locator('[data-domain="editor"][data-path="noblePhantasms.1.color"]')
    .selectOption("quick");
  await action("save-servant").click();
  await page.waitForFunction(() =>
    document.querySelector("#toast").textContent.includes("已保存"),
  );
  await page
    .locator('[data-action="settings-tab"][data-value="scores"]')
    .click();
  await page
    .locator(
      '[data-domain="settings"][data-path="classScores.saber.busterDamage"]',
    )
    .fill("12");
  await action("close-settings").click();
  await action("step").filter({ hasText: "选择从者" }).click();
  await page.getByRole("button", { name: /测试双宝具从者/ }).click();
  assert.match(await page.locator(".identity").innerText(), /测试双宝具从者/);
  await page.locator("#open-settings").click();
  await action("settings-tab").filter({ hasText: "外观与备份" }).click();
  await page.locator("#backup-file").setInputFiles({
    name: "backup.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(backup)),
  });
  await page.waitForFunction(() =>
    document.querySelector("#toast").textContent.includes("导入完成"),
  );
  await action("close-settings").click();
  assert.match(await page.locator(".tag").first().innerText(), /2/);
  await page.reload();
  await page.locator('[data-action="start-calculation"]').click();
  await action("next").click();
  await page.waitForSelector(".command");
  assert.ok(
    await page
      .locator("#background")
      .evaluate((el) => el.style.backgroundImage.startsWith("url(")),
  );
  await action("next").click();
  for (let i = 2; i < 6; i++) await action("add-enemy").click();
  assert.equal(await page.locator(".enemy-panel").count(), 6);
  assert.equal(await action("add-enemy").count(), 0);
  await action("delete-enemy").last().click();
  assert.equal(await page.locator(".enemy-panel").count(), 5);
  await noOverflow("six enemies");
  await page.setViewportSize({ width: 320, height: 740 });
  await noOverflow("320px");
  await page.setViewportSize({ width: 1200, height: 900 });
  await action("step").filter({ hasText: "选择从者" }).click();
  await page.screenshot({
    path: fileURLToPath(new URL("03-desktop-home.png", out)),
    fullPage: true,
  });
  await noOverflow("desktop");
  assert.deepEqual(errors, []);
  console.log(
    "PASS: mobile/desktop layout, wizard, per-target results, persistence, next turn, background, backup export/import, servant editor, NP2, class scores, six enemies.",
  );
  await fs.writeFile(
    new URL("../docs/ui-test-report.json", import.meta.url),
    JSON.stringify(
      { passed: true, errors, checks: 20, date: new Date().toISOString() },
      null,
      2,
    ),
  );
} finally {
  await browser.close();
}
