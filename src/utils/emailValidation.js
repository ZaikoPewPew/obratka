/** RFC-подобный лимит строки email */
export const EMAIL_MAX_LENGTH = 254;

/**
 * HTML `pattern` (упрощённо, без экзотики вроде кавычек в local-part).
 * Должен быть согласован с {@link isValidEmail}.
 */
export const EMAIL_PATTERN_ATTR = String.raw`[^\s@]+@[^\s@]+\.[^\s@]{2,}`;

/**
 * Проверка формата: обязателен ровно один `@`, домен с точкой, TLD ≥ 2 символов,
 * допустимые символы в local-part и метках домена (ASCII waitlist).
 * Строки вроде «penis» без `@` отклоняются.
 *
 * @param {unknown} raw
 * @returns {boolean}
 */
export function isValidEmail(raw) {
  const s = String(raw).trim();
  if (!s || s.length > EMAIL_MAX_LENGTH) {
    return false;
  }
  const ats = s.match(/@/g);
  if (!ats || ats.length !== 1) {
    return false;
  }
  const [local, domain] = s.split("@");
  if (!local || !domain || local.length > 64 || domain.length > 253) {
    return false;
  }
  if (!domain.includes(".")) {
    return false;
  }
  if (!/^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+$/.test(local)) {
    return false;
  }
  const labels = domain.split(".");
  const tld = labels[labels.length - 1];
  if (!tld || tld.length < 2 || tld.length > 63 || !/^[a-zA-Z0-9]+$/.test(tld)) {
    return false;
  }
  for (const label of labels) {
    if (
      !label ||
      label.length > 63 ||
      !/^[a-zA-Z0-9](?:[a-zA-Z0-9-]*[a-zA-Z0-9])?$/.test(label)
    ) {
      return false;
    }
  }
  return true;
}

/**
 * @param {string} email
 * @returns {string}
 */
export function normalizeEmail(email) {
  return String(email).trim().toLowerCase();
}
