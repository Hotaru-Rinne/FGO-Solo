// Public JSON requests use native HTTPS on Windows, including Mooncell.
export async function dataFetch(url, options = {}) {
  if (!globalThis.Desktop?.requestJson) return fetch(url, options);
  const id = crypto.randomUUID(),
    signal = options.signal;
  signal?.throwIfAborted();
  const abort = () => globalThis.Desktop.cancelRequest(id);
  signal?.addEventListener("abort", abort, { once: true });
  try {
    const result = await globalThis.Desktop.requestJson(id, String(url));
    signal?.throwIfAborted();
    return {
      ok: result.status >= 200 && result.status < 300,
      status: result.status,
      json: async () => JSON.parse(result.body),
    };
  } finally {
    signal?.removeEventListener("abort", abort);
  }
}
