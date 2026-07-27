import rulesDoc from "../../content/rules.json";
import { getDefaultLocale, getLocale } from "../i18n.js";

/**
 * @typedef {{
 *   title: string;
 *   updated: string;
 *   intro: string;
 *   sections: Array<{ title: string; body: string }>;
 * }} CommunityRulesCopy
 */

/**
 * Локализованные правила сообщества из `content/rules.json`.
 * @param {string} [locale]
 * @returns {CommunityRulesCopy}
 */
export function getCommunityRules(locale = getLocale()) {
  const fallback =
    rulesDoc.locales?.[rulesDoc.defaultLocale] ??
    rulesDoc.locales?.[getDefaultLocale()] ??
    null;
  const pack = rulesDoc.locales?.[locale] ?? fallback;

  if (!pack || typeof pack !== "object") {
    return {
      title: "",
      updated: "",
      intro: "",
      sections: [],
    };
  }

  const sections = Array.isArray(pack.sections)
    ? pack.sections
        .filter((item) => item && typeof item === "object")
        .map((item) => ({
          title: typeof item.title === "string" ? item.title : "",
          body: typeof item.body === "string" ? item.body : "",
        }))
    : [];

  return {
    title: typeof pack.title === "string" ? pack.title : "",
    updated: typeof pack.updated === "string" ? pack.updated : "",
    intro: typeof pack.intro === "string" ? pack.intro : "",
    sections,
  };
}
