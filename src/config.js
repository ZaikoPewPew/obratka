/** Число, которое подставляется в счётчик/заголовки (единый источник вместо данных стартапов). */
export const WAITLIST_DISPLAY_COUNT = 100;

const LOCALE_TO_BCP47 = {
  ru: "ru-RU",
  en: "en-US",
  de: "de-DE",
  fr: "fr-FR",
  pt: "pt-BR",
  es: "es-ES",
};

/**
 * Форматирует `WAITLIST_DISPLAY_COUNT` по локали.
 * @param {string} locale
 * @returns {string}
 */
export function getFormattedDisplayCount(locale) {
  const tag = LOCALE_TO_BCP47[locale] || "en-US";
  return WAITLIST_DISPLAY_COUNT.toLocaleString(tag);
}
