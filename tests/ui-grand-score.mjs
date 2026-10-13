import assert from "node:assert/strict";
import { createRequire } from "node:module";
const { chromium } = createRequire(
  "C:/Users/Administrator/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/package.json",
)("playwright");
const browser = await chromium.launch({
  headless: true,
  executablePath:
    "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
});
try {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await page.goto("http://localhost:4173");
  await page.locator('[data-action="start-calculation"]').click();
  await page.evaluate(async () => {
    const { newSettings } = await import("./src/model.js");
    const stored = JSON.parse(localStorage.getItem("fgo-solo-v1"));
    stored.settings = newSettings();
    delete stored.settings.grandScoreDefaultsVersion;
    stored.settings.grandScores = {
      saber: { artsDamage: 25, extra: 0 },
      rider: {},
    };
    localStorage.setItem("fgo-solo-v1", JSON.stringify(stored));
  });
  await page.reload();
  await page.locator('[data-action="start-calculation"]').click();
  await page.locator('[data-path="useGrandScore"]').check();
  await page.locator("#open-settings").click();
  const scores = () =>
    page.locator('[data-action="settings-tab"][data-value="scores"]');
  await scores().click();
  const grand = () =>
    page
      .locator("details")
      .filter({ has: page.locator("summary", { hasText: /^冠位职阶星图$/ }) });
  await grand().locator("summary").click();
  const input = (path) =>
    page.locator('[data-domain="settings"][data-path="' + path + '"]');
  assert.equal(
    await input("grandScores.saber.busterDamage").inputValue(),
    "50",
  );
  assert.equal(await input("grandScores.saber.artsDamage").inputValue(), "25");
  assert.equal(await input("grandScores.saber.npPerTurn").inputValue(), "10");
  assert.equal(await input("grandScores.saber.extra").inputValue(), "200");
  await input("grandScores.saber.extra").fill("0");
  await input("grandScores.saber.extra").blur();
  await page.reload();
  await page.locator('[data-action="start-calculation"]').click();
  await page.locator("#open-settings").click();
  await scores().click();
  await grand().locator("summary").click();
  assert.equal(await input("grandScores.saber.extra").inputValue(), "0");
  await page.locator('[data-action="reset-score"]').click();
  await grand().locator("summary").click();
  assert.equal(await input("grandScores.saber.extra").inputValue(), "200");
  assert.equal(await input("grandScores.saber.artsDamage").inputValue(), "50");
  await page.locator('[data-domain="score-select"]').selectOption("rider");
  await grand().locator("summary").click();
  assert.equal(await input("grandScores.rider.extra").inputValue(), "200");
  await page.locator('[data-action="close-settings"]').click();
  await page
    .locator('[data-action="choose-servant"][data-value="100100"]')
    .click();
  await page.locator('[data-path="useGrandScore"]').check();
  await page.locator('[data-action="next"]').click();
  for (let i = 0; i < 4; i++)
    await page
      .locator('[data-path="cards.' + i + '.kind"]')
      .selectOption("none");
  await page.locator('[data-action="next"]').click();
  await page.locator('[data-action="calculate"]').click();
  assert.equal(
    await page
      .locator(".result-overview .result-stats strong")
      .first()
      .innerText(),
    "10",
  );
  console.log(
    "PASS mobile layout: old settings migration, independent grand buffs, zero persistence, restore defaults, turn NP total.",
  );
} finally {
  await browser.close();
}
