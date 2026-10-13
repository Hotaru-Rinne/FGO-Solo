import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { checkForUpdate } from "../src/updates.js";
const { externalUrl, apiUrl, assetPath } = createRequire(import.meta.url)(
  "../windows/policy.cjs",
);
test("Windows bridge permits only public data routes and HTTP browser URLs", () => {
  assert.equal(
    apiUrl("https://api.atlasacademy.io/nice/JP/servant/100100"),
    "https://api.atlasacademy.io/nice/JP/servant/100100",
  );
  assert.ok(apiUrl("https://fgo.wiki/api.php?action=query&format=json"));
  assert.ok(apiUrl("https://api.github.com/repos/a/b/releases/latest"));
  for (const url of [
    "https://evil.com",
    "file:///C:/Windows/win.ini",
    "https://api.atlasacademy.io/other",
    "https://fgo.wiki/api.php?action=edit&format=json",
    "https://api.github.com/repos/a/b/releases/latest?x=1",
  ])
    assert.throws(() => apiUrl(url));
  for (const url of [
    "javascript:alert(1)",
    "file:///C:/",
    "https://user:pass@example.com",
  ])
    assert.throws(() => externalUrl(url));
});
test("Desktop local origin cannot access native source, metadata or escape its asset root", () => {
  assert.ok(
    assetPath("fgosolo://app/src/app.js", "C:/example").endsWith("app.js"),
  );
  for (const url of [
    "fgosolo://evil/src/app.js",
    "fgosolo://app/windows/main.cjs",
    "fgosolo://app/package.json",
    "fgosolo://app/src/%2e%2e%2fpackage.json",
    "fgosolo://app/src/%5c..%5cpackage.json",
  ])
    assert.throws(() => assetPath(url, "C:/example"));
});
test("Windows update must contain Windows files rather than Android APK or source ZIP", async () => {
  const check = (assets) =>
    checkForUpdate("a/b", {
      platform: "windows",
      currentVersion: "0.4.2",
      fetcher: async () => ({
        ok: true,
        status: 200,
        json: async () => ({
          tag_name: "v0.5.0",
          assets: assets.map((name) => ({ name, state: "uploaded" })),
        }),
      }),
    });
  assert.equal(
    (await check(["FGO-Solo.apk", "FGO-Solo-source.zip"])).hasDownload,
    false,
  );
  assert.equal(
    (await check(["FGO-Solo-Windows-0.5.0-x64.zip"])).hasDownload,
    true,
  );
  assert.equal((await check(["Setup.exe"])).hasDownload, true);
});
