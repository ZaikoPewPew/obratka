/**
 * Категория множественного числа (CLDR-ish): `one` / `few` / `many` / `other`.
 * @param {number | string} count
 * @param {string} [locale]
 * @returns {"one" | "few" | "many" | "other"}
 */
export function pluralCategory(count, locale = "ru") {
  const n = Math.abs(Math.trunc(Number(count)));
  const safe = Number.isFinite(n) ? n : 0;
  const lang = String(locale).split("-")[0];
  if (lang === "ru" || lang === "uk" || lang === "be") {
    const mod10 = safe % 10;
    const mod100 = safe % 100;
    if (mod10 === 1 && mod100 !== 11) {
      return "one";
    }
    if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) {
      return "few";
    }
    return "many";
  }
  return safe === 1 ? "one" : "other";
}

/**
 * Выбирает шаблон по `pluralCategory` и подставляет `{name}` / `{balance}` и т.п.
 * @param {{ one?: string, few?: string, many?: string, other?: string }} forms
 * @param {number | string} count
 * @param {Record<string, string | number>} [vars]
 * @param {string} [locale]
 */
export function formatPlural(forms, count, vars = {}, locale = "ru") {
  const cat = pluralCategory(count, locale);
  const template =
    forms[cat] ?? forms.other ?? forms.many ?? forms.few ?? forms.one ?? "";
  return String(template).replace(/\{(\w+)\}/g, (_, key) =>
    vars[key] == null ? "" : String(vars[key]),
  );
}
