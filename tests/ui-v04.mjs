import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { RELEASE_CONFIG } from "../src/release-config.js";
import { EXTERNAL_LINKS } from "../src/start-pages.js";
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
});
await context.addInitScript(() => {
  window.linksOpened = [];
  window.Android = {
    openExternal: (url) => window.linksOpened.push(url),
    setOrientation: () => {},
  };
});
const page = await context.newPage(),
  errors = [];
page.on("pageerror", (e) => errors.push(e.message));
const act = (n) => page.locator(`[data-action="${n}"]`);
const nav = (n) =>
  page.locator(`[data-action="navigate"][data-value="${n}"]`).click();
const field = (p) => page.locator(`[data-domain="session"][data-path="${p}"]`);
const saved = () =>
  page.evaluate(() => JSON.parse(localStorage.getItem("fgo-solo-v1")));
const home = () => page.locator("#go-home").click();
const out = new URL("../docs/screenshots-v0.4.2/", import.meta.url);
await fs.mkdir(out, { recursive: true });
async function screenshot(name) {
  assert.ok(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
    `${name} overflows`,
  );
  await page.screenshot({
    path: fileURLToPath(new URL(name + ".png", out)),
    fullPage: true,
  });
}
try {
  await page.goto("http://127.0.0.1:4173");
  await act("start-calculation").waitFor();
  assert.equal(await page.locator(".start-hero h1").innerText(), "一骑千筹");
  assert.equal(await page.getByText("每一张卡，都算清楚。").count(), 0);
  await screenshot("home-390");
  await page.setViewportSize({ width: 320, height: 700 });
  await screenshot("home-320");
  const lefts = await page
    .locator(".start-menu .menu-entry strong")
    .evaluateAll((els) => els.map((el) => el.getBoundingClientRect().left));
  assert.ok(
    Math.max(...lefts) - Math.min(...lefts) < 0.5,
    "Home menu titles must align",
  );
  await page.setViewportSize({ width: 844, height: 390 });
  await screenshot("home-landscape");
  await page.setViewportSize({ width: 390, height: 844 });
  await nav("guide");
  assert.equal(await page.locator(".guide-section").count(), 7);
  await screenshot("guide");
  await home();
  await nav("knowledge");
  await nav("random-reference");
  await page
    .getByRole("heading", { name: "0随机数的效果：", exact: true })
    .waitFor();
  assert.equal(await page.locator("article h2").count(), 4);
  const sourceText = await fs.readFile(
    new URL("../public/docs/command-code-random.txt", import.meta.url),
    "utf8",
  );
  assert.equal(
    (await page.locator("article").innerText()).replace(/\s/g, ""),
    sourceText.replace(/\s/g, ""),
  );
  await page
    .locator('[data-action="open-external"][data-value="commandCodeReference"]')
    .click();
  await screenshot("random-reference");
  await page.evaluate(() => window.handleNativeBack());
  assert.equal(await page.locator("h1").innerText(), "知识速查");
  await home();
  await nav("links");
  for (const key of ["mooncell", "atlas", "chaldea", "official"])
    await page
      .locator(`[data-action="open-external"][data-value="${key}"]`)
      .click();
  await screenshot("links");
  await home();
  await nav("author");
  assert.equal(await page.locator("h2").innerText(), "瑩鈴音");
  assert.equal(await act("project-repository").count(), 0);
  for (const key of ["author", "reference"])
    await page
      .locator(`[data-action="open-external"][data-value="${key}"]`)
      .click();
  assert.deepEqual(
    await page.evaluate(() => window.linksOpened),
    Object.values(EXTERNAL_LINKS).map((x) => x.url),
  );
  assert.equal(page.url(), "http://127.0.0.1:4173/");
  await home();
  await act("start-calculation").click();
  await field("extraAttack").fill("4567");
  await page
    .locator('footer [data-action="navigate"][data-value="home"]')
    .click();
  await act("start-calculation").waitFor();
  await act("start-calculation").click();
  assert.equal(await field("extraAttack").inputValue(), "4567");
  await page.setViewportSize({ width: 320, height: 700 });
  await screenshot("selection-320");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator("#servant-search").fill("100100");
  await page
    .locator('[data-action="choose-servant"][data-value="100100"]')
    .click();
  await act("next").click();
  await field("cards.0.kind").selectOption("arts");
  await page.locator('[data-detail="card-0"] summary').click();
  await field("cards.0.allHalf").check();
  await field("cards.0.commandRandom").fill("7");
  await field("cards.0.kind").selectOption("np");
  assert.equal(await field("cards.0.allHalf").count(), 0);
  assert.equal(await field("cards.0.commandRandom").count(), 0);
  await act("next").click();
  await field("enemies.0.customClass").check();
  const multiplier = field("enemies.0.classMultiplier");
  await multiplier.fill("");
  await multiplier.pressSequentially("1.");
  assert.equal(await multiplier.inputValue(), "1.");
  await multiplier.pressSequentially("2");
  assert.equal((await saved()).session.enemies[0].classMultiplier, 1.2);
  await multiplier.fill("15");
  await multiplier.evaluate((e) => e.setSelectionRange(1, 1));
  await act("decimal-point").click();
  assert.equal(await multiplier.inputValue(), "1.5");
  assert.equal((await saved()).session.enemies[0].classMultiplier, 1.5);
  await screenshot("decimal-input");
  await multiplier.fill("1..2");
  await act("calculate").click();
  assert.equal(await page.locator(".result-overview").count(), 0);
  await multiplier.fill("1.2");
  await act("add-enemy").click();
  assert.equal(await multiplier.inputValue(), "1.2");
  await act("calculate").click();
  await page.locator(".result-overview").waitFor();
  const report = await page.locator(".result-overview").innerText();
  await act("close-result").click();
  await act("back-enemies").click();
  await act("previous").click();
  await field("cards.0.kind").selectOption("arts");
  await page.locator('[data-detail="card-0"] summary').click();
  await field("cards.0.allHalf").uncheck();
  await field("cards.0.kind").selectOption("np");
  await act("next").click();
  await act("calculate").click();
  assert.equal(await page.locator(".result-overview").innerText(), report);
  await act("close-result").click();
  await act("next-turn").click();
  assert.equal((await saved()).session.enemies[0].classMultiplier, 1.2);
  await page.reload();
  await act("start-calculation").click();
  assert.equal((await saved()).session.enemies[0].classMultiplier, 1.2);
  await home();
  await nav("updates");
  const repo = page.locator('[data-path="updateRepository"]');
  await repo.fill("tester/fgo-solo");
  let mode = "new";
  await page.route("https://api.github.com/repos/**", async (route) => {
    if (mode === "wait") {
      await new Promise((r) => setTimeout(r, 700));
      await route.abort().catch(() => {});
      return;
    }
    if (mode === "404")
      return route.fulfill({
        status: 404,
        contentType: "application/json",
        body: "{}",
      });
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        tag_name: mode === "same" ? "v" + RELEASE_CONFIG.version : "v0.5.0",
        body: '<img src=x onerror="window.injected=true">新增功能',
        assets:
          mode === "noapk" ? [] : [{ name: "FGO-Solo.apk", state: "uploaded" }],
      }),
    });
  });
  await act("check-update").click();
  await act("open-release").waitFor();
  assert.equal(await page.locator(".release-notes img").count(), 0);
  assert.equal(await page.evaluate(() => window.injected), undefined);
  await act("open-release").click();
  assert.equal(
    (await page.evaluate(() => window.linksOpened)).at(-1),
    "https://github.com/tester/fgo-solo/releases/tag/v0.5.0",
  );
  await screenshot("update");
  mode = "same";
  await act("check-update").click();
  await page.getByRole("heading", { name: "当前已是最新版本" }).waitFor();
  await repo.fill("tester/changed");
  assert.equal(await page.locator("#update-result").count(), 0);
  await repo.fill("tester/fgo-solo");
  mode = "404";
  await act("check-update").click();
  await page.waitForFunction(() =>
    document.querySelector("#update-status").textContent.includes("仓库不存在"),
  );
  mode = "noapk";
  await act("check-update").click();
  await page
    .getByText("该发布尚未附加 APK，暂时无法从此发布下载安装。")
    .waitFor();
  mode = "wait";
  await act("check-update").click();
  await act("cancel-update").click();
  await page.waitForFunction(() =>
    document.querySelector("#update-status").textContent.includes("取消"),
  );
  await page.reload();
  await nav("updates");
  assert.equal(await repo.inputValue(), "tester/fgo-solo");
  assert.deepEqual(errors, []);
  console.log(
    "PASS v0.4 UI: home/docs/links/default-browser bridge, reference content/link, decimals, NP isolation, persistence, update cases, mobile/landscape layouts.",
  );
} finally {
  await browser.close();
}
