import { hrefForRoute } from "../app/routes.js";

/** Сколько друзей может пригласить один пользовательский код. */
export const REFERRAL_MAX_USES = 2;

/**
 * Нормализация кода или URL с `?ref=`.
 * @param {string} raw
 * @returns {string | null}
 */
export function normalizeReferralCode(raw) {
  let value = String(raw ?? "").trim();
  if (!value) return null;

  try {
    const url = new URL(value);
    const ref = url.searchParams.get("ref");
    if (ref) value = ref;
  } catch {
    const match = value.match(/[?&]ref=([^&#]+)/i);
    if (match?.[1]) {
      try {
        value = decodeURIComponent(match[1]);
      } catch {
        value = match[1];
      }
    }
  }

  const code = value.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
  return code || null;
}

/**
 * Абсолютная ссылка для шаринга (referral + ?ref=).
 * @param {string} code
 * @returns {string}
 */
export function buildReferralShareUrl(code) {
  const normalized = normalizeReferralCode(code) || String(code || "").trim();
  const baseUrl =
    (typeof import.meta !== "undefined" &&
      import.meta.env &&
      import.meta.env.BASE_URL) ||
    "/";
  const path = hrefForRoute("referral", {
    baseUrl,
    search: { ref: normalized },
  });
  if (typeof window === "undefined" || !window.location?.origin) {
    return path;
  }
  return new URL(path, window.location.origin).href;
}
