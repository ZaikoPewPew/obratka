import { getStartups } from "../../i18n.js";

/**
 * Количество стартапов в базе — одно значение из `content/startups.json` (поле `count`),
 * форматирование зависит от локали.
 * @param {string} locale
 * @returns {string}
 */
export function getFormattedStartupCount(locale) {
  const { count } = getStartups();
  return count.toLocaleString(locale === "ru" ? "ru-RU" : "en-US");
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
