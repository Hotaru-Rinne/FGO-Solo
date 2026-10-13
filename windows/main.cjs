const {
  app,
  BrowserWindow,
  protocol,
  ipcMain,
  shell,
  dialog,
  session,
  screen,
} = require("electron");
const fs = require("node:fs/promises");
const path = require("node:path");
const https = require("node:https");
const { ORIGIN, externalUrl, apiUrl, assetPath } = require("./policy.cjs");
const ROOT = path.resolve(__dirname, ".."),
  HOME = ORIGIN + "/index.html";
const meta = require("../package.json");
app.setName("一骑千筹");
app.setAppUserModelId("cn.fgosolo.calculator.windows");
const override = app.commandLine.getSwitchValue("user-data-dir");
app.setPath(
  "userData",
  override
    ? path.resolve(override)
    : path.join(app.getPath("appData"), "FGO-Solo"),
);
protocol.registerSchemesAsPrivileged([
  {
    scheme: "fgosolo",
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      corsEnabled: true,
    },
  },
]);
let window;
const requests = new Map();
const lock = app.requestSingleInstanceLock();
if (!lock) app.quit();
else {
  app.on("second-instance", () => {
    if (window) {
      if (window.isMinimized()) window.restore();
      window.show();
      window.focus();
    }
  });
  app
    .whenReady()
    .then(start)
    .catch((error) => {
      dialog.showErrorBox("一骑千筹启动失败", error.message);
      app.quit();
    });
}
function trusted(event) {
  if (
    !window ||
    event.sender !== window.webContents ||
    event.senderFrame !== event.sender.mainFrame ||
    event.senderFrame.url !== HOME
  )
    throw Error("拒绝非本地页面请求");
}
async function start() {
  protocol.handle("fgosolo", async (request) => {
    try {
      const file = assetPath(request.url, ROOT);
      const mime =
        {
          ".html": "text/html",
          ".js": "text/javascript",
          ".json": "application/json",
          ".css": "text/css",
          ".svg": "image/svg+xml",
          ".txt": "text/plain",
          ".png": "image/png",
          ".ico": "image/x-icon",
        }[path.extname(file)] || "application/octet-stream";
      return new Response(await fs.readFile(file), {
        headers: {
          "Content-Type": mime + "; charset=utf-8",
          "Cache-Control": "no-store",
        },
      });
    } catch {
      return new Response("Not found", { status: 404 });
    }
  });
  session.defaultSession.setPermissionRequestHandler(
    (_wc, _permission, callback) => callback(false),
  );
  session.defaultSession.setPermissionCheckHandler(() => false);
  // All data requests go through the limited native JSON bridge.
  session.defaultSession.webRequest.onBeforeRequest((details, callback) => {
    callback({
      cancel: !["fgosolo:", "data:", "blob:", "devtools:"].some((p) =>
        details.url.startsWith(p),
      ),
    });
  });
  ipcMain.handle("desktop:open-external", async (event, url) => {
    trusted(event);
    await shell.openExternal(externalUrl(url));
    return true;
  });
  ipcMain.handle("desktop:export-backup", async (event, name, json) => {
    trusted(event);
    if (
      typeof json !== "string" ||
      Buffer.byteLength(json, "utf8") > 20 * 1024 * 1024
    )
      throw Error("备份文件不能超过20MB");
    const backup = JSON.parse(json);
    if (backup.format !== "fgo-solo-backup") throw Error("无效备份");
    const chosen = await dialog.showSaveDialog(window, {
      title: "保存一骑千筹备份",
      defaultPath: path.join(
        app.getPath("documents"),
        path.basename(String(name)).replace(/[<>:"|?*]/g, "_"),
      ),
      filters: [{ name: "计算器备份", extensions: ["json"] }],
    });
    if (chosen.canceled || !chosen.filePath) return { cancelled: true };
    await fs.writeFile(chosen.filePath, json, "utf8");
    return { cancelled: false };
  });
  ipcMain.handle("desktop:request-json", (event, id, url) => {
    trusted(event);
    if (
      typeof id !== "string" ||
      !/^[a-zA-Z0-9-]{1,80}$/.test(id) ||
      requests.has(id) ||
      requests.size >= 12
    )
      throw Error("无效请求");
    return requestJson(id, apiUrl(url));
  });
  ipcMain.on("desktop:cancel-request", (event, id) => {
    trusted(event);
    requests.get(id)?.destroy(Error("已取消请求"));
  });
  const work = screen.getPrimaryDisplay().workArea;
  let saved = {};
  try {
    saved = JSON.parse(
      await fs.readFile(
        path.join(app.getPath("userData"), "window.json"),
        "utf8",
      ),
    );
  } catch {}
  const width = Math.max(
    460,
    Math.min(Number(saved.width) || 1160, work.width),
  );
  const height = Math.max(
    580,
    Math.min(Number(saved.height) || 860, work.height),
  );
  const bounds = { width, height };
  if (
    Number.isFinite(saved.x) &&
    Number.isFinite(saved.y) &&
    screen
      .getAllDisplays()
      .some(
        (d) =>
          saved.x + width > d.workArea.x &&
          saved.x < d.workArea.x + d.workArea.width &&
          saved.y >= d.workArea.y &&
          saved.y < d.workArea.y + d.workArea.height - 60,
      )
  ) {
    bounds.x = saved.x;
    bounds.y = saved.y;
  }
  window = new BrowserWindow({
    ...bounds,
    minWidth: 460,
    minHeight: 580,
    title: "一骑千筹",
    backgroundColor: "#f4f5ef",
    icon: path.join(__dirname, "icon.ico"),
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      webSecurity: true,
    },
  });
  window.removeMenu();
  window.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  window.webContents.on("will-navigate", (event, url) => {
    if (url !== HOME) event.preventDefault();
  });
  window.webContents.on("will-attach-webview", (event) =>
    event.preventDefault(),
  );
  window.webContents.on("before-input-event", (event, input) => {
    if (input.type === "keyDown" && input.key === "F11") {
      event.preventDefault();
      window.setFullScreen(!window.isFullScreen());
    }
  });
  window.on("page-title-updated", (event) => event.preventDefault());
  window.once("ready-to-show", () => {
    if (saved.maximized) window.maximize();
    window.show();
  });
  window.on("close", () => {
    const state = {
      ...window.getNormalBounds(),
      maximized: window.isMaximized(),
    };
    require("node:fs").writeFileSync(
      path.join(app.getPath("userData"), "window.json"),
      JSON.stringify(state),
    );
  });
  window.on("closed", () => {
    window = null;
  });
  await window.loadURL(HOME);
}
function requestJson(id, url) {
  return new Promise((resolve, reject) => {
    const request = https.get(
      url,
      {
        headers: {
          "User-Agent": "FGO-Solo/" + meta.version + " (Windows; public data)",
          Accept: "application/json",
        },
      },
      (response) => {
        const chunks = [];
        let bytes = 0;
        response.on("data", (chunk) => {
          bytes += chunk.length;
          if (bytes > 20 * 1024 * 1024) request.destroy(Error("数据响应过大"));
          else chunks.push(chunk);
        });
        response.on("error", reject);
        response.on("end", () =>
          resolve({
            status: response.statusCode,
            body: Buffer.concat(chunks).toString("utf8"),
          }),
        );
      },
    );
    requests.set(id, request);
    const timeout = setTimeout(
      () => request.destroy(Error("请求超时，请检查网络后重试")),
      20000,
    );
    request.on("error", reject);
    request.on("close", () => {
      clearTimeout(timeout);
      requests.delete(id);
    });
  });
}
app.on("window-all-closed", () => app.quit());
app.on("before-quit", () => {
  for (const req of requests.values()) req.destroy();
});
