import fs from "node:fs/promises";
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
  const page = await browser.newPage();
  const svg = await fs.readFile(
    new URL("../public/icon.svg", import.meta.url),
    "utf8",
  );
  await page.setContent(
    "<style>html,body{margin:0;background:transparent}svg{display:block;width:100vw;height:100vh}</style>" +
      svg,
  );
  const sizes = [16, 32, 48, 64, 128, 256],
    images = [];
  for (const size of sizes) {
    await page.setViewportSize({ width: size, height: size });
    images.push(await page.screenshot({ omitBackground: true }));
  }
  const header = Buffer.alloc(6 + 16 * sizes.length);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(sizes.length, 4);
  let offset = header.length;
  images.forEach((png, i) => {
    const at = 6 + 16 * i;
    header[at] = header[at + 1] = sizes[i] === 256 ? 0 : sizes[i];
    header.writeUInt16LE(1, at + 4);
    header.writeUInt16LE(32, at + 6);
    header.writeUInt32LE(png.length, at + 8);
    header.writeUInt32LE(offset, at + 12);
    offset += png.length;
  });
  await fs.writeFile(
    new URL("../windows/icon.ico", import.meta.url),
    Buffer.concat([header, ...images]),
  );
  await fs.writeFile(
    new URL("../windows/icon.png", import.meta.url),
    images.at(-1),
  );
} finally {
  await browser.close();
}
