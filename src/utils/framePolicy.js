/**
 * Можно ли встроить URL во iframe чужого origin по заголовкам ответа.
 * Зеркало логики Edge `portfolio-embed-probe`.
 */

/**
 * @param {string | null | undefined} xfoRaw
 * @returns {boolean | null} false = нельзя; null = заголовка нет
 */
export function canFrameFromXfo(xfoRaw) {
  if (xfoRaw == null || !String(xfoRaw).trim()) return null;
  const value = String(xfoRaw).trim().toLowerCase();
  if (value === "deny") return false;
  if (value === "sameorigin") return false;
  if (value.startsWith("allow-from")) return false;
  return false;
}

/**
 * @param {string | null | undefined} cspRaw
 * @param {string} embedderOrigin
 * @returns {boolean | null} false = нельзя; true = явно можно; null = нет frame-ancestors
 */
export function canFrameFromCsp(cspRaw, embedderOrigin) {
  if (cspRaw == null || !String(cspRaw).trim()) return null;
  const frameAncestors = String(cspRaw)
    .split(";")
    .map((d) => d.trim())
    .find((d) => /^frame-ancestors\b/i.test(d));
  if (!frameAncestors) return null;

  const tokens = frameAncestors
    .replace(/^frame-ancestors\b/i, "")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((t) => t.toLowerCase());

  if (tokens.length === 0) return null;
  if (tokens.includes("'none'")) return false;
  if (tokens.includes("*")) return true;

  let embedder;
  try {
    embedder = new URL(embedderOrigin).origin.toLowerCase();
  } catch {
    return false;
  }

  for (const token of tokens) {
    if (token === "'self'") continue;
    if (token === embedder) return true;
    try {
      if (new URL(token).origin.toLowerCase() === embedder) return true;
    } catch {
      // scheme-source / host-source без схемы — грубое сравнение хвоста
      const host = embedder.replace(/^https?:\/\//, "");
      if (token === host || host.endsWith(token.replace(/^\*\./, "."))) {
        return true;
      }
    }
  }
  return false;
}

/**
 * @param {{
 *   xFrameOptions?: string | null,
 *   csp?: string | null,
 *   cspReportOnly?: string | null,
 * }} headers
 * @param {string} embedderOrigin
 * @returns {{ canFrame: boolean, reason: string }}
 */
export function resolveFramePolicy(headers, embedderOrigin) {
  const xfo = canFrameFromXfo(headers.xFrameOptions);
  if (xfo === false) {
    return { canFrame: false, reason: "xfo" };
  }

  const csp =
    canFrameFromCsp(headers.csp, embedderOrigin) ??
    canFrameFromCsp(headers.cspReportOnly, embedderOrigin);
  if (csp === false) {
    return { canFrame: false, reason: "csp" };
  }
  if (csp === true) {
    return { canFrame: true, reason: "csp_allow" };
  }

  return { canFrame: true, reason: "default_allow" };
}
