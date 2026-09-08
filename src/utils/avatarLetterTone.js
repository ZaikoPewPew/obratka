/** @type {number} Должно совпадать с --home-screen-avatar-letter-tone-count. */
export const AVATAR_LETTER_TONE_COUNT = 8;

/** Имя CSS-переменной фона letter-аватара (переопределяется на элементе). */
export const AVATAR_LETTER_BG_VAR = "--home-screen-avatar-letter-bg";

/**
 * Детерминированная 32-битная строковая хеш-функция (без Math.random()).
 * @param {string} str
 * @returns {number}
 */
function hashString(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i += 1) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

/**
 * Индекс тона letter-аватара (0..AVATAR_LETTER_TONE_COUNT-1) по seed.
 * @param {string | null | undefined} seed
 * @returns {number}
 */
export function getAvatarLetterToneIndex(seed) {
  const text = String(seed || "").trim();
  if (!text) return 0;
  return hashString(text) % AVATAR_LETTER_TONE_COUNT;
}

/**
 * Назначает tone фона letter-аватара через CSS-переменную на элементе.
 * Надёжнее modifier-классов: `.home-screen__badge--letter` / slot читают
 * `var(--home-screen-avatar-letter-bg)` без борьбы специфичности с `--completed`.
 *
 * @param {HTMLElement} el
 * @param {string | null | undefined} seed
 */
export function applyAvatarLetterTone(el, seed) {
  const index = getAvatarLetterToneIndex(seed);
  el.style.setProperty(
    AVATAR_LETTER_BG_VAR,
    `var(--home-screen-avatar-letter-tone-${index})`,
  );
}
