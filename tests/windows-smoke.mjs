import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
const { _electron: electron } = createRequire(
  "C:/Users/Administrator/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/package.json",
)("playwright");
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const profile = path.join(root, ".cache", "windows-smoke-" + Date.now());
const exe =
  process.env.FGO_TEST_EXE ||
  path.resolve(root, "../开发安装/环境/electron-44.7.0/runtime/electron.exe");
const args = process.env.FGO_TEST_EXE ? [] : [root];
const launch = () =>
  electron.launch({
    executablePath: exe,
    args: [...args, "--user-data-dir=" + profile],
    env: { ...process.env, ELECTRON_RUN_AS_NODE: undefined },
    timeout: 30000,
  });
const out = path.join(root, "docs/screenshots-windows");
await fs.mkdir(out, { recursive: true });
let app = await launch();
const errors = [];
try {
  let page = await app.firstWindow();
  page.on("pageerror", (e) => errors.push(e.message));
  await page.locator('[data-action="start-calculation"]').waitFor();
  assert.equal(await page.title(), "一骑千筹 · FGO 单挑计算器");
  assert.equal(await page.evaluate(() => window.Desktop.platform), "windows");
  assert.equal(await page.evaluate(() => typeof require), "undefined");
  await page.screenshot({ path: path.join(out, "01-home.png") });
  const act = (n) => page.locator('[data-action="' + n + '"]');
  const field = (p) =>
    page.locator('[data-domain="session"][data-path="' + p + '"]');
  await act("start-calculation").click();
  await field("extraAttack").fill("4321");
  await page
    .locator('[data-action="choose-servant"][data-value="100100"]')
    .click();
  await field("extraAttack").fill("4321");
  await field("useGrandScore").check();
  await act("next").click();
  await field("cards.0.kind").selectOption("np");
  await act("next").click();
  await field("enemies.0.customClass").check();
  await field("enemies.0.classMultiplier").fill("1.2");
  await act("add-enemy").click();
  await act("calculate").click();
  await page.locator(".result-overview").waitFor();
  assert.equal(await page.locator(".result-card").count(), 4);
  assert.equal(
    await page.locator(".result-card").first().locator(".target-title").count(),
    2,
  );
  await page.screenshot({
    path: path.join(out, "02-results.png"),
    fullPage: true,
  });
  await act("close-result").click();
  await act("next-turn").click();
  await page.locator("#open-settings").click();
  assert.equal(await page.locator('[data-path="orientation"]').count(), 0);
  await page.getByRole("heading", { name: "桌面窗口" }).waitFor();
  const svg = Buffer.from(
    '<svg xmlns="http://www.w3.org/2000/svg" width="600" height="900"><rect width="600" height="900" fill="#8aa99b"/></svg>',
  );
  await page.locator("#background-file").setInputFiles({
    name: "test.svg",
    mimeType: "image/svg+xml",
    buffer: svg,
  });
  await page.waitForFunction(() =>
    document
      .querySelector("#background")
      .style.backgroundImage.startsWith("url("),
  );
  const backupPath = path.join(profile, "roundtrip.json");
  await app.evaluate(({ dialog }, backupPath) => {
    dialog.showSaveDialog = async () => ({
      canceled: false,
      filePath: backupPath,
    });
  }, backupPath);
  await act("export-backup").click();
  await page.waitForFunction(
    () => document.querySelector("#toast").textContent === "备份已保存。",
  );
  const backup = JSON.parse(await fs.readFile(backupPath, "utf8"));
  assert.equal(backup.format, "fgo-solo-backup");
  assert.equal(backup.session.extraAttack, 4321);
  assert.equal(backup.session.useGrandScore, true);
  for (const score of Object.values(backup.settings.grandScores)) {
    assert.equal(score.busterDamage, 50);
    assert.equal(score.artsDamage, 50);
    assert.equal(score.quickDamage, 50);
    assert.equal(score.npPerTurn, 10);
    assert.equal(score.extra, 200);
  }
  assert.ok(backup.background.startsWith("data:image/jpeg"));
  await act("close-settings").click();
  await page.locator("#go-home").click();
  await app.evaluate(({ shell }) => {
    globalThis.opened = [];
    shell.openExternal = async (url) => {
      globalThis.opened.push(url);
    };
  });
  await page
    .locator('[data-action="navigate"][data-value="knowledge"]')
    .click();
  await page
    .locator('[data-action="navigate"][data-value="random-reference"]')
    .click();
  await page
    .getByRole("heading", { name: "0随机数的效果：", exact: true })
    .waitFor();
  await page
    .locator('[data-action="open-external"][data-value="commandCodeReference"]')
    .click();
  assert.match(
    (await app.evaluate(() => globalThis.opened))[0],
    /1112832155317174297/,
  );
  assert.equal(page.url(), "fgosolo://app/index.html");
  await page.locator("#go-home").click();
  await page.locator('[data-action="navigate"][data-value="updates"]').click();
  assert.ok(
    (await page.locator("#app").innerText()).includes("Windows") ||
      (await page.locator("#app").innerText()).includes("正式版本"),
  );
  await assert.rejects(
    page.evaluate(() =>
      window.Desktop.openExternal("file:///C:/Windows/win.ini"),
    ),
  );
  await assert.rejects(
    page.evaluate(() =>
      window.Desktop.requestJson("blocked-test", "https://example.com/private"),
    ),
  );
  // Native network bridge: actual HTTPS request and response, no browser CORS bypass.
  const live = await page.evaluate(async () => {
    const r = await window.Desktop.requestJson(
      "atlas-live",
      "https://api.atlasacademy.io/nice/JP/servant/100100",
    );
    return { status: r.status, id: JSON.parse(r.body).id };
  });
  assert.deepEqual(live, { status: 200, id: 100100 });
  const wiki = await page.evaluate(async () => {
    const { mooncellName } = await import("./src/mooncell.js");
    return mooncellName({ id: 100100, collectionNo: 2 });
  });
  assert.equal(wiki.name, "阿尔托莉雅·潘德拉贡");
  await app.evaluate(({ ipcMain }) => {
    ipcMain.removeHandler("desktop:request-json");
    ipcMain.handle("desktop:request-json", () => ({
      status: 200,
      body: JSON.stringify({
        tag_name: "v0.5.0",
        assets: [{ name: "app.apk", state: "uploaded" }],
      }),
    }));
  });
  await page.locator('[data-path="updateRepository"]').fill("tester/fgo");
  await act("check-update").click();
  await page
    .getByText("该发布尚未附加 Windows 安装文件，暂时无法从此发布下载安装。", {
      exact: true,
    })
    .waitFor();
  await app.evaluate(({ ipcMain }) => {
    ipcMain.removeHandler("desktop:request-json");
    ipcMain.handle("desktop:request-json", () => ({
      status: 200,
      body: JSON.stringify({
        tag_name: "v0.5.0",
        assets: [{ name: "FGO-Solo-Windows-0.5.0-x64.zip", state: "uploaded" }],
      }),
    }));
  });
  await act("check-update").click();
  await page.waitForFunction(() =>
    document.querySelector("#update-status").textContent.includes("发现新版本"),
  );
  assert.equal(
    await page
      .getByText(
        "该发布尚未附加 Windows 安装文件，暂时无法从此发布下载安装。",
        { exact: true },
      )
      .count(),
    0,
  );
  await act("open-release").click();
  assert.equal(
    (await app.evaluate(() => globalThis.opened)).at(-1),
    "https://github.com/tester/fgo/releases/tag/v0.5.0",
  );
  await app.close();
  app = await launch();
  page = await app.firstWindow();
  page.on("pageerror", (e) => errors.push(e.message));
  await page.locator('[data-action="start-calculation"]').click();
  assert.equal(await field("extraAttack").inputValue(), "4321");
  assert.ok(
    await page.evaluate(() =>
      document
        .querySelector("#background")
        .style.backgroundImage.startsWith("url("),
    ),
  );
  await field("extraAttack").fill("1234");
  await page.locator("#open-settings").click();
  page.on("dialog", (d) => d.accept());
  await page.locator("#backup-file").setInputFiles(backupPath);
  // Import confirmation may appear synchronously after file reading.
  await page.waitForFunction(() =>
    document.querySelector("#toast").textContent.includes("导入完成"),
  );
  await act("close-settings").click();
  await page.locator('[data-action="step"][data-value="0"]').click();
  assert.equal(await field("extraAttack").inputValue(), "4321");
  await app.evaluate(({ BrowserWindow }) =>
    BrowserWindow.getAllWindows()[0].setSize(520, 740),
  );
  assert.ok(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  );
  await page.screenshot({
    path: path.join(out, "03-narrow.png"),
    fullPage: true,
  });
  assert.deepEqual(errors, []);
  console.log(
    "PASS Windows desktop: actual native window, calculation, background, native save, import, restart persistence, browser bridge, network whitelist, live Atlas/Mooncell, Windows updates and narrow layout.",
  );
} finally {
  await app.close();
}
