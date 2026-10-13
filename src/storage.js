const KEY = "fgo-solo-v1";
export function loadLocal() {
  try {
    return JSON.parse(localStorage.getItem(KEY) || "null");
  } catch {
    return null;
  }
}
export function saveLocal(session, settings) {
  localStorage.setItem(KEY, JSON.stringify({ version: 1, session, settings }));
}
function database() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open("fgo-solo-media", 2);
    req.onupgradeneeded = () => {
      for (const name of ["images", "servants"])
        if (!req.result.objectStoreNames.contains(name))
          req.result.createObjectStore(name);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
export async function getBackground() {
  const db = await database();
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction("images", "readonly");
      const req = tx.objectStore("images").get("background");
      req.onsuccess = () => resolve(req.result ?? null);
      req.onerror = () => reject(req.error);
    });
  } finally {
    db.close();
  }
}
export async function setBackground(data) {
  const db = await database();
  try {
    await new Promise((resolve, reject) => {
      const tx = db.transaction("images", "readwrite");
      const store = tx.objectStore("images");
      if (data) store.put(data, "background");
      else store.delete("background");
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}
export async function prepareImage(file) {
  if (file.size > 25 * 1024 * 1024)
    throw new Error("请选择小于 25 MB 的图片。");
  if (!file.type.startsWith("image/")) throw new Error("请选择图片文件。");
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    const scale = Math.min(1, 1800 / Math.max(image.width, image.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(image.width * scale));
    canvas.height = Math.max(1, Math.round(image.height * scale));
    canvas.getContext("2d").drawImage(image, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/jpeg", 0.85);
  } finally {
    URL.revokeObjectURL(url);
  }
}

export async function getImportedServants() {
  const db = await database();
  try {
    return await new Promise((resolve, reject) => {
      const req = db
        .transaction("servants", "readonly")
        .objectStore("servants")
        .getAll();
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  } finally {
    db.close();
  }
}
export async function storeImportedServant(servant) {
  const db = await database();
  try {
    await new Promise((resolve, reject) => {
      const tx = db.transaction("servants", "readwrite");
      tx.objectStore("servants").put(servant, String(servant.id));
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}
export async function replaceImportedServants(servants) {
  const db = await database();
  try {
    await new Promise((resolve, reject) => {
      const tx = db.transaction("servants", "readwrite");
      const store = tx.objectStore("servants");
      store.clear();
      for (const s of servants) store.put(s, String(s.id));
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}
