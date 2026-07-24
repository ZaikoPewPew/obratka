import locales from "../content/locales.json";
import founderAvatars from "../content/founder-avatars.json";

const STORAGE_KEY = "obratka.locale";

/** Самоназвание языка для aria-label и UI. */
export const LOCALE_NATIVE_NAMES = {
  ru: "Русский",
  en: "English",
};

/**
 * Следующая локаль в порядке `supportedLocales` (цикл).
 * @param {string} current
 * @returns {string}
 */
export function getNextLocale(current) {
  const list = locales.supportedLocales;
  let i = list.indexOf(current);
  if (i < 0) {
    i = list.indexOf(locales.defaultLocale);
  }
  if (i < 0) {
    i = 0;
  }
  return list[(i + 1) % list.length];
}

/** Порядок языков (как в `supportedLocales`). */
export function getSupportedLocales() {
  return [...locales.supportedLocales];
}

export function getDefaultLocale() {
  return locales.defaultLocale;
}

/**
 * Текущая локаль: ?lang= → localStorage → defaultLocale.
 * Новые языки — в content/locales.json (supportedLocales + блок locales).
 */
export function getLocale() {
  const supported = locales.supportedLocales;
  const params = new URLSearchParams(window.location.search);
  const fromUrl = params.get("lang");
  if (fromUrl && supported.includes(fromUrl)) {
    return fromUrl;
  }
  try {
    const fromStorage = window.localStorage.getItem(STORAGE_KEY);
    if (fromStorage && supported.includes(fromStorage)) {
      return fromStorage;
    }
  } catch {
    /* ignore */
  }
  return locales.defaultLocale;
}

/**
 * Сохраняет локаль и обновляет URL (?lang= для не-default).
 * @param {string} next
 */
export function setLocale(next) {
  const supported = locales.supportedLocales;
  if (!supported.includes(next)) {
    return;
  }
  try {
    window.localStorage.setItem(STORAGE_KEY, next);
  } catch {
    /* ignore */
  }
  const url = new URL(window.location.href);
  if (next === locales.defaultLocale) {
    url.searchParams.delete("lang");
  } else {
    url.searchParams.set("lang", next);
  }
  window.location.href = url.toString();
}

/**
 * @param {string} [locale]
 * @returns {Record<string, string>}
 */
export function getStrings(locale = getLocale()) {
  const block = locales.locales[locale];
  if (block) {
    return block;
  }
  return locales.locales[locales.defaultLocale];
}

/**
 * Подстановка `{name}` / `{next}` и т.п.
 * @param {string} template
 * @param {Record<string, string | number>} [vars]
 */
export function formatString(template, vars = {}) {
  return String(template).replace(/\{(\w+)\}/g, (_, key) =>
    vars[key] == null ? "" : String(vars[key]),
  );
}

/**
 * Применяет строки ко всему UI: data-i18n, data-i18n-aria, data-i18n-title, document.title/lang.
 * @param {string} [locale]
 */
export function applyDocumentI18n(locale = getLocale()) {
  const t = getStrings(locale);
  document.documentElement.lang = locale;
  if (t.metaTitle) {
    document.title = t.metaTitle;
  }

  document.querySelectorAll("[data-i18n]").forEach((el) => {
    const key = el.getAttribute("data-i18n");
    if (key && t[key] != null) {
      el.textContent = t[key];
    }
  });

  document.querySelectorAll("[data-i18n-aria]").forEach((el) => {
    const key = el.getAttribute("data-i18n-aria");
    if (key && t[key] != null) {
      el.setAttribute("aria-label", t[key]);
    }
  });

  document.querySelectorAll("[data-i18n-title]").forEach((el) => {
    const key = el.getAttribute("data-i18n-title");
    if (key && t[key] != null) {
      el.setAttribute("title", t[key]);
    }
  });

  return t;
}

/** Источники аватаров из `content/founder-avatars.json`. */
export function getFounderAvatarSources() {
  const list = founderAvatars.sources;
  return Array.isArray(list) ? list : [];
}

let shuffledAvatarSourcesCache = null;

function getFounderAvatarPickCount() {
  const n = founderAvatars.pickCount;
  return typeof n === "number" && n > 0 ? Math.floor(n) : 4;
}

/** Shuffle once per page load — стек аватаров на `/referral`. */
export function getFounderAvatarSourcesForPage() {
  if (shuffledAvatarSourcesCache) {
    return shuffledAvatarSourcesCache;
  }
  const pool = [...getFounderAvatarSources()];
  for (let i = pool.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  const k = Math.min(getFounderAvatarPickCount(), pool.length);
  shuffledAvatarSourcesCache = pool.slice(0, k);
  return shuffledAvatarSourcesCache;
}
