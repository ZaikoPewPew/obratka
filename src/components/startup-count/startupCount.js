import { getStartups } from "../../i18n.js";

/**
 * Количество стартапов в базе — одно значение из `content/startups.json` (поле `count`),
 * форматирование зависит от локали.
 * @param {string} locale
 * @returns {string}
 */
const LOCALE_TO_BCP47 = {
  ru: "ru-RU",
  en: "en-US",
  de: "de-DE",
  fr: "fr-FR",
  pt: "pt-BR",
  es: "es-ES",
};

export function getFormattedStartupCount(locale) {
  const { count } = getStartups();
  const tag = LOCALE_TO_BCP47[locale] || "en-US";
  return count.toLocaleString(tag);
}

/**
 * Подставляет отформатированное число в шаблон: сегменты текста и `span.startup-count`.
 * @param {HTMLElement} parent
 * @param {string} template — может содержать один или несколько `{count}`
 * @param {string} countFormatted
 */
export function fillCountTemplate(parent, template, countFormatted) {
  parent.textContent = "";
  const parts = String(template).split("{count}");
  parts.forEach((part, i) => {
    parent.append(document.createTextNode(part));
    if (i < parts.length - 1) {
      const span = document.createElement("span");
      span.className = "startup-count";
      span.textContent = countFormatted;
      parent.append(span);
    }
  });
}
