export const PROFILE_DISPLAY_NAME_MAX = 80;
export const PROFILE_WORKPLACE_MAX = 120;
export const PROFILE_TELEGRAM_USERNAME_RE = /^[A-Za-z0-9_]{5,32}$/;

/** @type {ReadonlySet<string>} */
export const PROFILE_ROLE_VALUES = Object.freeze(
  new Set([
    "web-designer",
    "product-designer",
    "emotional-designer",
    "ux-ui-designer",
    "other",
  ]),
);

/**
 * @param {unknown} value
 * @returns {string}
 */
function asTrimmedString(value) {
  return typeof value === "string" ? value.trim() : "";
}

/**
 * Нормализует контактный Telegram username (без @). Пусто → null.
 * @param {unknown} value
 * @returns {{ ok: true; value: string | null } | { ok: false; error: string }}
 */
export function normalizeTelegramUsername(value) {
  let raw = asTrimmedString(value);
  if (!raw) return { ok: true, value: null };
  if (raw.startsWith("@")) raw = raw.slice(1).trim();
  if (!raw) return { ok: true, value: null };
  if (!PROFILE_TELEGRAM_USERNAME_RE.test(raw)) {
    return { ok: false, error: "invalid_telegram_username" };
  }
  return { ok: true, value: raw };
}

/**
 * @param {unknown} value
 * @returns {{ ok: true; value: string } | { ok: false; error: string }}
 */
export function normalizeDisplayName(value) {
  const name = asTrimmedString(value);
  if (!name) return { ok: false, error: "display_name_required" };
  if (name.length > PROFILE_DISPLAY_NAME_MAX) {
    return { ok: false, error: "display_name_too_long" };
  }
  return { ok: true, value: name };
}

/**
 * @param {unknown} value
 * @returns {{ ok: true; value: string | null } | { ok: false; error: string }}
 */
export function normalizeWorkplace(value) {
  const workplace = asTrimmedString(value);
  if (!workplace) return { ok: true, value: null };
  if (workplace.length > PROFILE_WORKPLACE_MAX) {
    return { ok: false, error: "workplace_too_long" };
  }
  return { ok: true, value: workplace };
}

/**
 * @param {unknown} value
 * @returns {{ ok: true; value: string } | { ok: false; error: string }}
 */
export function normalizeProfileRole(value) {
  const role = asTrimmedString(value);
  if (!role || !PROFILE_ROLE_VALUES.has(role)) {
    return { ok: false, error: "invalid_role" };
  }
  return { ok: true, value: role };
}

/**
 * Клиентский allowlist для `/settings`. Системные поля (email, grade, …) отбрасываются.
 *
 * @param {Record<string, unknown>} input
 * @returns {{
 *   ok: true;
 *   patch: {
 *     display_name: string;
 *     telegram_username: string | null;
 *     role: string;
 *     workplace: string | null;
 *   };
 * } | {
 *   ok: false;
 *   error: string;
 * }}
 */
export function normalizeProfileSettings(input) {
  const raw =
    input && typeof input === "object" ? /** @type {Record<string, unknown>} */ (input) : {};

  const displayName = normalizeDisplayName(raw.display_name ?? raw.displayName);
  if (!displayName.ok) return displayName;

  const telegram = normalizeTelegramUsername(
    raw.telegram_username ?? raw.telegramUsername,
  );
  if (!telegram.ok) return telegram;

  const role = normalizeProfileRole(raw.role);
  if (!role.ok) return role;

  const workplace = normalizeWorkplace(raw.workplace);
  if (!workplace.ok) return workplace;

  return {
    ok: true,
    patch: {
      display_name: displayName.value,
      telegram_username: telegram.value,
      role: role.value,
      workplace: workplace.value,
    },
  };
}
