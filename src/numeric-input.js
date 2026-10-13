// Text inputs preserve a trailing dot while mobile IMEs compose decimal numbers.
export function parseNumericInput(text) {
  const normalized = String(text).normalize("NFKC").trim().replace(/,/g, ".");
  if (!normalized || ["-", "+", ".", "-.", "+."].includes(normalized))
    return null;
  if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(normalized)) return null;
  const value = Number(normalized);
  return Number.isFinite(value) ? value : null;
}
