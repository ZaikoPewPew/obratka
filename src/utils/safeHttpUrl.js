/**
 * Allowlist for assigning untrusted strings to img.src / similar sinks.
 * Only http(s) with a hostname; blocks javascript:, data:, blob:, etc.
 * @param {unknown} raw
 * @returns {string | null}
 */
export function safeHttpUrl(raw) {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  if (!trimmed || trimmed.length > 2048) return null;
  let parsed;
  try {
    parsed = new URL(trimmed);
  } catch {
    return null;
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
  if (!parsed.hostname) return null;
  return parsed.href;
}
