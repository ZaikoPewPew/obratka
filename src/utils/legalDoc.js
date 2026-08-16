import privacyDoc from "../../content/privacy.json";
import rulesDoc from "../../content/rules.json";
import termsDoc from "../../content/terms.json";
import { getDefaultLocale, getLocale } from "../i18n.js";
import { fixHangingPrepositions } from "./hangingPrepositions.js";

/**
 * @typedef {{
 *   title: string;
 *   updated: string;
 *   intro: string;
 *   sections: Array<{ title: string; body: string }>;
 * }} LegalDocCopy
 *
 * @typedef {'rules' | 'privacy' | 'terms'} LegalDocId
 */

/**
 * @param {string} text
 * @param {string} className
 * @param {string} [tagName="p"]
 * @returns {HTMLElement}
 */
function createDocText(text, className, tagName = "p") {
  const el = document.createElement(tagName);
  el.className = className;
  el.textContent = fixHangingPrepositions(text ?? "");
  return el;
}

/**
 * Строки `body` (через `\n`) → маркированный список.
 * @param {string} body
 * @returns {HTMLElement | null}
 */
function createDocList(body) {
  const items = String(body ?? "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  if (items.length === 0) return null;
  if (items.length === 1) {
    return createDocText(items[0], "side-panel__section-body");
  }
  const list = document.createElement("ul");
  list.className = "side-panel__section-list";
  for (const item of items) {
    const li = document.createElement("li");
    li.className = "side-panel__section-item";
    li.textContent = fixHangingPrepositions(item);
    list.append(li);
  }
  return list;
}

/**
 * Локализованный пакет документа (`title` / `updated` / `intro` / `sections`).
 * @param {{ defaultLocale?: string, locales?: Record<string, unknown> } | null | undefined} doc
 * @param {string} [locale]
 * @returns {LegalDocCopy}
 */
export function getLocalizedDoc(doc, locale = getLocale()) {
  const fallback =
    doc?.locales?.[doc.defaultLocale] ??
    doc?.locales?.[getDefaultLocale()] ??
    null;
  const pack = doc?.locales?.[locale] ?? fallback;

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

/**
 * @param {string} [locale]
 * @returns {LegalDocCopy}
 */
export function getCommunityRules(locale = getLocale()) {
  return getLocalizedDoc(rulesDoc, locale);
}

/**
 * @param {string} [locale]
 * @returns {LegalDocCopy}
 */
export function getPrivacyPolicy(locale = getLocale()) {
  return getLocalizedDoc(privacyDoc, locale);
}

/**
 * @param {string} [locale]
 * @returns {LegalDocCopy}
 */
export function getTermsOfService(locale = getLocale()) {
  return getLocalizedDoc(termsDoc, locale);
}

/**
 * @param {LegalDocId} id
 * @param {string} [locale]
 * @returns {LegalDocCopy}
 */
export function getLegalDoc(id, locale = getLocale()) {
  if (id === "privacy") return getPrivacyPolicy(locale);
  if (id === "terms") return getTermsOfService(locale);
  return getCommunityRules(locale);
}

/**
 * Заполняет side-panel заголовком и секциями документа.
 * @param {{
 *   setTitle: (title: string) => void;
 *   setDescription: (description: string) => void;
 *   setCloseAriaLabel?: (label: string) => void;
 *   content: HTMLElement;
 * }} panel
 * @param {LegalDocCopy} pack
 * @param {string} [closeAria]
 */
export function fillSidePanelDoc(panel, pack, closeAria) {
  panel.setTitle(pack.title ?? "");
  panel.setDescription(fixHangingPrepositions(pack.updated ?? ""));
  if (closeAria != null && typeof panel.setCloseAriaLabel === "function") {
    panel.setCloseAriaLabel(closeAria);
  }

  /** @type {HTMLElement[]} */
  const nodes = [];
  if (pack.intro) {
    nodes.push(createDocText(pack.intro, "side-panel__intro"));
  }
  for (const section of pack.sections ?? []) {
    const wrap = document.createElement("section");
    wrap.className = "side-panel__section";
    if (section.title) {
      wrap.append(createDocText(section.title, "side-panel__section-title", "h3"));
    }
    if (section.body) {
      const bodyNode = createDocList(section.body);
      if (bodyNode) wrap.append(bodyNode);
    }
    nodes.push(wrap);
  }
  panel.content.replaceChildren(...nodes);
}
