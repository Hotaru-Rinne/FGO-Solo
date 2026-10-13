const { contextBridge, ipcRenderer } = require("electron");
contextBridge.exposeInMainWorld(
  "Desktop",
  Object.freeze({
    platform: "windows",
    openExternal: (url) => ipcRenderer.invoke("desktop:open-external", url),
    exportBackup: (name, json) =>
      ipcRenderer.invoke("desktop:export-backup", name, json),
    requestJson: (id, url) =>
      ipcRenderer.invoke("desktop:request-json", id, url),
    cancelRequest: (id) => ipcRenderer.send("desktop:cancel-request", id),
  }),
);
